# Responsible Use Guidelines for Hydra-Termux

## 🎯 For Professional Penetration Testers and Security Researchers

This guide provides practical guidance for using Hydra-Termux ethically and professionally in authorized security testing engagements.

---

## 📋 Pre-Engagement Requirements

### 1. Authorization Documentation

**Required Documents:**
- **Rules of Engagement (RoE)** - Signed by client
- **Scope of Work Statement** - Detailed system list
- **Testing Schedule** - Approved time windows
- **Emergency Contacts** - 24/7 availability
- **Communication Plan** - Escalation procedures

**Sample Authorization Template:**

```
PENETRATION TESTING AUTHORIZATION

Client: [Company Name]
Tester: [Your Name/Company]
Date: [Start Date] to [End Date]

AUTHORIZED TARGETS:
- IP Range: 192.168.1.0/24
- Domains: example.com, test.example.com
- Systems: [Specific hostnames]

AUTHORIZED ACTIVITIES:
- Password brute-forcing against listed targets only
- Network service enumeration
- Web application testing
- Database connection testing

RESTRICTIONS:
- No denial of service attacks
- No data exfiltration without approval
- No social engineering without explicit consent
- Stop immediately upon finding sensitive data

Client Signature: _________________ Date: _______
Tester Signature: _________________ Date: _______
```

### 2. Scope Verification

**Before Starting ANY Test:**

1. **Verify IP Ownership**
   ```bash
   whois [target-ip]
   # Confirm IP belongs to client
   ```

2. **Confirm DNS Resolution**
   ```bash
   nslookup [target-domain]
   dig [target-domain]
   # Verify domain ownership
   ```

3. **Check for Third-Party Systems**
   - Identify cloud providers (AWS, Azure, GCP)
   - Check for shared hosting environments
   - Verify no other tenants on system
   - Confirm CDN/WAF ownership

4. **Document Everything**
   - Screenshot authorization emails
   - Save signed contracts
   - Log scope verification steps
   - Record pre-test system state

---

## 🛡️ Safe Testing Practices

### 1. Rate Limiting and Throttling

**Prevent Service Impact:**

```bash
# Recommended thread counts by service:
# SSH: -T 4 to -T 8 (start low)
# FTP: -T 8 to -T 16 (moderate)
# Web: -T 8 to -T 16 (moderate)
# RDP: -T 1 to -T 4 (VERY slow to prevent lockouts)
# Databases: -T 8 to -T 16 (moderate)
```

**Add delays between attempts:**
```bash
# Use Hydra's built-in rate limiting
hydra -t 4 -w 10 [target] [service]
# -t = threads, -w = wait time between attempts (seconds)
```

**Monitor target system:**
- Check for service degradation
- Watch for increased response times
- Monitor error rates
- Be prepared to stop immediately

### 2. Account Lockout Prevention

**Critical for Domain Environments:**

```bash
# Always start with minimal attempts
# For Active Directory (typical 3-5 failed attempts = lockout):
# Use ONLY 1-2 attempts per account
# Spread attempts over extended time periods
# Consider lockout reset times (typically 30 minutes)

# Example: Safe AD testing
hydra -L users.txt -p Password123 -t 1 -w 1800 [target] rdp
# 1 thread, 30-minute wait = safe for most environments
```

**Pre-Flight Lockout Policy Check:**
```bash
# Windows: Check lockout policy
net accounts /domain

# Linux: Check PAM configuration
cat /etc/pam.d/common-auth | grep deny
```

### 3. Logging and Documentation

**Maintain Detailed Records:**

```bash
# Enable verbose logging
bash scripts/ssh_admin_attack.sh -t [target] -v 2>&1 | tee test-log-$(date +%Y%m%d-%H%M%S).log

# Log format should include:
# - Timestamp of each action
# - Target system details
# - Commands executed
# - Results (success/failure)
# - Any anomalies observed
```

**Recommended Log Structure:**
```
[2026-01-04 10:30:15] Test Start
[2026-01-04 10:30:16] Target: 192.168.1.100 (Client System A)
[2026-01-04 10:30:17] Service: SSH (Port 22)
[2026-01-04 10:30:18] Authorization: Contract #12345
[2026-01-04 10:30:19] Starting username enumeration
[2026-01-04 10:30:45] Found valid user: admin
[2026-01-04 10:31:00] Beginning password testing
[2026-01-04 10:35:23] Weak password found: admin:Welcome2024
[2026-01-04 10:35:24] Test paused, documenting finding
[2026-01-04 10:35:25] Test End
```

---

## 🎯 Target Selection Best Practices

### What TO Test:

✅ **Systems Explicitly Listed in Authorization**
- Specific IP addresses documented in RoE
- Named domains in scope document
- Systems confirmed with client POC

✅ **Production-Like Test Environments**
- Client-designated testing systems
- Isolated lab environments
- Staging/QA systems (with approval)

✅ **Your Own Infrastructure**
- Personal lab environments
- Company-owned test systems
- Properly licensed VMs

### What NOT To Test:

❌ **NEVER Test These Without Explicit Authorization:**
- Systems "probably" owned by client
- IP ranges discovered via scanning
- Related domains found via OSINT
- Partner/vendor systems
- Cloud infrastructure (may violate ToS)
- Shared hosting environments
- Critical production systems (without specific approval)

❌ **ABSOLUTELY FORBIDDEN:**
- Personal information of individuals
- Targets based on SSN, birthday, address
- Systems to "help" someone without consent
- Competitors (industrial espionage)
- Government systems (without proper clearance)
- Financial systems (without regulatory approval)
- Healthcare systems (HIPAA considerations)

---

## 🔍 Reconnaissance Boundaries

### Acceptable OSINT Activities:

✅ **Public Information Gathering:**
- Public DNS records
- Certificate transparency logs
- Public GitHub repositories
- Job postings and company info
- Press releases and marketing materials
- Publicly accessible documentation

### Unacceptable Activities:

❌ **Do NOT:**
- Social engineer employees
- Use personal information of employees
- Dumpster dive without authorization
- Physical reconnaissance without approval
- Phish employees without explicit consent
- Access internal systems during OSINT phase

---

## 📊 Results Handling

### 1. Secure Storage

**Protect Discovered Credentials:**

```bash
# Encrypt results immediately
gpg --encrypt --recipient [your-key] results_$(date +%Y%m%d).json

# Secure file permissions
chmod 600 ~/hydra-logs/*.json
chmod 700 ~/hydra-logs/

# Use encrypted containers for sensitive data
# Consider tools like VeraCrypt or LUKS
```

### 2. Reporting Guidelines

**Professional Report Structure:**

1. **Executive Summary**
   - High-level findings
   - Business impact assessment
   - Risk ratings
   - Recommendations

2. **Technical Details**
   - Methodology used
   - Tools and versions
   - Detailed findings
   - Evidence (screenshots, logs)

3. **Remediation Guidance**
   - Specific fix recommendations
   - Implementation priority
   - Validation steps
   - Timeline suggestions

**What to Include:**
- ✅ Risk ratings with justification
- ✅ Proof of concept evidence
- ✅ Clear remediation steps
- ✅ Business impact explanation

**What to Exclude:**
- ❌ Working exploit code (without client request)
- ❌ Unnecessary sensitive data
- ❌ Personal information of users
- ❌ Information outside scope

### 3. Data Retention

**Follow These Timelines:**

```bash
# Secure deletion after retention period
# Typical retention: 30-90 days post-engagement

# Secure file deletion
shred -vfz -n 10 sensitive_data.txt

# Clean up logs
find ~/hydra-logs/ -mtime +90 -type f -exec shred -vfz {} \;
```

---

## 🚦 Decision Framework: Should I Proceed?

### Use This Checklist Before EVERY Test:

**STOP and ask yourself:**

1. ✅ **Authorization?** Do I have written authorization?
2. ✅ **Scope?** Is this target explicitly in scope?
3. ✅ **Impact?** Could this harm production systems?
4. ✅ **Timing?** Am I within the approved testing window?
5. ✅ **Communication?** Are key stakeholders aware?
6. ✅ **Documentation?** Have I logged all steps?
7. ✅ **Exit Plan?** Do I know how to stop safely?
8. ✅ **Legal?** Am I compliant with all applicable laws?

**If ANY answer is NO, do not proceed.**

---

## 🎓 Common Scenarios

### Scenario 1: Found Sensitive Data

**You discover:**
- Personal customer information
- Financial records
- Healthcare data
- Trade secrets

**Immediate Actions:**
1. STOP testing immediately
2. DO NOT access, copy, or view data
3. Document location only (don't screenshot data)
4. Contact client immediately
5. Follow data breach protocols
6. Document incident in detail

### Scenario 2: Out-of-Scope System Discovered

**You encounter:**
- IP not in authorization
- Partner/vendor system
- Cloud service in use
- Third-party application

**Immediate Actions:**
1. STOP interaction immediately
2. DO NOT test or enumerate
3. Document what you found
4. Contact client for scope clarification
5. Get written authorization before proceeding
6. Update scope documentation

### Scenario 3: Suspicious Activity Detected

**You observe:**
- Another attacker's presence
- Unusual system behavior
- Possible compromise indicators
- Active incident

**Immediate Actions:**
1. STOP testing to avoid interference
2. Document observations
3. Contact client immediately
4. DO NOT investigate further without direction
5. Preserve evidence if instructed
6. Assist IR team if requested

### Scenario 4: Locked Out Accounts

**You accidentally:**
- Lock domain administrator account
- Trigger account lockouts
- Cause authentication failures

**Immediate Actions:**
1. STOP testing immediately
2. Contact client technical POC
3. Document which accounts affected
4. Provide timeline of attempts
5. Assist in recovery if needed
6. Update testing approach to prevent recurrence

---

## 🔐 Password List Guidelines

### Ethical Wordlist Selection:

**DO Use:**
- ✅ Common password lists (rockyou.txt subset)
- ✅ Industry-standard weak passwords
- ✅ Company-specific terms (company name, products)
- ✅ Generic admin passwords
- ✅ Client-approved custom wordlists

**DO NOT Use:**
- ❌ Lists derived from breaches
- ❌ Personal information wordlists
- ❌ Employee-specific passwords
- ❌ Targeted individual information
- ❌ Social engineering derived terms without approval

**Recommended Wordlists:**
```bash
# Start with small, focused lists
/config/admin_passwords.txt  # 100-500 most common

# Progress to medium lists if authorized
~/wordlists/common_passwords.txt  # 1,000-10,000 entries

# Use large lists only with explicit approval
~/wordlists/rockyou.txt  # Full list (14M+)
# Note: May cause lockouts or extended testing time
```

---

## 📞 Communication Protocols

### Daily Status Updates:

**Send to client:**
```
Subject: Penetration Test Status - Day 1

Date: [Date]
Tester: [Your Name]
Engagement: [Engagement ID]

Activities Completed:
- Network enumeration of 192.168.1.0/24
- SSH password testing on 5 systems
- Web application enumeration

Findings:
- 2 systems with weak SSH passwords (details in tracker)
- 1 system with outdated web server

Planned for Tomorrow:
- Database service testing
- Web application authentication testing

Issues/Concerns:
- None

Next Update: [Tomorrow's Date]
```

### Incident Reporting:

**Immediate notification for:**
- Critical vulnerabilities (CVSS 9.0+)
- Active compromises discovered
- Sensitive data exposure
- Account lockouts or service disruption
- Out-of-scope findings
- Legal/regulatory concerns

**Use agreed communication channel:**
- Phone for critical issues
- Email for non-critical updates
- Encrypted email for sensitive details
- Secure portal/ticketing system

---

## 🛠️ Tool Configuration Best Practices

### Hydra-Termux Responsible Settings:

```bash
# Conservative testing profile
export DEFAULT_THREADS=4
export DEFAULT_TIMEOUT=30
export RATE_LIMIT_ENABLED=true
export VPN_CHECK_REQUIRED=true

# Enable detailed logging
export VERBOSE_LOGGING=true
export LOG_ALL_ATTEMPTS=true

# Configure safe defaults in config/hydra.conf:
[SECURITY]
vpn_check=true
rate_limit=true
max_attempts=1000  # Prevent runaway tests
random_delay=true
require_authorization_confirm=true  # New feature
```

### Pre-Test System Checks:

```bash
# Verify VPN connection
bash scripts/vpn_check.sh

# Run system diagnostics
bash scripts/system_diagnostics.sh

# Verify authorization is documented
bash scripts/authorization_check.sh  # New feature

# Test target reachability
bash scripts/target_scanner.sh -t [target] -s quick
```

---

## 📚 Continuous Professional Development

### Stay Current:

- **Certifications:** OSCP, OSWP, CEH, GPEN, GWAPT
- **Training:** Regular security training and updates
- **Communities:** OWASP, SANS, local BSides
- **Ethics:** Annual ethics training
- **Legal:** Stay informed on cybersecurity law changes

### Professional Organizations:

- (ISA)² - International Systems Audit Association
- ISSA - Information Systems Security Association
- ISACA - Information Systems Audit and Control Association
- EC-Council - Ethics in hacking
- OWASP - Web application security

---

## ⚖️ Legal Protection Strategies

### Protect Yourself:

1. **Insurance**
   - Errors & Omissions (E&O) insurance
   - Cyber liability insurance
   - Professional liability coverage

2. **Contracts**
   - Use lawyer-reviewed engagement contracts
   - Include indemnification clauses
   - Define liability limitations
   - Specify dispute resolution

3. **Documentation**
   - Keep all communications
   - Save all authorization documents
   - Maintain detailed testing logs
   - Archive for statute of limitations period

4. **Legal Counsel**
   - Have attorney on retainer
   - Get contract review before signing
   - Consult on complex engagements
   - Immediate contact if legal issues arise

---

## ✅ Final Checklist

**Before ANY security test:**

- [ ] Written authorization obtained and verified
- [ ] Scope explicitly defined and documented
- [ ] Out-of-scope systems identified
- [ ] Client POC contact information confirmed
- [ ] Emergency procedures established
- [ ] Insurance coverage verified
- [ ] Testing timeline approved
- [ ] Backup and recovery plan reviewed
- [ ] Communication protocols established
- [ ] Legal review completed
- [ ] Tool configuration verified safe
- [ ] VPN/anonymization active
- [ ] Logging enabled and tested
- [ ] Team briefed on scope and ethics
- [ ] Incident response procedures ready

**After testing:**

- [ ] All findings documented professionally
- [ ] Sensitive data secured/encrypted
- [ ] Client debriefed
- [ ] Final report delivered
- [ ] Questions answered
- [ ] Remediation guidance provided
- [ ] Follow-up testing scheduled (if needed)
- [ ] Data retention procedures followed
- [ ] Lessons learned documented
- [ ] Secure data deletion completed (after retention)

---

## 🎯 Remember

**The goal of penetration testing is to IMPROVE security, not to demonstrate superiority or cause harm.**

**When in doubt:**
1. Stop
2. Document
3. Contact client
4. Get clarification
5. Proceed only with explicit authorization

**Your reputation and freedom depend on your ethics.**

**Test responsibly. Document thoroughly. Communicate clearly.**

---

*For questions or clarification, consult with legal counsel and your professional organization's ethics board.*

*Last Updated: January 2026*
