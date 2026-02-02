const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { run, get } = require('../database');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Validate JWT_SECRET is set in production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-this') {
  const errorMsg = 'CRITICAL: JWT_SECRET must be set in environment variables for production use';
  logger.error(errorMsg);
  if (process.env.NODE_ENV === 'production') {
    throw new Error(errorMsg);
  } else {
    logger.warn('Using default JWT_SECRET in development mode - DO NOT USE IN PRODUCTION');
  }
}

// Register new user
router.post('/register', asyncHandler(async (req, res) => {
  const { username, password, email, role } = req.body;

  if (!username || !password) {
    throw new AppError('Username and password required', 400);
  }

  // Validate password strength
  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters long', 400);
  }
  
  // Check password complexity
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
    throw new AppError('Password must contain uppercase, lowercase, number, and special character', 400);
  }

  // Check if user exists
  const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    throw new AppError('Username already exists', 409);
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

  logger.info('User registered successfully', { username, userId: result.id, role: userRole });

  res.status(201).json({
    message: 'User registered successfully',
    userId: result.id,
    user: {
      username,
      email
      // Role intentionally omitted from response for security
    }
  });
}));

// Login
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    logger.debug('Login attempt with missing credentials');
    throw new AppError('Username and password required', 400);
  }

  // Get user
  const user = await get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) {
    // Don't log username to prevent account enumeration
    logger.warn('Failed login attempt - invalid credentials', { ip: req.ip });
    throw new AppError('Invalid credentials', 401);
  }

  // Verify password
  const validPassword = await bcrypt.compare(password, user.password);
  
  if (!validPassword) {
    logger.warn('Failed login attempt - incorrect password', { username, userId: user.id, ip: req.ip });
    throw new AppError('Invalid credentials', 401);
  }

  // Update last login
  await run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

  // Generate token
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET || 'your-secret-key-change-this',
    { expiresIn: '24h' }
  );

  logger.info('User logged in successfully', { username, userId: user.id, role: user.role });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }
  });
}));

// Verify token
router.get('/verify', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError('No token provided', 401);
  }

  const token = authHeader.split(' ')[1];

  const decoded = jwt.verify(token, JWT_SECRET || 'your-secret-key-change-this');
  const user = await get('SELECT id, username, email, role FROM users WHERE id = ?', [decoded.id]);
  
  if (!user) {
    logger.warn('Token verification failed - user not found', { userId: decoded.id });
    throw new AppError('User not found', 401);
  }

  res.json({ valid: true, user });
}));

module.exports = router;
