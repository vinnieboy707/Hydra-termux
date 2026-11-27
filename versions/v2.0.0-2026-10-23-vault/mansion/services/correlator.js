const similarity = require('string-similarity');
const db = require('../database/db');

async function runCorrelation() {
  console.log('Running correlation engine...');

  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM properties', (err, properties) => {
      if (err) return reject(err);

      db.all('SELECT * FROM inmates', (err, inmates) => {
        if (err) return reject(err);

        properties.forEach(prop => {
          inmates.forEach(inmate => {
            const score = similarity.compareTwoStrings(
              prop.owner_name.toLowerCase(),
              inmate.full_name.toLowerCase()
            );

            if (score > 0.85) {
              const distressScore = calculateDistress(prop, score);
              db.run(`INSERT INTO distressed_matches (property_id, inmate_id, confidence, distress_score, status) 
                      VALUES (?, ?, ?, ?, ?)`, 
                      [prop.id, inmate.id, score, distressScore, 'Flagged']);
            }
          });
        });
        console.log('Correlation complete.');
        resolve();
      });
    });
  });
}

function calculateDistress(prop, matchConfidence) {
  let score = matchConfidence * 40; // Incarceration Match weight: 40%
  if (prop.tax_delinquent) score += 20; // Tax weight reduced to 20%
  if (prop.days_on_market > 180) score += 10; // Market weight reduced to 10%
  if (prop.foreclosed) score += 10; // Foreclosure weight reduced to 10%
  
  // New indicators
  if (prop.utility_anomalies) score += 10;
  if (prop.code_violations > 3) score += 5;
  if (prop.permit_stagnation) score += 5;

  return Math.min(score, 100);
}

module.exports = { runCorrelation };
