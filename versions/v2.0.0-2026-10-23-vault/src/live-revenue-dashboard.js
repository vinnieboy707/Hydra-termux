'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const aiConfigManager = require('./ai-config-manager');

const app = express();
const PORT = process.env.PORT || 3800;
const LEDGER_PATH = path.resolve(__dirname, '../unified_financial_ledger.wal');
const AUDIT_PATH = path.resolve(__dirname, '../ai_audit_suggestions.json');

app.use(express.json());

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>CHRONOS OS // AI Config Manager & Live Telemetry</title>
    <style>
        :root {
            --bg: #0b0f19;
            --card-bg: #111827;
            --accent: #10b981;
            --accent-glow: rgba(16, 185, 129, 0.2);
            --text: #f3f4f6;
            --text-dim: #9ca3af;
            --border: #374151;
            --blue: #3b82f6;
            --purple: #8b5cf6;
            --amber: #f59e0b;
            --red: #ef4444;
        }
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 20px;
        }
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border);
            padding-bottom: 15px;
            margin-bottom: 25px;
        }
        h1 { margin: 0; font-size: 22px; color: var(--accent); display: flex; align-items: center; gap: 10px; }
        .badge { background: var(--accent-glow); color: var(--accent); padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: bold; border: 1px solid var(--accent); }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 25px; }
        .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); }
        .card h3 { margin-top: 0; color: var(--text-dim); font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
        .stat { font-size: 26px; font-weight: bold; margin: 10px 0 0 0; color: var(--text); }
        .account-id { font-size: 11px; color: var(--text-dim); margin-top: 5px; font-family: monospace; }
        .section-title { font-size: 18px; color: var(--accent); margin: 30px 0 15px 0; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
        .chat-container { background: #1f2937; border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 25px; }
        .chat-log { background: #0f172a; border: 1px solid var(--border); border-radius: 8px; padding: 15px; height: 180px; overflow-y: auto; font-size: 13px; margin-bottom: 15px; font-family: monospace; }
        .chat-input-group { display: flex; gap: 10px; }
        input[type="text"] { flex: 1; background: #111827; border: 1px solid var(--border); border-radius: 6px; padding: 10px; color: var(--text); font-size: 13px; }
        button { padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; border: none; background: var(--accent); color: #fff; font-size: 13px; transition: opacity 0.2s; }
        button:hover { opacity: 0.85; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--border); font-size: 13px; }
        th { color: var(--text-dim); background: #1f2937; }
        tr:hover { background: rgba(255,255,255,0.02); }
        .refresh-status { font-size: 12px; color: var(--text-dim); text-align: right; margin-top: 10px; }
        .api-link { color: var(--blue); text-decoration: none; font-size: 13px; }
        .api-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <header>
        <h1>⚡ CHRONOS OS // AI Config Manager & Live Telemetry</h1>
        <div>
            <a href="/api/telemetry" target="_blank" class="api-link">🔗 JSON Telemetry API</a> &nbsp;|&nbsp;
            <span class="badge">AI CONFIG AGENT ACTIVE</span>
        </div>
    </header>

    <div class="grid">
        <div class="card">
            <h3>Total Revenue Captured</h3>
            <div class="stat" id="totalRevenue">$0.00</div>
            <div class="account-id">Account: ACCT_INGRESS_ALL</div>
        </div>
        <div class="card">
            <h3>Treasury Reserve (70%)</h3>
            <div class="stat" id="treasuryBalance" style="color: var(--blue);">$0.00</div>
            <div class="account-id">Account: ACCT_TREASURY_70</div>
        </div>
        <div class="card">
            <h3>Tap-to-Pay Spendable (30%)</h3>
            <div class="stat" id="spendableBalance" style="color: var(--accent);">$0.00</div>
            <div class="account-id">Account: ACCT_SPENDABLE_30</div>
        </div>
        <div class="card">
            <h3>Direct Settlement Gateway</h3>
            <div class="stat" id="bankSettled" style="color: var(--purple);">$0.00</div>
            <div class="account-id">Account: BANK_DEST_DIRECT</div>
        </div>
    </div>

    <div class="section-title">💬 Tap In With AI (Natural Language Config Management)</div>
    <div class="chat-container">
        <div class="chat-log" id="chatLog">
            [AI Config Manager]: Ready. Type any instruction to update your configurations (e.g. "Adjust arbitrage allocation to 20%" or "Set auto settle threshold to $500")...
        </div>
        <div class="chat-input-group">
            <input type="text" id="chatInput" placeholder="Type your instruction to AI Config Manager..." onkeydown="if(event.key==='Enter') sendAIInstruction()" />
            <button onclick="sendAIInstruction()">Send to AI</button>
        </div>
    </div>

    <div class="section-title">📊 Recent Transactions Audit Trail</div>
    <div class="card">
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Transaction ID</th>
                        <th>Source Stream</th>
                        <th>Revenue (USD)</th>
                        <th>Treasury (70%)</th>
                        <th>Spendable (30%)</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody id="ledgerTableBody">
                </tbody>
            </table>
        </div>
        <div class="refresh-status" id="refreshStatus">Updating telemetry every 2 seconds...</div>
    </div>

    <script>
        async function sendAIInstruction() {
            const input = document.getElementById('chatInput');
            const log = document.getElementById('chatLog');
            const prompt = input.value.trim();
            if (!prompt) return;

            log.innerHTML += \`<br><span style="color: var(--blue);">[You]: \${prompt}</span>\`;
            input.value = '';
            log.scrollTop = log.scrollHeight;

            try {
                const res = await fetch('/api/ai-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt })
                });
                const data = await res.json();
                if (data.status === 'SUCCESS') {
                    log.innerHTML += \`<br><span style="color: var(--accent);">[AI Config Manager]: \${data.explanation}</span>\`;
                } else {
                    log.innerHTML += \`<br><span style="color: var(--red);">[Error]: \${data.message}</span>\`;
                }
                log.scrollTop = log.scrollHeight;
            } catch (err) {
                log.innerHTML += \`<br><span style="color: var(--red);">[Error]: Failed to communicate with AI config manager.</span>\`;
                log.scrollTop = log.scrollHeight;
            }
        }

        async function fetchTelemetry() {
            try {
                const res = await fetch('/api/telemetry');
                const data = await res.json();
                
                document.getElementById('totalRevenue').innerText = '$' + data.totals.ingress.toFixed(2);
                document.getElementById('treasuryBalance').innerText = '$' + data.totals.treasury.toFixed(2);
                document.getElementById('spendableBalance').innerText = '$' + data.totals.spendable.toFixed(2);
                document.getElementById('bankSettled').innerText = '$' + data.totals.bankSettled.toFixed(2);

                const tbody = document.getElementById('ledgerTableBody');
                tbody.innerHTML = '';
                data.recentEntries.reverse().forEach(entry => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = \`
                        <td>\${new Date(entry.timestamp).toLocaleTimeString()}</td>
                        <td><code>\${entry.txId || entry.iteration || 'TX'}</code></td>
                        <td>\${entry.streamName || entry.sourceType || 'Stream'}</td>
                        <td style="color: var(--accent); font-weight: bold;">+\$\${(entry.revenueUSD || 0).toFixed(2)}</td>
                        <td>+\$\${(entry.treasuryAllocation || 0).toFixed(2)}</td>
                        <td>+\$\${(entry.spendableTapToPayAllocation || entry.operationsAllocation || 0).toFixed(2)}</td>
                        <td><span style="color: var(--accent)">● \${entry.status || 'VERIFIED'}</span></td>
                    \`;
                    tbody.appendChild(tr);
                });

                document.getElementById('refreshStatus').innerText = 'Last updated: ' + new Date().toLocaleTimeString();
            } catch (err) {
                console.error('Failed to fetch telemetry:', err);
            }
        }

        setInterval(fetchTelemetry, 2000);
        fetchTelemetry();
    </script>
</body>
</html>
    `);
});

app.get('/api/telemetry', (req, res) => {
    let totalIngress = 0;
    let treasuryBalance = 0;
    let spendableBalance = 0;
    let bankSettled = 0;
    let recentEntries = [];

    try {
        if (fs.existsSync(LEDGER_PATH)) {
            const lines = fs.readFileSync(LEDGER_PATH, 'utf8').trim().split('\n');
            for (const line of lines) {
                if (!line) continue;
                try {
                    const entry = JSON.parse(line);
                    const rev = entry.revenueUSD || 0;
                    const treas = entry.treasuryAllocation || (rev * 0.70);
                    const spend = entry.spendableTapToPayAllocation || entry.operationsAllocation || (rev * 0.30);

                    totalIngress += rev;
                    treasuryBalance += treas;
                    spendableBalance += spend;
                    bankSettled += spend;

                    recentEntries.push(entry);
                } catch (e) {}
            }
        }
    } catch (err) {}

    if (recentEntries.length > 25) {
        recentEntries = recentEntries.slice(recentEntries.length - 25);
    }

    res.json({
        totals: {
            ingress: totalIngress,
            treasury: treasuryBalance,
            spendable: spendableBalance,
            bankSettled
        },
        recentEntries
    });
});

// AI Config Chat Endpoint
app.post('/api/ai-config', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ status: 'ERROR', message: 'Prompt is required.' });
    }
    const result = await aiConfigManager.handleInstruction(prompt);
    res.json(result);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [AI CONFIG MANAGER DASHBOARD] Running on http://0.0.0.0:${PORT}`);
});
