const { Pool } = require('pg');

// PostgreSQL connection configuration
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'hydra_termux',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize PostgreSQL database schema
async function initPostgresDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);

    // Targets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS targets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        host VARCHAR(255) NOT NULL,
        port INTEGER,
        protocol VARCHAR(50),
        description TEXT,
        tags TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Attacks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS attacks (
        id SERIAL PRIMARY KEY,
        attack_type VARCHAR(100) NOT NULL,
        target_id INTEGER REFERENCES targets(id),
        target_host VARCHAR(255) NOT NULL,
        target_port INTEGER,
        protocol VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'queued',
        progress INTEGER DEFAULT 0,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        user_id INTEGER REFERENCES users(id),
        config TEXT,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Results table
    await client.query(`
      CREATE TABLE IF NOT EXISTS results (
        id SERIAL PRIMARY KEY,
        attack_id INTEGER NOT NULL REFERENCES attacks(id),
        target_host VARCHAR(255) NOT NULL,
        protocol VARCHAR(50) NOT NULL,
        username VARCHAR(255),
        password VARCHAR(255),
        port INTEGER,
        success BOOLEAN DEFAULT FALSE,
        response_time INTEGER,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Wordlists table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wordlists (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL,
        path VARCHAR(500) NOT NULL,
        size BIGINT,
        line_count INTEGER,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Attack logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS attack_logs (
        id SERIAL PRIMARY KEY,
        attack_id INTEGER NOT NULL REFERENCES attacks(id),
        level VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Scheduled attacks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduled_attacks (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        attack_config TEXT NOT NULL,
        schedule VARCHAR(255) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        last_run TIMESTAMP,
        next_run TIMESTAMP,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // API keys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id),
        name VARCHAR(255),
        permissions TEXT,
        expires_at TIMESTAMP,
        last_used TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Webhooks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url VARCHAR(500) NOT NULL,
        events TEXT NOT NULL,
        description TEXT,
        secret VARCHAR(255) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Webhook deliveries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id SERIAL PRIMARY KEY,
        webhook_id INTEGER NOT NULL REFERENCES webhooks(id),
        event VARCHAR(255) NOT NULL,
        payload TEXT,
        status_code INTEGER,
        response TEXT,
        success BOOLEAN DEFAULT FALSE,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('COMMIT');
    console.log('PostgreSQL database tables initialized');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing PostgreSQL database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Helper functions for PostgreSQL queries
const pg_helpers = {
  run: async (sql, params = []) => {
    const client = await pool.connect();
    try {
      // Convert SQLite-style placeholders (?) to PostgreSQL-style ($1, $2, etc.)
      let index = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++index}`);
      
      // For INSERT statements, add RETURNING id to get the inserted ID
      let finalSql = pgSql;
      if (pgSql.trim().toUpperCase().startsWith('INSERT')) {
        // Check if RETURNING clause already exists
        if (!pgSql.toUpperCase().includes('RETURNING')) {
          finalSql = pgSql.trim().replace(/;?\s*$/, ' RETURNING id');
        }
      }
      
      const result = await client.query(finalSql, params);
      return { 
        id: result.rows[0]?.id, 
        changes: result.rowCount 
      };
    } finally {
      client.release();
    }
  },

  get: async (sql, params = []) => {
    const client = await pool.connect();
    try {
      // Convert SQLite-style placeholders (?) to PostgreSQL-style ($1, $2, etc.)
      let index = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++index}`);
      
      const result = await client.query(pgSql, params);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  },

  all: async (sql, params = []) => {
    const client = await pool.connect();
    try {
      // Convert SQLite-style placeholders (?) to PostgreSQL-style ($1, $2, etc.)
      let index = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++index}`);
      
      const result = await client.query(pgSql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }
};

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

module.exports = { 
  pool, 
  initPostgresDatabase,
  ...pg_helpers 
};
