/**
 * Notification Manager Module
 * Handles email and webhook notifications
 * @module notificationManager
 */

const nodemailer = require('nodemailer');
const axios = require('axios');
const { logger } = require('./logManager');

/**
 * Notification Manager Service
 * Manages email and webhook notifications for attack events
 */
class NotificationManager {
  constructor() {
    this.emailEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
    this.webhookEnabled = process.env.WEBHOOK_NOTIFICATIONS_ENABLED === 'true';
    
    this.emailTransporter = null;
    this.webhookEndpoints = [];
    
    if (this.emailEnabled) {
      this.setupEmailTransporter();
    }
    
    if (this.webhookEnabled) {
      this.loadWebhookEndpoints();
    }

    logger.info('Notification Manager initialized');
  }

  /**
   * Setup email transporter
   * @private
   */
  setupEmailTransporter() {
    try {
      const config = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      };

      this.emailTransporter = nodemailer.createTransport(config);
      
      // Verify connection
      this.emailTransporter.verify((error, success) => {
        if (error) {
          logger.error(`Email transporter verification failed: ${error.message}`);
          this.emailEnabled = false;
        } else {
          logger.info('Email transporter ready');
        }
      });
    } catch (error) {
      logger.error(`Failed to setup email transporter: ${error.message}`);
      this.emailEnabled = false;
    }
  }

  /**
   * Load webhook endpoints from environment
   * @private
   */
  loadWebhookEndpoints() {
    try {
      const webhookUrls = process.env.WEBHOOK_URLS;
      if (webhookUrls) {
        this.webhookEndpoints = webhookUrls.split(',').map(url => url.trim());
        logger.info(`Loaded ${this.webhookEndpoints.length} webhook endpoints`);
      }
    } catch (error) {
      logger.error(`Failed to load webhook endpoints: ${error.message}`);
    }
  }

  /**
   * Send notification for attack completion
   * @param {Object} attackData - Attack data
   * @returns {Promise<Object>} Notification results
   */
  async notifyAttackComplete(attackData) {
    try {
      const {
        attackId,
        userId,
        target,
        attackType,
        status,
        credentialsFound = 0,
        duration,
        userEmail
      } = attackData;

      const notification = {
        type: 'attack_complete',
        attackId,
        target,
        attackType,
        status,
        credentialsFound,
        duration,
        timestamp: new Date().toISOString()
      };

      const results = {
        email: null,
        webhook: null
      };

      // Send email notification
      if (this.emailEnabled && userEmail) {
        results.email = await this.sendEmailNotification(
          userEmail,
          'Attack Completed',
          this._generateAttackCompleteEmail(notification)
        );
      }

      // Send webhook notification
      if (this.webhookEnabled) {
        results.webhook = await this.sendWebhookNotification(notification);
      }

      logger.info(`Notifications sent for attack ${attackId}`);
      return results;
    } catch (error) {
      logger.error(`Failed to send attack complete notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send notification for attack failure
   * @param {Object} attackData - Attack data
   * @returns {Promise<Object>} Notification results
   */
  async notifyAttackFailed(attackData) {
    try {
      const {
        attackId,
        target,
        attackType,
        error,
        userEmail
      } = attackData;

      const notification = {
        type: 'attack_failed',
        attackId,
        target,
        attackType,
        error: error.message || error,
        timestamp: new Date().toISOString()
      };

      const results = {
        email: null,
        webhook: null
      };

      if (this.emailEnabled && userEmail) {
        results.email = await this.sendEmailNotification(
          userEmail,
          'Attack Failed',
          this._generateAttackFailedEmail(notification)
        );
      }

      if (this.webhookEnabled) {
        results.webhook = await this.sendWebhookNotification(notification);
      }

      logger.info(`Failure notifications sent for attack ${attackId}`);
      return results;
    } catch (error) {
      logger.error(`Failed to send attack failed notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send notification for credentials discovered
   * @param {Object} credentialData - Credential data
   * @returns {Promise<Object>} Notification results
   */
  async notifyCredentialsDiscovered(credentialData) {
    try {
      const {
        attackId,
        target,
        service,
        username,
        userEmail,
        includePassword = false,
        password
      } = credentialData;

      const notification = {
        type: 'credentials_discovered',
        attackId,
        target,
        service,
        username,
        timestamp: new Date().toISOString()
      };

      if (includePassword && password) {
        notification.password = password;
      }

      const results = {
        email: null,
        webhook: null
      };

      if (this.emailEnabled && userEmail) {
        results.email = await this.sendEmailNotification(
          userEmail,
          'Credentials Discovered',
          this._generateCredentialsEmail(notification)
        );
      }

      if (this.webhookEnabled) {
        // Don't include password in webhook by default for security
        const webhookNotification = { ...notification };
        delete webhookNotification.password;
        results.webhook = await this.sendWebhookNotification(webhookNotification);
      }

      logger.info(`Credential discovery notifications sent for attack ${attackId}`);
      return results;
    } catch (error) {
      logger.error(`Failed to send credentials notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send email notification
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} body - Email body (HTML or text)
   * @returns {Promise<Object>} Email send result
   */
  async sendEmailNotification(to, subject, body) {
    if (!this.emailEnabled || !this.emailTransporter) {
      logger.warn('Email notifications are disabled');
      return { success: false, reason: 'Email notifications disabled' };
    }

    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: `[Hydra-Termux] ${subject}`,
        html: body,
        text: body.replace(/<[^>]*>/g, '') // Strip HTML for text version
      };

      const info = await this.emailTransporter.sendMail(mailOptions);

      logger.info(`Email sent to ${to}: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
        to,
        subject
      };
    } catch (error) {
      logger.error(`Failed to send email to ${to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        to,
        subject
      };
    }
  }

  /**
   * Send webhook notification
   * @param {Object} payload - Notification payload
   * @returns {Promise<Array>} Webhook send results
   */
  async sendWebhookNotification(payload) {
    if (!this.webhookEnabled || this.webhookEndpoints.length === 0) {
      logger.warn('Webhook notifications are disabled or no endpoints configured');
      return [];
    }

    const results = [];

    for (const endpoint of this.webhookEndpoints) {
      try {
        const response = await axios.post(endpoint, payload, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Hydra-Termux-Notifier/1.0'
          },
          timeout: 5000
        });

        results.push({
          endpoint,
          success: true,
          status: response.status,
          data: response.data
        });

        logger.info(`Webhook sent to ${endpoint}: ${response.status}`);
      } catch (error) {
        results.push({
          endpoint,
          success: false,
          error: error.message
        });

        logger.error(`Failed to send webhook to ${endpoint}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Generate HTML email for attack completion
   * @param {Object} data - Attack data
   * @returns {string} HTML email content
   * @private
   */
  _generateAttackCompleteEmail(data) {
    const statusColor = data.status === 'completed' ? '#28a745' : '#ffc107';
    const credentialsText = data.credentialsFound > 0 
      ? `<strong>${data.credentialsFound}</strong> credential(s) discovered!`
      : 'No credentials found.';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${statusColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #555; }
          .value { color: #333; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🎯 Attack Completed</h2>
          </div>
          <div class="content">
            <div class="info-row">
              <span class="label">Attack ID:</span>
              <span class="value">${data.attackId}</span>
            </div>
            <div class="info-row">
              <span class="label">Target:</span>
              <span class="value">${data.target}</span>
            </div>
            <div class="info-row">
              <span class="label">Attack Type:</span>
              <span class="value">${data.attackType}</span>
            </div>
            <div class="info-row">
              <span class="label">Status:</span>
              <span class="value">${data.status}</span>
            </div>
            <div class="info-row">
              <span class="label">Duration:</span>
              <span class="value">${this._formatDuration(data.duration)}</span>
            </div>
            <div class="info-row">
              <span class="label">Results:</span>
              <span class="value">${credentialsText}</span>
            </div>
            <div class="footer">
              <p>Timestamp: ${data.timestamp}</p>
              <p>This is an automated notification from Hydra-Termux.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML email for attack failure
   * @param {Object} data - Attack data
   * @returns {string} HTML email content
   * @private
   */
  _generateAttackFailedEmail(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #555; }
          .value { color: #333; }
          .error { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 15px 0; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>❌ Attack Failed</h2>
          </div>
          <div class="content">
            <div class="info-row">
              <span class="label">Attack ID:</span>
              <span class="value">${data.attackId}</span>
            </div>
            <div class="info-row">
              <span class="label">Target:</span>
              <span class="value">${data.target}</span>
            </div>
            <div class="info-row">
              <span class="label">Attack Type:</span>
              <span class="value">${data.attackType}</span>
            </div>
            <div class="error">
              <strong>Error:</strong><br>
              ${data.error}
            </div>
            <div class="footer">
              <p>Timestamp: ${data.timestamp}</p>
              <p>This is an automated notification from Hydra-Termux.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML email for credentials discovered
   * @param {Object} data - Credential data
   * @returns {string} HTML email content
   * @private
   */
  _generateCredentialsEmail(data) {
    const passwordRow = data.password
      ? `<div class="info-row">
           <span class="label">Password:</span>
           <span class="value"><code>${data.password}</code></span>
         </div>`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #555; }
          .value { color: #333; }
          code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
          .warning { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 15px 0; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🔑 Credentials Discovered</h2>
          </div>
          <div class="content">
            <div class="info-row">
              <span class="label">Attack ID:</span>
              <span class="value">${data.attackId}</span>
            </div>
            <div class="info-row">
              <span class="label">Target:</span>
              <span class="value">${data.target}</span>
            </div>
            <div class="info-row">
              <span class="label">Service:</span>
              <span class="value">${data.service}</span>
            </div>
            <div class="info-row">
              <span class="label">Username:</span>
              <span class="value"><code>${data.username}</code></span>
            </div>
            ${passwordRow}
            <div class="warning">
              <strong>⚠️ Security Notice:</strong><br>
              These credentials should be used responsibly and only for authorized testing purposes.
            </div>
            <div class="footer">
              <p>Timestamp: ${data.timestamp}</p>
              <p>This is an automated notification from Hydra-Termux.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Format duration in milliseconds to human-readable string
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   * @private
   */
  _formatDuration(ms) {
    if (!ms) return 'N/A';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Test email configuration
   * @param {string} testEmail - Email to send test to
   * @returns {Promise<Object>} Test result
   */
  async testEmailConfiguration(testEmail) {
    try {
      const result = await this.sendEmailNotification(
        testEmail,
        'Test Notification',
        '<h1>Test Email</h1><p>Your email notifications are configured correctly!</p>'
      );

      return {
        success: result.success,
        message: result.success 
          ? 'Test email sent successfully' 
          : `Failed to send test email: ${result.error}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Test failed: ${error.message}`
      };
    }
  }

  /**
   * Test webhook configuration
   * @returns {Promise<Array>} Test results for all webhooks
   */
  async testWebhookConfiguration() {
    const testPayload = {
      type: 'test',
      message: 'Webhook configuration test',
      timestamp: new Date().toISOString()
    };

    const results = await this.sendWebhookNotification(testPayload);

    return results.map(result => ({
      endpoint: result.endpoint,
      success: result.success,
      message: result.success 
        ? `Webhook test successful (status: ${result.status})` 
        : `Webhook test failed: ${result.error}`
    }));
  }

  /**
   * Get notification statistics
   * @returns {Object} Notification statistics
   */
  getStats() {
    return {
      email: {
        enabled: this.emailEnabled,
        configured: this.emailTransporter !== null
      },
      webhook: {
        enabled: this.webhookEnabled,
        endpoints: this.webhookEndpoints.length
      }
    };
  }
}

// Export singleton instance
module.exports = new NotificationManager();
