// Data Encryption Service
// Implements AES-256-GCM encryption as per SECURITY_PROTOCOLS.md Section 3.2

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Get encryption key from environment or generate warning
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    console.warn('⚠️  WARNING: ENCRYPTION_KEY not set in environment. Using temporary key.');
    console.warn('⚠️  Set ENCRYPTION_KEY in .env for production use.');
    // Generate a random key for development (NOT for production)
    return crypto.randomBytes(KEY_LENGTH);
  }
  
  // Key should be 64 hex characters (32 bytes)
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  
  return Buffer.from(key, 'hex');
}

const ENCRYPTION_KEY = getEncryptionKey();

/**
 * Encrypt data using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @returns {Object} Encrypted data with iv and authTag
 */
function encrypt(plaintext) {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty data');
  }
  
  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get authentication tag
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('hex'),
    data: encrypted,
    authTag: authTag.toString('hex'),
    algorithm: ALGORITHM
  };
}

/**
 * Decrypt data using AES-256-GCM
 * @param {Object} encrypted - Encrypted data object
 * @returns {string} Decrypted plaintext
 */
function decrypt(encrypted) {
  if (!encrypted || !encrypted.iv || !encrypted.data || !encrypted.authTag) {
    throw new Error('Invalid encrypted data format');
  }
  
  // Create decipher
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    Buffer.from(encrypted.iv, 'hex')
  );
  
  // Set authentication tag
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));
  
  // Decrypt
  let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Encrypt sensitive database field
 * @param {string} value - Value to encrypt
 * @returns {string} JSON string of encrypted data
 */
function encryptField(value) {
  if (!value) return null;
  
  const encrypted = encrypt(value);
  return JSON.stringify(encrypted);
}

/**
 * Decrypt sensitive database field
 * @param {string} encryptedJson - JSON string of encrypted data
 * @returns {string} Decrypted value
 */
function decryptField(encryptedJson) {
  if (!encryptedJson) return null;
  
  try {
    const encrypted = JSON.parse(encryptedJson);
    return decrypt(encrypted);
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return null;
  }
}

/**
 * Hash sensitive data (one-way)
 * @param {string} data - Data to hash
 * @returns {string} SHA-256 hash
 */
function hash(data) {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Generate secure random token
 * @param {number} length - Token length in bytes (default 32)
 * @returns {string} Hex-encoded random token
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate encryption key (for initial setup)
 * @returns {string} 64 hex character key
 */
function generateEncryptionKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Verify data integrity using HMAC
 * @param {string} data - Data to verify
 * @param {string} signature - HMAC signature
 * @param {string} secret - Secret key
 * @returns {boolean} True if signature is valid
 */
function verifyHMAC(data, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Create HMAC signature
 * @param {string} data - Data to sign
 * @param {string} secret - Secret key
 * @returns {string} HMAC signature
 */
function createHMAC(data, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
}

module.exports = {
  encrypt,
  decrypt,
  encryptField,
  decryptField,
  hash,
  generateToken,
  generateEncryptionKey,
  verifyHMAC,
  createHMAC
};
