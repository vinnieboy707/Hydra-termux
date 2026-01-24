const express = require('express');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { run, get, all } = require('../database');
const { sanitizePath, sanitizeFilename, sanitizeLogMessage, sanitizeError, check2FARequirement, sanitize2FAToken } = require('../utils/sanitizer');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const router = express.Router();

// Enable 2FA for user
router.post('/2fa/enable', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Generate 2FA secret
    const secret = speakeasy.generateSecret({
      name: `Hydra-Termux (${req.user.username})`,
      length: 32
    });
    
    // Store secret in database
    await run(
      'UPDATE users SET twofa_secret = ?, twofa_enabled = 0 WHERE id = ?',
      [secret.base32, userId]
    );
    
    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    
    res.json({
      message: '2FA setup initiated. Scan QR code with authenticator app.',
      secret: secret.base32,
      qrCode: qrCodeUrl,
      backupCodes: generateBackupCodes()
    });
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

// Verify and complete 2FA setup
router.post('/2fa/verify-setup', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;
    
    // Sanitize and validate token
    const sanitizedToken = sanitize2FAToken(token);
    if (!sanitizedToken) {
      return res.status(400).json({ error: 'Valid 6-digit token required' });
    }
    
    // Get user's 2FA secret
    const user = await get('SELECT twofa_secret FROM users WHERE id = ?', [userId]);
    
    if (!user || !user.twofa_secret) {
      return res.status(400).json({ error: '2FA not initiated' });
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.twofa_secret,
      encoding: 'base32',
      token: sanitizedToken,
      window: 2
    });
    
    if (!verified) {
      return res.status(400).json({ error: 'Invalid token' });
    }
    
    // Enable 2FA
    await run('UPDATE users SET twofa_enabled = 1 WHERE id = ?', [userId]);
    
    // Log security event
    await logSecurityEvent(userId, 'security.2fa_enabled', {
      timestamp: new Date().toISOString()
    });
    
    res.json({
      message: '2FA enabled successfully',
      enabled: true
    });
  } catch (error) {
    console.error('Error verifying 2FA setup:', error);
    res.status(500).json({ error: 'Failed to verify 2FA setup' });
  }
});

// Disable 2FA
router.post('/2fa/disable', authMiddleware, async (req, res) => {
  try {
    const { password, token } = req.body;
    const userId = req.user.id;
    
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }
    
    // Get user with 2FA settings
    const user = await get('SELECT twofa_enabled, twofa_secret, password FROM users WHERE id = ?', [userId]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if 2FA is actually enabled
    const twoFACheck = check2FARequirement(user, token);
    if (twoFACheck.required && !twoFACheck.valid) {
      return res.status(400).json({ error: twoFACheck.reason });
    }
    
    // If 2FA is enabled, verify the token
    if (user.twofa_enabled && user.twofa_secret) {
      const sanitizedToken = sanitize2FAToken(token);
      if (!sanitizedToken) {
        return res.status(400).json({ error: 'Valid 6-digit 2FA token required' });
      }
      
      const verified = speakeasy.totp.verify({
        secret: user.twofa_secret,
        encoding: 'base32',
        token: sanitizedToken,
        window: 2
      });
      
      if (!verified) {
        return res.status(400).json({ error: 'Invalid 2FA token' });
      }
    }
    
    // Disable 2FA
    await run(
      'UPDATE users SET twofa_enabled = 0, twofa_secret = NULL WHERE id = ?',
      [userId]
    );
    
    // Log security event
    await logSecurityEvent(userId, 'security.2fa_disabled', {
      timestamp: new Date().toISOString()
    });
    
    res.json({
      message: '2FA disabled successfully',
      enabled: false
    });
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// Get account security status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await get(
      `SELECT 
        twofa_enabled,
        ip_whitelist_enabled,
        last_password_change,
        failed_login_attempts,
        account_locked_until
      FROM users WHERE id = ?`,
      [userId]
    );
    
    // Get recent security events
    const recentEvents = await all(
      `SELECT event_type, details, created_at
       FROM security_events
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );
    
    // Get active sessions
    const activeSessions = await all(
      `SELECT id, ip_address, user_agent, created_at, last_activity
       FROM user_sessions
       WHERE user_id = ? AND expires_at > datetime('now')
       ORDER BY last_activity DESC`,
      [userId]
    );
    
    res.json({
      security: {
        twoFactorEnabled: user.twofa_enabled === 1,
        ipWhitelistEnabled: user.ip_whitelist_enabled === 1,
        lastPasswordChange: user.last_password_change,
        failedLoginAttempts: user.failed_login_attempts || 0,
        accountLocked: user.account_locked_until ? 
          new Date(user.account_locked_until) > new Date() : false
      },
      recentEvents,
      activeSessions: activeSessions.map(s => ({
        id: s.id,
        ipAddress: s.ip_address,
        userAgent: s.user_agent,
        created: s.created_at,
        lastActive: s.last_activity
      }))
    });
  } catch (error) {
    console.error('Error getting security status:', error);
    res.status(500).json({ error: 'Failed to get security status' });
  }
});

// Enable IP whitelist
router.post('/ip-whitelist/enable', authMiddleware, async (req, res) => {
  try {
    const { ipAddresses } = req.body;
    const userId = req.user.id;
    
    if (!ipAddresses || !Array.isArray(ipAddresses)) {
      return res.status(400).json({ error: 'IP addresses array required' });
    }
    
    // Validate IP addresses
    const validIPs = ipAddresses.filter(ip => isValidIP(ip));
    
    if (validIPs.length === 0) {
      return res.status(400).json({ error: 'No valid IP addresses provided' });
    }
    
    // Store whitelisted IPs
    await run(
      'UPDATE users SET ip_whitelist = ?, ip_whitelist_enabled = 1 WHERE id = ?',
      [JSON.stringify(validIPs), userId]
    );
    
    // Log security event
    await logSecurityEvent(userId, 'security.ip_whitelist_enabled', {
      ips: validIPs
    });
    
    res.json({
      message: 'IP whitelist enabled',
      whitelistedIPs: validIPs
    });
  } catch (error) {
    console.error('Error enabling IP whitelist:', error);
    res.status(500).json({ error: 'Failed to enable IP whitelist' });
  }
});

// Terminate specific session
router.delete('/sessions/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    // Verify session belongs to user
    const session = await get(
      'SELECT id FROM user_sessions WHERE id = ? AND user_id = ?',
      [sessionId, userId]
    );
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Terminate session
    await run('DELETE FROM user_sessions WHERE id = ?', [sessionId]);
    
    // Log security event
    await logSecurityEvent(userId, 'security.session_terminated', {
      sessionId
    });
    
    res.json({ message: 'Session terminated successfully' });
  } catch (error) {
    console.error('Error terminating session:', error);
    res.status(500).json({ error: 'Failed to terminate session' });
  }
});

// Terminate all other sessions
router.post('/sessions/terminate-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const currentSessionId = req.headers['x-session-id'];
    
    // Terminate all sessions except current
    await run(
      'DELETE FROM user_sessions WHERE user_id = ? AND id != ?',
      [userId, currentSessionId]
    );
    
    // Log security event
    await logSecurityEvent(userId, 'security.all_sessions_terminated', {
      keepSessionId: currentSessionId
    });
    
    res.json({ message: 'All other sessions terminated successfully' });
  } catch (error) {
    console.error('Error terminating sessions:', error);
    res.status(500).json({ error: 'Failed to terminate sessions' });
  }
});

// Get security audit log
router.get('/audit-log', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, offset = 0, eventType } = req.query;
    const userId = req.user.id;
    
    let sql = `
      SELECT event_type, details, ip_address, user_agent, created_at
      FROM security_events
      WHERE user_id = ?
    `;
    const params = [userId];
    
    if (eventType) {
      sql += ' AND event_type = ?';
      params.push(eventType);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const events = await all(sql, params);
    
    res.json({ events });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// Change password with security checks
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword, token2fa } = req.body;
    const userId = req.user.id;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords required' });
    }
    
    // Get user
    const user = await get(
      'SELECT password, twofa_enabled, twofa_secret FROM users WHERE id = ?',
      [userId]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // ALWAYS check 2FA requirement - cannot be bypassed
    const twoFACheck = check2FARequirement(user, token2fa);
    if (twoFACheck.required && !twoFACheck.valid) {
      return res.status(403).json({ error: '2FA token required for password change' });
    }
    
    // Verify 2FA if enabled (strict enforcement)
    if (user.twofa_enabled === 1 || user.twofa_enabled === true) {
      const sanitizedToken = sanitize2FAToken(token2fa);
      if (!sanitizedToken) {
        return res.status(400).json({ error: 'Valid 6-digit 2FA token required' });
      }
      
      if (!user.twofa_secret) {
        return res.status(400).json({ error: '2FA configuration error' });
      }
      
      const verified = speakeasy.totp.verify({
        secret: user.twofa_secret,
        encoding: 'base32',
        token: sanitizedToken,
        window: 2
      });
      
      if (!verified) {
        return res.status(403).json({ error: 'Invalid 2FA token' });
      }
    }
    
    // Validate new password strength
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        error: 'Password does not meet security requirements',
        requirements: {
          minLength: 12,
          uppercase: true,
          lowercase: true,
          numbers: true,
          specialChars: true
        }
      });
    }
    
    // Update password (would need bcrypt in real implementation)
    await run(
      `UPDATE users SET 
        password = ?,
        last_password_change = datetime('now')
       WHERE id = ?`,
      [newPassword, userId]
    );
    
    // Terminate all other sessions for security
    await run(
      'DELETE FROM user_sessions WHERE user_id = ? AND id != ?',
      [userId, req.headers['x-session-id']]
    );
    
    // Log security event
    await logSecurityEvent(userId, 'security.password_changed', {
      timestamp: new Date().toISOString()
    });
    
    res.json({
      message: 'Password changed successfully. All other sessions terminated.'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Helper functions

function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

function isValidIP(ip) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

function isStrongPassword(password) {
  if (password.length < 12) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
  return true;
}

async function logSecurityEvent(userId, eventType, details) {
  try {
    await run(
      `INSERT INTO security_events (user_id, event_type, details, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [userId, eventType, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Error logging security event:', error);
  }
}

module.exports = router;
