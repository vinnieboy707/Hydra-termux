import * as os from 'os';
import * as db from '../database/db';

export async function getSystemTelemetry() {
    return {
        cpuUsage: os.loadavg(),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        uptime: os.uptime(),
        platform: os.platform(),
    };
}

export async function getDatabaseMetrics() {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as interactionCount FROM interaction_logs', (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}
