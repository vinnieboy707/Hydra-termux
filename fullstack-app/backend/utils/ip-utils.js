/**
 * IP Utility Functions
 * Shared utilities for IP extraction and processing
 */

/**
 * Extract and clean IP address from request
 * Handles X-Forwarded-For, X-Real-IP, and direct connection IPs
 * Cleans IPv6 prefix if present
 * 
 * @param {Object} req - Express request object
 * @returns {string} Clean IP address
 */
function extractClientIP(req) {
  // Try multiple sources for IP address
  const userIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                 req.headers['x-real-ip'] ||
                 req.connection?.remoteAddress ||
                 req.socket?.remoteAddress ||
                 req.ip ||
                 'unknown';

  // Clean IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
  return userIP.replace(/^::ffff:/, '');
}

/**
 * Validate if a string is a valid IP address (IPv4 or IPv6)
 * 
 * @param {string} ip - IP address to validate
 * @returns {boolean} True if valid IP address
 */
function isValidIP(ip) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  
  if (ipv4Regex.test(ip)) {
    // Additional IPv4 validation: each octet should be 0-255
    const octets = ip.split('.');
    return octets.every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }
  
  return ipv6Regex.test(ip);
}

/**
 * Check if an IP address is private/internal
 * 
 * @param {string} ip - IP address to check
 * @returns {boolean} True if private IP
 */
function isPrivateIP(ip) {
  // Private IPv4 ranges
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const secondOctet = parseInt(ip.split('.')[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }
  
  // Loopback
  if (ip.startsWith('127.')) return true;
  if (ip === '::1' || ip === 'localhost') return true;
  
  // Link-local
  if (ip.startsWith('169.254.')) return true;
  
  return false;
}

module.exports = {
  extractClientIP,
  isValidIP,
  isPrivateIP
};
