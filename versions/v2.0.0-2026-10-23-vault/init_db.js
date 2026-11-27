'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(process.env.HOME, 'chronos-infrastructure-core/chronos_production.db');
console.log(`Initializing SQLite database at: ${dbPath}`);

const db = new DatabaseSync(dbPath);
const schema = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8');

db.exec(schema);
console.log('✅ SQLite database schema initialized successfully using node:sqlite.');
