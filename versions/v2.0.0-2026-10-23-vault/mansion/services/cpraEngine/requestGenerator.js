const fs = require('fs');
const path = require('path');
const db = require('../../database/db');

// Request template
const CPRA_TEMPLATE = (county, date) => `
TO: County Clerk / Sheriff's Department - ${county} County
DATE: ${date}

RE: California Public Records Act (CPRA) Request for Sentencing Data

To Whom It May Concern,

Pursuant to the California Public Records Act (Gov. Code § 6250 et seq.), I am formally requesting a copy of the following public records:

All records of individuals currently sentenced to custody in the ${county} County jail system, including name, booking date, sentencing date, and projected release date.

I request that this information be provided in a machine-readable format (CSV or JSON).

Sincerely,
AAI Intelligence Engine
`;

async function createRequest(county) {
  const date = new Date().toISOString().split('T')[0];
  const requestContent = CPRA_TEMPLATE(county, date);
  const filePath = path.join(__dirname, '../../data/cpra_requests', `${county}_${date}.txt`);

  fs.writeFileSync(filePath, requestContent);

  // Track in DB
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO cpra_requests (county, request_date, status, file_path) VALUES (?, ?, ?, ?)",
      [county, date, 'Draft', filePath],
      (err) => {
        if (err) reject(err);
        else resolve({ county, filePath });
      }
    );
  });
}

module.exports = { createRequest };
