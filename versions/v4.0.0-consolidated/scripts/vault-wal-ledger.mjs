import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "vault_store.db");
const JSONL_PATH = path.join(process.cwd(), "logs", "real_execution_ledger.jsonl");

export class VaultWalLedger {
    constructor(dbPath = DB_PATH) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        this.db = new DatabaseSync(dbPath);
        this.db.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA busy_timeout = 5000;

            CREATE TABLE IF NOT EXISTS settlements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tx_hash TEXT UNIQUE NOT NULL,
                sweep_tx_hash TEXT,
                timestamp TEXT NOT NULL,
                pair TEXT NOT NULL,
                asset_symbol TEXT NOT NULL,
                gross_inflow TEXT NOT NULL,
                tax_reserve_30pct TEXT NOT NULL,
                net_withdrawable_70pct TEXT NOT NULL,
                net_spread_bps INTEGER DEFAULT 0,
                recipient_eoa TEXT NOT NULL,
                policy_tag TEXT DEFAULT 'POLICY_T1_30PCT'
            );

            CREATE TABLE IF NOT EXISTS vault_balances (
                asset_symbol TEXT PRIMARY KEY,
                cumulative_gross TEXT NOT NULL,
                segregated_tax_reserve TEXT NOT NULL,
                net_withdrawable_cash TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        `);
    }

    recordSettlement(entry) {
        const txHash = entry.txHash;
        if (!txHash) return null;

        const symbol = entry.sweptSymbol || "WETH";
        const grossFloat = parseFloat(entry.sweptAmount || "0");
        const taxFloat = Number((grossFloat * 0.30).toFixed(18));
        const netFloat = Number((grossFloat - taxFloat).toFixed(18));
        const ts = entry.timestamp || new Date().toISOString();

        const result = this.db.prepare(`
            INSERT OR IGNORE INTO settlements (
                tx_hash, sweep_tx_hash, timestamp, pair, asset_symbol,
                gross_inflow, tax_reserve_30pct, net_withdrawable_70pct,
                net_spread_bps, recipient_eoa
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            txHash,
            entry.sweepTxHash || null,
            ts,
            entry.pair || "UNKNOWN",
            symbol,
            grossFloat.toString(),
            taxFloat.toString(),
            netFloat.toString(),
            entry.netSpreadBps || 0,
            entry.recipient || "0xbdf5cC5F73e81E5BE2d495f04BAc1A864372407a"
        );

        if (result.changes > 0) {
            const existing = this.db.prepare(
                "SELECT cumulative_gross, segregated_tax_reserve, net_withdrawable_cash FROM vault_balances WHERE asset_symbol = ?"
            ).get(symbol);

            const prevGross = existing ? parseFloat(existing.cumulative_gross) : 0;
            const prevTax = existing ? parseFloat(existing.segregated_tax_reserve) : 0;
            const prevNet = existing ? parseFloat(existing.net_withdrawable_cash) : 0;

            this.db.prepare(`
                INSERT INTO vault_balances (asset_symbol, cumulative_gross, segregated_tax_reserve, net_withdrawable_cash, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(asset_symbol) DO UPDATE SET
                    cumulative_gross = excluded.cumulative_gross,
                    segregated_tax_reserve = excluded.segregated_tax_reserve,
                    net_withdrawable_cash = excluded.net_withdrawable_cash,
                    updated_at = excluded.updated_at
            `).run(
                symbol,
                (prevGross + grossFloat).toFixed(18),
                (prevTax + taxFloat).toFixed(18),
                (prevNet + netFloat).toFixed(18),
                ts
            );
        }

        return {
            txHash,
            symbol,
            gross: grossFloat.toFixed(8),
            taxReserve30Pct: taxFloat.toFixed(8),
            netWithdrawable70Pct: netFloat.toFixed(8)
        };
    }

    syncFromJsonl(jsonlPath = JSONL_PATH) {
        if (!fs.existsSync(jsonlPath)) return 0;
        const lines = fs.readFileSync(jsonlPath, "utf8").split("\n").filter(Boolean);
        let synced = 0;
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                if (this.recordSettlement(parsed)) synced++;
            } catch {}
        }
        return synced;
    }

    getSummary() {
        return this.db.prepare("SELECT * FROM vault_balances").all();
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const ledger = new VaultWalLedger();
    const count = ledger.syncFromJsonl();
    console.log(`🗄️ [SQLite WAL] vault_store.db active (journal_mode=WAL). Synced ${count} JSONL entries.`);
}
