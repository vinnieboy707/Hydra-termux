/**
 * Credential Manager Module
 * Manages credential storage, retrieval, and encryption
 * @module credentialManager
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { logger } = require('./logManager');

/**
 * Credential Manager Service
 * Handles secure storage and retrieval of discovered credentials
 */
class CredentialManager {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    this.encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY || 
                         crypto.randomBytes(32).toString('hex');
    this.algorithm = 'aes-256-gcm';
    
    logger.info('Credential Manager initialized');
  }

  /**
   * Encrypt sensitive data
   * @param {string} text - Plain text to encrypt
   * @returns {Object} Encrypted data with IV and auth tag
   * @private
   */
  _encrypt(text) {
    try {
      const iv = crypto.randomBytes(16);
      const key = Buffer.from(this.encryptionKey, 'hex');
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      logger.error(`Encryption failed: ${error.message}`);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive data
   * @param {string} encrypted - Encrypted text
   * @param {string} iv - Initialization vector
   * @param {string} authTag - Authentication tag
   * @returns {string} Decrypted plain text
   * @private
   */
  _decrypt(encrypted, iv, authTag) {
    try {
      const key = Buffer.from(this.encryptionKey, 'hex');
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        key,
        Buffer.from(iv, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error(`Decryption failed: ${error.message}`);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Store discovered credentials
   * @param {Object} credentialData - Credential information
   * @returns {Promise<Object>} Stored credential
   */
  async storeCredential(credentialData) {
    try {
      const {
        attackId,
        userId,
        target,
        service,
        port,
        username,
        password,
        additionalInfo = {}
      } = credentialData;

      // Validate required fields
      if (!target || !service || !username || !password) {
        throw new Error('Missing required credential fields');
      }

      // Encrypt password
      const encryptedPassword = this._encrypt(password);

      // Prepare credential record
      const credential = {
        attack_id: attackId,
        user_id: userId,
        target,
        service,
        port: port || null,
        username,
        password_encrypted: encryptedPassword.encrypted,
        password_iv: encryptedPassword.iv,
        password_auth_tag: encryptedPassword.authTag,
        additional_info: additionalInfo,
        discovered_at: new Date().toISOString(),
        verified: false,
        active: true
      };

      // Store in database
      const { data, error } = await this.supabase
        .from('credentials')
        .insert([credential])
        .select()
        .single();

      if (error) throw error;

      logger.info(`Credential stored for ${service}://${target} (username: ${username})`);

      return {
        id: data.id,
        target: data.target,
        service: data.service,
        username: data.username,
        discoveredAt: data.discovered_at
      };
    } catch (error) {
      logger.error(`Failed to store credential: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store multiple credentials (bulk operation)
   * @param {Array} credentials - Array of credential objects
   * @returns {Promise<Array>} Stored credentials
   */
  async storeBulkCredentials(credentials) {
    try {
      const results = [];

      for (const cred of credentials) {
        try {
          const stored = await this.storeCredential(cred);
          results.push({ success: true, credential: stored });
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            credential: cred
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      logger.info(`Bulk store completed: ${successCount}/${credentials.length} successful`);

      return results;
    } catch (error) {
      logger.error(`Bulk credential storage failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve credential by ID
   * @param {string} credentialId - Credential identifier
   * @param {boolean} includePassword - Whether to include decrypted password
   * @returns {Promise<Object>} Credential data
   */
  async getCredential(credentialId, includePassword = false) {
    try {
      const { data, error } = await this.supabase
        .from('credentials')
        .select('*')
        .eq('id', credentialId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Credential not found');

      const credential = {
        id: data.id,
        attackId: data.attack_id,
        userId: data.user_id,
        target: data.target,
        service: data.service,
        port: data.port,
        username: data.username,
        additionalInfo: data.additional_info,
        discoveredAt: data.discovered_at,
        verified: data.verified,
        active: data.active
      };

      // Decrypt password if requested
      if (includePassword) {
        credential.password = this._decrypt(
          data.password_encrypted,
          data.password_iv,
          data.password_auth_tag
        );
      }

      return credential;
    } catch (error) {
      logger.error(`Failed to retrieve credential: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get credentials by attack ID
   * @param {string} attackId - Attack identifier
   * @param {boolean} includePasswords - Whether to include decrypted passwords
   * @returns {Promise<Array>} Array of credentials
   */
  async getCredentialsByAttack(attackId, includePasswords = false) {
    try {
      const { data, error } = await this.supabase
        .from('credentials')
        .select('*')
        .eq('attack_id', attackId)
        .order('discovered_at', { ascending: false });

      if (error) throw error;

      const credentials = data.map(cred => {
        const credential = {
          id: cred.id,
          target: cred.target,
          service: cred.service,
          port: cred.port,
          username: cred.username,
          discoveredAt: cred.discovered_at,
          verified: cred.verified,
          active: cred.active
        };

        if (includePasswords) {
          credential.password = this._decrypt(
            cred.password_encrypted,
            cred.password_iv,
            cred.password_auth_tag
          );
        }

        return credential;
      });

      return credentials;
    } catch (error) {
      logger.error(`Failed to retrieve credentials by attack: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get credentials by user ID
   * @param {string} userId - User identifier
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Paginated credentials
   */
  async getCredentialsByUser(userId, filters = {}) {
    try {
      const {
        service,
        target,
        verified,
        active = true,
        page = 1,
        limit = 50
      } = filters;

      let query = this.supabase
        .from('credentials')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('active', active);

      // Apply filters
      if (service) query = query.eq('service', service);
      if (target) query = query.ilike('target', `%${target}%`);
      if (verified !== undefined) query = query.eq('verified', verified);

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to).order('discovered_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        credentials: data.map(cred => ({
          id: cred.id,
          target: cred.target,
          service: cred.service,
          port: cred.port,
          username: cred.username,
          discoveredAt: cred.discovered_at,
          verified: cred.verified
        })),
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      logger.error(`Failed to retrieve user credentials: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search credentials
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Array>} Matching credentials
   */
  async searchCredentials(searchParams) {
    try {
      const { userId, query, service, target } = searchParams;

      let dbQuery = this.supabase
        .from('credentials')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true);

      if (service) {
        dbQuery = dbQuery.eq('service', service);
      }

      if (target) {
        dbQuery = dbQuery.ilike('target', `%${target}%`);
      }

      if (query) {
        dbQuery = dbQuery.or(`username.ilike.%${query}%,target.ilike.%${query}%`);
      }

      const { data, error } = await dbQuery
        .order('discovered_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return data.map(cred => ({
        id: cred.id,
        target: cred.target,
        service: cred.service,
        username: cred.username,
        discoveredAt: cred.discovered_at
      }));
    } catch (error) {
      logger.error(`Credential search failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update credential verification status
   * @param {string} credentialId - Credential identifier
   * @param {boolean} verified - Verification status
   * @returns {Promise<Object>} Updated credential
   */
  async verifyCredential(credentialId, verified) {
    try {
      const { data, error } = await this.supabase
        .from('credentials')
        .update({
          verified,
          verified_at: verified ? new Date().toISOString() : null
        })
        .eq('id', credentialId)
        .select()
        .single();

      if (error) throw error;

      logger.info(`Credential ${credentialId} verification updated: ${verified}`);

      return {
        id: data.id,
        verified: data.verified,
        verifiedAt: data.verified_at
      };
    } catch (error) {
      logger.error(`Failed to update credential verification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Soft delete credential (mark as inactive)
   * @param {string} credentialId - Credential identifier
   * @returns {Promise<boolean>} Success status
   */
  async deleteCredential(credentialId) {
    try {
      const { error } = await this.supabase
        .from('credentials')
        .update({ active: false })
        .eq('id', credentialId);

      if (error) throw error;

      logger.info(`Credential ${credentialId} marked as inactive`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete credential: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get credential statistics
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} Credential statistics
   */
  async getCredentialStats(userId) {
    try {
      const { data, error } = await this.supabase
        .from('credentials')
        .select('service, verified, active')
        .eq('user_id', userId);

      if (error) throw error;

      const stats = {
        total: data.length,
        active: data.filter(c => c.active).length,
        verified: data.filter(c => c.verified).length,
        byService: {}
      };

      // Count by service
      data.forEach(cred => {
        if (!stats.byService[cred.service]) {
          stats.byService[cred.service] = 0;
        }
        stats.byService[cred.service]++;
      });

      return stats;
    } catch (error) {
      logger.error(`Failed to get credential stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export credentials for user
   * @param {string} userId - User identifier
   * @param {boolean} includePasswords - Whether to include passwords
   * @returns {Promise<Array>} Exportable credential data
   */
  async exportCredentials(userId, includePasswords = false) {
    try {
      const { data, error } = await this.supabase
        .from('credentials')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('discovered_at', { ascending: false });

      if (error) throw error;

      return data.map(cred => {
        const exported = {
          target: cred.target,
          service: cred.service,
          port: cred.port,
          username: cred.username,
          discoveredAt: cred.discovered_at,
          verified: cred.verified
        };

        if (includePasswords) {
          exported.password = this._decrypt(
            cred.password_encrypted,
            cred.password_iv,
            cred.password_auth_tag
          );
        }

        return exported;
      });
    } catch (error) {
      logger.error(`Failed to export credentials: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check for duplicate credentials
   * @param {Object} credentialData - Credential to check
   * @returns {Promise<boolean>} True if duplicate exists
   */
  async isDuplicate(credentialData) {
    try {
      const { target, service, port, username } = credentialData;

      const { data, error } = await this.supabase
        .from('credentials')
        .select('id')
        .eq('target', target)
        .eq('service', service)
        .eq('port', port)
        .eq('username', username)
        .eq('active', true)
        .limit(1);

      if (error) throw error;

      return data.length > 0;
    } catch (error) {
      logger.error(`Duplicate check failed: ${error.message}`);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new CredentialManager();
