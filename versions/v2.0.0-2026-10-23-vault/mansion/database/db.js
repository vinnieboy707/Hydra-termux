const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'mansion_mesh.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT,
    owner_name TEXT,
    market_value REAL,
    tax_delinquent INTEGER,
    foreclosed INTEGER,
    days_on_market INTEGER,
    latitude REAL,
    longitude REAL,
    structure_details TEXT,
    last_contact_date TEXT,
    acquisition_pathway TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inmates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT,
    inmate_no TEXT,
    admission_date TEXT,
    sentence_length TEXT,
    facility TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS distressed_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER,
    inmate_id INTEGER,
    confidence REAL,
    distress_score REAL,
    status TEXT,
    FOREIGN KEY(property_id) REFERENCES properties(id),
    FOREIGN KEY(inmate_id) REFERENCES inmates(id)
  )`);
});

module.exports = db;
