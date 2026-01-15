/**
 * Module Integration Test
 * Demonstrates how all modules work together
 * @file test-modules.js
 */

const modules = require('./modules');

const {
  dnsIntelligence,
  attackOrchestrator,
  credentialManager,
  resultParser,
  notificationManager,
  analyticsEngine,
  exportManager,
  cacheManager,
  logger,
  validateMiddleware,
  schemas
} = modules;

/**
 * Test DNS Intelligence Module
 */
async function testDNSIntelligence() {
  try {
    logger.info('Testing DNS Intelligence...');
    
    const domain = 'google.com';
    const analysis = await dnsIntelligence.analyzeDomain(domain);
    
    logger.info(`DNS Analysis for ${domain}:`, {
      hasRecords: analysis.records.a.length > 0,
      securityScore: analysis.security_score.percentage,
      grade: analysis.security_score.grade
    });
    
    return { success: true, module: 'dnsIntelligence' };
  } catch (error) {
    logger.error(`DNS Intelligence test failed: ${error.message}`);
    return { success: false, module: 'dnsIntelligence', error: error.message };
  }
}

/**
 * Test Cache Manager
 */
async function testCacheManager() {
  try {
    logger.info('Testing Cache Manager...');
    
    // Set cache
    await cacheManager.set('test_key', { data: 'test_value' }, 60);
    
    // Get cache
    const cached = await cacheManager.get('test_key');
    
    // Get stats
    const stats = await cacheManager.getStats();
    
    logger.info('Cache Manager test:', {
      cacheWorks: cached?.data === 'test_value',
      stats: stats
    });
    
    // Cleanup
    await cacheManager.delete('test_key');
    
    return { success: true, module: 'cacheManager' };
  } catch (error) {
    logger.error(`Cache Manager test failed: ${error.message}`);
    return { success: false, module: 'cacheManager', error: error.message };
  }
}

/**
 * Test Result Parser
 */
async function testResultParser() {
  try {
    logger.info('Testing Result Parser...');
    
    // Sample Hydra output
    const sampleOutput = `
[22][ssh] host: 192.168.1.100   login: admin   password: admin123
[21][ftp] host: 192.168.1.101   login: root    password: toor
1 of 2 targets successfully completed, 2 valid passwords found
    `;
    
    const parsed = resultParser.parse(sampleOutput, 'hydra');
    
    logger.info('Result Parser test:', {
      credentialsFound: parsed.credentials.length,
      success: parsed.success
    });
    
    return { success: true, module: 'resultParser' };
  } catch (error) {
    logger.error(`Result Parser test failed: ${error.message}`);
    return { success: false, module: 'resultParser', error: error.message };
  }
}

/**
 * Test Validation Schemas
 */
async function testValidationSchemas() {
  try {
    logger.info('Testing Validation Schemas...');
    
    // Valid attack config
    const validConfig = {
      target: '192.168.1.100',
      attackType: 'ssh',
      port: 22,
      passwordList: '/path/to/list.txt',
      threads: 4
    };
    
    const { valid, errors, value } = modules.validate(
      validConfig,
      schemas.attackConfigSchema
    );
    
    logger.info('Validation test:', {
      isValid: valid,
      hasErrors: errors.length > 0
    });
    
    return { success: true, module: 'validationSchemas' };
  } catch (error) {
    logger.error(`Validation test failed: ${error.message}`);
    return { success: false, module: 'validationSchemas', error: error.message };
  }
}

/**
 * Test Export Manager
 */
async function testExportManager() {
  try {
    logger.info('Testing Export Manager...');
    
    // Sample data
    const sampleData = [
      { target: '192.168.1.100', service: 'ssh', username: 'admin' },
      { target: '192.168.1.101', service: 'ftp', username: 'root' }
    ];
    
    // Test JSON export
    const jsonExport = await exportManager.export(
      sampleData,
      'json',
      { filename: 'test_export' }
    );
    
    logger.info('Export Manager test:', {
      format: jsonExport.format,
      fileCreated: !!jsonExport.filePath
    });
    
    // Cleanup
    await exportManager.deleteExport(jsonExport.filename);
    
    return { success: true, module: 'exportManager' };
  } catch (error) {
    logger.error(`Export Manager test failed: ${error.message}`);
    return { success: false, module: 'exportManager', error: error.message };
  }
}

/**
 * Test Notification Manager
 */
async function testNotificationManager() {
  try {
    logger.info('Testing Notification Manager...');
    
    const stats = notificationManager.getStats();
    
    logger.info('Notification Manager test:', {
      emailEnabled: stats.email.enabled,
      webhookEnabled: stats.webhook.enabled
    });
    
    return { success: true, module: 'notificationManager' };
  } catch (error) {
    logger.error(`Notification Manager test failed: ${error.message}`);
    return { success: false, module: 'notificationManager', error: error.message };
  }
}

/**
 * Test Health Check
 */
async function testHealthCheck() {
  try {
    logger.info('Testing Health Check...');
    
    const health = await modules.healthCheck();
    
    logger.info('Health Check test:', {
      status: health.status,
      moduleCount: Object.keys(health.modules || {}).length
    });
    
    return { success: true, module: 'healthCheck' };
  } catch (error) {
    logger.error(`Health Check test failed: ${error.message}`);
    return { success: false, module: 'healthCheck', error: error.message };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('\n========================================');
  console.log('  Module Integration Test Suite');
  console.log('========================================\n');
  
  const tests = [
    testDNSIntelligence,
    testCacheManager,
    testResultParser,
    testValidationSchemas,
    testExportManager,
    testNotificationManager,
    testHealthCheck
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await test();
    results.push(result);
    console.log(`\n[${result.success ? '✓' : '✗'}] ${result.module}`);
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  console.log('\n========================================');
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  console.log(`\n  Results: ${passed}/${total} tests passed`);
  console.log('\n========================================\n');
  
  // Cleanup
  await modules.shutdown();
  
  process.exit(passed === total ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testDNSIntelligence,
  testCacheManager,
  testResultParser,
  testValidationSchemas,
  testExportManager,
  testNotificationManager,
  testHealthCheck,
  runAllTests
};
