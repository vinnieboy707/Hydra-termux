#!/usr/bin/env node
/**
 * Initialize Default Admin User
 * Creates a default admin account if none exists
 * Password meets all security requirements
 */

const bcrypt = require('bcryptjs');
const { run, get, DB_TYPE } = require('./database');
const readline = require('readline');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Default credentials with strong password
const DEFAULT_USERS = [
  {
    username: 'admin',
    password: 'Admin@123',  // Meets all requirements: uppercase, lowercase, number, special char, 8+ chars
    email: 'admin@hydra.local',
    role: 'super_admin'
  },
  {
    username: 'demo',
    password: 'Demo@123',
    email: 'demo@hydra.local',
    role: 'user'
  }
];

async function initializeDefaultUsers() {
  console.log('');
  colorLog('blue', '╔════════════════════════════════════════════════════════════════╗');
  colorLog('blue', '║  Hydra-Termux - Default User Initialization                   ║');
  colorLog('blue', '╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Wait a bit for database to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    colorLog('blue', `ℹ  Using ${DB_TYPE.toUpperCase()} database`);
    console.log('');

    for (const defaultUser of DEFAULT_USERS) {
      try {
        // Check if user already exists
        const existing = await get(
          'SELECT id, username, role FROM users WHERE username = ?',
          [defaultUser.username]
        );

        if (existing) {
          colorLog('yellow', `⚠  User '${defaultUser.username}' already exists (ID: ${existing.id}, Role: ${existing.role})`);
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(defaultUser.password, 10);

        // Create user
        const result = await run(
          'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
          [defaultUser.username, hashedPassword, defaultUser.email, defaultUser.role]
        );

        colorLog('green', `✓ Created user: ${defaultUser.username}`);
        colorLog('blue', `  Role: ${defaultUser.role}`);
        colorLog('blue', `  Email: ${defaultUser.email}`);
        colorLog('blue', `  Password: ${defaultUser.password.substring(0, 3)}***`);
        
        if (defaultUser.role === 'super_admin') {
          colorLog('red', `  ⚠  CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!`);
        }
        console.log('');

      } catch (error) {
        colorLog('red', `✗ Error creating user '${defaultUser.username}': ${error.message}`);
      }
    }

    console.log('');
    colorLog('green', '╔════════════════════════════════════════════════════════════════╗');
    colorLog('green', '║  ✓ User Initialization Complete                               ║');
    colorLog('green', '╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    
    colorLog('blue', '📋 Default Credentials:');
    console.log('');
    colorLog('green', '   Admin Account:');
    colorLog('blue', '   Username: admin');
    colorLog('blue', '   Password: See documentation or initial setup output');
    console.log('');
    colorLog('green', '   Demo Account:');
    colorLog('blue', '   Username: demo');
    colorLog('blue', '   Password: See documentation or initial setup output');
    console.log('');
    colorLog('red', '   ⚠  CRITICAL: Change these passwords immediately after first login!');
    colorLog('blue', '   📖 Default passwords are in QUICKSTART_GUIDE.md');
    console.log('');

  } catch (error) {
    colorLog('red', `✗ Fatal error: ${error.message}`);
    console.error(error);
    if (require.main === module) {
      process.exit(1);
    } else {
      throw error;
    }
  }

  // Only exit if run as main module
  if (require.main === module) {
    // Give time for async operations to complete
    setTimeout(() => {
      process.exit(0);
    }, 500);
  }
}

// Run if called directly
if (require.main === module) {
  initializeDefaultUsers();
}

module.exports = { initializeDefaultUsers, DEFAULT_USERS };
