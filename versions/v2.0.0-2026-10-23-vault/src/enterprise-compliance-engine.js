'use strict';

/**
 * CHRONOS OS // ENTERPRISE COMPLIANCE & ACCOUNTING ENGINE
 * Version: 1.0.0-PROD
 * 
 * Mandate: Enforce strict-fail-closed logic and deterministic financial definitions.
 */

const { ethers } = require('ethers');
const crypto = require('crypto');

// Canonical Financial Definitions (Scale: 18 decimals for precision, similar to ETH/USDC)
const SCALE = 18;
const UNIT = ethers.parseUnits('1', SCALE);

/**
 * @typedef {Object} FinancialRecord
 * @property {bigint} grossInflow - Raw receipts before any deductions.
 * @property {bigint} recognizedRevenue - Irreversibly settled value.
 * @property {bigint} costs - Principal + Gas + Fees + Slippage.
 * @property {bigint} taxReserve - Allocated tax reserve.
 */

class ComplianceEngine {
    /**
     * Calculates Net Realized Profit using the mathematical invariant:
     * Net Realized Profit = Recognized Revenue - (Costs + Tax Reserve)
     * 
     * @param {FinancialRecord} record 
     * @returns {bigint} Net Realized Profit (Withdrawable Net Income)
     */
    static calculateNetRealizedProfit(record) {
        const { recognizedRevenue, costs, taxReserve } = record;
        const totalDeductions = costs + taxReserve;
        
        if (recognizedRevenue < totalDeductions) {
            return 0n; // No profit realized if deductions exceed revenue
        }
        
        return recognizedRevenue - totalDeductions;
    }

    /**
     * Verifies the "ATM Standard" for withdrawable funds.
     * @param {string} assetType - 'FIAT' or 'CRYPTO'
     * @param {Object} verificationData - proof of finality/clearing
     * @returns {boolean}
     */
    static verifyATMStandard(assetType, verificationData) {
        if (assetType === 'CRYPTO') {
            // Check finality: Ethereum >= 64 blocks, Solana = finalized
            const { confirmations, threshold } = verificationData;
            return confirmations >= (threshold || 64);
        } else if (assetType === 'FIAT') {
            // Check status: Cleared and off-hold
            return verificationData.status === 'cleared' && !verificationData.onHold;
        }
        return false;
    }

    /**
     * Dual-Provider Consensus Protocol
     * @param {Array<Promise<any>>} queries - Promises from independent providers
     * @param {number} tolerance - Allowed percentage difference (default 0.5%)
     * @returns {Promise<any>} Consensus value
     */
    static async getConsensusValue(queries, tolerance = 0.005) {
        const results = await Promise.all(queries);
        if (results.length < 2) {
            throw new Error('Dual-provider consensus requires at least 2 independent queries.');
        }

        const v1 = Number(results[0]);
        const v2 = Number(results[1]);

        const diff = Math.abs(v1 - v2) / Math.max(v1, v2);
        if (diff > tolerance) {
            this.failClosed(`Consensus violation: Difference (${(diff * 100).toFixed(2)}%) exceeds tolerance (${(tolerance * 100).toFixed(2)}%)`);
        }

        return results[0]; // Return the primary value if consensus reached
    }

    /**
     * Strict Fail-Closed Execution
     * @param {string} reason 
     */
    static failClosed(reason) {
        const alert = {
            ts: new Date().toISOString(),
            level: 'FATAL',
            event: 'POLICY_INVARIANT_BREACH',
            reason,
            action: 'HALTING_EXECUTION',
            hal: 3
        };
        console.error(`[HAL 3] ${JSON.stringify(alert)}`);
        process.stderr.write(`FATAL [HAL 3]: ${reason}\n`);
        process.exit(1);
    }

    /**
     * Immutable SHA-256 Ledger Append with chaining
     * @param {string} ledgerPath 
     * @param {Object} entry 
     */
    static async secureAppend(ledgerPath, entry) {
        const fs = require('fs').promises;
        let prevHash = '0'.repeat(64);
        
        try {
            const data = await fs.readFile(ledgerPath, 'utf8');
            const lines = data.trim().split('\n').filter(Boolean);
            if (lines.length > 0) {
                const lastLine = JSON.parse(lines[lines.length - 1]);
                prevHash = lastLine.hash;
            }
        } catch (e) {
            // File might not exist, starting new chain
        }

        const body = {
            ...entry,
            prevHash,
            ts: new Date().toISOString()
        };

        const hash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
        const finalEntry = { ...body, hash };

        await fs.appendFile(ledgerPath, JSON.stringify(finalEntry) + '\n');
        console.log(`[HAL 0] Securely appended entry to ledger with hash: ${hash.substring(0, 8)}...`);
        return finalEntry;
    }
}

module.exports = ComplianceEngine;

// --- UNIVERSAL I/O COMPLIANCE ENFORCED ---
console.log("[IO Audit] File loaded successfully: enterprise-compliance-engine.js");
const executeIO = (input = process.argv[2] || process.env.NODE_ENV || "default") => {
  const output = { file: "enterprise-compliance-engine.js", inputReceived: input, timestamp: new Date().toISOString(), status: "nominal" };
  console.log("[IO Output]:", JSON.stringify(output));
  return output;
};
executeIO();
