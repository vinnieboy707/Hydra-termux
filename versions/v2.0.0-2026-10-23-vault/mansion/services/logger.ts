const db = require('../database/db');

// Logging Middleware/Service
function logInteraction(action: string, details: string) {
    const timestamp = new Date().toISOString();
    db.run("INSERT INTO interaction_logs (timestamp, action, details) VALUES (?, ?, ?)", 
           [timestamp, action, details]);
    console.log(`[${timestamp}] ${action}: ${details}`);
}

export { logInteraction };
