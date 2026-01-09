const { exec } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');

const execPromise = promisify(exec);

/**
 * VPN Verification Middleware
 * Checks if user is connected through a VPN before allowing sensitive operations
 */

// Track IP rotation history
const ipRotationHistory = new Map();

/**
 * Check if VPN is active using multiple detection methods
 */
async function detectVPN(userIP) {
  const checks = {
    interfaceCheck: false,
    processCheck: false,
    dnsCheck: false,
    publicIPCheck: false,
    ipAddress: userIP,
    timestamp: new Date().toISOString()
  };

  try {
    // Method 1: Check for VPN network interfaces (tun, tap, wg, etc.)
    try {
      const { stdout } = await execPromise('ip link show 2>/dev/null || ifconfig 2>/dev/null');
      const vpnInterfaces = ['tun0', 'tun1', 'tap0', 'ppp0', 'wg0', 'ipsec0'];
      checks.interfaceCheck = vpnInterfaces.some(iface => stdout.includes(iface));
      
      if (checks.interfaceCheck) {
        checks.detectedInterface = vpnInterfaces.find(iface => stdout.includes(iface));
      }
    } catch (error) {
      // Interface check failed, continue with other methods
    }

    // Method 2: Check for VPN processes
    try {
      const { stdout } = await execPromise('ps aux 2>/dev/null || ps -ef 2>/dev/null');
      const vpnProcesses = ['openvpn', 'wireguard', 'vpnc', 'strongswan', 'ipsec'];
      checks.processCheck = vpnProcesses.some(proc => stdout.toLowerCase().includes(proc));
      
      if (checks.processCheck) {
        checks.detectedProcess = vpnProcesses.find(proc => stdout.toLowerCase().includes(proc));
      }
    } catch (error) {
      // Process check failed, continue
    }

    // Method 3: Check DNS for private ranges (VPN-provided DNS)
    try {
      const { stdout } = await execPromise('cat /etc/resolv.conf 2>/dev/null');
      const dnsServers = stdout.match(/nameserver\s+([\d.]+)/g);
      if (dnsServers) {
        const privateDNS = dnsServers.some(dns => {
          const ip = dns.replace('nameserver', '').trim();
          return ip.startsWith('10.') || 
                 ip.startsWith('172.') || 
                 ip.startsWith('192.168.');
        });
        checks.dnsCheck = privateDNS;
      }
    } catch (error) {
      // DNS check failed
    }

    // Method 4: Check public IP against known VPN/proxy providers
    try {
      // Check if IP is from known VPN provider ranges
      // This would typically query a VPN detection API
      const response = await axios.get(`https://vpnapi.io/api/${userIP}`, {
        timeout: 3000
      }).catch(() => null);
      
      if (response && response.data) {
        checks.publicIPCheck = response.data.security?.vpn || response.data.security?.proxy || false;
        checks.vpnProvider = response.data.network?.autonomous_system_organization;
      }
    } catch (error) {
      // Public IP check failed, but don't fail the whole check
    }

    // Determine if VPN is detected
    checks.isVPNDetected = checks.interfaceCheck || 
                           checks.processCheck || 
                           checks.dnsCheck || 
                           checks.publicIPCheck;

    return checks;
  } catch (error) {
    console.error('VPN detection error:', error);
    return { ...checks, error: error.message };
  }
}

/**
 * Track IP rotation patterns
 * Monitors if user is rotating through multiple IPs (VPN endpoint switching)
 */
function trackIPRotation(userId, ipAddress) {
  if (!ipRotationHistory.has(userId)) {
    ipRotationHistory.set(userId, []);
  }

  const userHistory = ipRotationHistory.get(userId);
  const now = Date.now();

  // Add current IP with timestamp
  userHistory.push({
    ip: ipAddress,
    timestamp: now
  });

  // Keep only last 1000 IPs (as per requirement)
  if (userHistory.length > 1000) {
    userHistory.shift();
  }

  // Calculate unique IPs in the last hour
  const oneHourAgo = now - (60 * 60 * 1000);
  const recentIPs = userHistory.filter(entry => entry.timestamp > oneHourAgo);
  const uniqueRecentIPs = new Set(recentIPs.map(entry => entry.ip));

  return {
    totalIPsTracked: userHistory.length,
    uniqueIPsLastHour: uniqueRecentIPs.size,
    currentIP: ipAddress,
    ipRotationRate: uniqueRecentIPs.size > 1 ? 'active' : 'static',
    ipHistory: userHistory.slice(-10) // Return last 10 IPs
  };
}

/**
 * Get IP rotation statistics for a user
 */
function getIPRotationStats(userId) {
  if (!ipRotationHistory.has(userId)) {
    return {
      totalIPsTracked: 0,
      uniqueIPs: 0,
      firstSeen: null,
      lastSeen: null,
      ipHistory: []
    };
  }

  const userHistory = ipRotationHistory.get(userId);
  const uniqueIPs = new Set(userHistory.map(entry => entry.ip));

  return {
    totalIPsTracked: userHistory.length,
    uniqueIPs: uniqueIPs.size,
    firstSeen: userHistory[0]?.timestamp,
    lastSeen: userHistory[userHistory.length - 1]?.timestamp,
    ipHistory: userHistory.slice(-100), // Return last 100 IPs
    reachedThreshold: userHistory.length >= 1000
  };
}

/**
 * Middleware to verify VPN connection before sensitive operations
 */
const vpnCheckMiddleware = (options = {}) => {
  const { 
    enforceVPN = true, 
    trackRotation = true,
    minIPRotation = 0 
  } = options;

  return async (req, res, next) => {
    try {
      // Get user IP address
      const userIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection.remoteAddress ||
                     req.socket.remoteAddress ||
                     req.ip;

      // Clean IPv6 prefix if present
      const cleanIP = userIP.replace(/^::ffff:/, '');

      // Track IP rotation if enabled
      if (trackRotation && req.user?.id) {
        const rotationStats = trackIPRotation(req.user.id, cleanIP);
        req.ipRotation = rotationStats;
      }

      // Perform VPN detection
      const vpnStatus = await detectVPN(cleanIP);

      // Attach VPN status to request
      req.vpnStatus = vpnStatus;
      req.clientIP = cleanIP;

      // If VPN is not required, just log and continue
      if (!enforceVPN) {
        if (!vpnStatus.isVPNDetected) {
          console.log(`⚠️  Warning: User ${req.user?.username || 'unknown'} not using VPN (IP: ${cleanIP})`);
        }
        return next();
      }

      // Enforce VPN requirement
      if (!vpnStatus.isVPNDetected) {
        return res.status(403).json({
          error: 'VPN connection required',
          message: 'You must be connected to a VPN to perform this operation',
          suggestion: 'Please connect to a VPN service and try again',
          vpnStatus: {
            detected: false,
            yourIP: cleanIP,
            checks: {
              interface: vpnStatus.interfaceCheck,
              process: vpnStatus.processCheck,
              dns: vpnStatus.dnsCheck,
              publicIP: vpnStatus.publicIPCheck
            }
          },
          recommendations: [
            'Use OpenVPN, WireGuard, or similar VPN service',
            'Verify your VPN connection is active',
            'Check that VPN is not in split-tunnel mode'
          ]
        });
      }

      // Check minimum IP rotation requirement
      if (minIPRotation > 0 && req.ipRotation) {
        if (req.ipRotation.uniqueIPsLastHour < minIPRotation) {
          return res.status(403).json({
            error: 'Insufficient IP rotation',
            message: `Minimum ${minIPRotation} different IPs required in the last hour`,
            current: req.ipRotation.uniqueIPsLastHour,
            suggestion: 'Switch VPN endpoints more frequently for better anonymity'
          });
        }
      }

      // VPN verified, continue
      next();
    } catch (error) {
      console.error('VPN check middleware error:', error);
      
      // In case of error, decide whether to fail open or closed
      if (enforceVPN) {
        return res.status(500).json({
          error: 'VPN verification failed',
          message: 'Unable to verify VPN status',
          details: error.message
        });
      } else {
        // Fail open - allow request but log error
        console.error('VPN check failed but continuing (enforceVPN=false)');
        next();
      }
    }
  };
};

/**
 * Clear IP history for a user
 */
function clearIPHistory(userId) {
  ipRotationHistory.delete(userId);
}

/**
 * Get all users with IP tracking data
 */
function getAllTrackedUsers() {
  const users = [];
  for (const [userId, history] of ipRotationHistory.entries()) {
    const uniqueIPs = new Set(history.map(entry => entry.ip));
    users.push({
      userId,
      totalIPs: history.length,
      uniqueIPs: uniqueIPs.size,
      lastSeen: history[history.length - 1]?.timestamp
    });
  }
  return users;
}

module.exports = {
  vpnCheckMiddleware,
  detectVPN,
  trackIPRotation,
  getIPRotationStats,
  clearIPHistory,
  getAllTrackedUsers
};
