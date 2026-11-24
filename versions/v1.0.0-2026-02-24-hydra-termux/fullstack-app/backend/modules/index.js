/**
 * Modules Index
 * Central export point for all backend modules
 * @module modules
 */

// Core Modules
const dnsIntelligence = require('./dnsIntelligence');
const attackOrchestrator = require('./attackOrchestrator');
const credentialManager = require('./credentialManager');
const resultParser = require('./resultParser');
const notificationManager = require('./notificationManager');
const analyticsEngine = require('./analyticsEngine');
const exportManager = require('./exportManager');
const cacheManager = require('./cacheManager');

// Utility Modules
const { 
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
} = require('./logManager');

const {
  // Schemas
  userRegistrationSchema,
  userLoginSchema,
  attackConfigSchema,
  dnsAnalysisSchema,
  credentialSchema,
  searchSchema,
  exportSchema,
  notificationSettingsSchema,
  analyticsReportSchema,
  userProfileUpdateSchema,
  paginationSchema,
  uuidParamSchema,
  dateRangeSchema,
  
  // Validation functions
  validate,
  validateMiddleware,
  
  // Sanitization functions
  sanitizeString,
  sanitizeObject
} = require('./validationSchemas');

/**
 * Module initialization function
 * Call this to initialize all modules with configuration
 * @param {Object} config - Configuration object
 * @returns {Object} Initialized modules
 */
const initializeModules = async (config = {}) => {
  try {
    logger.info('Initializing all modules...');

    // Initialize modules that need async setup
    // Add any initialization logic here

    logger.info('All modules initialized successfully');

    return {
      initialized: true,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`Module initialization failed: ${error.message}`);
    throw error;
  }
};

/**
 * Graceful shutdown function
 * Call this to cleanly shutdown all modules
 * @returns {Promise<void>}
 */
const shutdown = async () => {
  try {
    logger.info('Shutting down modules...');

    // Close attack orchestrator queues
    await attackOrchestrator.close();

    // Close cache connections
    await cacheManager.close();

    logger.info('All modules shut down successfully');
  } catch (error) {
    logger.error(`Module shutdown failed: ${error.message}`);
    throw error;
  }
};

/**
 * Health check for all modules
 * @returns {Promise<Object>} Health status of all modules
 */
const healthCheck = async () => {
  try {
    const health = {
      timestamp: new Date().toISOString(),
      modules: {}
    };

    // Check attack orchestrator
    try {
      const queueStats = await attackOrchestrator.getQueueStats();
      health.modules.attackOrchestrator = {
        status: 'healthy',
        queues: queueStats
      };
    } catch (error) {
      health.modules.attackOrchestrator = {
        status: 'unhealthy',
        error: error.message
      };
    }

    // Check cache manager
    try {
      const cacheStats = await cacheManager.getStats();
      health.modules.cacheManager = {
        status: 'healthy',
        stats: cacheStats
      };
    } catch (error) {
      health.modules.cacheManager = {
        status: 'unhealthy',
        error: error.message
      };
    }

    // Check notification manager
    try {
      const notificationStats = notificationManager.getStats();
      health.modules.notificationManager = {
        status: 'healthy',
        stats: notificationStats
      };
    } catch (error) {
      health.modules.notificationManager = {
        status: 'unhealthy',
        error: error.message
      };
    }

    // Check DNS intelligence
    try {
      const dnsStats = dnsIntelligence.getCacheStats();
      health.modules.dnsIntelligence = {
        status: 'healthy',
        stats: dnsStats
      };
    } catch (error) {
      health.modules.dnsIntelligence = {
        status: 'unhealthy',
        error: error.message
      };
    }

    // Overall health status
    const unhealthyModules = Object.values(health.modules).filter(
      m => m.status === 'unhealthy'
    );

    health.status = unhealthyModules.length === 0 ? 'healthy' : 'degraded';
    health.unhealthyCount = unhealthyModules.length;

    return health;
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Export all modules
module.exports = {
  // Core Modules
  dnsIntelligence,
  attackOrchestrator,
  credentialManager,
  resultParser,
  notificationManager,
  analyticsEngine,
  exportManager,
  cacheManager,

  // Logging
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
  streamLogFile,

  // Validation Schemas
  schemas: {
    userRegistrationSchema,
    userLoginSchema,
    attackConfigSchema,
    dnsAnalysisSchema,
    credentialSchema,
    searchSchema,
    exportSchema,
    notificationSettingsSchema,
    analyticsReportSchema,
    userProfileUpdateSchema,
    paginationSchema,
    uuidParamSchema,
    dateRangeSchema
  },

  // Validation Functions
  validate,
  validateMiddleware,

  // Sanitization Functions
  sanitizeString,
  sanitizeObject,

  // Module Management
  initializeModules,
  shutdown,
  healthCheck
};
