/**
 * Result Parser Module
 * Parses attack outputs and extracts structured results
 * @module resultParser
 */

const { logger } = require('./logManager');

/**
 * Result Parser Service
 * Handles parsing of various attack tool outputs
 */
class ResultParser {
  constructor() {
    this.parsers = {
      hydra: this.parseHydraOutput.bind(this),
      nmap: this.parseNmapOutput.bind(this),
      masscan: this.parseMasscanOutput.bind(this),
      custom: this.parseCustomOutput.bind(this)
    };

    logger.info('Result Parser initialized');
  }

  /**
   * Parse attack output based on tool type
   * @param {string} output - Raw tool output
   * @param {string} toolType - Type of tool
   * @returns {Object} Parsed results
   */
  parse(output, toolType = 'hydra') {
    try {
      if (!output || output.trim() === '') {
        return {
          success: false,
          error: 'Empty output',
          results: []
        };
      }

      const parser = this.parsers[toolType.toLowerCase()];
      
      if (!parser) {
        logger.warn(`No parser found for tool type: ${toolType}, using custom parser`);
        return this.parseCustomOutput(output);
      }

      return parser(output);
    } catch (error) {
      logger.error(`Failed to parse output: ${error.message}`);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  /**
   * Parse Hydra output
   * @param {string} output - Hydra output
   * @returns {Object} Parsed Hydra results
   */
  parseHydraOutput(output) {
    try {
      const results = {
        success: false,
        credentials: [],
        statistics: {},
        errors: [],
        warnings: []
      };

      const lines = output.split('\n');

      for (const line of lines) {
        // Parse successful credentials
        if (line.includes('[') && line.includes('host:') && line.includes('login:') && line.includes('password:')) {
          const credential = this._parseHydraCredentialLine(line);
          if (credential) {
            results.credentials.push(credential);
            results.success = true;
          }
        }

        // Parse statistics
        if (line.includes('valid password') || line.includes('valid passwords')) {
          const match = line.match(/(\d+)\s+valid\s+password/);
          if (match) {
            results.statistics.validPasswords = parseInt(match[1]);
          }
        }

        // Parse attempt count
        if (line.includes('of') && line.includes('target')) {
          const match = line.match(/(\d+)\s+of\s+(\d+)\s+target/);
          if (match) {
            results.statistics.completed = parseInt(match[1]);
            results.statistics.total = parseInt(match[2]);
          }
        }

        // Parse errors
        if (line.toLowerCase().includes('error') || line.toLowerCase().includes('fail')) {
          results.errors.push(line.trim());
        }

        // Parse warnings
        if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('warn')) {
          results.warnings.push(line.trim());
        }
      }

      // Calculate success rate
      if (results.statistics.total) {
        results.statistics.successRate = 
          (results.credentials.length / results.statistics.total * 100).toFixed(2);
      }

      return results;
    } catch (error) {
      logger.error(`Hydra output parsing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse Hydra credential line
   * @param {string} line - Credential line from Hydra
   * @returns {Object|null} Parsed credential
   * @private
   */
  _parseHydraCredentialLine(line) {
    try {
      // Pattern: [port][service] host: IP/domain login: username password: password
      const patterns = [
        /\[(\d+)\]\[([^\]]+)\]\s+host:\s+([^\s]+)\s+login:\s+([^\s]+)\s+password:\s+(.+)/,
        /host:\s+([^\s]+)\s+login:\s+([^\s]+)\s+password:\s+([^\s]+)/
      ];

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          if (match.length === 6) {
            return {
              port: match[1],
              service: match[2],
              host: match[3],
              username: match[4],
              password: match[5].trim()
            };
          } else if (match.length === 4) {
            return {
              host: match[1],
              username: match[2],
              password: match[3].trim()
            };
          }
        }
      }

      return null;
    } catch (error) {
      logger.error(`Failed to parse credential line: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse Nmap output
   * @param {string} output - Nmap output
   * @returns {Object} Parsed Nmap results
   */
  parseNmapOutput(output) {
    try {
      const results = {
        success: true,
        hosts: [],
        statistics: {}
      };

      const lines = output.split('\n');
      let currentHost = null;

      for (const line of lines) {
        // Parse host information
        if (line.includes('Nmap scan report for')) {
          if (currentHost) {
            results.hosts.push(currentHost);
          }

          const match = line.match(/Nmap scan report for (.+)/);
          currentHost = {
            host: match ? match[1].trim() : 'unknown',
            ports: [],
            os: null,
            services: []
          };
        }

        // Parse port information
        if (currentHost && line.match(/^\d+\/\w+/)) {
          const portInfo = this._parseNmapPortLine(line);
          if (portInfo) {
            currentHost.ports.push(portInfo);
            if (portInfo.service) {
              currentHost.services.push(portInfo.service);
            }
          }
        }

        // Parse OS detection
        if (currentHost && line.includes('OS details:')) {
          const match = line.match(/OS details:\s+(.+)/);
          if (match) {
            currentHost.os = match[1].trim();
          }
        }

        // Parse statistics
        if (line.includes('Nmap done:')) {
          const match = line.match(/(\d+)\s+IP address/);
          if (match) {
            results.statistics.hostsScanned = parseInt(match[1]);
          }
        }
      }

      // Add last host
      if (currentHost) {
        results.hosts.push(currentHost);
      }

      return results;
    } catch (error) {
      logger.error(`Nmap output parsing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse Nmap port line
   * @param {string} line - Port line from Nmap
   * @returns {Object|null} Parsed port information
   * @private
   */
  _parseNmapPortLine(line) {
    try {
      const match = line.match(/(\d+)\/(tcp|udp)\s+(\w+)\s+(\S+)(?:\s+(.+))?/);
      
      if (match) {
        return {
          port: parseInt(match[1]),
          protocol: match[2],
          state: match[3],
          service: match[4],
          version: match[5] ? match[5].trim() : null
        };
      }

      return null;
    } catch (error) {
      logger.error(`Failed to parse port line: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse Masscan output
   * @param {string} output - Masscan output
   * @returns {Object} Parsed Masscan results
   */
  parseMasscanOutput(output) {
    try {
      const results = {
        success: true,
        discoveries: [],
        statistics: {}
      };

      const lines = output.split('\n');

      for (const line of lines) {
        // Parse discovered ports
        if (line.includes('Discovered open port')) {
          const match = line.match(/port\s+(\d+)\/(tcp|udp)\s+on\s+([^\s]+)/);
          if (match) {
            results.discoveries.push({
              port: parseInt(match[1]),
              protocol: match[2],
              host: match[3]
            });
          }
        }

        // Parse banner
        if (line.includes('Banner on port')) {
          const match = line.match(/port\s+(\d+)\/(tcp|udp)\s+on\s+([^\s]+):\s+(.+)/);
          if (match) {
            const discovery = results.discoveries.find(
              d => d.port === parseInt(match[1]) && d.host === match[3]
            );
            if (discovery) {
              discovery.banner = match[4].trim();
            }
          }
        }
      }

      results.statistics.portsFound = results.discoveries.length;
      results.statistics.uniqueHosts = 
        [...new Set(results.discoveries.map(d => d.host))].length;

      return results;
    } catch (error) {
      logger.error(`Masscan output parsing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse custom/generic output
   * @param {string} output - Generic output
   * @returns {Object} Parsed results
   */
  parseCustomOutput(output) {
    try {
      const results = {
        success: true,
        lines: [],
        patterns: {}
      };

      const lines = output.split('\n').filter(line => line.trim());
      results.lines = lines;

      // Extract common patterns
      results.patterns.emails = this._extractEmails(output);
      results.patterns.ips = this._extractIPs(output);
      results.patterns.urls = this._extractURLs(output);
      results.patterns.passwords = this._extractPasswords(output);

      return results;
    } catch (error) {
      logger.error(`Custom output parsing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract email addresses from text
   * @param {string} text - Input text
   * @returns {Array} Array of email addresses
   * @private
   */
  _extractEmails(text) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * Extract IP addresses from text
   * @param {string} text - Input text
   * @returns {Array} Array of IP addresses
   * @private
   */
  _extractIPs(text) {
    const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    const matches = text.match(ipRegex);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * Extract URLs from text
   * @param {string} text - Input text
   * @returns {Array} Array of URLs
   * @private
   */
  _extractURLs(text) {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const matches = text.match(urlRegex);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * Extract potential passwords from text
   * @param {string} text - Input text
   * @returns {Array} Array of potential passwords
   * @private
   */
  _extractPasswords(text) {
    const passwords = [];
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.toLowerCase().includes('password:') || 
          line.toLowerCase().includes('pass:') ||
          line.toLowerCase().includes('pwd:')) {
        const match = line.match(/(?:password|pass|pwd):\s*(\S+)/i);
        if (match && match[1]) {
          passwords.push(match[1]);
        }
      }
    }

    return [...new Set(passwords)];
  }

  /**
   * Validate parsed results
   * @param {Object} results - Parsed results
   * @returns {Object} Validation report
   */
  validateResults(results) {
    const validation = {
      valid: true,
      issues: [],
      warnings: []
    };

    if (!results) {
      validation.valid = false;
      validation.issues.push('Results object is null or undefined');
      return validation;
    }

    // Check for required fields
    if (results.success === undefined) {
      validation.warnings.push('Success status not defined');
    }

    // Validate credentials if present
    if (results.credentials && Array.isArray(results.credentials)) {
      results.credentials.forEach((cred, index) => {
        if (!cred.username || !cred.password) {
          validation.issues.push(`Credential at index ${index} missing username or password`);
          validation.valid = false;
        }
      });
    }

    // Check for empty results
    if (results.credentials && results.credentials.length === 0 && 
        results.hosts && results.hosts.length === 0 &&
        results.discoveries && results.discoveries.length === 0) {
      validation.warnings.push('No results found in output');
    }

    return validation;
  }

  /**
   * Format results for display
   * @param {Object} results - Parsed results
   * @param {string} format - Output format (json, text, table)
   * @returns {string} Formatted results
   */
  formatResults(results, format = 'json') {
    try {
      switch (format.toLowerCase()) {
        case 'json':
          return JSON.stringify(results, null, 2);
        
        case 'text':
          return this._formatAsText(results);
        
        case 'table':
          return this._formatAsTable(results);
        
        default:
          return JSON.stringify(results, null, 2);
      }
    } catch (error) {
      logger.error(`Result formatting failed: ${error.message}`);
      return JSON.stringify(results);
    }
  }

  /**
   * Format results as plain text
   * @param {Object} results - Parsed results
   * @returns {string} Text formatted results
   * @private
   */
  _formatAsText(results) {
    let output = '';

    if (results.credentials && results.credentials.length > 0) {
      output += '=== Credentials Found ===\n';
      results.credentials.forEach((cred, index) => {
        output += `${index + 1}. ${cred.host} - ${cred.username}:${cred.password}\n`;
      });
    }

    if (results.hosts && results.hosts.length > 0) {
      output += '\n=== Hosts Discovered ===\n';
      results.hosts.forEach((host, index) => {
        output += `${index + 1}. ${host.host} (${host.ports.length} ports)\n`;
      });
    }

    return output || 'No results to display';
  }

  /**
   * Format results as table
   * @param {Object} results - Parsed results
   * @returns {string} Table formatted results
   * @private
   */
  _formatAsTable(results) {
    let output = '';

    if (results.credentials && results.credentials.length > 0) {
      output += '┌────────────────────────────────────────────────────────────┐\n';
      output += '│                    Credentials Found                       │\n';
      output += '├────────────────────────────────────────────────────────────┤\n';
      results.credentials.forEach(cred => {
        output += `│ Host: ${cred.host.padEnd(50)} │\n`;
        output += `│ User: ${cred.username.padEnd(50)} │\n`;
        output += `│ Pass: ${cred.password.padEnd(50)} │\n`;
        output += '├────────────────────────────────────────────────────────────┤\n';
      });
      output += '└────────────────────────────────────────────────────────────┘\n';
    }

    return output || 'No results to display';
  }
}

// Export singleton instance
module.exports = new ResultParser();
