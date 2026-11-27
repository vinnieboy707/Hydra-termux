const http = require('http');
const express = require('express');
const masterApiRouter = require('./src/master-api-gateway');

async function runNativeValidation() {
    console.log('🧪 [Native Validation] Starting API Gateway server for empirical testing...');

    const app = express();
    app.use(express.json());
    app.use('/api', masterApiRouter);

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}/api`;

    try {
        // 1. Test Health Endpoint
        console.log('[+] Testing GET /api/health...');
        const healthRes = await fetch(`${baseUrl}/health`);
        const healthData = await healthRes.json();
        if (healthRes.status === 200 && healthData.status === 'ONLINE') {
            console.log('✅ /api/health PASSED');
        } else {
            throw new Error(`❌ /api/health failed with status ${healthRes.status}`);
        }

        // 2. Test Registry Endpoint
        console.log('[+] Testing GET /api/registry...');
        const regRes = await fetch(`${baseUrl}/registry`);
        const regData = await regRes.json();
        if (regRes.status === 200 && regData.supported_providers.length === 9) {
            console.log('✅ /api/registry PASSED (9 providers verified)');
        } else {
            throw new Error(`❌ /api/registry failed with status ${regRes.status}`);
        }

        // 3. Test Unauthorized Query Rejection (Unconfigured)
        console.log('[+] Testing POST /api/public-records/query (unconfigured key rejection)...');
        const queryRes = await fetch(`${baseUrl}/public-records/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'TRACERS', query: 'Brandon Virgin CA' })
        });
        const queryData = await queryRes.json();
        if (queryRes.status === 401 && queryData.error) {
            console.log('✅ Unconfigured provider rejection PASSED (Status 401)');
        } else {
            throw new Error(`❌ Query validation test failed with status ${queryRes.status}`);
        }

        // 4. Test Configured Provider Request (Mock API Key set)
        console.log('[+] Testing POST /api/public-records/query with configured API key...');
        process.env.TRACERS_API_KEY = 'mock_tracers_test_key_12345';
        const configuredQueryRes = await fetch(`${baseUrl}/public-records/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'TRACERS', query: 'Brandon Virgin CA' })
        });
        const configuredQueryData = await configuredQueryRes.json();
        if (configuredQueryRes.status === 200 && configuredQueryData.status === 'SUCCESS') {
            console.log('✅ Configured provider request PASSED (Status 200, Success payload returned)');
        } else {
            throw new Error(`❌ Configured query test failed with status ${configuredQueryRes.status}`);
        }

        console.log('🔥 [Success] All empirical validation checks (unconfigured & configured) passed successfully!');
    } finally {
        server.close();
    }
}

runNativeValidation().catch(err => {
    console.error('❌ Validation Error:', err.message);
    process.exit(1);
});
