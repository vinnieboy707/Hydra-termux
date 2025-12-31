const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { spawn } = require('child_process');
const dns = require('dns').promises;

const router = express.Router();

// Scan target endpoint
router.post('/target', authMiddleware, async (req, res) => {
  try {
    const { target, targetType, scanType } = req.body;

    if (!target) {
      return res.status(400).json({ error: 'Target is required' });
    }

    // Detect target type if not provided
    const detectedType = targetType || detectTargetType(target);
    
    let scanResults = {
      target,
      targetType: detectedType,
      openPorts: 0,
      services: 0,
      protocols: [],
      emailInfo: null
    };

    if (detectedType === 'email') {
      // Handle email scanning
      scanResults = await scanEmail(target);
    } else {
      // Handle IP/domain scanning
      scanResults = await scanNetwork(target, scanType || 'quick');
    }

    res.json(scanResults);
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ 
      error: 'Scan failed', 
      message: error.message 
    });
  }
});

function detectTargetType(target) {
  // Email detection
  if (target.includes('@') && target.includes('.')) {
    return 'email';
  }
  // IP address detection
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(target)) {
    return 'ip';
  }
  // Domain/hostname detection
  if (target.includes('.')) {
    return 'domain';
  }
  return 'unknown';
}

async function scanEmail(email) {
  const domain = email.split('@')[1];
  
  try {
    const mxRecords = await dns.resolveMx(domain);
    
    return {
      target: email,
      targetType: 'email',
      emailInfo: {
        domain,
        mxRecords: mxRecords.map(mx => `${mx.exchange} (priority: ${mx.priority})`)
      },
      openPorts: 0,
      services: 0,
      protocols: []
    };
  } catch (error) {
    return {
      target: email,
      targetType: 'email',
      emailInfo: {
        domain,
        mxRecords: [],
        error: 'Could not resolve MX records'
      },
      openPorts: 0,
      services: 0,
      protocols: []
    };
  }
}

async function scanNetwork(target, scanType) {
  return new Promise((resolve, reject) => {
    // Define scan parameters based on type
    let nmapArgs = [];
    
    switch (scanType) {
      case 'quick':
        nmapArgs = ['-F', '--top-ports', '100', target];
        break;
      case 'full':
        nmapArgs = ['-p-', target];
        break;
      case 'aggressive':
        nmapArgs = ['-A', '-T4', target];
        break;
      default:
        nmapArgs = ['-F', target];
    }

    // Check if nmap is available, if not use simulated results
    const nmap = spawn('nmap', nmapArgs);
    
    let output = '';
    let errorOutput = '';
    
    nmap.stdout.on('data', (data) => {
      output += data.toString();
    });

    nmap.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    nmap.on('close', (code) => {
      if (code !== 0 && code !== null) {
        // If nmap is not available or fails, return simulated results
        console.log('Nmap not available, using simulated scan results');
        resolve(getSimulatedScanResults(target));
        return;
      }

      // Parse nmap output
      const results = parseNmapOutput(output, target);
      resolve(results);
    });

    nmap.on('error', (error) => {
      // Nmap not installed, return simulated results
      console.log('Nmap not found, using simulated scan results');
      resolve(getSimulatedScanResults(target));
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      nmap.kill();
      resolve(getSimulatedScanResults(target));
    }, 120000);
  });
}

function parseNmapOutput(output, target) {
  const protocols = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    // Match lines like: 22/tcp   open  ssh
    const match = line.match(/(\d+)\/tcp\s+open\s+(\S+)/);
    if (match) {
      const port = parseInt(match[1]);
      const service = match[2];
      
      protocols.push({
        port,
        service,
        state: 'open'
      });
    }
  }

  return {
    target,
    targetType: detectTargetType(target),
    openPorts: protocols.length,
    services: protocols.length,
    protocols
  };
}

function getSimulatedScanResults(target) {
  // Simulated common open ports for demonstration
  const commonPorts = [
    { port: 22, service: 'ssh', state: 'open' },
    { port: 80, service: 'http', state: 'open' },
    { port: 443, service: 'https', state: 'open' }
  ];

  return {
    target,
    targetType: detectTargetType(target),
    openPorts: commonPorts.length,
    services: commonPorts.length,
    protocols: commonPorts,
    simulated: true
  };
}

module.exports = router;
