# Report Requirements & Documentation Standards

**Version:** 2.0.0  
**Classification:** STANDARDS  
**Last Updated:** January 2026  
**Compliance:** Industry Best Practices

---

## Table of Contents

1. [Overview](#overview)
2. [Report Types](#report-types)
3. [Report Structure](#report-structure)
4. [Content Requirements](#content-requirements)
5. [Formatting Standards](#formatting-standards)
6. [Evidence Requirements](#evidence-requirements)
7. [Compliance-Specific Reports](#compliance-specific-reports)
8. [Quality Assurance](#quality-assurance)
9. [Delivery Requirements](#delivery-requirements)
10. [Report Templates](#report-templates)

---

## Overview

### Purpose

Professional penetration testing reports serve multiple purposes:
1. **Document findings** - Record all discovered vulnerabilities
2. **Communicate risks** - Explain business impact to stakeholders
3. **Provide remediation** - Guide security improvements
4. **Demonstrate compliance** - Meet regulatory requirements
5. **Evidence retention** - Maintain audit trail

### Audience Levels

Reports must address multiple audiences:

**Executive Level** (C-Suite, Board):
- Business impact and risk
- High-level findings
- Strategic recommendations
- Minimal technical jargon

**Management Level** (IT Managers, Security Managers):
- Tactical recommendations
- Resource requirements
- Implementation timelines
- Prioritized action items

**Technical Level** (IT Staff, System Administrators):
- Detailed technical findings
- Step-by-step remediation
- Configuration examples
- Command-line instructions

---

## Report Types

### 1. Executive Summary Report

**Length:** 2-5 pages  
**Audience:** C-Level, Board Members, Non-Technical Stakeholders  
**Purpose:** High-level business risk communication

**Required Sections:**
- Overview and Scope
- Methodology Summary
- Key Findings (3-5 critical items)
- Risk Summary (visual/chart)
- Business Impact Analysis
- High-Level Recommendations (top 5)
- Overall Security Posture Rating

**Tone:** Business-focused, minimal technical detail

**Template:**
```markdown
# Executive Summary

## Assessment Overview
[Organization name] engaged [testing company] to conduct an independent
security assessment of their [systems/network] to identify potential
security vulnerabilities and risks.

**Testing Period:** [Dates]  
**Scope:** [High-level scope]  
**Approach:** [Black/Gray/White box]

## Overall Security Posture: [HIGH RISK / MEDIUM RISK / LOW RISK]

[1-2 paragraph assessment of overall security state]

## Critical Findings

### 1. [Critical Finding #1]
- **Risk:** CRITICAL
- **Impact:** [Business impact in plain language]
- **Recommendation:** [What needs to be done]

### 2. [Critical Finding #2]
- **Risk:** HIGH
- **Impact:** [Business impact]
- **Recommendation:** [Action needed]

[Continue for top 3-5 findings]

## Risk Summary

| Severity | Count | Percentage |
|----------|-------|------------|
| Critical | X | XX% |
| High | X | XX% |
| Medium | X | XX% |
| Low | X | XX% |
| **Total** | **X** | **100%** |

## Business Impact

**Potential Consequences if Unaddressed:**
- Data breach affecting [X] customers
- Financial loss estimated at $[amount]
- Regulatory fines up to $[amount]
- Reputational damage
- Business disruption

## Immediate Actions Required

1. [Priority 1 action] - Within 24-48 hours
2. [Priority 2 action] - Within 1 week
3. [Priority 3 action] - Within 2 weeks
4. [Priority 4 action] - Within 1 month
5. [Priority 5 action] - Within 3 months

## Investment Recommendation

**Estimated Remediation Cost:** $[range]  
**Recommended Timeline:** [timeframe]  
**ROI:** Risk reduction of [X]% with investment of $[Y]

## Conclusion

[1-2 paragraph conclusion and next steps]
```

---

### 2. Technical Report

**Length:** 25-100+ pages  
**Audience:** Security Teams, IT Staff, Technical Management  
**Purpose:** Detailed technical findings and remediation

**Required Sections:**
- Executive Summary (brief version)
- Scope and Methodology
- Technical Findings (detailed)
  - Each vulnerability documented
  - Evidence included
  - Technical details provided
  - Step-by-step remediation
- Attack Paths and Scenarios
- Network Diagrams
- Technical Appendices

**Template Structure:**
```markdown
# Technical Security Assessment Report

## 1. Executive Summary
[Brief version for technical managers]

## 2. Engagement Details

### 2.1 Scope
**In-Scope Systems:**
- [Detailed list with IP addresses, hostnames]

**Out-of-Scope:**
- [Exclusions]

### 2.2 Methodology
- Standards: PTES, OWASP, NIST SP 800-115
- Phases: [List all phases]
- Tools Used: Hydra-Termux Platform, Nmap, [others]

### 2.3 Timeline
- Start Date: [Date/Time]
- End Date: [Date/Time]
- Total Hours: [X]

## 3. Findings Summary

### 3.1 Vulnerability Statistics

| Severity | Count |
|----------|-------|
| Critical | X |
| High | X |
| Medium | X |
| Low | X |
| Informational | X |

### 3.2 Findings by Category

| Category | Count |
|----------|-------|
| Authentication | X |
| Authorization | X |
| Configuration | X |
| Cryptography | X |
| [Others] | X |

## 4. Detailed Findings

### Finding #1: [Vulnerability Name]

#### 4.1.1 Overview
- **Finding ID:** F-001
- **Severity:** CRITICAL (CVSS 9.8)
- **Category:** Authentication
- **Affected Systems:** [List]
- **Status:** Open

#### 4.1.2 Description
[Detailed description of vulnerability, how it was discovered, what it means]

#### 4.1.3 Impact
**Technical Impact:**
- [Technical consequences]

**Business Impact:**
- [Business consequences]
- Estimated financial impact: $[range]
- Affected users/data: [count/description]

#### 4.1.4 Evidence
```bash
# Attack command executed
[command]

# Result
[output demonstrating vulnerability]

# Verification
[additional proof]
```

**Screenshots:**
[Include relevant screenshots]

**Affected Files/Configurations:**
[List specific files, configurations]

#### 4.1.5 CVSS Analysis
- **Vector:** CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
- **Base Score:** 9.8 CRITICAL

**Breakdown:**
- Attack Vector (AV): Network
- Attack Complexity (AC): Low
- Privileges Required (PR): None
- User Interaction (UI): None
- Scope (S): Unchanged
- Confidentiality (C): High
- Integrity (I): High
- Availability (A): High

#### 4.1.6 Remediation

**Immediate Actions (Priority 1 - 24-48 hours):**

1. **Change Weak Credential**
   ```bash
   # Change password immediately
   passwd [user]
   # Use strong password: 16+ characters, mixed case, numbers, symbols
   ```

2. **Disable Vulnerable Service/Feature**
   ```bash
   # Temporary mitigation until proper fix
   systemctl stop [service]
   systemctl disable [service]
   ```

**Short-term Actions (Priority 2 - 1-2 weeks):**

3. **Implement MFA**
   ```bash
   # Install MFA module
   [installation commands]
   
   # Configure MFA
   [configuration steps]
   ```

4. **Configure Fail2Ban**
   ```bash
   # Install and configure brute-force protection
   apt-get install fail2ban
   [configuration]
   ```

**Long-term Actions (Priority 3 - 1-3 months):**

5. **Implement Key-Based Authentication**
6. **Deploy VPN for Remote Access**
7. **Regular Security Audits**
8. **Security Awareness Training**

#### 4.1.7 Verification

**Testing Steps:**
1. Implement remediation
2. Verify configuration:
   ```bash
   [verification commands]
   ```
3. Retest vulnerability:
   ```bash
   [retest commands]
   ```
4. Expected result: [description]

#### 4.1.8 References
- CVE-XXXX-XXXX
- CWE-XXX: [Weakness name]
- OWASP: [Related OWASP item]
- NIST: [Related NIST guidance]

[Repeat for each finding]

## 5. Attack Scenarios

### 5.1 Scenario 1: External Attacker
[Describe complete attack chain]

### 5.2 Scenario 2: Insider Threat
[Describe attack scenario]

## 6. Recommendations Summary

### 6.1 Critical Priority (Immediate - 48 hours)
- [Recommendation 1]
- [Recommendation 2]

### 6.2 High Priority (1-2 weeks)
- [Recommendation 1]
- [Recommendation 2]

### 6.3 Medium Priority (1-3 months)
- [Recommendation 1]
- [Recommendation 2]

### 6.4 Low Priority (3-6 months)
- [Recommendation 1]
- [Recommendation 2]

### 6.5 Long-term Strategy (6-12 months)
- [Strategic recommendation 1]
- [Strategic recommendation 2]

## 7. Conclusion

[Summary and next steps]

## 8. Appendices

### Appendix A: Testing Logs
[Complete testing timeline and logs]

### Appendix B: Scan Results
[Raw scan data]

### Appendix C: Discovered Credentials
[Table of all credentials - HANDLE SECURELY]

### Appendix D: Network Diagrams
[Topology and attack paths]

### Appendix E: Tools and Techniques
[List of all tools used]

### Appendix F: Glossary
[Technical terms defined]
```

---

### 3. Compliance Report

**Length:** 30-80 pages  
**Audience:** Auditors, Compliance Officers, Regulators  
**Purpose:** Demonstrate regulatory compliance

**Required Elements:**
- Compliance framework mapping
- Control testing results
- Gap analysis
- Remediation roadmap
- Attestation documentation

**Frameworks:**
- PCI-DSS
- HIPAA
- SOC 2
- ISO 27001
- NIST Cybersecurity Framework

---

### 4. Attack Report (Hydra-Termux Auto-Generated)

**Length:** 5-15 pages  
**Audience:** Security Analysts, System Administrators  
**Purpose:** Document specific attack engagement

**Generated Automatically By:**
All Hydra-Termux attack scripts generate reports automatically.

**Location:** `reports/attack_report_[protocol]_[timestamp].md`

**Auto-Generated Sections:**
1. Attack Details
   - Protocol tested
   - Target information
   - Attack parameters
   - Timeline

2. Results
   - Credentials discovered
   - Access obtained
   - Success rate

3. Vulnerability Assessment
   - CVSS scoring
   - Risk classification
   - Business impact

4. Prevention Recommendations
   - Immediate actions
   - Short-term improvements
   - Long-term best practices

5. Security Best Practices
   - Protocol-specific guidance
   - Industry standards
   - Compliance requirements

**Example Usage:**
```bash
# SSH attack generates report automatically
bash scripts/ssh_admin_attack.sh -t 192.168.1.100

# Report saved to:
# reports/attack_report_ssh_20260120_143022.md

# View report
cat reports/attack_report_ssh_20260120_143022.md
```

---

### 5. Retest Report

**Length:** 5-20 pages  
**Audience:** Original stakeholders  
**Purpose:** Verify remediation effectiveness

**Required Sections:**
- Original findings summary
- Remediation actions taken (by client)
- Retest methodology
- Retest results (each finding)
- Residual risk assessment
- Additional findings (if any)
- Final security posture
- Sign-off/closure

**Template:**
```markdown
# Remediation Verification (Retest) Report

## 1. Overview
**Original Assessment:** [Date]  
**Retest Date:** [Date]  
**Findings Retested:** [Count]

## 2. Remediation Summary

| Finding ID | Severity | Status | Verification |
|------------|----------|--------|--------------|
| F-001 | Critical | CLOSED | Verified Fixed |
| F-002 | High | CLOSED | Verified Fixed |
| F-003 | High | OPEN | Not Fixed |
| F-004 | Medium | PARTIAL | Partially Fixed |

## 3. Detailed Retest Results

### Finding F-001: [Original Finding]
**Original Severity:** CRITICAL  
**Remediation Status:** CLOSED ✓

**Client Actions:**
- [Action 1 taken]
- [Action 2 taken]

**Verification Testing:**
```bash
[Retest commands]
```

**Result:** Vulnerability successfully remediated. Unable to reproduce.

**Evidence:**
[Screenshots, outputs showing fix]

[Repeat for each finding]

## 4. New Findings
[Any new vulnerabilities discovered during retest]

## 5. Residual Risk
[Assessment of remaining risks]

## 6. Final Security Posture
**Before:** HIGH RISK  
**After:** MEDIUM RISK  
**Improvement:** [Description]

## 7. Recommendations
[Any remaining recommendations]

## 8. Sign-off
Assessment complete. [X]% of critical findings remediated.
```

---

## Report Structure

### Standard Report Organization

```
Title Page
  - Report title
  - Client name
  - Date
  - Classification marking
  - Version number

Document Control
  - Version history
  - Distribution list
  - Classification
  - Handling instructions

Table of Contents
  - All sections numbered
  - Page numbers
  - List of figures/tables

Executive Summary
  - 2-5 pages max
  - Business-focused
  - Key findings
  - Risk summary

Introduction
  - Purpose
  - Scope
  - Limitations
  - Contact information

Methodology
  - Standards followed
  - Testing phases
  - Tools used
  - Timeline

Findings
  - Critical findings first
  - Structured consistently
  - Evidence included
  - Clear remediation

Recommendations
  - Prioritized
  - Actionable
  - Resourced
  - Timelines

Conclusion
  - Summary
  - Next steps
  - Support available

Appendices
  - Detailed data
  - Technical details
  - References
  - Glossary
```

---

## Content Requirements

### Mandatory Elements

Every professional report must include:

#### 1. Executive Summary
- [ ] Clear overview in plain language
- [ ] Key findings highlighted
- [ ] Risk summary
- [ ] Business impact
- [ ] Top recommendations

#### 2. Scope Definition
- [ ] In-scope systems listed
- [ ] Out-of-scope exclusions
- [ ] IP addresses/hostnames
- [ ] Testing constraints
- [ ] Authorization reference

#### 3. Methodology
- [ ] Standards followed (PTES, OWASP, NIST)
- [ ] Testing phases
- [ ] Tools and techniques
- [ ] Timeline
- [ ] Limitations

#### 4. Findings Documentation
For each finding:
- [ ] Unique identifier
- [ ] Severity rating (CVSS)
- [ ] Clear description
- [ ] Affected systems
- [ ] Business impact
- [ ] Technical impact
- [ ] Evidence (screenshots, commands, output)
- [ ] CVSS scoring and justification
- [ ] Reproduction steps
- [ ] Remediation guidance (immediate and long-term)
- [ ] Verification steps
- [ ] References (CVE, CWE, etc.)

#### 5. Evidence
- [ ] Screenshots with timestamps
- [ ] Command outputs
- [ ] Configuration files
- [ ] Network diagrams
- [ ] Attack paths
- [ ] All evidence properly labeled

#### 6. Recommendations
- [ ] Prioritized by severity
- [ ] Actionable steps
- [ ] Technical implementation details
- [ ] Estimated effort/cost
- [ ] Timeline suggestions
- [ ] Best practices

#### 7. Appendices
- [ ] Complete testing logs
- [ ] Raw scan data
- [ ] Credential list (secure handling)
- [ ] Network diagrams
- [ ] Tool outputs
- [ ] Glossary

---

## Formatting Standards

### Document Formatting

**General:**
- Font: Arial or Calibri, 11-12pt
- Margins: 1 inch all sides
- Line spacing: 1.15 or 1.5
- Alignment: Left-aligned body, justified for executive summary
- Headers/Footers: Page numbers, classification, date

**Headings:**
- H1: 16pt, Bold
- H2: 14pt, Bold
- H3: 12pt, Bold
- H4: 11pt, Bold Italic

**Code Blocks:**
```
Font: Courier New or Consolas, 10pt
Background: Light gray (#F5F5F5)
Border: 1px solid gray
```

**Tables:**
- Headers: Bold, background color
- Borders: All cells
- Alternating row colors (optional)
- Page breaks avoided in tables

**Images:**
- Centered
- Captioned below
- Referenced in text
- Maximum width: 6.5 inches

### Severity Colors

Use consistent color coding:

**Critical:** Red (#FF0000 or #DC3545)  
**High:** Orange (#FFA500 or #FF6B6B)  
**Medium:** Yellow (#FFD700 or #FFC107)  
**Low:** Blue (#0000FF or #007BFF)  
**Informational:** Gray (#808080 or #6C757D)

### Example Severity Badge

```markdown
![CRITICAL](https://img.shields.io/badge/CRITICAL-RED)
![HIGH](https://img.shields.io/badge/HIGH-ORANGE)
![MEDIUM](https://img.shields.io/badge/MEDIUM-YELLOW)
![LOW](https://img.shields.io/badge/LOW-BLUE)
```

---

## Evidence Requirements

### Screenshot Standards

**Requirements:**
- High resolution (1920x1080 minimum)
- Full context visible
- Timestamp included (if possible)
- Annotations as needed
- Redact sensitive information
- File naming: `evidence_[finding-id]_[description].png`

**What to Screenshot:**
- Successful authentication
- System access obtained
- Privilege levels
- Sensitive data exposure (redacted)
- Configuration issues
- Error messages
- Proof of exploitation

### Command Documentation

**Format:**
```bash
# Description of what command does
$ command --with --flags target

# Output
[Actual output from command]

# Analysis
[What the output means]
```

**Requirements:**
- Include full command with all parameters
- Show complete output (or relevant portions)
- Timestamp if available
- Indicate if output truncated

### Log Evidence

**Requirements:**
- Relevant portions extracted
- Context provided (before/after)
- Timestamps visible
- Highlight key entries
- Original logs preserved

---

## Compliance-Specific Reports

### PCI-DSS Penetration Testing Report

**Required Per Requirement 11.3:**

**Must Include:**
1. Industry-accepted penetration testing approach
2. Coverage for entire Cardholder Data Environment (CDE)
3. Testing from both network perimeter and inside network
4. Validation of segmentation and scope-reduction controls
5. Application-layer penetration tests
6. Network-layer penetration tests
7. Threats and vulnerabilities experienced in last 12 months
8. Documented approach to vulnerability assessment
9. Results of penetration tests
10. Corrective actions for findings

**Specific Sections:**
```markdown
## PCI-DSS Compliance Statement

This penetration test was conducted in accordance with PCI-DSS 
Requirement 11.3 and follows the Penetration Testing Execution 
Standard (PTES).

### Scope
**Cardholder Data Environment (CDE):**
- [List all CDE systems]

**Connected Systems:**
- [List systems connected to CDE]

### Segmentation Testing
[Results of network segmentation validation]

### Application-Layer Testing
[Results of application testing]

### Network-Layer Testing
[Results of network testing]

### Threat-Based Testing
[Vulnerabilities from recent threat intelligence]

## Compliance Status
☐ COMPLIANT - No findings requiring remediation
☐ NON-COMPLIANT - Findings require remediation
☑ COMPLIANT WITH EXCEPTIONS - [Describe exceptions]

## Attestation
I attest that this penetration test was conducted in accordance
with PCI-DSS requirements.

Signed: _____________________ Date: _______
```

---

### HIPAA Security Assessment Report

**Required Per §164.308(a)(8):**

**Must Include:**
1. Technical evaluation
2. Non-technical evaluation  
3. Risk assessment
4. Security controls testing
5. Vulnerability identification
6. Remediation recommendations

**Specific Sections:**
```markdown
## HIPAA Compliance Assessment

### Controls Tested

#### Administrative Safeguards (§164.308)
- Risk Analysis: [Results]
- Risk Management: [Results]
- Workforce Security: [Results]
- [Other controls]

#### Physical Safeguards (§164.310)
- Facility Access Controls: [Results]
- Workstation Security: [Results]
- [Other controls]

#### Technical Safeguards (§164.312)
- Access Control: [Testing results]
- Audit Controls: [Testing results]
- Integrity Controls: [Testing results]
- Transmission Security: [Testing results]

### ePHI at Risk
[List any ePHI exposure discovered]

### Compliance Status
| Requirement | Status | Findings |
|-------------|--------|----------|
| §164.312(a)(1) Access Control | Non-Compliant | F-001, F-002 |
| §164.312(b) Audit Controls | Compliant | None |
| [Others] | | |

## Recommendations for HIPAA Compliance
[Prioritized recommendations]
```

---

## Quality Assurance

### Report Review Checklist

Before delivering any report, verify:

**Content Review:**
- [ ] All findings documented completely
- [ ] Evidence included for all findings
- [ ] CVSS scores calculated and justified
- [ ] Remediation guidance clear and actionable
- [ ] Business impact articulated
- [ ] Executive summary understandable by non-technical readers
- [ ] Technical details sufficient for implementation
- [ ] All sections complete

**Accuracy Review:**
- [ ] IP addresses correct
- [ ] Hostnames accurate
- [ ] Dates and timestamps correct
- [ ] Command outputs match findings
- [ ] CVSS calculations verified
- [ ] No false positives included
- [ ] All findings verified and reproducible

**Formatting Review:**
- [ ] Consistent formatting throughout
- [ ] Proper heading hierarchy
- [ ] Page numbers present
- [ ] Table of contents updated
- [ ] All images display correctly
- [ ] Code blocks formatted properly
- [ ] No formatting artifacts
- [ ] Professional appearance

**Compliance Review:**
- [ ] Meets client requirements
- [ ] Satisfies regulatory needs (if applicable)
- [ ] Follows industry standards
- [ ] Includes required elements
- [ ] Appropriate classification markings

**Security Review:**
- [ ] Sensitive information redacted appropriately
- [ ] No client credentials exposed
- [ ] Secure handling instructions included
- [ ] Classification marking correct
- [ ] Distribution list appropriate

**Final Review:**
- [ ] Spelling and grammar checked
- [ ] Technical accuracy verified
- [ ] Peer review completed
- [ ] Client-specific customization done
- [ ] Version number and date correct
- [ ] Ready for delivery

---

## Delivery Requirements

### File Formats

**Primary Deliverable: PDF**
- Professional, print-ready
- Password-protected
- Searchable text
- Bookmarks for navigation
- Metadata stripped or appropriate

**Secondary Formats (Optional):**
- Markdown: Source format, version control
- HTML: Interactive web version
- DOCX: Editable format for client
- CSV: Vulnerability data for tracking
- JSON: Machine-readable data

### Encryption and Security

**Requirements:**
1. **Encrypt all reports**
   - AES-256 encryption
   - Strong password (communicate separately)
   - Signed if possible (PGP/GPG)

2. **Secure Delivery**
   - Encrypted email attachment
   - Secure file sharing (password-protected link)
   - Physical media (encrypted)
   - Never unencrypted email

3. **Password Management**
   - Communicate password out-of-band
   - Phone call or separate email
   - SMS or secure messaging
   - Never in same email as report

4. **Retention**
   - Client retention: Per contract/policy
   - Tester retention: 3-7 years
   - Secure storage
   - Secure disposal when no longer needed

### Delivery Package Contents

**Standard Package:**
```
Delivery_[Client]_[Date]/
├── Report_Executive_Summary.pdf (encrypted)
├── Report_Technical_Full.pdf (encrypted)
├── Vulnerability_Data.csv
├── Evidence/
│   ├── screenshots/
│   ├── logs/
│   └── configurations/
├── Remediation_Checklist.xlsx
├── README.txt (delivery instructions)
└── Password.txt.pgp (encrypted password)
```

### Delivery Communication

**Email Template:**
```
Subject: Penetration Testing Report Delivery - [Client Name]

Dear [Client Contact],

Please find attached the penetration testing report for [Client Name]
completed on [Date].

The report is encrypted with AES-256 encryption. The password will be
communicated separately via [phone/SMS/separate email].

Package Contents:
- Executive Summary Report
- Technical Detailed Report
- Vulnerability Data (CSV format)
- Evidence Archive
- Remediation Checklist

Please confirm receipt of this email and all attachments.

We are available to discuss the findings and recommendations at your
convenience. Please let us know if you would like to schedule a
presentation or have any questions.

Best regards,
[Your Name]
[Your Title]
[Contact Information]

---
CONFIDENTIAL - This email and attachments contain confidential
information intended only for [Client Name]. Do not forward or
share without authorization.
```

---

## Report Templates

### Template Files Available

**Location:** `reports/templates/`

**Available Templates:**
1. `executive_summary_template.md`
2. `technical_report_template.md`
3. `compliance_report_template.md`
4. `retest_report_template.md`
5. `finding_detail_template.md`

**Usage:**
```bash
# Copy template
cp reports/templates/technical_report_template.md reports/my_client_report.md

# Edit with findings
nano reports/my_client_report.md

# Generate PDF (if tools available)
# pandoc reports/my_client_report.md -o reports/my_client_report.pdf
```

---

## Automated Reporting

### Hydra-Termux Auto-Reports

**Generation:**
All attack scripts automatically generate reports:
```bash
# Run attack - report generated automatically
bash scripts/ssh_admin_attack.sh -t 192.168.1.100

# Report location
reports/attack_report_ssh_[timestamp].md
```

**Customize Reports:**
Edit report generator:
```bash
nano scripts/report_generator.sh
```

**Batch Report Generation:**
```bash
# Generate comprehensive report from all attacks
bash scripts/report_generator.sh --target 192.168.1.100 --comprehensive
```

---

## Best Practices

### Writing Effective Reports

**Do:**
- Write clearly and concisely
- Use plain language for non-technical sections
- Be specific and actionable
- Include evidence for every finding
- Prioritize by business impact
- Provide step-by-step remediation
- Use consistent formatting
- Proofread thoroughly

**Don't:**
- Use jargon without explanation
- Include unverified findings
- Exaggerate severity
- Provide vague recommendations
- Forget business context
- Skip evidence
- Rush final review
- Deliver unencrypted reports

### Report Maintenance

**Version Control:**
- Track all changes
- Maintain version history
- Document revisions
- Keep all versions

**Updates:**
- Update if client provides feedback
- Correct any errors immediately
- Reissue with version increment
- Document all changes

---

**Last Updated:** January 2026  
**Maintained By:** Hydra-Termux Documentation Team  
**Review Schedule:** Quarterly  
**Compliance:** PTES, OWASP, NIST, PCI-DSS, HIPAA
