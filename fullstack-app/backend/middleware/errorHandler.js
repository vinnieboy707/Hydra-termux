const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate unique error ID for tracking
 */
const generateErrorId = () => {
  return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Centralized error handler middleware
 * Logs errors with context and returns safe error messages to clients
 */
const errorHandler = (err, req, res, next) => {
  const errorId = generateErrorId();
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Extract user context
  const userId = req.user?.id || 'anonymous';
  const username = req.user?.username || 'anonymous';
  
  // Log error with full context
  logger.error('Request error occurred', {
    errorId,
    userId,
    username,
    endpoint: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
  });
  
  // Determine status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Build response
  const response = {
    error: true,
    errorId,
    message: isDevelopment ? err.message : 'An error occurred processing your request',
  };
  
  // In development, include stack trace
  if (isDevelopment) {
    response.stack = err.stack;
    response.details = err.details || null;
  }
  
  res.status(statusCode).json(response);
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  logger.warn('Route not found', {
    endpoint: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });
  
  res.status(404).json({
    error: true,
    message: 'Route not found',
    endpoint: req.originalUrl,
  });
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create custom error with status code
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
};
