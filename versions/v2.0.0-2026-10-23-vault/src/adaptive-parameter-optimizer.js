'use strict';
/**
 * adaptive-parameter-optimizer.js
 *
 * Implements an adaptive parameter-tuning feedback loop:
 *   - Tracks trade execution success/failure outcomes.
 *   - On failure or zero profit: adjusts parameters (tightens profit spread threshold, lowers gas cap, reduces slippage) to protect capital.
 *   - On success (net profit > 0): marks and saves current parameters as the "Golden Baseline".
 *   - Enforces hard safety bounds to prevent runaway configuration changes.
 */

const fs = require('fs');
const path = require('path');
const { PredictiveSimulator } = require('./predictive-simulator');

class AdaptiveParameterOptimizer {
  constructor({
    statePath = path.resolve(__dirname, '../data/adaptive_optimizer_state.json'),
    configPath = path.resolve(__dirname, '../revenue_streams_config.json'),
    initialParams = {
      minProfitSpread: 0.005, // 0.5%
      maxGasGwei: 50,          // 50 Gwei
      slippageTolerance: 0.003 // 0.3%
    },
    bounds = {
      minProfitSpread: { min: 0.001, max: 0.02 },
      maxGasGwei: { min: 15, max: 150 },
      slippageTolerance: { min: 0.001, max: 0.01 }
    },
    log = console
  } = {}) {
    this.statePath = statePath;
    this.configPath = configPath;
    this.bounds = bounds;
    this.log = log;
    this.simulator = new PredictiveSimulator();

    this.params = { ...initialParams };
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures = 0;
    this.goldenBaseline = { ...initialParams };
    this.history = [];

    this._loadState();
  }

  _loadState() {
    try {
      if (fs.existsSync(this.statePath)) {
        const raw = fs.readFileSync(this.statePath, 'utf8');
        const data = JSON.parse(raw);
        if (data.params) this.params = { ...data.params };
        if (data.goldenBaseline) this.goldenBaseline = { ...data.goldenBaseline };
        this.consecutiveSuccesses = data.consecutiveSuccesses || 0;
        this.consecutiveFailures = data.consecutiveFailures || 0;
      }
    } catch (err) {
      this.log.warn(`[HAL 1] [AdaptiveOptimizer] Failed to load state: ${err.message}. Using defaults.`);
    }
  }

  _saveState() {
    try {
      fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
      const snapshot = {
        timestamp: new Date().toISOString(),
        params: this.params,
        goldenBaseline: this.goldenBaseline,
        consecutiveSuccesses: this.consecutiveSuccesses,
        consecutiveFailures: this.consecutiveFailures
      };
      fs.writeFileSync(this.statePath, JSON.stringify(snapshot, null, 2));
    } catch (err) {
      this.log.error(`[HAL 3] [AdaptiveOptimizer] Failed to save state: ${err.message}`);
    }
  }

  getCurrentParams() {
    return { ...this.params };
  }

  getGoldenBaseline() {
    return { ...this.goldenBaseline };
  }

  async recordOutcome({ success, netProfitUSD = 0, gasGweiUsed = 0, reason = '' }) {
    const record = {
      timestamp: new Date().toISOString(),
      success,
      netProfitUSD,
      gasGweiUsed,
      reason,
      paramsBefore: { ...this.params }
    };

    if (success && netProfitUSD > 0) {
      this.consecutiveSuccesses++;
      this.consecutiveFailures = 0;

      // Mark and save as Golden Baseline upon sustained success
      if (this.consecutiveSuccesses >= 2) {
        this.goldenBaseline = { ...this.params };
        this.log.info(`[HAL 0] ✨ [AdaptiveOptimizer] Golden baseline locked and saved after ${this.consecutiveSuccesses} consecutive profitable trades.`);
      }

      // Slightly optimize parameters for efficiency during winning streaks
      this.params.maxGasGwei = Math.min(
        this.bounds.maxGasGwei.max,
        Math.round((this.params.maxGasGwei * 1.02) * 100) / 100
      );
    } else {
      this.consecutiveFailures++;
      this.consecutiveSuccesses = 0;

      this.log.warn(`[HAL 1] ⚠️ [AdaptiveOptimizer] Trade failure/non-profit detected (streak: ${this.consecutiveFailures}). Adjusting parameters for safety...`);

      // Tighten filters on failure: raise minimum profit spread, lower gas cap, tighten slippage
      this.params.minProfitSpread = Math.min(
        this.bounds.minProfitSpread.max,
        Number((this.params.minProfitSpread * 1.10).toFixed(4))
      );
      this.params.maxGasGwei = Math.max(
        this.bounds.maxGasGwei.min,
        Math.round((this.params.maxGasGwei * 0.90) * 100) / 100
      );
      this.params.slippageTolerance = Math.max(
        this.bounds.slippageTolerance.min,
        Number((this.params.slippageTolerance * 0.95).toFixed(4))
      );

      // PREDICTIVE SIMULATION: Verify the new parameters
      const simResult = await this.simulator.simulate({
        type: 'parameter_update',
        params: this.params
      });

      if (!simResult.safe) {
        this.log.error(`[HAL 3] 🛑 [AdaptiveOptimizer] Predictive Simulation VETO: Adjusted parameters are non-viable. ${simResult.failureModes[0].reason}`);
        // Rollback to golden baseline if the "safe" adjustment fails simulation
        this.params = { ...this.goldenBaseline };
        this.log.info(`[HAL 1] [AdaptiveOptimizer] Reverted to Golden Baseline for safety.`);
      } else {
        this.log.info(`[HAL 0] [AdaptiveOptimizer] Predictive Simulation passed with ${simResult.confidence * 100}% confidence.`);
      }
    }

    record.paramsAfter = { ...this.params };
    this.history.push(record);
    if (this.history.length > 100) this.history.shift();

    this._saveState();
    return record;
  }
}

module.exports = { AdaptiveParameterOptimizer };
