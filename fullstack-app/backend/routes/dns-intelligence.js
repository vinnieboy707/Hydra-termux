const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { run, get, all } = require('../database-pg');
const dns = require('dns').promises;

const router = express.Router();

// Get DNS intelligence for a domain
router.get('/domain/:domain', authMiddleware, async (req, res) => {
  try {
    const { domain } = req.params;
    
    // Check if we have cached data
    let intel = await get(
      'SELECT * FROM email_infrastructure_intel WHERE domain = $1',
      [domain]
    );
    
    // If cache is older than 7 days, refresh
    const shouldRefresh = !intel || 
      (new Date() - new Date(intel.last_scanned_at)) > (7 * 24 * 60 * 60 * 1000);
    
    if (shouldRefresh) {
      // Perform DNS scan
      intel = await scanDomainIntelligence(domain, req.user.id);
    }
    
    res.json({ intel });
  } catch (error) {
    console.error('Error fetching DNS intelligence:', error);
    res.status(500).json({ error: 'Failed to fetch DNS intelligence' });
  }
});

// Force refresh DNS intelligence
router.post('/domain/:domain/scan', authMiddleware, async (req, res) => {
  try {
    const { domain } = req.params;
    const intel = await scanDomainIntelligence(domain, req.user.id);
    res.json({ intel, message: 'DNS scan completed' });
  } catch (error) {
    console.error('Error scanning domain:', error);
    res.status(500).json({ error: 'Failed to scan domain' });
  }
});

// Get all scanned domains
router.get('/domains', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const domains = await all(
      'SELECT * FROM email_infrastructure_intel ORDER BY last_scanned_at DESC LIMIT $1 OFFSET $2',
      [parseInt(limit), parseInt(offset)]
    );
    
    const { total } = await get('SELECT COUNT(*) as total FROM email_infrastructure_intel', []);
    
    res.json({ 
      domains, 
      pagination: { 
        total: parseInt(total), 
        limit: parseInt(limit), 
        offset: parseInt(offset) 
      } 
    });
  } catch (error) {
    console.error('Error fetching domains:', error);
    res.status(500).json({ error: 'Failed to fetch domains' });
  }
});

// Bulk scan domains
router.post('/bulk-scan', authMiddleware, async (req, res) => {
  try {
    const { domains } = req.body;
    
    if (!Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ error: 'Domains array is required' });
    }
    
    const results = [];
    for (const domain of domains.slice(0, 10)) { // Limit to 10 at a time
      try {
        const intel = await scanDomainIntelligence(domain, req.user.id);
        results.push({ domain, success: true, intel });
      } catch (error) {
        results.push({ domain, success: false, error: error.message });
      }
    }
    
    res.json({ results });
  } catch (error) {
    console.error('Error in bulk scan:', error);
    res.status(500).json({ error: 'Failed to perform bulk scan' });
  }
});

// Helper function to scan domain intelligence
async function scanDomainIntelligence(domain, userId) {
  const intel = {
    domain,
    mx_records: [],
    spf_record: null,
    dmarc_record: null,
    dkim_selectors: [],
    a_records: [],
    aaaa_records: [],
    ns_records: [],
    txt_records: [],
    has_spf: false,
    has_dmarc: false,
    has_dkim: false,
    security_score: 0
  };
  
  try {
    // Get MX records
    try {
      const mx = await dns.resolveMx(domain);
      intel.mx_records = mx.map(record => ({
        exchange: record.exchange,
        priority: record.priority
      }));
    } catch (e) {
      console.log('No MX records found for', domain);
    }
    
    // Get A records
    try {
      intel.a_records = await dns.resolve4(domain);
    } catch (e) {
      console.log('No A records found for', domain);
    }
    
    // Get AAAA records
    try {
      intel.aaaa_records = await dns.resolve6(domain);
    } catch (e) {
      console.log('No AAAA records found for', domain);
    }
    
    // Get NS records
    try {
      intel.ns_records = await dns.resolveNs(domain);
    } catch (e) {
      console.log('No NS records found for', domain);
    }
    
    // Get TXT records (SPF, DMARC, DKIM)
    try {
      intel.txt_records = await dns.resolveTxt(domain);
      
      for (const record of intel.txt_records) {
        const txt = Array.isArray(record) ? record.join('') : record;
        
        // Check for SPF
        if (txt.startsWith('v=spf1')) {
          intel.spf_record = txt;
          intel.has_spf = true;
          intel.security_score += 30;
        }
      }
    } catch (e) {
      console.log('No TXT records found for', domain);
    }
    
    // Check DMARC
    try {
      const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`);
      for (const record of dmarcRecords) {
        const txt = Array.isArray(record) ? record.join('') : record;
        if (txt.startsWith('v=DMARC1')) {
          intel.dmarc_record = txt;
          intel.has_dmarc = true;
          intel.security_score += 40;
          
          // Parse DMARC policy
          const policyMatch = txt.match(/p=([^;]+)/);
          if (policyMatch) {
            intel.dmarc_policy = policyMatch[1];
          }
        }
      }
    } catch (e) {
      console.log('No DMARC records found for', domain);
    }
    
    // Check common DKIM selectors
    const commonSelectors = ['default', 'google', 'k1', 'selector1', 'selector2', 'dkim', 'mail'];
    const dkimRecords = [];
    
    for (const selector of commonSelectors) {
      try {
        const records = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
        for (const record of records) {
          const txt = Array.isArray(record) ? record.join('') : record;
          if (txt.includes('v=DKIM1')) {
            intel.dkim_selectors.push(selector);
            dkimRecords.push({ selector, record: txt });
            intel.has_dkim = true;
          }
        }
      } catch (e) {
        // Selector doesn't exist
      }
    }
    
    if (intel.has_dkim) {
      intel.security_score += 30;
      intel.dkim_records = dkimRecords;
    }
    
    // Helper to safely match MX host to a provider domain or its subdomains
    function matchesProvider(mxHost, providerDomain) {
      if (!mxHost) {
        return false;
      }
      // Exact match or subdomain match (e.g., mail.mimecast.com)
      return mxHost === providerDomain || mxHost.endsWith('.' + providerDomain);
    }

    // Detect email provider
    if (intel.mx_records && intel.mx_records.length > 0) {
      const mxHost = (intel.mx_records[0].exchange || '').toLowerCase();
      
      if (matchesProvider(mxHost, 'google.com') || matchesProvider(mxHost, 'googlemail.com')) {
        intel.email_provider = 'Google Workspace';
      } else if (
        matchesProvider(mxHost, 'outlook.com') ||
        matchesProvider(mxHost, 'protection.outlook.com') ||
        matchesProvider(mxHost, 'mail.protection.outlook.com')
      ) {
        intel.email_provider = 'Microsoft 365';
      } else if (matchesProvider(mxHost, 'proofpoint.com')) {
        intel.email_provider = 'Proofpoint';
      } else if (matchesProvider(mxHost, 'mailgun.org')) {
        intel.email_provider = 'Mailgun';
      } else if (matchesProvider(mxHost, 'sendgrid.net')) {
        intel.email_provider = 'SendGrid';
      } else if (matchesProvider(mxHost, 'amazonses.com')) {
        intel.email_provider = 'Amazon SES';
      } else if (matchesProvider(mxHost, 'mimecast.com')) {
        intel.email_provider = 'Mimecast';
      } else {
        intel.email_provider = 'Other';
      }
    }
    
    // Store or update in database
    const existing = await get('SELECT * FROM email_infrastructure_intel WHERE domain = $1', [domain]);
    
    if (existing) {
      await run(`
        UPDATE email_infrastructure_intel SET
          mx_records = $1, spf_record = $2, dmarc_record = $3, dkim_selectors = $4,
          dkim_records = $5, a_records = $6, aaaa_records = $7, ns_records = $8,
          txt_records = $9, email_provider = $10, has_spf = $11, has_dmarc = $12,
          has_dkim = $13, security_score = $14, dmarc_policy = $15,
          last_scanned_at = CURRENT_TIMESTAMP, scan_count = scan_count + 1
        WHERE domain = $16
      `, [
        JSON.stringify(intel.mx_records), intel.spf_record, intel.dmarc_record,
        intel.dkim_selectors, JSON.stringify(intel.dkim_records),
        intel.a_records, intel.aaaa_records, intel.ns_records,
        intel.txt_records, intel.email_provider, intel.has_spf,
        intel.has_dmarc, intel.has_dkim, intel.security_score,
        intel.dmarc_policy, domain
      ]);
    } else {
      await run(`
        INSERT INTO email_infrastructure_intel (
          domain, mx_records, spf_record, dmarc_record, dkim_selectors, dkim_records,
          a_records, aaaa_records, ns_records, txt_records, email_provider,
          has_spf, has_dmarc, has_dkim, security_score, dmarc_policy
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        domain, JSON.stringify(intel.mx_records), intel.spf_record, intel.dmarc_record,
        intel.dkim_selectors, JSON.stringify(intel.dkim_records),
        intel.a_records, intel.aaaa_records, intel.ns_records,
        intel.txt_records, intel.email_provider, intel.has_spf,
        intel.has_dmarc, intel.has_dkim, intel.security_score, intel.dmarc_policy
      ]);
    }
    
    // Fetch the saved record
    return await get('SELECT * FROM email_infrastructure_intel WHERE domain = $1', [domain]);
    
  } catch (error) {
    console.error('Error scanning domain:', error);
    throw error;
  }
}

// Analyze email security
router.get('/domain/:domain/security-analysis', authMiddleware, async (req, res) => {
  try {
    const { domain } = req.params;
    
    const intel = await get(
      'SELECT * FROM email_infrastructure_intel WHERE domain = $1',
      [domain]
    );
    
    if (!intel) {
      return res.status(404).json({ error: 'Domain not scanned yet' });
    }
    
    const analysis = {
      security_score: intel.security_score,
      max_score: 100,
      grade: getSecurityGrade(intel.security_score),
      findings: [],
      recommendations: [],
      vulnerabilities: []
    };
    
    if (!intel.has_spf) {
      analysis.findings.push('No SPF record found');
      analysis.recommendations.push('Implement SPF record to prevent email spoofing');
      analysis.vulnerabilities.push({ 
        type: 'missing_spf', 
        severity: 'high',
        description: 'Domain is vulnerable to email spoofing attacks'
      });
    }
    
    if (!intel.has_dmarc) {
      analysis.findings.push('No DMARC record found');
      analysis.recommendations.push('Implement DMARC policy to monitor and protect against email fraud');
      analysis.vulnerabilities.push({ 
        type: 'missing_dmarc', 
        severity: 'high',
        description: 'No DMARC policy protecting domain reputation'
      });
    } else if (intel.dmarc_policy === 'none') {
      analysis.findings.push('DMARC policy set to "none" (monitoring only)');
      analysis.recommendations.push('Upgrade DMARC policy to "quarantine" or "reject"');
    }
    
    if (!intel.has_dkim) {
      analysis.findings.push('No DKIM records found');
      analysis.recommendations.push('Implement DKIM signatures for email authentication');
      analysis.vulnerabilities.push({ 
        type: 'missing_dkim', 
        severity: 'medium',
        description: 'Emails not cryptographically signed'
      });
    }
    
    if (intel.mx_records && intel.mx_records.length === 0) {
      analysis.findings.push('No MX records configured');
      analysis.vulnerabilities.push({ 
        type: 'no_mx', 
        severity: 'critical',
        description: 'Domain cannot receive email'
      });
    }
    
    res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing security:', error);
    res.status(500).json({ error: 'Failed to analyze security' });
  }
});

function getSecurityGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

module.exports = router;
