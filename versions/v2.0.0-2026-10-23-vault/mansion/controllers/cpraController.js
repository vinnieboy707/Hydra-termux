const { createRequest } = require('../services/cpraEngine/requestGenerator');
const db = require('../database/db');

exports.createCpraRequest = async (req, res) => {
    try {
        const { county } = req.body;
        const result = await createRequest(county);
        res.json({ message: 'Request created', ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.listCpraRequests = (req, res) => {
    db.all("SELECT * FROM cpra_requests", (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
};

exports.updateRequestStatus = (req, res) => {
    const { id, status } = req.body;
    db.run("UPDATE cpra_requests SET status = ? WHERE id = ?", [status, id], function(err) {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ message: 'Status updated' });
    });
};
