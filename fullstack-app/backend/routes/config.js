const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Get configuration
router.get('/', authMiddleware, async (req, res) => {
  try {
    const configPath = process.env.CONFIG_PATH || path.join(__dirname, '../../../config/hydra.conf');
    
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      res.json({ 
        config: configContent,
        path: configPath
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Configuration file not found' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error fetching configuration:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// Update configuration
router.put('/', authMiddleware, async (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({ error: 'Configuration content is required' });
    }
    
    const configPath = process.env.CONFIG_PATH || path.join(__dirname, '../../../config/hydra.conf');
    
    // Backup existing config
    try {
      const existingConfig = await fs.readFile(configPath, 'utf-8');
      const backupPath = `${configPath}.backup.${Date.now()}`;
      await fs.writeFile(backupPath, existingConfig);
    } catch (error) {
      console.warn('Could not create backup:', error.message);
    }
    
    // Write new config
    await fs.writeFile(configPath, config, 'utf-8');
    
    res.json({ 
      message: 'Configuration updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Get configuration schema/help
router.get('/schema', authMiddleware, async (req, res) => {
  const schema = {
    sections: [
      {
        name: 'GENERAL',
        options: [
          { key: 'default_threads', type: 'integer', default: 16, description: 'Default number of parallel threads' },
          { key: 'timeout', type: 'integer', default: 30, description: 'Connection timeout in seconds' },
          { key: 'verbose', type: 'boolean', default: true, description: 'Enable verbose output' },
          { key: 'output_format', type: 'string', default: 'json', description: 'Output format (json, txt, csv)' },
          { key: 'log_directory', type: 'string', default: '~/hydra-logs', description: 'Log file directory' }
        ]
      },
      {
        name: 'SECURITY',
        options: [
          { key: 'vpn_check', type: 'boolean', default: true, description: 'Check for VPN connection' },
          { key: 'rate_limit', type: 'boolean', default: true, description: 'Enable rate limiting' },
          { key: 'max_attempts', type: 'integer', default: 1000, description: 'Maximum login attempts' },
          { key: 'random_delay', type: 'boolean', default: true, description: 'Random delay between attempts' }
        ]
      },
      {
        name: 'WORDLISTS',
        options: [
          { key: 'default_passwords', type: 'string', default: '~/wordlists/common_passwords.txt', description: 'Default password wordlist' },
          { key: 'admin_passwords', type: 'string', default: '~/wordlists/admin_passwords.txt', description: 'Admin password wordlist' },
          { key: 'usernames', type: 'string', default: '~/wordlists/admin_usernames.txt', description: 'Username wordlist' }
        ]
      }
    ]
  };
  
  res.json({ schema });
});

module.exports = router;
