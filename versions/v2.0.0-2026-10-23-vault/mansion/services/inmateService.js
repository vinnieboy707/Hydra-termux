const db = require('../database/db');
const { mockInmateAdapter, realInmateAdapter } = require('./adapters/inmateAdapters');

const adapter = process.env.DATA_MODE === 'production' ? realInmateAdapter : mockInmateAdapter;

async function scrapeCondemnedInmates() {
  const inmates = await adapter.fetchInmates();

  return new Promise((resolve, reject) => {
    const stmt = db.prepare("INSERT INTO inmates (full_name, inmate_no, admission_date, facility, data_source) VALUES (?, ?, ?, ?, ?)");
    inmates.forEach(inmate => {
      stmt.run(inmate.full_name, inmate.inmate_no, inmate.admission_date, inmate.facility, inmate.data_source);
    });
    stmt.finalize((err) => {
      if (err) reject(err);
      else {
        console.log(`Ingested ${inmates.length} inmates using ${process.env.DATA_MODE || 'mock'} mode.`);
        resolve();
      }
    });
  });
}

module.exports = { scrapeCondemnedInmates };
