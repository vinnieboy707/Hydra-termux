/**
 * Log Manager Module
 * Winston logging configuration with multiple transports
 * @module logManager
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

/**
 * Custom format for console output with colors
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

/**
 * Custom format for file output without colors
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Create logs directory if it doesn't exist
 */
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Daily rotate file transport for general logs
 */
const dailyRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: fileFormat
});

/**
 * Daily rotate file transport for error logs
 */
const errorRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: fileFormat
});

/**
 * Daily rotate file transport for attack logs
 */
const attackRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'attacks-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '50m',
  maxFiles: '30d',
  format: fileFormat
});

/**
 * Daily rotate file transport for security logs
 */
const securityRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'security-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '90d',
  format: fileFormat
});

/**
 * Main application logger
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  defaultMeta: { service: 'hydra-termux' },
  transports: [
    dailyRotateTransport,
    errorRotateTransport
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat
    })
  ]
});

/**
 * Add console transport in development
 */
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

/**
 * Attack logger for attack-specific logs
 */
const attackLogger = winston.createLogger({
  level: 'info',
  format: fileFormat,
  defaultMeta: { service: 'hydra-termux-attacks' },
  transports: [
    attackRotateTransport
  ]
});

if (process.env.NODE_ENV !== 'production') {
  attackLogger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

/**
 * Security logger for security-related events
 */
const securityLogger = winston.createLogger({
  level: 'info',
  format: fileFormat,
  defaultMeta: { service: 'hydra-termux-security' },
  transports: [
    securityRotateTransport
  ]
});

if (process.env.NODE_ENV !== 'production') {
  securityLogger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

/**
 * HTTP request logger middleware
 * @returns {Function} Express middleware
 */
const httpLogger = () => {
  return (req, res, next) => {
    const start = Date.now();

    // Log request
    logger.info({
      type: 'http_request',
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
      
      logger.log(logLevel, {
        type: 'http_response',
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`
      });
    });

    next();
  };
};

/**
 * Log attack event
 * @param {Object} attackData - Attack event data
 */
const logAttack = (attackData) => {
  attackLogger.info({
    type: 'attack_event',
    ...attackData,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log security event
 * @param {string} eventType - Type of security event
 * @param {Object} eventData - Event data
 */
const logSecurity = (eventType, eventData) => {
  securityLogger.info({
    type: 'security_event',
    eventType,
    ...eventData,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log authentication event
 * @param {Object} authData - Authentication event data
 */
const logAuth = (authData) => {
  securityLogger.info({
    type: 'authentication',
    ...authData,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log credential discovery
 * @param {Object} credentialData - Credential data
 */
const logCredentialDiscovery = (credentialData) => {
  attackLogger.info({
    type: 'credential_discovery',
    target: credentialData.target,
    service: credentialData.service,
    username: credentialData.username,
    attackId: credentialData.attackId,
    timestamp: new Date().toISOString()
  });

  securityLogger.info({
    type: 'credential_discovery',
    target: credentialData.target,
    service: credentialData.service,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log error with context
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
const logError = (error, context = {}) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log performance metric
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in milliseconds
 * @param {Object} metadata - Additional metadata
 */
const logPerformance = (operation, duration, metadata = {}) => {
  logger.info({
    type: 'performance',
    operation,
    duration: `${duration}ms`,
    ...metadata,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log database query
 * @param {string} query - Query string
 * @param {number} duration - Duration in milliseconds
 */
const logQuery = (query, duration) => {
  if (process.env.LOG_QUERIES === 'true') {
    logger.debug({
      type: 'database_query',
      query,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Log cache event
 * @param {string} operation - Cache operation (hit, miss, set, delete)
 * @param {string} key - Cache key
 */
const logCache = (operation, key) => {
  if (process.env.LOG_CACHE === 'true') {
    logger.debug({
      type: 'cache',
      operation,
      key,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Create child logger with additional context
 * @param {Object} defaultMeta - Default metadata for all logs
 * @returns {winston.Logger} Child logger
 */
const createChildLogger = (defaultMeta) => {
  return logger.child(defaultMeta);
};

/**
 * Get log files list
 * @returns {Array} List of log files
 */
const getLogFiles = () => {
  try {
    const files = fs.readdirSync(logsDir);
    return files.map(file => ({
      name: file,
      path: path.join(logsDir, file),
      size: fs.statSync(path.join(logsDir, file)).size,
      modified: fs.statSync(path.join(logsDir, file)).mtime
    }));
  } catch (error) {
    logger.error(`Failed to get log files: ${error.message}`);
    return [];
  }
};

/**
 * Read log file
 * @param {string} filename - Log file name
 * @param {Object} options - Read options
 * @returns {Promise<string>} Log file content
 */
const readLogFile = async (filename, options = {}) => {
  try {
    const { lines = 100, filter = null } = options;
    const filePath = path.join(logsDir, filename);
    
    const content = await fs.promises.readFile(filePath, 'utf8');
    let logLines = content.split('\n').filter(line => line.trim());

    // Apply filter if provided
    if (filter) {
      logLines = logLines.filter(line => line.includes(filter));
    }

    // Return last N lines
    return logLines.slice(-lines).join('\n');
  } catch (error) {
    logger.error(`Failed to read log file: ${error.message}`);
    throw error;
  }
};

/**
 * Clean old log files
 * @param {number} daysToKeep - Number of days to keep logs
 * @returns {number} Number of files deleted
 */
const cleanOldLogs = (daysToKeep = 30) => {
  try {
    const files = fs.readdirSync(logsDir);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
    let deleted = 0;

    files.forEach(file => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtime.getTime();

      if (age > maxAge) {
        fs.unlinkSync(filePath);
        deleted++;
        logger.info(`Deleted old log file: ${file}`);
      }
    });

    return deleted;
  } catch (error) {
    logger.error(`Failed to clean old logs: ${error.message}`);
    return 0;
  }
};

/**
 * Stream log file
 * @param {string} filename - Log file name
 * @returns {ReadStream} File read stream
 */
const streamLogFile = (filename) => {
  const filePath = path.join(logsDir, filename);
  return fs.createReadStream(filePath);
};

module.exports = {
  logger,
  attackLogger,
  securityLogger,
  httpLogger,
  logAttack,
  logSecurity,
  logAuth,
  logCredentialDiscovery,
  logError,
  logPerformance,
  logQuery,
  logCache,
  createChildLogger,
  getLogFiles,
  readLogFile,
  cleanOldLogs,
  streamLogFile
};
