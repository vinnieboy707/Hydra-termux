require('ts-node/register');
const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();

const db = require('./database/db');
const { scrapeCondemnedInmates } = require('./services/inmateService');
const { seedProperties } = require('./services/propertyService');
const { runCorrelation } = require('./services/correlator');
const { analyzePropertyDistress } = require('./services/correlator'); 
const cpraController = require('./controllers/cpraController');
const { generateOutreachAI, analyzeVisualDistressAI } = require('./services/aiEngine');
const { predictAbandonmentProbability } = require('./services/predictiveEngine');
const { performSearch } = require('./services/searchService');
const { getSystemTelemetry, getDatabaseMetrics } = require('./services/telemetryService');
const { logInteraction } = require('./services/logger');

// ... (existing routes)

// Telemetry Endpoint
app.get('/api/telemetry', async (req, res) => {
    const system = await getSystemTelemetry();
    const dbMetrics = await getDatabaseMetrics();
    res.json({ system, dbMetrics });
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Endpoints
app.get('/api/properties', (req, res) => {
  db.all('SELECT * FROM properties', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

// Nearby Abandoned Property Endpoint
app.get('/api/properties/nearby', async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Missing latitude/longitude' });

    db.all('SELECT * FROM properties WHERE tax_delinquent = 1', async (err, properties) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Simple Haversine approximation in JS for proximity ranking
        const nearby = properties.map(p => {
            const distance = Math.sqrt(Math.pow(p.latitude - parseFloat(lat), 2) + Math.pow(p.longitude - parseFloat(lng), 2));
            return { ...p, distance };
        }).sort((a, b) => a.distance - b.distance);
        
        res.json(nearby.slice(0, 5)); // Return top 5 closest
    });
});

app.get('/api/matches', (req, res) => {
  db.all(`
    SELECT p.*, m.distress_score, m.confidence, i.full_name as owner_match 
    FROM distressed_matches m
    JOIN properties p ON m.property_id = p.id
    JOIN inmates i ON m.inmate_id = i.id
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

// Premium Feature Endpoints
app.get('/api/property/analysis/:id', async (req, res) => {
    db.get('SELECT * FROM properties WHERE id = ?', [req.params.id], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Property not found' });
        const analysis = await analyzeVisualDistressAI(row.structure_details);
        res.json(analysis);
    });
});

app.get('/api/property/predict/:id', async (req, res) => {
    db.get('SELECT * FROM properties WHERE id = ?', [req.params.id], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Property not found' });
        const probability = await predictAbandonmentProbability(row);
        res.json({ probability });
    });
});
// ...

// Example usage in API:
app.post('/api/outreach', async (req, res) => {
    const { ownerName, address } = req.body;
    const message = await generateOutreachAI(ownerName, address);

    // Persistent log
    logInteraction('OUTREACH_GENERATED', `Owner: ${ownerName}, Address: ${address}`);

    res.json({ message });
});


// Search Endpoint
app.post('/api/search', async (req, res) => {
    const { query } = req.body;
    const results = await performSearch(query);
    res.json(results);
});

// CPRA Endpoints
app.post('/api/cpra/request', cpraController.createCpraRequest);
app.get('/api/cpra/requests', cpraController.listCpraRequests);
app.put('/api/cpra/status', cpraController.updateRequestStatus);

app.get('/api/stats', (req, res) => {
  db.get(`SELECT COUNT(*) as count FROM properties`, (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ totalProperties: row.count });
  });
});

app.post('/api/trigger-sync', async (req, res) => {
  try {
    await scrapeCondemnedInmates();
    await seedProperties();
    await runCorrelation();
    res.json({ message: 'Sync and correlation completed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server if main module
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Abandoned Asset Intelligence API running on port ${PORT}`);
    });
}

module.exports = app;
