'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const LEDGER_PATH = path.resolve(__dirname, '../unified_financial_ledger.wal');
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const BANK_ACCOUNT_ID = process.env.DESTINATION_BANK_ACCOUNT_ID;

console.log('========================================================');
console.log('CHRONOS OS // INSTANT BANK PAYOUT EXECUTION BRIDGE');
console.log('========================================================');

async function triggerPayouts() {
    if (!STRIPE_KEY || STRIPE_KEY === 'REDACTED' || STRIPE_KEY.includes('YOUR_REAL_STRIPE_KEY')) {
        console.error('🚨 [STRIPE KEY REQUIRED]: To free up funds into your bank account, please provide your LIVE Stripe Secret Key (`STRIPE_SECRET_KEY`) in your `.env` file.');
        console.log('📌 Notification: Live payouts require an active Stripe account with payouts enabled and a verified external bank account ID.');
        return;
    }

    const stripe = require('stripe')(STRIPE_KEY);

    let totalSpendable = 0;
    try {
        if (fs.existsSync(LEDGER_PATH)) {
            const lines = fs.readFileSync(LEDGER_PATH, 'utf8').trim().split('\n');
            for (const line of lines) {
                if (!line) continue;
                try {
                    const e = JSON.parse(line);
                    const rev = e.revenueUSD || 0;
                    totalSpendable += (e.spendableTapToPayAllocation || (rev * 0.30));
                } catch (err) {}
            }
        }
    } catch (err) {}

    const amountCents = Math.floor(totalSpendable * 100);
    if (amountCents <= 0) {
        console.log('ℹ️ No pending spendable balance to pay out.');
        return;
    }

    console.log(`🏦 [Payout Engine] Triggering instant Stripe payout of $${totalSpendable.toFixed(2)} to bank account: ${BANK_ACCOUNT_ID}...`);

    try {
        require('./send-guard').assertLiveAllowed('stripe payout');
        const payout = await stripe.payouts.create({
            amount: amountCents,
            currency: 'usd',
            method: 'instant',
            destination: BANK_ACCOUNT_ID,
            statement_descriptor: 'CHRONOS PAYOUT'
        }, {
            idempotencyKey: `bank_payout_${Date.now()}`
        });

        console.log(`✅ [BANK PAYOUT SUCCESS] Payout ID: ${payout.id} | Status: ${payout.status}`);
        console.log(`🎉 Funds successfully routed from Stripe gateway to bank account ending in destination ID.`);
    } catch (err) {
        console.error(`❌ [STRIPE PAYOUT ERROR]: ${err.message}`);
        console.log('💡 Note: Ensure your Stripe account has sufficient available balance and instant payout capabilities enabled.');
    }
}

triggerPayouts();
