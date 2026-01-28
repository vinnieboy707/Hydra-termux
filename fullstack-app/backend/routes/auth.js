const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { run, get } = require('../database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    // Check password complexity
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      return res.status(400).json({ 
        error: 'Password must contain uppercase, lowercase, number, and special character' 
      });
    }

    // Check if user exists
    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Validate and set role (default to 'user')
    const validRoles = ['super_admin', 'admin', 'analyst', 'auditor', 'viewer', 'user'];
    const userRole = validRoles.includes(role) ? role : 'user';

    // Insert user
    const result = await run(
      'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, email, userRole]
    );

    res.status(201).json({
      message: 'User registered successfully',
      userId: result.id,
      user: {
        username,
        email
        // Role intentionally omitted from response for security
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Only log in development mode to prevent security issues
    // Note: Sensitive data like usernames and passwords should never be logged
    if (process.env.NODE_ENV === 'development') {
      console.log('[LOGIN] Login attempt received');
    }

    if (!username || !password) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[LOGIN] Missing credentials');
      }
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Get user
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      // Don't log any user information to prevent account enumeration
      if (process.env.NODE_ENV === 'development') {
        console.log('[LOGIN] Authentication failed - invalid credentials');
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[LOGIN] User record found, verifying password');
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await get('SELECT id, username, email, role FROM users WHERE id = ?', [decoded.id]);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ valid: true, user });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token', valid: false });
  }
});

// Get current user profile (requires authentication)
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await get('SELECT id, username, email, role, created_at, last_login FROM users WHERE id = ?', [decoded.id]);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Remove password from response
    delete user.password;

    res.json(user);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

module.exports = router;
