/**
 * DNS Intelligence Module
 * Provides comprehensive DNS analysis including MX, SPF, DMARC, DKIM lookups
 * @module dnsIntelligence
 */

const dns = require('dns').promises;
const { Resolver } = require('dns');
const { logger } = require('./logManager');

/**
 * DNS Intelligence Service
 * Handles all DNS-related queries and intelligence gathering
 */
class DNSIntelligence {
  constructor() {
    this.resolver = new Resolver();
    this.cache = new Map();
    this.cacheTimeout = 300000; // 5 minutes
    this.dnsServers = ['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1'];
    this.resolver.setServers(this.dnsServers);
  }

  /**
   * Get cached result or execute DNS query
   * @param {string} key - Cache key
   * @param {Function} queryFn - Function to execute if cache miss
   * @returns {Promise<any>} Query result
   * @private
   */
  async _getCached(key, queryFn) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      logger.debug(`DNS cache hit: ${key}`);
      return cached.data;
    }

    try {
      const data = await queryFn();
      this.cache.set(key, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      logger.error(`DNS query failed for ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform comprehensive DNS analysis for a domain
   * @param {string} domain - Domain to analyze
   * @returns {Promise<Object>} Complete DNS intelligence report
   */
  async analyzeDomain(domain) {
    try {
      logger.info(`Starting DNS analysis for domain: ${domain}`);

      const [
        aRecords,
        mxRecords,
        txtRecords,
        nsRecords,
        soaRecord,
        spfRecord,
        dmarcRecord,
        dkimRecords
      ] = await Promise.allSettled([
        this.getARecords(domain),
        this.getMXRecords(domain),
        this.getTXTRecords(domain),
        this.getNSRecords(domain),
        this.getSOARecord(domain),
        this.getSPFRecord(domain),
        this.getDMARCRecord(domain),
        this.getDKIMRecords(domain)
      ]);

      const result = {
        domain,
        timestamp: new Date().toISOString(),
        records: {
          a: aRecords.status === 'fulfilled' ? aRecords.value : [],
          mx: mxRecords.status === 'fulfilled' ? mxRecords.value : [],
          txt: txtRecords.status === 'fulfilled' ? txtRecords.value : [],
          ns: nsRecords.status === 'fulfilled' ? nsRecords.value : [],
          soa: soaRecord.status === 'fulfilled' ? soaRecord.value : null
        },
        email_security: {
          spf: spfRecord.status === 'fulfilled' ? spfRecord.value : null,
          dmarc: dmarcRecord.status === 'fulfilled' ? dmarcRecord.value : null,
          dkim: dkimRecords.status === 'fulfilled' ? dkimRecords.value : []
        },
        security_score: this._calculateSecurityScore({
          spf: spfRecord.status === 'fulfilled' ? spfRecord.value : null,
          dmarc: dmarcRecord.status === 'fulfilled' ? dmarcRecord.value : null,
          dkim: dkimRecords.status === 'fulfilled' ? dkimRecords.value : []
        })
      };

      logger.info(`DNS analysis completed for domain: ${domain}`);
      return result;
    } catch (error) {
      logger.error(`DNS analysis failed for ${domain}: ${error.message}`);
      throw new Error(`DNS analysis failed: ${error.message}`);
    }
  }

  /**
   * Get A records for domain
   * @param {string} domain - Domain name
   * @returns {Promise<Array>} Array of IP addresses
   */
  async getARecords(domain) {
    return this._getCached(`A:${domain}`, async () => {
      try {
        const addresses = await dns.resolve4(domain);
        return addresses.map(ip => ({ type: 'A', ip }));
      } catch (error) {
        logger.warn(`A record lookup failed for ${domain}: ${error.message}`);
        return [];
      }
    });
  }

  /**
   * Get MX records for domain
   * @param {string} domain - Domain name
   * @returns {Promise<Array>} Array of MX records
   */
  async getMXRecords(domain) {
    return this._getCached(`MX:${domain}`, async () => {
      try {
        const records = await dns.resolveMx(domain);
        return records
          .sort((a, b) => a.priority - b.priority)
          .map(record => ({
            type: 'MX',
            priority: record.priority,
            exchange: record.exchange
          }));
      } catch (error) {
        logger.warn(`MX record lookup failed for ${domain}: ${error.message}`);
        return [];
      }
    });
  }

  /**
   * Get TXT records for domain
   * @param {string} domain - Domain name
   * @returns {Promise<Array>} Array of TXT records
   */
  async getTXTRecords(domain) {
    return this._getCached(`TXT:${domain}`, async () => {
      try {
        const records = await dns.resolveTxt(domain);
        return records.map(record => ({
          type: 'TXT',
          value: Array.isArray(record) ? record.join('') : record
        }));
      } catch (error) {
        logger.warn(`TXT record lookup failed for ${domain}: ${error.message}`);
        return [];
      }
    });
  }

  /**
   * Get NS records for domain
   * @param {string} domain - Domain name
   * @returns {Promise<Array>} Array of nameservers
   */
  async getNSRecords(domain) {
    return this._getCached(`NS:${domain}`, async () => {
      try {
        const nameservers = await dns.resolveNs(domain);
        return nameservers.map(ns => ({ type: 'NS', nameserver: ns }));
      } catch (error) {
        logger.warn(`NS record lookup failed for ${domain}: ${error.message}`);
        return [];
      }
    });
  }

  /**
   * Get SOA record for domain
   * @param {string} domain - Domain name
   * @returns {Promise<Object|null>} SOA record details
   */
  async getSOARecord(domain) {
    return this._getCached(`SOA:${domain}`, async () => {
      try {
        const soa = await dns.resolveSoa(domain);
        return {
          type: 'SOA',
          nsname: soa.nsname,
          hostmaster: soa.hostmaster,
          serial: soa.serial,
          refresh: soa.refresh,
          retry: soa.retry,
          expire: soa.expire,
          minttl: soa.minttl
        };
      } catch (error) {
        logger.warn(`SOA record lookup failed for ${domain}: ${error.message}`);
        return null;
      }
    });
  }

  /**
   * Get and parse SPF record
   * @param {string} domain - Domain name
   * @returns {Promise<Object|null>} SPF record details
   */
  async getSPFRecord(domain) {
    return this._getCached(`SPF:${domain}`, async () => {
      try {
        const txtRecords = await dns.resolveTxt(domain);
        const spfRecord = txtRecords
          .map(r => Array.isArray(r) ? r.join('') : r)
          .find(r => r.startsWith('v=spf1'));

        if (!spfRecord) {
          return { exists: false, record: null, parsed: null };
        }

        const parsed = this._parseSPF(spfRecord);
        return {
          exists: true,
          record: spfRecord,
          parsed,
          valid: this._validateSPF(parsed)
        };
      } catch (error) {
        logger.warn(`SPF record lookup failed for ${domain}: ${error.message}`);
        return { exists: false, record: null, parsed: null };
      }
    });
  }

  /**
   * Get and parse DMARC record
   * @param {string} domain - Domain name
   * @returns {Promise<Object|null>} DMARC record details
   */
  async getDMARCRecord(domain) {
    return this._getCached(`DMARC:${domain}`, async () => {
      try {
        const dmarcDomain = `_dmarc.${domain}`;
        const txtRecords = await dns.resolveTxt(dmarcDomain);
        const dmarcRecord = txtRecords
          .map(r => Array.isArray(r) ? r.join('') : r)
          .find(r => r.startsWith('v=DMARC1'));

        if (!dmarcRecord) {
          return { exists: false, record: null, parsed: null };
        }

        const parsed = this._parseDMARC(dmarcRecord);
        return {
          exists: true,
          record: dmarcRecord,
          parsed,
          valid: this._validateDMARC(parsed)
        };
      } catch (error) {
        logger.warn(`DMARC record lookup failed for ${domain}: ${error.message}`);
        return { exists: false, record: null, parsed: null };
      }
    });
  }

  /**
   * Get DKIM records (common selectors)
   * @param {string} domain - Domain name
   * @returns {Promise<Array>} Array of DKIM records found
   */
  async getDKIMRecords(domain) {
    const commonSelectors = [
      'default', 'google', 'k1', 'dkim', 'selector1', 'selector2',
      'mail', 'email', 's1', 's2', 'mandrill', 'mta', 'smtp'
    ];

    const results = await Promise.allSettled(
      commonSelectors.map(selector => this._checkDKIM(domain, selector))
    );

    return results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);
  }

  /**
   * Check DKIM record for specific selector
   * @param {string} domain - Domain name
   * @param {string} selector - DKIM selector
   * @returns {Promise<Object|null>} DKIM record details
   * @private
   */
  async _checkDKIM(domain, selector) {
    try {
      const dkimDomain = `${selector}._domainkey.${domain}`;
      const txtRecords = await dns.resolveTxt(dkimDomain);
      const dkimRecord = txtRecords
        .map(r => Array.isArray(r) ? r.join('') : r)
        .find(r => r.includes('v=DKIM1') || r.includes('p='));

      if (dkimRecord) {
        return {
          selector,
          domain: dkimDomain,
          record: dkimRecord,
          parsed: this._parseDKIM(dkimRecord)
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse SPF record
   * @param {string} spf - SPF record string
   * @returns {Object} Parsed SPF components
   * @private
   */
  _parseSPF(spf) {
    const mechanisms = [];
    const modifiers = {};
    const parts = spf.split(/\s+/);

    for (const part of parts) {
      if (part.startsWith('v=')) continue;
      
      if (part.includes('=')) {
        const [key, value] = part.split('=');
        modifiers[key] = value;
      } else {
        mechanisms.push(part);
      }
    }

    return { mechanisms, modifiers };
  }

  /**
   * Parse DMARC record
   * @param {string} dmarc - DMARC record string
   * @returns {Object} Parsed DMARC components
   * @private
   */
  _parseDMARC(dmarc) {
    const tags = {};
    const parts = dmarc.split(';').map(p => p.trim()).filter(p => p);

    for (const part of parts) {
      const [key, value] = part.split('=').map(s => s.trim());
      if (key && value) {
        tags[key] = value;
      }
    }

    return tags;
  }

  /**
   * Parse DKIM record
   * @param {string} dkim - DKIM record string
   * @returns {Object} Parsed DKIM components
   * @private
   */
  _parseDKIM(dkim) {
    const tags = {};
    const parts = dkim.split(';').map(p => p.trim()).filter(p => p);

    for (const part of parts) {
      const [key, value] = part.split('=').map(s => s.trim());
      if (key && value) {
        tags[key] = value;
      }
    }

    return tags;
  }

  /**
   * Validate SPF record
   * @param {Object} parsed - Parsed SPF record
   * @returns {boolean} Validation result
   * @private
   */
  _validateSPF(parsed) {
    if (!parsed || !parsed.mechanisms) return false;
    const hasAll = parsed.mechanisms.some(m => m.includes('all'));
    const hasMechanisms = parsed.mechanisms.length > 1;
    return hasMechanisms && hasAll;
  }

  /**
   * Validate DMARC record
   * @param {Object} parsed - Parsed DMARC record
   * @returns {boolean} Validation result
   * @private
   */
  _validateDMARC(parsed) {
    if (!parsed || !parsed.p) return false;
    const validPolicies = ['none', 'quarantine', 'reject'];
    return validPolicies.includes(parsed.p);
  }

  /**
   * Calculate security score based on email security records
   * @param {Object} emailSecurity - Email security records
   * @returns {Object} Security score and recommendations
   * @private
   */
  _calculateSecurityScore(emailSecurity) {
    let score = 0;
    const maxScore = 100;
    const recommendations = [];

    // SPF (30 points)
    if (emailSecurity.spf?.exists) {
      score += 15;
      if (emailSecurity.spf?.valid) {
        score += 15;
      } else {
        recommendations.push('SPF record exists but may not be properly configured');
      }
    } else {
      recommendations.push('Add SPF record to prevent email spoofing');
    }

    // DMARC (40 points)
    if (emailSecurity.dmarc?.exists) {
      score += 20;
      if (emailSecurity.dmarc?.valid) {
        score += 20;
        const policy = emailSecurity.dmarc.parsed?.p;
        if (policy === 'reject') {
          recommendations.push('DMARC policy is set to reject - excellent!');
        } else if (policy === 'quarantine') {
          recommendations.push('Consider upgrading DMARC policy to "reject"');
        } else {
          recommendations.push('DMARC policy is set to "none" - consider "quarantine" or "reject"');
        }
      }
    } else {
      recommendations.push('Add DMARC record to improve email authentication');
    }

    // DKIM (30 points)
    if (emailSecurity.dkim && emailSecurity.dkim.length > 0) {
      score += 30;
    } else {
      recommendations.push('Configure DKIM signing for your emails');
    }

    return {
      score,
      maxScore,
      percentage: Math.round((score / maxScore) * 100),
      grade: this._getGrade(score, maxScore),
      recommendations
    };
  }

  /**
   * Get letter grade for security score
   * @param {number} score - Current score
   * @param {number} maxScore - Maximum possible score
   * @returns {string} Letter grade
   * @private
   */
  _getGrade(score, maxScore) {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  /**
   * Perform reverse DNS lookup
   * @param {string} ip - IP address
   * @returns {Promise<Array>} Hostnames
   */
  async reverseLookup(ip) {
    return this._getCached(`PTR:${ip}`, async () => {
      try {
        const hostnames = await dns.reverse(ip);
        return hostnames.map(hostname => ({ type: 'PTR', ip, hostname }));
      } catch (error) {
        logger.warn(`Reverse DNS lookup failed for ${ip}: ${error.message}`);
        return [];
      }
    });
  }

  /**
   * Clear DNS cache
   */
  clearCache() {
    this.cache.clear();
    logger.info('DNS cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      timeout: this.cacheTimeout,
      servers: this.dnsServers
    };
  }
}

// Export singleton instance
module.exports = new DNSIntelligence();
