'use strict';
const express = require('express');
const EnhancedPublicRecordsClient = require('./public-records-client');

const router = express.Router();
const publicRecordsClient = new EnhancedPublicRecordsClient();

// Health Check Route
router.get('/health', (req, res) => {
    res.json({
        status: 'ONLINE',
        system: 'Chronos Master API Gateway',
        timestamp: new Date().toISOString()
    });
});

// Public Records Query Route
router.post('/public-records/query', async (req, res) => {
    const { provider, query } = req.body;
    if (!provider || !query) {
        return res.status(400).json({ error: 'Missing required parameters: provider and query.' });
    }

    try {
        if (!publicRecordsClient.validateCredentials(provider)) {
            return res.status(401).json({ error: `API credentials for ${provider} are not configured in environment.` });
        }
        const result = await publicRecordsClient.queryProvider(provider, query);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Registry Info Route
router.get('/registry', (req, res) => {
    res.json({
        registry_doc: 'API_REGISTRY.md',
        supported_providers: ['TRACERS', 'PROPMIX', 'FIRST_AMERICAN', 'FOIA', 'DATAGOV', 'GOVINFO', 'ZILLOW', 'CIVICPLUS', 'RIS']
    });
});

module.exports = router;
