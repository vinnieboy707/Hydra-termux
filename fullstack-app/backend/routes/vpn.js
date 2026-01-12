const express = require('express');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const {
  detectVPN,
  trackIPRotation,
  getIPRotationStats,
  clearIPHistory,
  getAllTrackedUsers
} = require('../middleware/vpn-check');
const { extractClientIP } = require('../utils/ip-utils');

const router = express.Router();

/**
 * Check VPN status for current connection
 * GET /api/vpn/status
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    // Extract clean IP address using utility function
    const cleanIP = extractClientIP(req);

    // Detect VPN
    const vpnStatus = await detectVPN(cleanIP);

    // Get IP rotation stats if user is tracked
    const rotationStats = req.user?.id ? await getIPRotationStats(req.user.id) : null;

    res.json({
      vpn: {
        detected: vpnStatus.isVPNDetected,
        confidence: calculateConfidence(vpnStatus),
        checks: {
          interface: vpnStatus.interfaceCheck,
          process: vpnStatus.processCheck,
          dns: vpnStatus.dnsCheck,
          publicIP: vpnStatus.publicIPCheck
        },
        detectedInterface: vpnStatus.detectedInterface,
        detectedProcess: vpnStatus.detectedProcess,
        vpnProvider: vpnStatus.vpnProvider
      },
      ip: {
        current: cleanIP,
        timestamp: vpnStatus.timestamp
      },
      rotation: rotationStats,
      recommendations: generateRecommendations(vpnStatus, rotationStats)
    });
  } catch (error) {
    console.error('Error checking VPN status:', error);
    res.status(500).json({ 
      error: 'Failed to check VPN status',
      message: error.message 
    });
  }
});

/**
 * Track IP rotation - manually record current IP
 * POST /api/vpn/track
 */
router.post('/track', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Extract clean IP address using utility function
    const cleanIP = extractClientIP(req);

    // Track this IP
    const rotationStats = await trackIPRotation(userId, cleanIP);

    res.json({
      message: 'IP tracked successfully',
      rotation: rotationStats
    });
  } catch (error) {
    console.error('Error tracking IP:', error);
    res.status(500).json({ 
      error: 'Failed to track IP',
      message: error.message 
    });
  }
});

/**
 * Get IP rotation history
 * GET /api/vpn/rotation-history
 */
router.get('/rotation-history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await getIPRotationStats(userId);

    res.json({
      userId,
      statistics: stats,
      progress: {
        current: stats.totalIPsTracked,
        target: 1000,
        percentage: Math.min((stats.totalIPsTracked / 1000) * 100, 100).toFixed(1)
      }
    });
  } catch (error) {
    console.error('Error fetching rotation history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch rotation history',
      message: error.message 
    });
  }
});

/**
 * Clear IP rotation history
 * DELETE /api/vpn/rotation-history
 */
router.delete('/rotation-history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    await clearIPHistory(userId);

    res.json({
      message: 'IP rotation history cleared successfully',
      userId
    });
  } catch (error) {
    console.error('Error clearing rotation history:', error);
    res.status(500).json({ 
      error: 'Failed to clear rotation history',
      message: error.message 
    });
  }
});

/**
 * Get all tracked users (admin only)
 * GET /api/vpn/tracked-users
 */
router.get('/tracked-users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = getAllTrackedUsers();

    res.json({
      total: users.length,
      users: users.sort((a, b) => b.totalIPs - a.totalIPs)
    });
  } catch (error) {
    console.error('Error fetching tracked users:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tracked users',
      message: error.message 
    });
  }
});

/**
 * Verify VPN connection with detailed diagnostics
 * GET /api/vpn/verify
 */
router.get('/verify', authMiddleware, async (req, res) => {
  try {
    // Extract clean IP address using utility function
    const cleanIP = extractClientIP(req);

    // Perform comprehensive VPN check
    const vpnStatus = await detectVPN(cleanIP);

    // Detailed diagnostics
    const diagnostics = {
      timestamp: new Date().toISOString(),
      ip: cleanIP,
      vpnDetected: vpnStatus.isVPNDetected,
      checks: [
        {
          name: 'Network Interface Check',
          passed: vpnStatus.interfaceCheck,
          description: 'Checks for VPN network interfaces (tun, tap, wg)',
          details: vpnStatus.detectedInterface || 'No VPN interface detected'
        },
        {
          name: 'Process Check',
          passed: vpnStatus.processCheck,
          description: 'Checks for VPN processes running',
          details: vpnStatus.detectedProcess || 'No VPN process detected'
        },
        {
          name: 'DNS Check',
          passed: vpnStatus.dnsCheck,
          description: 'Checks if using VPN-provided DNS',
          details: vpnStatus.dnsCheck ? 'Using private DNS' : 'Using public DNS'
        },
        {
          name: 'Public IP Check',
          passed: vpnStatus.publicIPCheck,
          description: 'Checks if IP is from known VPN provider',
          details: vpnStatus.vpnProvider || 'Not identified as VPN provider'
        }
      ],
      confidence: calculateConfidence(vpnStatus),
      recommendation: vpnStatus.isVPNDetected ? 
        'VPN connection verified. You are protected.' :
        'No VPN detected. Please connect to a VPN for anonymity.'
    };

    res.json(diagnostics);
  } catch (error) {
    console.error('Error verifying VPN:', error);
    res.status(500).json({ 
      error: 'Failed to verify VPN',
      message: error.message 
    });
  }
});

/**
 * Get VPN configuration recommendations
 * GET /api/vpn/recommendations
 */
router.get('/recommendations', async (req, res) => {
  const recommendations = {
    vpnServices: [
      {
        name: 'OpenVPN',
        description: 'Open-source VPN protocol with strong security',
        installation: 'pkg install openvpn',
        configExample: 'openvpn --config /path/to/config.ovpn'
      },
      {
        name: 'WireGuard',
        description: 'Modern VPN protocol with excellent performance',
        installation: 'pkg install wireguard-tools',
        configExample: 'wg-quick up wg0'
      },
      {
        name: 'Third-party VPN Apps',
        description: 'Commercial VPN services with Android apps',
        examples: ['NordVPN', 'ExpressVPN', 'ProtonVPN', 'Mullvad']
      }
    ],
    bestPractices: [
      'Always use VPN when performing security testing',
      'Rotate VPN endpoints regularly for better anonymity',
      'Use no-logs VPN providers',
      'Enable kill switch to prevent IP leaks',
      'Verify VPN connection before starting attacks',
      'Use strong encryption protocols (OpenVPN, WireGuard)',
      'Avoid free VPN services for security testing',
      'Check for DNS leaks regularly'
    ],
    anonymityTips: [
      'Rotate between different VPN servers',
      'Use VPN + Tor for maximum anonymity (note: slower)',
      'Disable WebRTC in browsers to prevent IP leaks',
      'Use VPN that supports port forwarding for P2P',
      'Clear cookies and browser data between sessions',
      'Consider using a dedicated device for security testing'
    ]
  };

  res.json(recommendations);
});

// Helper functions

function calculateConfidence(vpnStatus) {
  // Weighted confidence scoring - different methods have different reliability
  // Interface check (40%) - most reliable
  // Process check (30%) - reliable
  // DNS check (15%) - less reliable due to custom DNS configs
  // Public IP check (15%) - depends on external service
  
  const weights = {
    interfaceCheck: 0.40,
    processCheck: 0.30,
    dnsCheck: 0.15,
    publicIPCheck: 0.15
  };
  
  let weightedScore = 0;
  let totalWeight = 0;
  
  // Only include defined checks in calculation
  Object.keys(weights).forEach(check => {
    if (vpnStatus[check] !== undefined) {
      totalWeight += weights[check];
      if (vpnStatus[check] === true) {
        weightedScore += weights[check];
      }
    }
  });
  
  // Prevent division by zero
  if (totalWeight === 0) {
    return 0;
  }
  
  // Calculate percentage based on weighted score
  return Math.round((weightedScore / totalWeight) * 100);
}

function generateRecommendations(vpnStatus, rotationStats) {
  const recommendations = [];

  if (!vpnStatus.isVPNDetected) {
    recommendations.push({
      priority: 'high',
      message: 'Connect to a VPN before performing security testing',
      action: 'Install and configure OpenVPN or WireGuard'
    });
  }

  if (rotationStats && rotationStats.uniqueIPs < 5 && rotationStats.totalIPsTracked > 50) {
    recommendations.push({
      priority: 'medium',
      message: 'Consider rotating VPN endpoints more frequently',
      action: 'Switch to different VPN servers periodically'
    });
  }

  if (rotationStats && rotationStats.totalIPsTracked >= 1000) {
    recommendations.push({
      priority: 'info',
      message: 'You have reached the IP rotation tracking limit (1000)',
      action: 'Your IP rotation history is at maximum capacity'
    });
  }

  // Explicit check for false (not undefined)
  if (vpnStatus.isVPNDetected && vpnStatus.dnsCheck === false) {
    recommendations.push({
      priority: 'medium',
      message: 'Potential DNS leak detected',
      action: 'Configure your VPN to use its own DNS servers'
    });
  }

  return recommendations;
}

module.exports = router;
