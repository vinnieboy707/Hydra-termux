const db = require('../database/db');
const { mockPropertyAdapter, realEstateApiAdapter } = require('./adapters/propertyAdapters');

const adapter = process.env.DATA_MODE === 'production' ? realEstateApiAdapter : mockPropertyAdapter;

async function seedProperties() {
  const properties = await adapter.fetchProperties();
  
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`INSERT INTO properties (
      address, owner_name, market_value, tax_delinquent, foreclosed, 
      days_on_market, latitude, longitude, structure_details, 
      last_contact_date, acquisition_pathway, utility_anomalies, 
      code_violations, permit_stagnation
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    properties.forEach(prop => {
      stmt.run(
        prop.address, prop.owner_name, prop.market_value, prop.tax_delinquent,
        prop.foreclosed, prop.days_on_market, prop.latitude, prop.longitude,
        prop.structure_details, prop.last_contact_date, prop.acquisition_pathway,
        prop.utility_anomalies, prop.code_violations, prop.permit_stagnation
      );
    });

    stmt.finalize((err) => {
      if (err) reject(err);
      else {
        console.log(`Seeded ${properties.length} properties using ${process.env.DATA_MODE || 'mock'} mode.`);
        resolve();
      }
    });
  });
}

module.exports = { seedProperties };
