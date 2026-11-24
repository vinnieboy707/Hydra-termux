const express = require('express');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const router = express.Router();
const execPromise = promisify(exec);

// Get system information
router.get('/info', authMiddleware, async (req, res) => {
  try {
    const info = {
      version: '2.0.0 Ultimate Edition',
      platform: process.platform,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        total: Math.round(require('os').totalmem() / 1024 / 1024),
        free: Math.round(require('os').freemem() / 1024 / 1024),
        used: Math.round((require('os').totalmem() - require('os').freemem()) / 1024 / 1024)
      },
      cpu: require('os').cpus()[0]?.model || 'Unknown',
      cores: require('os').cpus().length
    };
    
    // Check if Hydra is installed
    try {
      const { stdout } = await execPromise('hydra -h 2>&1 | head -n 1');
      info.hydraInstalled = true;
      info.hydraVersion = stdout.trim();
    } catch {
      info.hydraInstalled = false;
    }
    
    res.json({ info });
  } catch (error) {
    console.error('Error fetching system info:', error);
    res.status(500).json({ error: 'Failed to fetch system information' });
  }
});

// Check for updates
router.get('/update/check', authMiddleware, async (req, res) => {
  try {
    const projectRoot = path.join(__dirname, '../../..');
    
    try {
      // Check if in git repo
      await execPromise('git rev-parse --git-dir', { cwd: projectRoot });
      
      // Fetch latest changes
      await execPromise('git fetch origin', { cwd: projectRoot });
      
      // Get current hash
      const { stdout: localHash } = await execPromise('git rev-parse HEAD', { cwd: projectRoot });
      
      // Determine default branch and get remote hash
      let remoteHash;
      try {
        const { stdout: mainHash } = await execPromise('git rev-parse origin/main', { cwd: projectRoot });
        remoteHash = mainHash;
      } catch {
        try {
          const { stdout: masterHash } = await execPromise('git rev-parse origin/master', { cwd: projectRoot });
          remoteHash = masterHash;
        } catch {
          throw new Error('Could not find default branch (main or master)');
        }
      }
      
      const upToDate = localHash.trim() === remoteHash.trim();
      
      let changeCount = 0;
      if (!upToDate) {
        try {
          const { stdout: changes } = await execPromise(
            `git rev-list HEAD..origin/main --count`,
            { cwd: projectRoot }
          );
          changeCount = parseInt(changes.trim()) || 0;
        } catch {
          const { stdout: changes } = await execPromise(
            `git rev-list HEAD..origin/master --count`,
            { cwd: projectRoot }
          );
          changeCount = parseInt(changes.trim()) || 0;
        }
      }
      
      res.json({
        upToDate,
        currentVersion: localHash.trim().substring(0, 7),
        latestVersion: remoteHash.trim().substring(0, 7),
        changesAvailable: changeCount
      });
    } catch (error) {
      res.json({
        error: 'Not a git repository or unable to check updates',
        upToDate: true
      });
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
    res.status(500).json({ error: 'Failed to check for updates' });
  }
});

// Perform update (admin only for security)
router.post('/update/apply', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const projectRoot = path.join(__dirname, '../../..');
    
    try {
      // Determine default branch
      let branch = 'main';
      try {
        await execPromise('git rev-parse origin/main', { cwd: projectRoot });
      } catch {
        branch = 'master';
      }
      
      // Pull latest changes
      const { stdout, stderr } = await execPromise(`git pull origin ${branch}`, { 
        cwd: projectRoot 
      });
      
      res.json({
        message: 'Update completed successfully',
        output: stdout + stderr,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Update failed',
        message: error.message,
        output: error.stdout + error.stderr
      });
    }
  } catch (error) {
    console.error('Error applying update:', error);
    res.status(500).json({ error: 'Failed to apply update' });
  }
});

// Get help/documentation
router.get('/help', authMiddleware, async (req, res) => {
  const help = {
    attackScripts: [
      {
        id: 1,
        name: 'SSH Admin Attack',
        description: 'Multi-wordlist SSH brute-force with resume support',
        usage: 'bash scripts/ssh_admin_attack.sh -t <target>',
        options: [
          { flag: '-t', description: 'Target IP or hostname (required)' },
          { flag: '-p', description: 'Custom port (default: 22)' },
          { flag: '-u', description: 'Custom username list' },
          { flag: '-w', description: 'Custom password wordlist' },
          { flag: '-T', description: 'Number of threads (default: 16)' },
          { flag: '-v', description: 'Verbose output' }
        ]
      },
      {
        id: 2,
        name: 'FTP Admin Attack',
        description: 'FTP service attack with connection handling',
        usage: 'bash scripts/ftp_admin_attack.sh -t <target>',
        options: [
          { flag: '-t', description: 'Target IP or hostname (required)' },
          { flag: '-p', description: 'Custom port (default: 21)' }
        ]
      },
      {
        id: 3,
        name: 'Web Admin Attack',
        description: 'HTTP/HTTPS admin panel detection and attack',
        usage: 'bash scripts/web_admin_attack.sh -t <target>',
        options: [
          { flag: '-t', description: 'Target hostname (required)' },
          { flag: '-P', description: 'Admin panel path (e.g., /admin)' },
          { flag: '-s', description: 'Use HTTPS' }
        ]
      },
      {
        id: 4,
        name: 'RDP Admin Attack',
        description: 'Windows RDP with lockout prevention',
        usage: 'bash scripts/rdp_admin_attack.sh -t <target>',
        options: [
          { flag: '-t', description: 'Target IP or hostname (required)' },
          { flag: '-p', description: 'Custom port (default: 3389)' }
        ]
      },
      {
        id: 5,
        name: 'MySQL Admin Attack',
        description: 'Database attack with connection strings',
        usage: 'bash scripts/mysql_admin_attack.sh -t <target>',
        options: [
          { flag: '-t', description: 'Target IP or hostname (required)' },
          { flag: '-p', description: 'Custom port (default: 3306)' }
        ]
      },
      {
        id: 6,
        name: 'PostgreSQL Admin Attack',
        description: 'PostgreSQL-specific attacks',
        usage: 'bash scripts/postgres_admin_attack.sh -t <target>',
        options: [
          { flag: '-t', description: 'Target IP or hostname (required)' },
          { flag: '-p', description: 'Custom port (default: 5432)' }
        ]
      },
      {
        id: 7,
        name: 'SMB Admin Attack',
        description: 'Windows SMB/CIFS with domain support',
        usage: 'bash scripts/smb_admin_attack.sh -t <target>',
        options: [
          { flag: '-t', description: 'Target IP or hostname (required)' },
          { flag: '-p', description: 'Custom port (default: 445)' }
        ]
      },
      {
        id: 8,
        name: 'Multi-Protocol Auto Attack',
        description: 'Automated reconnaissance and attack chain',
        usage: 'bash scripts/admin_auto_attack.sh -t <target>',
        options: [
          { flag: '-t', description: 'Target IP or hostname (required)' },
          { flag: '-r', description: 'Enable reconnaissance scan' }
        ]
      }
    ],
    utilities: [
      {
        id: 9,
        name: 'Download Wordlists',
        description: 'Download and organize password lists from SecLists'
      },
      {
        id: 10,
        name: 'Generate Custom Wordlist',
        description: 'Combine, dedupe, sort, and filter wordlists'
      },
      {
        id: 11,
        name: 'Scan Target',
        description: 'Quick nmap wrapper with multiple scan modes'
      },
      {
        id: 12,
        name: 'View Attack Results',
        description: 'Filter, export, and manage attack results'
      }
    ],
    management: [
      {
        id: 13,
        name: 'View Configuration',
        description: 'Display current Hydra-Termux configuration'
      },
      {
        id: 14,
        name: 'View Logs',
        description: 'Display recent attack logs and activity'
      },
      {
        id: 15,
        name: 'Export Results',
        description: 'Export results in TXT, CSV, or JSON format'
      },
      {
        id: 16,
        name: 'Update Hydra-Termux',
        description: 'Check for and install updates from GitHub'
      }
    ],
    apiEndpoints: {
      authentication: [
        'POST /api/auth/register',
        'POST /api/auth/login',
        'GET /api/auth/verify'
      ],
      attacks: [
        'GET /api/attacks',
        'GET /api/attacks/:id',
        'POST /api/attacks',
        'POST /api/attacks/:id/stop',
        'DELETE /api/attacks/:id'
      ],
      targets: [
        'GET /api/targets',
        'POST /api/targets',
        'PUT /api/targets/:id',
        'DELETE /api/targets/:id'
      ],
      results: [
        'GET /api/results',
        'GET /api/results/attack/:attackId',
        'GET /api/results/export'
      ]
    }
  };
  
  res.json({ help });
});

// Get about/credits information
router.get('/about', async (req, res) => {
  const about = {
    name: 'Hydra-Termux Ultimate Edition',
    version: '2.0.0',
    description: 'A powerful brute-force tool suite optimized for Termux on Android devices',
    features: [
      '8 Pre-built attack scripts',
      'Multi-protocol auto attack',
      'Wordlist management',
      'Target scanning',
      'Results tracking',
      'Comprehensive logging',
      'Full-stack web application',
      'RESTful API with JWT authentication',
      'Real-time WebSocket updates'
    ],
    credits: {
      original: 'cyrushar/Hydra-Termux',
      enhanced: 'vinnieboy707',
      hydra: 'THC-Hydra team',
      wordlists: 'SecLists by Daniel Miessler'
    },
    license: 'MIT',
    repository: 'https://github.com/vinnieboy707/Hydra-termux',
    disclaimer: 'This tool is for educational and authorized security testing purposes ONLY. Unauthorized access to computer systems is illegal.'
  };
  
  res.json({ about });
});

module.exports = router;
