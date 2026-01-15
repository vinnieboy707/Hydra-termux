/**
 * Cache Manager Module
 * Redis caching layer with fallback to in-memory cache
 * @module cacheManager
 */

const Redis = require('ioredis');
const NodeCache = require('node-cache');
const { logger } = require('./logManager');

/**
 * Cache Manager Service
 * Handles caching with Redis primary and NodeCache fallback
 */
class CacheManager {
  constructor() {
    this.redisEnabled = process.env.REDIS_ENABLED !== 'false';
    this.redis = null;
    this.localCache = new NodeCache({
      stdTTL: 600, // 10 minutes default
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false
    });

    if (this.redisEnabled) {
      this.initializeRedis();
    }

    logger.info('Cache Manager initialized');
  }

  /**
   * Initialize Redis connection
   * @private
   */
  initializeRedis() {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB) || 0,
        retryStrategy: (times) => {
          if (times > 3) {
            logger.warn('Redis connection failed after 3 attempts, using local cache');
            this.redisEnabled = false;
            return null;
          }
          return Math.min(times * 200, 2000);
        }
      });

      this.redis.on('connect', () => {
        logger.info('Redis cache connected');
      });

      this.redis.on('error', (error) => {
        logger.error(`Redis error: ${error.message}`);
        this.redisEnabled = false;
      });

      this.redis.on('close', () => {
        logger.warn('Redis connection closed');
      });
    } catch (error) {
      logger.error(`Failed to initialize Redis: ${error.message}`);
      this.redisEnabled = false;
    }
  }

  /**
   * Set cache value
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = 600) {
    try {
      const serialized = JSON.stringify(value);

      // Try Redis first
      if (this.redisEnabled && this.redis) {
        try {
          if (ttl > 0) {
            await this.redis.setex(key, ttl, serialized);
          } else {
            await this.redis.set(key, serialized);
          }
          logger.debug(`Cache set (Redis): ${key}`);
          return true;
        } catch (error) {
          logger.warn(`Redis set failed, using local cache: ${error.message}`);
        }
      }

      // Fallback to local cache
      this.localCache.set(key, serialized, ttl);
      logger.debug(`Cache set (local): ${key}`);
      return true;
    } catch (error) {
      logger.error(`Cache set failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get cache value
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null
   */
  async get(key) {
    try {
      // Try Redis first
      if (this.redisEnabled && this.redis) {
        try {
          const value = await this.redis.get(key);
          if (value) {
            logger.debug(`Cache hit (Redis): ${key}`);
            return JSON.parse(value);
          }
        } catch (error) {
          logger.warn(`Redis get failed, trying local cache: ${error.message}`);
        }
      }

      // Try local cache
      const localValue = this.localCache.get(key);
      if (localValue) {
        logger.debug(`Cache hit (local): ${key}`);
        return JSON.parse(localValue);
      }

      logger.debug(`Cache miss: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Cache get failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete cache value
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async delete(key) {
    try {
      let deleted = false;

      // Delete from Redis
      if (this.redisEnabled && this.redis) {
        try {
          await this.redis.del(key);
        } catch (error) {
          logger.warn(`Redis delete failed: ${error.message}`);
        }
      }

      // Delete from local cache
      this.localCache.del(key);
      deleted = true;

      logger.debug(`Cache deleted: ${key}`);
      return deleted;
    } catch (error) {
      logger.error(`Cache delete failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Exists status
   */
  async exists(key) {
    try {
      // Check Redis first
      if (this.redisEnabled && this.redis) {
        try {
          const exists = await this.redis.exists(key);
          if (exists) return true;
        } catch (error) {
          logger.warn(`Redis exists check failed: ${error.message}`);
        }
      }

      // Check local cache
      return this.localCache.has(key);
    } catch (error) {
      logger.error(`Cache exists check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get multiple cache values
   * @param {Array<string>} keys - Array of cache keys
   * @returns {Promise<Object>} Object with key-value pairs
   */
  async mget(keys) {
    try {
      const results = {};

      for (const key of keys) {
        const value = await this.get(key);
        if (value !== null) {
          results[key] = value;
        }
      }

      return results;
    } catch (error) {
      logger.error(`Cache mget failed: ${error.message}`);
      return {};
    }
  }

  /**
   * Set multiple cache values
   * @param {Object} keyValuePairs - Object with key-value pairs
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async mset(keyValuePairs, ttl = 600) {
    try {
      const promises = Object.entries(keyValuePairs).map(([key, value]) =>
        this.set(key, value, ttl)
      );

      const results = await Promise.all(promises);
      return results.every(result => result === true);
    } catch (error) {
      logger.error(`Cache mset failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Increment cache value
   * @param {string} key - Cache key
   * @param {number} amount - Amount to increment
   * @returns {Promise<number>} New value
   */
  async increment(key, amount = 1) {
    try {
      // Try Redis first
      if (this.redisEnabled && this.redis) {
        try {
          const result = await this.redis.incrby(key, amount);
          logger.debug(`Cache incremented (Redis): ${key} by ${amount}`);
          return result;
        } catch (error) {
          logger.warn(`Redis increment failed: ${error.message}`);
        }
      }

      // Fallback to local cache
      const current = this.localCache.get(key);
      const currentValue = current ? parseInt(JSON.parse(current)) : 0;
      const newValue = currentValue + amount;
      this.localCache.set(key, JSON.stringify(newValue));
      logger.debug(`Cache incremented (local): ${key} by ${amount}`);
      return newValue;
    } catch (error) {
      logger.error(`Cache increment failed: ${error.message}`);
      return 0;
    }
  }

  /**
   * Decrement cache value
   * @param {string} key - Cache key
   * @param {number} amount - Amount to decrement
   * @returns {Promise<number>} New value
   */
  async decrement(key, amount = 1) {
    return this.increment(key, -amount);
  }

  /**
   * Get keys matching pattern
   * @param {string} pattern - Key pattern (Redis pattern syntax)
   * @returns {Promise<Array<string>>} Matching keys
   */
  async keys(pattern) {
    try {
      const allKeys = [];

      // Get from Redis
      if (this.redisEnabled && this.redis) {
        try {
          const redisKeys = await this.redis.keys(pattern);
          allKeys.push(...redisKeys);
        } catch (error) {
          logger.warn(`Redis keys search failed: ${error.message}`);
        }
      }

      // Get from local cache
      const localKeys = this.localCache.keys();
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      const matchingLocalKeys = localKeys.filter(key => regex.test(key));
      allKeys.push(...matchingLocalKeys);

      return [...new Set(allKeys)];
    } catch (error) {
      logger.error(`Cache keys search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Clear all cache
   * @returns {Promise<boolean>} Success status
   */
  async clear() {
    try {
      // Clear Redis
      if (this.redisEnabled && this.redis) {
        try {
          await this.redis.flushdb();
        } catch (error) {
          logger.warn(`Redis clear failed: ${error.message}`);
        }
      }

      // Clear local cache
      this.localCache.flushAll();

      logger.info('Cache cleared');
      return true;
    } catch (error) {
      logger.error(`Cache clear failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get cache with automatic refresh
   * @param {string} key - Cache key
   * @param {Function} refreshFn - Function to refresh cache if miss
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<any>} Cached or fresh value
   */
  async getOrSet(key, refreshFn, ttl = 600) {
    try {
      // Try to get from cache
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }

      // Cache miss, refresh
      logger.debug(`Cache miss, refreshing: ${key}`);
      const fresh = await refreshFn();
      
      // Store in cache
      await this.set(key, fresh, ttl);
      
      return fresh;
    } catch (error) {
      logger.error(`Cache getOrSet failed: ${error.message}`);
      // Return fresh data even if cache fails
      return await refreshFn();
    }
  }

  /**
   * Set with expiration at specific time
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {Date} expireAt - Expiration date
   * @returns {Promise<boolean>} Success status
   */
  async setExpireAt(key, value, expireAt) {
    try {
      const now = new Date();
      const ttl = Math.max(0, Math.floor((expireAt - now) / 1000));
      return await this.set(key, value, ttl);
    } catch (error) {
      logger.error(`Cache setExpireAt failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get time to live for key
   * @param {string} key - Cache key
   * @returns {Promise<number>} TTL in seconds, -1 if no expiry, -2 if not exists
   */
  async ttl(key) {
    try {
      // Try Redis first
      if (this.redisEnabled && this.redis) {
        try {
          return await this.redis.ttl(key);
        } catch (error) {
          logger.warn(`Redis TTL check failed: ${error.message}`);
        }
      }

      // Local cache doesn't provide TTL info easily
      const exists = this.localCache.has(key);
      return exists ? -1 : -2;
    } catch (error) {
      logger.error(`Cache TTL check failed: ${error.message}`);
      return -2;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getStats() {
    try {
      const stats = {
        redis: {
          enabled: this.redisEnabled,
          connected: false,
          keys: 0,
          memory: 0
        },
        local: {
          keys: this.localCache.keys().length,
          hits: this.localCache.getStats().hits,
          misses: this.localCache.getStats().misses
        }
      };

      // Get Redis stats
      if (this.redisEnabled && this.redis) {
        try {
          stats.redis.connected = this.redis.status === 'ready';
          stats.redis.keys = await this.redis.dbsize();
          
          const info = await this.redis.info('memory');
          const memoryMatch = info.match(/used_memory:(\d+)/);
          if (memoryMatch) {
            stats.redis.memory = parseInt(memoryMatch[1]);
          }
        } catch (error) {
          logger.warn(`Failed to get Redis stats: ${error.message}`);
        }
      }

      return stats;
    } catch (error) {
      logger.error(`Failed to get cache stats: ${error.message}`);
      return null;
    }
  }

  /**
   * Wrap function with caching
   * @param {string} keyPrefix - Cache key prefix
   * @param {Function} fn - Function to wrap
   * @param {number} ttl - Time to live in seconds
   * @returns {Function} Wrapped function
   */
  wrap(keyPrefix, fn, ttl = 600) {
    return async (...args) => {
      const key = `${keyPrefix}:${JSON.stringify(args)}`;
      return await this.getOrSet(key, () => fn(...args), ttl);
    };
  }

  /**
   * Close connections
   * @returns {Promise<void>}
   */
  async close() {
    try {
      if (this.redis) {
        await this.redis.quit();
      }
      this.localCache.close();
      logger.info('Cache connections closed');
    } catch (error) {
      logger.error(`Failed to close cache connections: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new CacheManager();
