const axios = require('axios');

// Mock Adapter
const mockPropertyAdapter = {
    fetchProperties: async () => [
        {
            address: '1234 Trousdale Dr, Beverly Hills, CA 90210',
            owner_name: 'John A. Smith',
            market_value: 5500000,
            tax_delinquent: 1,
            foreclosed: 0,
            days_on_market: 210,
            latitude: 34.0736,
            longitude: -118.4004,
            structure_details: '8-bed, 10-bath, 12,000 sqft',
            last_contact_date: '2024-05-15',
            acquisition_pathway: 'Tax Deed Sale',
            utility_anomalies: 1,
            code_violations: 2,
            permit_stagnation: 1
        }
    ]
};

// Real API Adapter (Example structure)
const realEstateApiAdapter = {
    fetchProperties: async () => {
        // PRODUCTION NOTE: Use securely managed API keys, NEVER hardcode.
        // const response = await axios.get(process.env.REAL_ESTATE_API_URL, {
        //     headers: { 'Authorization': `Bearer ${process.env.REAL_ESTATE_API_KEY}` }
        // });
        // return response.data.map(mapToInternalSchema);
        console.log("Fetching from real API...");
        return []; 
    }
};

module.exports = { mockPropertyAdapter, realEstateApiAdapter };
