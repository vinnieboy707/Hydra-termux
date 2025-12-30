const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Determine which database to use
const DB_TYPE = process.env.DB_TYPE || 'sqlite'; // 'sqlite' or 'postgres'

let db, run, get, all;

if (DB_TYPE === 'postgres') {
  // Use PostgreSQL
  console.log('Using PostgreSQL database');
  const pgDb = require('./database-pg');
  
  // Initialize PostgreSQL
  pgDb.initPostgresDatabase()
    .then(() => console.log('PostgreSQL initialized'))
    .catch(err => console.error('PostgreSQL init error:', err));
  
  run = pgDb.run;
  get = pgDb.get;
  all = pgDb.all;
  db = pgDb.pool;
} else {
  // Use SQLite (default)
  console.log('Using SQLite database');
  
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database.sqlite');

  // Ensure database directory exists
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Error opening database:', err);
    } else {
      console.log('Connected to SQLite database');
      initDatabase();
    }
  });

  function initDatabase() {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          email TEXT UNIQUE,
          role TEXT DEFAULT 'user',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME
        )
      `);

      // Targets table
      db.run(`
        CREATE TABLE IF NOT EXISTS targets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          host TEXT NOT NULL,
          port INTEGER,
          protocol TEXT,
          description TEXT,
          tags TEXT,
          status TEXT DEFAULT 'pending',
          user_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Attacks table
      db.run(`
        CREATE TABLE IF NOT EXISTS attacks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          attack_type TEXT NOT NULL,
          target_id INTEGER,
          target_host TEXT NOT NULL,
          target_port INTEGER,
          protocol TEXT NOT NULL,
          status TEXT DEFAULT 'queued',
          progress INTEGER DEFAULT 0,
          started_at DATETIME,
          completed_at DATETIME,
          user_id INTEGER,
          config TEXT,
          error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (target_id) REFERENCES targets(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Results table
      db.run(`
        CREATE TABLE IF NOT EXISTS results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          attack_id INTEGER NOT NULL,
          target_host TEXT NOT NULL,
          protocol TEXT NOT NULL,
          username TEXT,
          password TEXT,
          port INTEGER,
          success BOOLEAN DEFAULT 0,
          response_time INTEGER,
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (attack_id) REFERENCES attacks(id)
        )
      `);

      // Wordlists table
      db.run(`
        CREATE TABLE IF NOT EXISTS wordlists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          type TEXT NOT NULL,
          path TEXT NOT NULL,
          size INTEGER,
          line_count INTEGER,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Attack logs table
      db.run(`
        CREATE TABLE IF NOT EXISTS attack_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          attack_id INTEGER NOT NULL,
          level TEXT NOT NULL,
          message TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (attack_id) REFERENCES attacks(id)
        )
      `);

      // Scheduled attacks table
      db.run(`
        CREATE TABLE IF NOT EXISTS scheduled_attacks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          attack_config TEXT NOT NULL,
          schedule TEXT NOT NULL,
          enabled BOOLEAN DEFAULT 1,
          last_run DATETIME,
          next_run DATETIME,
          user_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // API keys table
      db.run(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE NOT NULL,
          user_id INTEGER NOT NULL,
          name TEXT,
          permissions TEXT,
          expires_at DATETIME,
          last_used DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Webhooks table
      db.run(`
        CREATE TABLE IF NOT EXISTS webhooks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          events TEXT NOT NULL,
          description TEXT,
          secret TEXT NOT NULL,
          enabled BOOLEAN DEFAULT 1,
          user_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Webhook deliveries table
      db.run(`
        CREATE TABLE IF NOT EXISTS webhook_deliveries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          webhook_id INTEGER NOT NULL,
          event TEXT NOT NULL,
          payload TEXT,
          status_code INTEGER,
          response TEXT,
          success BOOLEAN DEFAULT 0,
          error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (webhook_id) REFERENCES webhooks(id)
        )
      `);

      console.log('Database tables initialized');
    });
  }

  // Helper functions for common queries
  const db_helpers = {
    run: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, changes: this.changes });
        });
      });
    },

    get: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    },

    all: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }
  };
  
  run = db_helpers.run;
  get = db_helpers.get;
  all = db_helpers.all;
}

module.exports = { db, run, get, all, DB_TYPE };
