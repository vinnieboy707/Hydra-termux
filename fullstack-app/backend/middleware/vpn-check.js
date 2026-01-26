const { exec } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const { sanitizePath, sanitizeFilename, sanitizeLogMessage, sanitizeError, check2FARequirement } = require('../utils/sanitizer');
const { extractClientIP, sanitizeIPForLog, isValidIP, isPrivateIP } = require('../utils/ip-utils');
const { run, get } = require('../database');

const execPromise = promisify(exec);

/**
 * VPN Verification Middleware - Comprehensive Implementation
 * Checks if user is connected through a VPN before allowing sensitive operations
 * 
 * Features:
 * - Multi-method VPN detection with confidence scoring
 * - Database-persisted IP rotation tracking
 * - Memory leak prevention with cleanup
 * - Command injection protection
 * - Rate limiting for external API calls
 * - Per-user VPN requirement settings
 */

// In-memory cache for IP rotation (with TTL cleanup)
const ipRotationCache = new Map();
const CACHE_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const USER_INACTIVITY_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting for external VPN API calls
const apiCallTimestamps = new Map();
const API_RATE_LIMIT_MS = 60000; // 1 minute between calls per IP

// Cleanup stale cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, history] of ipRotationCache.entries()) {
    const lastActivity = history[history.length - 1]?.timestamp || 0;
    if (now - lastActivity > USER_INACTIVITY_THRESHOLD) {
      ipRotationCache.delete(userId);
      console.log(`Cleaned up IP rotation cache for inactive user: ${userId}`);
    }
  }
}, CACHE_CLEANUP_INTERVAL);

/**
 * Check if VPN is active using multiple detection methods
 * Implements command injection protection and timeout handling
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
      // Use timeout to prevent hanging
      const { stdout } = await Promise.race([
        execPromise('ip link show 2>/dev/null || ifconfig 2>/dev/null'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      
      const vpnInterfaces = ['tun0', 'tun1', 'tap0', 'ppp0', 'wg0', 'ipsec0'];
      // Use indexOf for safer string matching
      checks.interfaceCheck = vpnInterfaces.some(iface => stdout.indexOf(iface) !== -1);
      
      if (checks.interfaceCheck) {
        checks.detectedInterface = vpnInterfaces.find(iface => stdout.indexOf(iface) !== -1);
      }
    } catch (error) {
      // Interface check failed, continue with other methods
      if (error.message !== 'Timeout') {
        console.debug('VPN interface check failed:', error.message);
      }
    }

    // Method 2: Check for VPN processes
    try {
      const { stdout } = await Promise.race([
        execPromise('ps aux 2>/dev/null || ps -ef 2>/dev/null'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      
      const vpnProcesses = ['openvpn', 'wireguard', 'vpnc', 'strongswan', 'ipsec'];
      const lowerOutput = stdout.toLowerCase();
      checks.processCheck = vpnProcesses.some(proc => lowerOutput.indexOf(proc) !== -1);
      
      if (checks.processCheck) {
        checks.detectedProcess = vpnProcesses.find(proc => lowerOutput.indexOf(proc) !== -1);
      }
    } catch (error) {
      // Process check failed, continue
      if (error.message !== 'Timeout') {
        console.debug('VPN process check failed:', error.message);
      }
    }

    // Method 3: Check DNS for private ranges (VPN-provided DNS)
    try {
      const { stdout } = await Promise.race([
        execPromise('cat /etc/resolv.conf 2>/dev/null'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
      ]);
      
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
      if (error.message !== 'Timeout') {
        console.debug('DNS check failed:', error.message);
      }
    }

    // Method 4: Check public IP against known VPN/proxy providers
    // Rate limited to prevent API abuse
    try {
      const now = Date.now();
      const lastCall = apiCallTimestamps.get(userIP) || 0;
      
      if (!isValidIP(userIP) || isPrivateIP(userIP)) {
        // Skip external VPN API lookup for invalid or private/internal IPs
        console.debug(sanitizeLogMessage(`Skipping VPN API check for non-public or invalid IP: ${userIP}`));
      } else if (now - lastCall < API_RATE_LIMIT_MS) {
        // Skip API call if rate limited, use cached result if available
        console.debug(`VPN API check rate limited for IP: ${userIP}`);
      } else {
        apiCallTimestamps.set(userIP, now);
        
        // Check if IP is from known VPN provider ranges
        // Note: This sends user IP to external service - documented privacy implication
        const response = await axios.get(`https://vpnapi.io/api/${userIP}`, {
          timeout: 3000,
          maxRedirects: 0
        }).catch(err => {
          // Handle expected network errors gracefully
          if (err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
            console.debug('VPN API service unavailable:', err.code);
          }
          return null;
        });
        
        if (response && response.data) {
          checks.publicIPCheck = response.data.security?.vpn || response.data.security?.proxy || false;
          checks.vpnProvider = response.data.network?.autonomous_system_organization;
        }
      }
    } catch (error) {
      // Public IP check failed, but don't fail the whole check
      console.debug('VPN public IP check error:', error.message);
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
 * Persists to database and maintains in-memory cache
 */
async function trackIPRotation(userId, ipAddress) {
  // Update in-memory cache
  if (!ipRotationCache.has(userId)) {
    ipRotationCache.set(userId, []);
  }

  const userHistory = ipRotationCache.get(userId);
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

  // Persist to database for long-term tracking
  try {
    await run(
      `INSERT INTO ip_rotation_log (user_id, ip_address, total_ips_tracked, unique_ips_last_hour, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [userId, ipAddress, userHistory.length, uniqueRecentIPs.size]
    );
  } catch (error) {
    console.error('Failed to persist IP rotation to database:', error);
    // Don't throw - allow operation to continue even if logging fails
  }

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
 * Loads from database if not in cache
 */
async function getIPRotationStats(userId) {
  // Try cache first
  if (ipRotationCache.has(userId)) {
    const userHistory = ipRotationCache.get(userId);
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

  // Load from database if not in cache
  try {
    const rows = await require('../database').all(
      `SELECT ip_address, created_at FROM ip_rotation_log
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 1000`,
      [userId]
    );

    if (rows && rows.length > 0) {
      // Populate cache from database
      const history = rows.reverse().map(row => ({
        ip: row.ip_address,
        timestamp: new Date(row.created_at).getTime()
      }));
      
      ipRotationCache.set(userId, history);
      
      const uniqueIPs = new Set(history.map(entry => entry.ip));
      return {
        totalIPsTracked: history.length,
        uniqueIPs: uniqueIPs.size,
        firstSeen: history[0]?.timestamp,
        lastSeen: history[history.length - 1]?.timestamp,
        ipHistory: history.slice(-100),
        reachedThreshold: history.length >= 1000
      };
    }
  } catch (error) {
    console.error('Failed to load IP rotation stats from database:', error);
  }

  return {
    totalIPsTracked: 0,
    uniqueIPs: 0,
    firstSeen: null,
    lastSeen: null,
    ipHistory: [],
    reachedThreshold: false
  };
}

/**
 * Middleware to verify VPN connection before sensitive operations
 * Respects per-user VPN requirements from database
 */
const vpnCheckMiddleware = (options = {}) => {
  const { 
    enforceVPN = true, 
    trackRotation = true,
    minIPRotation = 0 
  } = options;

  return async (req, res, next) => {
    try {
      // Extract clean IP address using utility function
      const cleanIP = extractClientIP(req);

      // Check user's VPN requirement settings from database
      let userVPNRequired = enforceVPN; // Default from middleware options
      if (req.user?.id) {
        try {
          const user = await get('SELECT vpn_required FROM users WHERE id = ?', [req.user.id]);
          if (user && typeof user.vpn_required === 'boolean') {
            userVPNRequired = user.vpn_required;
          }
        } catch (error) {
          console.error('Failed to check user VPN settings:', error);
          // Continue with default setting
        }
      }

      // Track IP rotation if enabled
      if (trackRotation && req.user?.id) {
        const rotationStats = await trackIPRotation(req.user.id, cleanIP);
        req.ipRotation = rotationStats;
      }

      // Perform VPN detection
      const vpnStatus = await detectVPN(cleanIP);

      // Attach VPN status to request
      req.vpnStatus = vpnStatus;
      req.clientIP = cleanIP;

      // If VPN is not required, just log and continue
      if (!userVPNRequired) {
        if (!vpnStatus.isVPNDetected) {
          const safeIPForLog = sanitizeIPForLog(cleanIP);
          console.log(`⚠️  Warning: User ${req.user?.username || 'unknown'} not using VPN (IP: ${safeIPForLog})`);
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

      // Classify expected VPN detection failures (e.g. upstream/network issues)
      const expectedErrorCodes = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH']);
      const isAxiosError = Boolean(error && error.isAxiosError);
      const isExpectedCode = Boolean(error && error.code && expectedErrorCodes.has(error.code));
      const isExpectedError = isAxiosError || isExpectedCode;

      // In case of error, decide whether to fail open or closed
      // - Always fail closed when enforceVPN is true
      // - When enforceVPN is false, only fail open for expected/operational errors
      if (enforceVPN || !isExpectedError) {
        return res.status(500).json({
          error: 'VPN verification failed',
          message: 'Unable to verify VPN status',
          details: error && error.message ? error.message : String(error)
        });
      } else {
        // Fail open for expected detection errors - allow request but log
        console.error('VPN check failed due to expected detection error; continuing (enforceVPN=false)');
        next();
      }
    }
  };
};

/**
 * Clear IP history for a user (both cache and database)
 */
async function clearIPHistory(userId) {
  // Clear from cache
  ipRotationCache.delete(userId);
  
  // Clear from database
  try {
    await run('DELETE FROM ip_rotation_log WHERE user_id = ?', [userId]);
  } catch (error) {
    console.error('Failed to clear IP history from database:', error);
    throw error;
  }
}

/**
 * Get all users with IP tracking data
 */
function getAllTrackedUsers() {
  const users = [];
  for (const [userId, history] of ipRotationCache.entries()) {
    const uniqueIPs = new Set(history.map(entry => entry.ip));
    const lastActivity = history[history.length - 1]?.timestamp;
    
    users.push({
      userId,
      totalIPs: history.length,
      uniqueIPs: uniqueIPs.size,
      lastSeen: lastActivity,
      isStale: lastActivity && (Date.now() - lastActivity > USER_INACTIVITY_THRESHOLD)
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
