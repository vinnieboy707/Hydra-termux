'use strict';
const fs = require('fs');
const path = require('path');

const COMBINED_LOG_PATH = path.resolve(__dirname, '../combined_sessions.jsonl');
const CHECKPOINT_PATH = path.resolve(__dirname, '../session_checkpoint.json');

class SessionCheckpointCache {
    constructor() {
        this.cache = new Map();
        this.loadCheckpoint();
    }

    loadCheckpoint() {
        try {
            if (fs.existsSync(CHECKPOINT_PATH)) {
                const data = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'));
                if (data && data.sessions) {
                    for (const [k, v] of Object.entries(data.sessions)) {
                        this.cache.set(k, v);
                    }
                }
            }
        } catch (err) {
            console.error('[-] Failed to load session checkpoint:', err.message);
        }
    }

    saveCheckpoint() {
        try {
            const obj = {
                timestamp: new Date().toISOString(),
                sessions: Object.fromEntries(this.cache.entries())
            };
            fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(obj, null, 2));
        } catch (err) {
            console.error('[-] Failed to save session checkpoint:', err.message);
        }
    }

    recordMessage(sessionId, role, content) {
        const timestamp = new Date().toISOString();
        const entry = { sessionId, timestamp, role, content };

        // Append to combined persistent JSONL log (never starting new logs)
        fs.appendFileSync(COMBINED_LOG_PATH, JSON.stringify(entry) + '\n');

        // Update in-memory and checkpoint cache
        if (!this.cache.has(sessionId)) {
            this.cache.set(sessionId, { messages: [], lastUpdated: timestamp });
        }
        const session = this.cache.get(sessionId);
        session.messages.push({ timestamp, role, content });
        session.lastUpdated = timestamp;

        this.saveCheckpoint();
        return entry;
    }

    getSessionHistory(sessionId) {
        if (this.cache.has(sessionId)) {
            return this.cache.get(sessionId).messages;
        }
        return [];
    }
}

module.exports = new SessionCheckpointCache();
