// Shared utility functions for the application

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validate email address
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid
 */
export function isValidEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Validate IP address
 * @param {string} ip - IP address to validate
 * @returns {boolean} True if valid
 */
export function isValidIP(ip) {
  const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipMatch = ip.match(ipRegex);
  if (!ipMatch) return false;
  
  // Validate each octet is 0-255
  const octets = ipMatch.slice(1).map(Number);
  return octets.every(octet => octet >= 0 && octet <= 255);
}

/**
 * Validate domain name
 * @param {string} domain - Domain name to validate
 * @returns {boolean} True if valid
 */
export function isValidDomain(domain) {
  return domain.includes('.') && /^[a-zA-Z0-9.-]+$/.test(domain);
}

/**
 * Detect target type (email, IP, or domain)
 * @param {string} target - Target string
 * @returns {string} Type: 'email', 'ip', 'domain', or 'unknown'
 */
export function detectTargetType(target) {
  if (isValidEmail(target)) return 'email';
  if (isValidIP(target)) return 'ip';
  if (isValidDomain(target)) return 'domain';
  return 'unknown';
}
