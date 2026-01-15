/**
 * Module Integration Example
 * Shows how to integrate modules into Express server
 * @file example-integration.js
 */

const express = require('express');
const modules = require('./modules');

const {
  // Core modules
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
  httpLogger,
  logAttack,
  logSecurity,
  
  // Validation
  validateMiddleware,
  schemas,
  
  // Module management
  initializeModules,
  shutdown,
  healthCheck
} = modules;

const app = express();

// Middleware
app.use(express.json());
app.use(httpLogger()); // HTTP request logging

/**
 * Initialize modules on startup
 */
async function initializeApp() {
  try {
    logger.info('Initializing application...');
    
    // Initialize all modules
    await initializeModules();
    
    logger.info('Application initialized successfully');
  } catch (error) {
    logger.error(`Application initialization failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * DNS Intelligence Endpoints
 */

// Analyze domain
app.post('/api/dns/analyze',
  validateMiddleware(schemas.dnsAnalysisSchema),
  async (req, res) => {
    try {
      const { domain } = req.body;
      
      // Check cache first
      const cacheKey = `dns:${domain}`;
      const cached = await cacheManager.get(cacheKey);
      
      if (cached) {
        return res.json({
          success: true,
          cached: true,
          data: cached
        });
      }
      
      // Perform analysis
      const analysis = await dnsIntelligence.analyzeDomain(domain);
      
      // Cache for 5 minutes
      await cacheManager.set(cacheKey, analysis, 300);
      
      res.json({
        success: true,
        cached: false,
        data: analysis
      });
    } catch (error) {
      logger.error(`DNS analysis failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Attack Management Endpoints
 */

// Queue new attack
app.post('/api/attacks',
  validateMiddleware(schemas.attackConfigSchema),
  async (req, res) => {
    try {
      const attackConfig = req.body;
      
      // Queue attack
      const job = await attackOrchestrator.queueAttack(
        {
          ...attackConfig,
          userId: req.user?.id // From auth middleware
        },
        attackConfig.priority
      );
      
      // Log attack
      logAttack({
        jobId: job.jobId,
        userId: req.user?.id,
        target: attackConfig.target,
        type: attackConfig.attackType,
        status: 'queued'
      });
      
      res.json({
        success: true,
        data: job
      });
    } catch (error) {
      logger.error(`Attack queue failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get attack status
app.get('/api/attacks/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await attackOrchestrator.getJobStatus(jobId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error(`Get attack status failed: ${error.message}`);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Cancel attack
app.delete('/api/attacks/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    await attackOrchestrator.cancelJob(jobId);
    
    res.json({
      success: true,
      message: 'Attack cancelled'
    });
  } catch (error) {
    logger.error(`Cancel attack failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get queue statistics
app.get('/api/attacks/queue/stats', async (req, res) => {
  try {
    const stats = await attackOrchestrator.getQueueStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error(`Get queue stats failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Credential Management Endpoints
 */

// Get user credentials
app.get('/api/credentials',
  validateMiddleware(schemas.searchSchema, 'query'),
  async (req, res) => {
    try {
      const userId = req.user?.id; // From auth middleware
      const filters = req.query;
      
      const result = await credentialManager.getCredentialsByUser(userId, filters);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Get credentials failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get specific credential (with password)
app.get('/api/credentials/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const includePassword = req.query.password === 'true';
    
    const credential = await credentialManager.getCredential(id, includePassword);
    
    // Log security event
    if (includePassword) {
      logSecurity('credential_access', {
        userId: req.user?.id,
        credentialId: id,
        includePassword: true
      });
    }
    
    res.json({
      success: true,
      data: credential
    });
  } catch (error) {
    logger.error(`Get credential failed: ${error.message}`);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Delete credential
app.delete('/api/credentials/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await credentialManager.deleteCredential(id);
    
    res.json({
      success: true,
      message: 'Credential deleted'
    });
  } catch (error) {
    logger.error(`Delete credential failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Analytics Endpoints
 */

// Generate analytics report
app.post('/api/analytics/report',
  validateMiddleware(schemas.analyticsReportSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id;
      const options = req.body;
      
      // Check cache
      const cacheKey = `analytics:${userId}:${JSON.stringify(options)}`;
      const cached = await cacheManager.get(cacheKey);
      
      if (cached) {
        return res.json({
          success: true,
          cached: true,
          data: cached
        });
      }
      
      // Generate report
      const report = await analyticsEngine.generateReport(userId, options);
      
      // Cache for 10 minutes
      await cacheManager.set(cacheKey, report, 600);
      
      res.json({
        success: true,
        cached: false,
        data: report
      });
    } catch (error) {
      logger.error(`Generate report failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get attack trends
app.get('/api/analytics/trends', async (req, res) => {
  try {
    const userId = req.user?.id;
    const days = parseInt(req.query.days) || 30;
    
    const trends = await analyticsEngine.getAttackTrends(userId, { days });
    
    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    logger.error(`Get trends failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Export Endpoints
 */

// Export credentials
app.post('/api/export/credentials',
  validateMiddleware(schemas.exportSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id;
      const { format, includePasswords, filters } = req.body;
      
      // Get credentials
      const credentials = await credentialManager.exportCredentials(
        userId,
        includePasswords
      );
      
      // Export to format
      const result = await exportManager.exportCredentials(
        credentials,
        format,
        { includePasswords }
      );
      
      // Log security event
      logSecurity('data_export', {
        userId,
        type: 'credentials',
        format,
        includePasswords
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Export credentials failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Download export file
app.get('/api/export/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const exports = await exportManager.listExports();
    const exportFile = exports.find(e => e.filename === filename);
    
    if (!exportFile) {
      return res.status(404).json({
        success: false,
        error: 'Export file not found'
      });
    }
    
    res.download(exportFile.path);
  } catch (error) {
    logger.error(`Download export failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Health Check Endpoints
 */

// Application health
app.get('/health', async (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Module health check
app.get('/health/modules', async (req, res) => {
  try {
    const health = await healthCheck();
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cache statistics
app.get('/health/cache', async (req, res) => {
  try {
    const stats = await cacheManager.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Error handling middleware
 */
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

/**
 * Graceful shutdown
 */
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, starting graceful shutdown...`);
  
  // Stop accepting new requests
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Shutdown modules
      await shutdown();
      logger.info('All modules shut down successfully');
      process.exit(0);
    } catch (error) {
      logger.error(`Shutdown error: ${error.message}`);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Start server
const PORT = process.env.PORT || 3000;
let server;

async function startServer() {
  try {
    await initializeApp();
    
    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
    
    // Setup signal handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

// Start if called directly
if (require.main === module) {
  startServer();
}

module.exports = app;
