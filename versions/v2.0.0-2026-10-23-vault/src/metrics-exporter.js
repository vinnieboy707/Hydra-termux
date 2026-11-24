'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ledgerPath = path.resolve(__dirname, '../unified_financial_ledger.wal');
const PORT = process.env.METRICS_PORT || 3900;

console.log('📈 [Metrics Exporter] Initialized Prometheus metrics telemetry exporter...');

const server = http.createServer((req, res) => {
    if (req.url === '/metrics') {
        let totalRevenue = 0;
        let totalEntries = 0;
        if (fs.existsSync(ledgerPath)) {
            const lines = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n');
            for (const line of lines) {
                if (!line) continue;
                try {
                    const e = JSON.parse(line);
                    totalEntries++;
                    totalRevenue += Number(e.revenueUSD || e.amountUSD || 0);
                } catch (err) {}
            }
        }

        const memUsage = process.memoryUsage();
        const metrics = [
            `# HELP chronos_total_revenue_usd Total cumulative verified revenue in USD`,
            `# TYPE chronos_total_revenue_usd gauge`,
            `chronos_total_revenue_usd ${totalRevenue.toFixed(2)}`,
            `# HELP chronos_ledger_entries_total Total verified WAL ledger entries`,
            `# TYPE chronos_ledger_entries_total counter`,
            `chronos_ledger_entries_total ${totalEntries}`,
            `# HELP chronos_node_heap_used_bytes V8 heap used bytes`,
            `# TYPE chronos_node_heap_used_bytes gauge`,
            `chronos_node_heap_used_bytes ${memUsage.heapUsed}`,
            `# HELP chronos_node_rss_bytes Process RSS memory bytes`,
            `# TYPE chronos_node_rss_bytes gauge`,
            `chronos_node_rss_bytes ${memUsage.rss}`
        ].join('\n') + '\n';

        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
        res.end(metrics);
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`📈 [Metrics Exporter] Prometheus metrics endpoint active on port ${PORT} (/metrics)`);
});

process.on('SIGINT', () => {
    server.close(() => {
        console.log('⚙️ [Metrics Exporter] Shutting down telemetry server...');
        process.exit(0);
    });
});
