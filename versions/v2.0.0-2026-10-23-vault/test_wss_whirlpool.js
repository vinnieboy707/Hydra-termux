'use strict';
const assert = require('node:assert/strict');
const { WssWhirlpoolEngine } = require('./src/wss_whirlpool_engine');
const { ethers } = require('ethers');

async function testWhirlpool() {
    console.log('========================================================');
    console.log('CHRONOS OS // WSS WHIRLPOOL ENGINE TEST SUITE');
    console.log('========================================================');

    // Generate 3 test wallets for multi-wallet architecture
    const pk1 = ethers.Wallet.createRandom().privateKey;
    const pk2 = ethers.Wallet.createRandom().privateKey;
    const pk3 = ethers.Wallet.createRandom().privateKey;

    const engine = new WssWhirlpoolEngine({
        privateKeys: [pk1, pk2, pk3],
        targetTps: 100 // Test drip rate
    });

    await engine.init();

    // Enqueue 50 test transactions
    for (let i = 0; i < 50; i++) {
        engine.enqueueTransaction({ tradeId: `TRADE-${i}`, amountUSD: 100 + i });
    }

    // Allow leaky bucket to process
    await new Promise((r) => setTimeout(r, 600));

    assert.ok(engine.pendingTxMap.size > 0, 'Whirlpool should successfully dispatch and track transactions');
    console.log(`✅ [SUCCESS]: Whirlpool successfully shaped and dispatched ${engine.pendingTxMap.size} transactions across multi-wallet signers.`);
    console.log('========================================================');
}

testWhirlpool().catch((err) => {
    console.error('❌ [TEST FAILED]:', err);
    process.exit(1);
});
