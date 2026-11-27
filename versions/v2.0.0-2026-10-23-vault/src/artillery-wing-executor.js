'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('========================================================');
console.log('CHRONOS OS // ARTILLERY WING HIGH-PERFORMANCE DISPATCH WORKER');
console.log('========================================================');

const LEDGER_PATH = path.resolve(__dirname, '../unified_financial_ledger.wal');
const CHECKPOINT_PATH = path.resolve(__dirname, '../artillery_checkpoint.json');

class ArtilleryWingExecutor {
    constructor(options = {}) {
        this.maxConsecutiveFailures = options.maxConsecutiveFailures || 3;
        this.consecutiveFailures = 0;
        this.isTripped = false;
        this.processedIds = new Set();
        this.loadCheckpoint();
    }

    loadCheckpoint() {
        try {
            if (fs.existsSync(CHECKPOINT_PATH)) {
                const data = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'));
                if (data) {
                    this.consecutiveFailures = data.consecutiveFailures || 0;
                    this.isTripped = !!data.isTripped;
                    if (Array.isArray(data.processedIds)) {
                        for (const id of data.processedIds) {
                            this.processedIds.add(id);
                        }
                    }
                }
                console.log(`[ArtilleryWing] Checkpoint loaded: ${this.processedIds.size} processed idempotency keys | Tripped: ${this.isTripped}`);
            }
        } catch (err) {
            console.error('[-] Failed to load artillery checkpoint:', err.message);
        }
    }

    saveCheckpoint() {
        try {
            const data = {
                timestamp: new Date().toISOString(),
                consecutiveFailures: this.consecutiveFailures,
                isTripped: this.isTripped,
                processedIds: Array.from(this.processedIds)
            };
            fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error('[-] Failed to save artillery checkpoint:', err.message);
        }
    }

    dispatchPayload(payload) {
        if (this.isTripped) {
            throw new Error('[ArtilleryWing] Circuit breaker is TRIPPED. Dispatch halted.');
        }

        const correlationId = payload.correlationId || `ARTILLERY-${crypto.randomBytes(4).toString('hex')}--${Date.now()}`;
        const idempotencyKey = payload.idempotencyKey || crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

        if (this.processedIds.has(idempotencyKey)) {
            console.warn(`[ArtilleryWing] Duplicate dispatch detected for idempotencyKey: ${idempotencyKey}. Skipping.`);
            return { status: 'DUPLICATE_SKIPPED', correlationId };
        }

        try {
            const amountUSD = Number(payload.amountUSD || 0);
            if (amountUSD <= 0) {
                throw new Error('Invalid or zero amountUSD in dispatch payload.');
            }

            const entry = {
                correlationId,
                idempotencyKey,
                timestamp: new Date().toISOString(),
                module: 'ArtilleryWingExecutor',
                targetStream: payload.targetStream || 'PRIMARY_EXECUTION_GRID',
                amountUSD,
                status: 'ARTILLERY_STRIKE_SUCCESS'
            };

            fs.appendFileSync(LEDGER_PATH, JSON.stringify(entry) + '\n');
            this.processedIds.add(idempotencyKey);
            this.consecutiveFailures = 0;
            this.saveCheckpoint();

            console.log(`[ArtilleryWing SUCCESS] Dispatched strike ${correlationId} | Amount: +$${amountUSD.toFixed(2)} USD`);
            return { status: 'SUCCESS', correlationId, entry };
        } catch (err) {
            this.consecutiveFailures++;
            console.error(`[ArtilleryWing ERROR] Dispatch failed (${this.consecutiveFailures}/${this.maxConsecutiveFailures}):`, err.message);

            if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
                this.isTripped = true;
                console.error('[ArtilleryWing CRITICAL] Circuit breaker tripped due to consecutive dispatch failures.');
            }
            this.saveCheckpoint();
            throw err;
        }
    }

    resetCircuitBreaker() {
        this.consecutiveFailures = 0;
        this.isTripped = false;
        this.saveCheckpoint();
        console.log('[ArtilleryWing] Circuit breaker manually reset.');
    }
}

module.exports = new ArtilleryWingExecutor();
