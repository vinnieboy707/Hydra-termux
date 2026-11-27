'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');
const { AdaptiveParameterOptimizer } = require('./src/adaptive-parameter-optimizer');
const ComplianceEngine = require('./src/enterprise-compliance-engine');

console.log('================================================================');
require('./src/integrity-status').printBanner();
console.log('================================================================');

const config = JSON.parse(fs.readFileSync('./revenue_streams_config.json', 'utf8'));
const ledgerPath = process.env.CHRONOS_LEDGER_PATH
  ? path.resolve(process.env.CHRONOS_LEDGER_PATH)
  : path.resolve(__dirname, config.unified_ledger || 'unified_financial_ledger.wal');
const optimizer = new AdaptiveParameterOptimizer();

// Scale for USD (18 decimals for precision)
const SCALE = 18;

/**
 * Ingests a verified production transaction into the unified ledger.
 * Enforces strict canonical financial definitions and fail-closed logic.
 */
async function ingestVerifiedTransaction(txData) {
    const timestamp = new Date().toISOString();
    
    // Canonical Definition: Recognized Revenue (Irreversibly settled)
    // We expect txData.revenueUSD to be a string or number representing USD
    if (!txData.revenueUSD || Number(txData.revenueUSD) <= 0) {
        ComplianceEngine.failClosed(`Invalid or zero revenue reported for stream ${txData.streamId || 'UNKNOWN'}`);
    }

    if (!/^0x[0-9a-fA-F]{64}$/.test(String(txData.txHash || ''))) {
        throw new Error('refusing to book revenue without an on-chain txHash (stream ' + (txData.streamId || 'UNKNOWN') + ')');
    }
    const rpcProvider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com');
    let receipt;
    try { receipt = await rpcProvider.getTransactionReceipt(txData.txHash); } finally { rpcProvider.destroy(); }
    if (!receipt || receipt.status !== 1) {
        throw new Error('txHash has no successful on-chain receipt; refusing to book revenue');
    }
    const baseRevenue = ethers.parseUnits(txData.revenueUSD.toString(), SCALE);
    const success = txData.success !== false;

    // Record outcome in adaptive parameter optimizer
    optimizer.recordOutcome({
        success,
        netProfitUSD: Number(txData.revenueUSD),
        gasGweiUsed: txData.gasGweiUsed || 30,
        reason: txData.reason || (success ? 'profitable_trade' : 'zero_or_failed_trade')
    });

    const activeParams = optimizer.getCurrentParams();
    const goldenBaseline = optimizer.getGoldenBaseline();

    // Recognized revenue equals the evidence-backed base amount. No multipliers.
    
    // Total Recognized Revenue after compounding
    const revenueUSD_BigInt = baseRevenue;
    const revenueUSD_Formatted = ethers.formatUnits(revenueUSD_BigInt, SCALE);

    const streamId = txData.streamId || 'STREAM_01';
    const streamConfig = config.revenue_streams.find(s => s.id === streamId) || { treasury_ratio: 0.60, spendable_ratio: 0.40, name: 'Production Verified Stream', category: 'Enterprise' };
    
    // Tax Reserve Invariant (Default 20% if not specified)
    const taxRatio = streamConfig.tax_ratio || 0.20;
    const taxReserve_BigInt = (revenueUSD_BigInt * BigInt(Math.floor(taxRatio * 100))) / 100n;

    // Operational Costs (Gas + Fees)
    const costs_BigInt = ethers.parseUnits((txData.gasCostUSD || 0).toString(), SCALE);

    // Canonical Definition: Net Realized Profit (Withdrawable Net Income)
    const netProfit_BigInt = ComplianceEngine.calculateNetRealizedProfit({
        recognizedRevenue: revenueUSD_BigInt,
        costs: costs_BigInt,
        taxReserve: taxReserve_BigInt
    });

    const treasuryShare = (revenueUSD_BigInt * BigInt(Math.floor(streamConfig.treasury_ratio * 100))) / 100n;
    const spendableShare = (revenueUSD_BigInt * BigInt(Math.floor(streamConfig.spendable_ratio * 100))) / 100n;

    const payload = {
        txId: txData.txId || `TX-PROD-${Date.now()}`,
        timestamp,
        streamId,
        streamName: streamConfig.name,
        category: streamConfig.category,
        baseRevenueUSD: txData.revenueUSD,
        recognizedRevenueUSD: revenueUSD_Formatted,
        netRealizedProfitUSD: ethers.formatUnits(netProfit_BigInt, SCALE),
        taxReserveUSD: ethers.formatUnits(taxReserve_BigInt, SCALE),
        costsUSD: ethers.formatUnits(costs_BigInt, SCALE),
        treasuryAllocation: ethers.formatUnits(treasuryShare, SCALE),
        spendableAllocation: ethers.formatUnits(spendableShare, SCALE),
        activeParams,
        goldenBaseline,
        txHash: txData.txHash,
        blockNumber: receipt.blockNumber,
        status: 'TX_CONFIRMED_AMOUNT_UNRECONCILED'
    };

    const entry = await ComplianceEngine.secureAppend(ledgerPath, payload);
    console.log(`[COMPLIANCE ENTRY] [${streamId}] Recognized: +$${revenueUSD_Formatted} | Profit: +$${payload.netRealizedProfitUSD} | Hash: ${entry.hash.substring(0, 10)}...`);
}

module.exports = { ingestVerifiedTransaction, optimizer };

if (require.main === module) {
    setInterval(() => {
        // Production heartbeat
    }, 60000);
}

