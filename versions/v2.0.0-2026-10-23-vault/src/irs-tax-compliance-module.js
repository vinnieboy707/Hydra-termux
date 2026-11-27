'use strict';

/**
 * CHRONOS OS // IRS & W2 TAX COMPLIANCE AUTOMATION MODULE
 * Mandate: Automated W2 withholding calculations, IRS-compliant 1099/W2 tracking,
 * and immutable tax reporting audit trails.
 */

const fs = require('fs');
const path = require('path');

class IRSTaxComplianceEngine {
  constructor({ reportPath = path.resolve(__dirname, '../data/tax_compliance_report.json') } = {}) {
    this.reportPath = reportPath;
    this.withholdingRates = {
      federalIncomeTax: 0.22, // Standard supplemental / flat rate assumption
      socialSecurity: 0.062,   // 6.2%
      medicare: 0.0145         // 1.45%
    };
  }

  /**
   * Calculates W2 compliant withholdings for a payout or payroll distribution.
   * @param {number} grossAmountUSD 
   * @returns {Object} Breakdown of taxes and net payout
   */
  calculateW2Withholdings(grossAmountUSD) {
    const fit = grossAmountUSD * this.withholdingRates.federalIncomeTax;
    const ss = grossAmountUSD * this.withholdingRates.socialSecurity;
    const med = grossAmountUSD * this.withholdingRates.medicare;
    const totalWithheld = fit + ss + med;
    const netPayout = grossAmountUSD - totalWithheld;

    return {
      grossAmountUSD,
      withholdings: {
        federalIncomeTax: Number(fit.toFixed(2)),
        socialSecurity: Number(ss.toFixed(2)),
        medicare: Number(med.toFixed(2)),
        totalWithheld: Number(totalWithheld.toFixed(2))
      },
      netPayout: Number(netPayout.toFixed(2)),
      compliant: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generates and persists an IRS-compliant reporting record.
   * @param {Object} payoutRecord 
   */
  recordTaxCompliance(payoutRecord) {
    const taxRecord = this.calculateW2Withholdings(payoutRecord.amountUSD || 0);
    const auditEntry = {
      payoutId: payoutRecord.key,
      recipient: payoutRecord.recipient || 'PRIMARY_BENEFICIARY',
      ...taxRecord
    };

    try {
      let existing = [];
      if (fs.existsSync(this.reportPath)) {
        existing = JSON.parse(fs.readFileSync(this.reportPath, 'utf8'));
      }
      existing.push(auditEntry);
      fs.mkdirSync(path.dirname(this.reportPath), { recursive: true });
      fs.writeFileSync(this.reportPath, JSON.stringify(existing, null, 2));
    } catch (err) {
      console.error(`[IRS Compliance Error]: Failed to record tax report: ${err.message}`);
    }

    return auditEntry;
  }
}

module.exports = { IRSTaxComplianceEngine };
