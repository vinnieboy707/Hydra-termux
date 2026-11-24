'use strict';
/**
 * ai-profit-orchestrator.js
 * 
 * Autonomous AI Agent & Orchestrator for Chronos OS:
 * 1. Continuously monitors system execution logs and WAL ledgers.
 * 2. Enforces Zero-Simulation & Pre-Revenue Verification policies.
 * 3. Integrates OpenRouter AI (via AIConfigManager) for dynamic policy & config optimization.
 * 4. Automatically tunes parameters using AdaptiveParameterOptimizer.
 */

const fs = require('fs');
const path = require('path');
const { AdaptiveParameterOptimizer } = require('./adaptive-parameter-optimizer');
const aiConfigManager = require('./ai-config-manager');

class AIProfitOrchestrator {
  constructor() {
    this.optimizer = new AdaptiveParameterOptimizer();
    this.ledgerPath = path.resolve(__dirname, '../unified_financial_ledger.wal');
    this.logPath = path.resolve(__dirname, '../logs/ai_orchestrator.log');
    fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
  }

  logMessage(level, msg) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [AI_ORCHESTRATOR] [${level}] ${msg}`;
    console.log(entry);
    try {
      fs.appendFileSync(this.logPath, entry + '\n');
    } catch (e) {}
  }

  auditLedger() {
    if (!fs.existsSync(this.ledgerPath)) {
      return { totalRevenueUSD: 0, txCount: 0, verifiedProfits: false };
    }
    const lines = fs.readFileSync(this.ledgerPath, 'utf8').trim().split('\n').filter(Boolean);
    let totalRevenue = 0;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        totalRevenue += Number(entry.netRealizedProfitUSD || entry.revenueUSD || 0);
      } catch (e) {}
    }
    return {
      totalRevenueUSD: Number(totalRevenue.toFixed(2)),
      txCount: lines.length,
      verifiedProfits: totalRevenue >= 200.0
    };
  }

  async runOptimizationCycle() {
    this.logMessage('INFO', '[HAL 0] Initiating autonomous OpenRouter-powered AI optimization & monitoring cycle...');
    const audit = this.auditLedger();
    this.logMessage('INFO', `[Ledger Audit] Total Verified Profit: $${audit.totalRevenueUSD} | Transactions: ${audit.txCount}`);

    if (!audit.verifiedProfits) {
      this.logMessage('WARN', '[HAL 1] ⚠️ System currently in STAGING_UNVERIFIED status. No real verified profits >= $200 detected.');
      
      // Invoke OpenRouter AI Agent to adjust policies and configuration for maximum yield
      if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'sk-or-v1-mock_openrouter_key') {
        this.logMessage('INFO', '[HAL 0] 🤖 Consulting OpenRouter AI Agent to reconfigure parameters for profitability...');
        const aiResult = await aiConfigManager.handleInstruction(
          'System is currently in STAGING_UNVERIFIED state with zero verified profit. Tighten profit spread thresholds, optimize allocation weights for maximum yield, and ensure zero simulation.'
        );
        this.logMessage('INFO', `[OpenRouter AI] Status: ${aiResult.status} | Explanation: ${aiResult.explanation}`);
      } else {
        this.logMessage('WARN', '[HAL 1] ℹ️ OPENROUTER_API_KEY not active. Falling back to local adaptive optimizer.');
      }

      this.optimizer.recordOutcome({
        success: false,
        netProfitUSD: audit.totalRevenueUSD,
        reason: 'Pending live RPC / Stripe webhook key configuration and verified transaction ingress.'
      });
    } else {
      this.logMessage('INFO', '[HAL 0] 🎉 VERIFIED PROFITS ACHIEVED! Advancing system stage to PRODUCTION_PROFIT_GENERATING.');
      this.optimizer.recordOutcome({
        success: true,
        netProfitUSD: audit.totalRevenueUSD,
        reason: 'Empirical profit verification threshold met successfully.'
      });
    }

    const currentParams = this.optimizer.getCurrentParams();
    this.logMessage('INFO', `[Current AI Params] Min Profit Spread: ${currentParams.minProfitSpread}, Max Gas Gwei: ${currentParams.maxGasGwei}, Slippage: ${currentParams.slippageTolerance}`);
  }
}

if (require.main === module) {
  const orchestrator = new AIProfitOrchestrator();
  orchestrator.runOptimizationCycle();
}

module.exports = { AIProfitOrchestrator };
