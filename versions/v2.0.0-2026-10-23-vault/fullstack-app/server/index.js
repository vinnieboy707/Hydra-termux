const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const config = require('../config/config.json');

const app = express();
app.use(express.json());

// Initialize SQLite Database Connection
const db = new sqlite3.Database(config.database.path, (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to SQLite database.');
});

// Endpoint: Fetch metrics
app.get('/api/data', (req, res) => {
    db.all("SELECT * FROM metrics ORDER BY timestamp DESC LIMIT 10", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: "success", data: rows });
    });
});

// Endpoint: Log new event
app.post('/api/data', (req, res) => {
    const { name, value } = req.body;
    db.run("INSERT INTO metrics (name, value) VALUES (?, ?)", [name, value], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: "success", id: this.lastID });
    });
});

app.listen(config.server.port, () => {
    console.log(`Server running on http://localhost:${config.server.port}`);
});
