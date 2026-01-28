# Standard Operating Procedures & Operational Runbooks

**Version:** 2.0.0  
**Classification:** OPERATIONAL  
**Last Updated:** January 2026

---

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Attack Execution Procedures](#attack-execution-procedures)
3. [Incident Response](#incident-response)
4. [Maintenance Procedures](#maintenance-procedures)
5. [Quality Assurance](#quality-assurance)
6. [Documentation Standards](#documentation-standards)
7. [Team Coordination](#team-coordination)
8. [Compliance & Audit](#compliance--audit)

---

## Daily Operations

### Morning Checklist

**Time Required:** 10-15 minutes  
**Frequency:** Daily before operations

#### Pre-Operation Checklist

```bash
# 1. System Health Check
bash scripts/system_diagnostics.sh

# Expected: Grade A or B
# If C or lower: Address issues before proceeding
```

**Checklist Items:**
- [ ] Hydra operational (`hydra -h` works)
- [ ] All dependencies available
- [ ] Network connectivity verified
- [ ] VPN configured and tested
- [ ] Sufficient storage space (>1GB free)
- [ ] Battery >50% or plugged in
- [ ] System resources available (RAM >500MB free)

#### Daily System Updates

```bash
# 2. Update Check
cd ~/Hydra-termux
git fetch origin

# If updates available:
git pull origin main

# 3. Package Updates (weekly, or as needed)
pkg update
# Review updates before applying
pkg upgrade -y
```

#### Environment Preparation

```bash
# 4. VPN Verification
bash scripts/vpn_check.sh -v

# Expected Output:
# ✓ VPN Status: CONNECTED
# ✓ VPN Interface: tun0
# ✓ Public IP: [VPN IP]
# ✓ IP Rotation: Enabled

# 5. Wordlist Verification
ls -lh wordlists/
# Ensure wordlists present and accessible

# 6. Clear Old Logs (optional)
# Keep logs <30 days
find logs/ -type f -mtime +30 -delete
```

---

## Attack Execution Procedures

### Standard Attack Workflow

**Phase 1: Planning (5-10 minutes)**

#### 1.1 Define Scope
```yaml
Attack Scope Document:
  Target: 192.168.1.0/24
  Services: SSH, FTP, Web, RDP
  Authorization: [Reference to authorization document]
  Timeline: [Start Date] to [End Date]
  Restrictions:
    - No DoS attacks
    - Business hours only
    - Rate limit: Max 16 threads
  Success Criteria:
    - Identify weak credentials
    - Document all findings
    - Provide remediation
```

#### 1.2 Reconnaissance
```bash
# Initial target scan
bash scripts/target_scanner.sh -t [target] -s quick

# Review results
cat results/scan_results_*.txt

# Identify services:
# - Port 22: SSH
# - Port 21: FTP  
# - Port 80/443: HTTP/HTTPS
# - Port 3389: RDP
# etc.
```

#### 1.3 Select Attack Vectors
Based on scan results, choose appropriate scripts:
- SSH detected → ssh_admin_attack.sh
- Web server → web_admin_attack.sh
- Multiple services → admin_auto_attack.sh

---

### Phase 2: Execution (30 minutes - 2 hours)

#### 2.1 Pre-Attack Verification

**Safety Checklist:**
- [ ] VPN confirmed active
- [ ] Authorization documented
- [ ] Scope clearly defined
- [ ] Rate limits configured
- [ ] Monitoring in place
- [ ] Backup terminal ready

#### 2.2 Single Service Attack

**Example: SSH Attack**
```bash
# Step 1: Start attack with logging
bash scripts/ssh_admin_attack.sh \
  -t 192.168.1.100 \
  -T 16 \
  -o 30 \
  -v \
  2>&1 | tee logs/ssh_attack_$(date +%Y%m%d_%H%M%S).log

# Step 2: Monitor progress
# In separate terminal:
tail -f logs/hydra_$(date +%Y%m%d).log | grep "attempt"

# Step 3: Watch for success
tail -f logs/hydra_$(date +%Y%m%d).log | grep "valid password"
```

#### 2.3 Multi-Service Attack

**Example: Auto-Attack**
```bash
# Comprehensive attack on single target
bash scripts/admin_auto_attack.sh \
  -t 192.168.1.100 \
  -a \
  -v \
  2>&1 | tee logs/auto_attack_$(date +%Y%m%d_%H%M%S).log

# Subnet attack
bash scripts/admin_auto_attack.sh \
  -t 192.168.1.0/24 \
  -v
```

#### 2.4 Monitoring During Attack

**Terminal 1: Main Attack**
```bash
bash scripts/ssh_admin_attack.sh -t [target] -v
```

**Terminal 2: Resource Monitor**
```bash
# Monitor system resources
watch -n 5 'echo "=== SYSTEM STATUS ===" && free -h && echo && echo "=== NETWORK ===" && ifconfig tun0'
```

**Terminal 3: Log Monitor**
```bash
# Watch for successful credentials
tail -f logs/hydra_$(date +%Y%m%d).log | grep --color=always "valid password"
```

---

### Phase 3: Post-Attack (15-30 minutes)

#### 3.1 Results Collection

```bash
# View all results
bash scripts/results_viewer.sh --all

# Export results
bash scripts/results_viewer.sh --export results_$(date +%Y%m%d).csv --format csv

# Review reports
ls -lt reports/
cat reports/attack_report_ssh_*.md
```

#### 3.2 Verification

**Verify Found Credentials:**
```bash
# Test SSH credential
ssh user@target
# Enter password when prompted

# Test FTP credential
ftp target
# Enter username and password

# Test Web credential
curl -u username:password http://target/admin
```

**Document Verification:**
- [ ] All credentials tested
- [ ] Access levels documented
- [ ] Timestamps recorded
- [ ] Screenshots captured

#### 3.3 Evidence Preservation

```bash
# Create evidence archive
mkdir -p evidence/$(date +%Y%m%d)

# Copy results
cp results/*_$(date +%Y%m%d)* evidence/$(date +%Y%m%d)/

# Copy reports
cp reports/*_$(date +%Y%m%d)* evidence/$(date +%Y%m%d)/

# Copy logs
cp logs/hydra_$(date +%Y%m%d).log evidence/$(date +%Y%m%d)/

# Create archive
tar -czf evidence_$(date +%Y%m%d_%H%M%S).tar.gz evidence/$(date +%Y%m%d)/

# Secure archive
chmod 600 evidence_$(date +%Y%m%d_%H%M%S).tar.gz
```

---

### Phase 4: Reporting (30-60 minutes)

#### 4.1 Generate Reports

**Automatic Reports (Already Generated):**
```bash
# Reports auto-generated after each attack
ls reports/attack_report_*.md

# Review content
cat reports/attack_report_ssh_$(date +%Y%m%d)*.md
```

**Custom Report Generation:**
```bash
# Generate comprehensive report
bash scripts/report_generator.sh \
  --target 192.168.1.100 \
  --date $(date +%Y%m%d) \
  --format markdown

# Export to PDF (if supported)
bash scripts/report_generator.sh \
  --target 192.168.1.100 \
  --format pdf
```

#### 4.2 Report Review Checklist

**Executive Summary:**
- [ ] Clear overview of findings
- [ ] Business impact explained
- [ ] Risk levels assigned
- [ ] High-level recommendations

**Technical Details:**
- [ ] Attack methodology documented
- [ ] All credentials listed
- [ ] Vulnerability details complete
- [ ] Evidence included (screenshots, logs)

**Recommendations:**
- [ ] Immediate actions identified
- [ ] Short-term improvements listed
- [ ] Long-term strategy outlined
- [ ] Compliance requirements noted

#### 4.3 Client Deliverables

**Package Contents:**
1. Executive summary report
2. Technical detailed report
3. Compliance report (if required)
4. Evidence archive
5. Remediation roadmap
6. Follow-up recommendations

**Delivery Checklist:**
- [ ] All reports reviewed for accuracy
- [ ] Sensitive data properly handled
- [ ] Client contact information verified
- [ ] Secure delivery method confirmed
- [ ] Follow-up meeting scheduled

---

## Incident Response

### Security Incident During Attack

#### Scenario 1: Target Detected Attack

**Symptoms:**
- Sudden connection blocks
- Account lockouts
- Firewall rules changed
- IPS/IDS alerts

**Immediate Actions:**
1. **STOP all attacks immediately**
   ```bash
   # Kill all hydra processes
   pkill -9 hydra
   
   # Stop all attack scripts
   pkill -9 -f "admin_attack"
   ```

2. **Disconnect and secure**
   ```bash
   # Change VPN server
   # Reconnect to different location
   
   # Verify new IP
   curl ifconfig.me
   ```

3. **Document incident**
   ```bash
   # Create incident log
   cat > logs/incident_$(date +%Y%m%d_%H%M%S).log << EOF
   Incident Time: $(date)
   Target: [target]
   Detection Type: [IPS/IDS/Lockout/Block]
   Actions Taken: [list actions]
   Status: [ongoing/resolved]
   EOF
   ```

4. **Notify stakeholders**
   - If authorized test: Contact client
   - If detected: Follow escalation procedure
   - Document all communications

---

#### Scenario 2: System Compromise

**Symptoms:**
- Unexpected system behavior
- Unauthorized access detected
- Data exfiltration suspected

**Immediate Actions:**
1. **Isolate system**
   ```bash
   # Disable network
   # Do NOT run automated scripts
   
   # Document state
   ps aux > /tmp/processes_snapshot.txt
   netstat -tulpn > /tmp/network_snapshot.txt
   ```

2. **Preserve evidence**
   ```bash
   # Backup current state
   tar -czf system_state_$(date +%Y%m%d_%H%M%S).tar.gz logs/ results/ config/
   
   # Move to secure location
   mv system_state_*.tar.gz ~/secure_backup/
   ```

3. **Investigate**
   - Review logs for unauthorized activity
   - Check for modified files
   - Verify configurations
   - Scan for malware

4. **Remediate**
   - Remove any malicious code
   - Reset credentials
   - Update all software
   - Restore from clean backup if needed

---

### Emergency Procedures

#### Emergency Shutdown

**When to use:** Critical security event, legal issue, unauthorized access

```bash
#!/bin/bash
# Emergency shutdown script

echo "EMERGENCY SHUTDOWN INITIATED"
date >> logs/emergency_shutdown.log

# 1. Stop all attacks
pkill -9 hydra
pkill -9 -f "attack"

# 2. Disconnect network (optional)
# ip link set wlan0 down

# 3. Secure sensitive data
chmod 600 results/*.json
chmod 600 reports/*.md

# 4. Create incident log
echo "Emergency shutdown: $(date)" >> logs/incident.log
echo "User: $(whoami)" >> logs/incident.log
echo "Reason: [SPECIFY]" >> logs/incident.log

# 5. Archive evidence
tar -czf emergency_archive_$(date +%Y%m%d_%H%M%S).tar.gz logs/ results/ reports/

echo "SHUTDOWN COMPLETE - System secured"
```

---

## Maintenance Procedures

### Weekly Maintenance

**Schedule:** Every Monday, 9:00 AM  
**Duration:** 30 minutes

#### Maintenance Checklist

```bash
# 1. System Updates
pkg update && pkg upgrade -y

# 2. Repository Update
cd ~/Hydra-termux
git pull origin main

# 3. Wordlist Updates
bash scripts/download_wordlists.sh --update

# 4. Log Rotation
mkdir -p logs/archive
mv logs/hydra_*.log logs/archive/ 2>/dev/null

# 5. Results Backup
mkdir -p backups/results_$(date +%Y%m%d)
cp results/*.json backups/results_$(date +%Y%m%d)/

# 6. Health Check
bash scripts/system_diagnostics.sh -v

# 7. Configuration Validation
bash scripts/security_validation.sh

# 8. Disk Cleanup
pkg clean
find logs/archive/ -mtime +30 -delete
find backups/ -mtime +90 -delete
```

**Checklist:**
- [ ] All packages updated
- [ ] Repository synchronized
- [ ] Wordlists current
- [ ] Logs rotated and archived
- [ ] Results backed up
- [ ] System health verified (Grade A or B)
- [ ] Configuration valid
- [ ] Disk space sufficient

---

### Monthly Maintenance

**Schedule:** First day of month  
**Duration:** 1-2 hours

#### Comprehensive Maintenance

```bash
# 1. Full system review
bash scripts/system_diagnostics.sh -v > diagnostics_$(date +%Y%m%d).txt

# 2. Dependency audit
bash scripts/check_dependencies.sh > dependencies_$(date +%Y%m%d).txt

# 3. Security scan
bash scripts/security_validation.sh > security_$(date +%Y%m%d).txt

# 4. Performance review
# Review attack success rates
bash scripts/results_viewer.sh --stats

# 5. Configuration backup
tar -czf config_backup_$(date +%Y%m%d).tar.gz config/

# 6. Documentation review
# Update any outdated procedures
# Review and update reports

# 7. Wordlist optimization
# Remove duplicates
bash scripts/wordlist_generator.sh --optimize

# 8. Archive old data
tar -czf archive_$(date +%Y%m).tar.gz logs/archive/ backups/
mv archive_$(date +%Y%m).tar.gz ~/long_term_storage/
```

---

## Quality Assurance

### Pre-Engagement QA

**Before Starting Any Attack:**

#### 1. Authorization Verification
```yaml
Authorization Checklist:
  - [ ] Written authorization obtained
  - [ ] Scope clearly defined and documented
  - [ ] Start/end dates specified
  - [ ] Contact persons identified
  - [ ] Emergency procedures established
  - [ ] Legal review completed
  - [ ] Insurance verified (if applicable)
```

#### 2. Technical Readiness
```bash
# Run QA script
bash scripts/qa_check.sh

# Manual checks:
# - Hydra version >9.0
# - All scripts executable
# - Wordlists available
# - VPN operational
# - Adequate resources
```

#### 3. Team Briefing
- Review scope and objectives
- Assign roles and responsibilities
- Establish communication protocol
- Review emergency procedures
- Confirm reporting requirements

---

### Post-Engagement QA

**After Completing Attack:**

#### 1. Results Validation
```bash
# Verify all credentials found
# Test each credential
# Document access levels

# QA Checklist:
- [ ] All findings verified
- [ ] False positives removed
- [ ] Credentials tested
- [ ] Screenshots captured
- [ ] Timestamps recorded
```

#### 2. Report Quality Check
```yaml
Report QA:
  Technical Accuracy:
    - [ ] All IPs/hostnames correct
    - [ ] Timestamps accurate
    - [ ] Commands reproducible
    - [ ] Evidence complete
  
  Clarity:
    - [ ] Executive summary clear
    - [ ] Technical details sufficient
    - [ ] Recommendations actionable
    - [ ] Language professional
  
  Completeness:
    - [ ] All findings included
    - [ ] Methodology documented
    - [ ] Evidence attached
    - [ ] Remediation provided
```

#### 3. Client Satisfaction
- Schedule debrief meeting
- Review findings together
- Answer questions
- Provide additional support
- Request feedback

---

## Documentation Standards

### File Naming Conventions

```bash
# Results Files
results/[protocol]_admin_results_[YYYYMMDD_HHMMSS].json

# Report Files
reports/attack_report_[protocol]_[YYYYMMDD_HHMMSS].md

# Log Files
logs/hydra_[YYYYMMDD].log

# Evidence Archives
evidence/evidence_[YYYYMMDD_HHMMSS].tar.gz

# Backup Files
backups/[type]_backup_[YYYYMMDD].tar.gz
```

### Log Entry Format

```bash
# Standard log entry
[YYYY-MM-DD HH:MM:SS] [LEVEL] [COMPONENT] Message

# Example:
[2026-01-20 10:30:45] [INFO] [SSH_ATTACK] Starting attack on 192.168.1.100
[2026-01-20 10:35:12] [SUCCESS] [SSH_ATTACK] Valid credential found: root:admin
[2026-01-20 10:40:00] [ERROR] [FTP_ATTACK] Connection timeout on 192.168.1.50
```

### Report Templates

**All reports must include:**
1. Cover page with date, author, target
2. Table of contents
3. Executive summary (non-technical)
4. Methodology description
5. Findings with evidence
6. Risk assessment
7. Recommendations (prioritized)
8. Appendices (detailed technical data)

---

## Team Coordination

### Multi-Operator Procedures

#### Role Assignments

**Lead Operator:**
- Overall coordination
- Client communication
- Final report approval
- Quality assurance

**Technical Operator(s):**
- Execute attacks
- Monitor progress
- Collect evidence
- Initial documentation

**Support Operator:**
- System monitoring
- Resource management
- Backup operations
- Logistics support

#### Communication Protocol

**Status Updates:**
```bash
# Hourly status template
Time: [HH:MM]
Operator: [Name]
Target: [IP/hostname]
Status: [In Progress/Completed/Issue]
Progress: [X% or description]
Findings: [Count or notable items]
Issues: [Any problems]
Next: [Planned next steps]
```

**Incident Reporting:**
- Immediate notification to lead
- Document in incident log
- Follow escalation procedure
- Update all stakeholders

---

## Compliance & Audit

### Regulatory Compliance

#### PCI-DSS Compliance
- Quarterly vulnerability scanning
- Annual penetration testing
- Documented security policies
- Access control verification
- Encryption validation

#### HIPAA Compliance
- Risk assessment procedures
- Access control testing
- Audit trail verification
- Encryption validation
- Incident response testing

#### SOC 2 Compliance
- Security testing procedures
- Access control validation
- Monitoring and logging
- Change management verification
- Incident response capability

### Audit Trail Maintenance

```bash
# Complete audit trail includes:
- Authorization documents
- Scope definitions
- Execution logs
- Results and evidence
- Reports delivered
- Client communications
- Remediation verification
```

### Record Retention

**Minimum Retention Periods:**
- Authorization documents: 7 years
- Execution logs: 3 years
- Results and reports: 5 years
- Evidence archives: 3 years
- Client communications: 5 years

**Secure Storage:**
```bash
# Encrypt sensitive archives
tar -czf data.tar.gz [files]
openssl enc -aes-256-cbc -salt -in data.tar.gz -out data.tar.gz.enc

# Store securely with access controls
chmod 600 data.tar.gz.enc
```

---

## Performance Metrics

### Key Performance Indicators (KPIs)

**Technical KPIs:**
- Attack success rate
- Time to first finding
- Coverage completeness
- False positive rate
- System uptime

**Operational KPIs:**
- Engagement completion time
- Report turnaround time
- Client satisfaction score
- Follow-up completion rate
- Remediation verification rate

### Metrics Collection

```bash
# Generate monthly metrics report
bash scripts/results_viewer.sh --stats --month $(date +%Y%m)

# Example output:
# Total Attacks: 45
# Successful: 38 (84%)
# Services Tested: SSH, FTP, Web, RDP, MySQL
# Average Time per Attack: 32 minutes
# Credentials Found: 127
# Reports Generated: 45
```

---

## Continuous Improvement

### Lessons Learned

**After Each Engagement:**
1. Team debrief
2. Document successes and challenges
3. Identify improvement opportunities
4. Update procedures as needed
5. Share knowledge with team

### Procedure Updates

**Review Quarterly:**
- Effectiveness of current procedures
- New tools or techniques available
- Industry best practices
- Client feedback
- Regulatory changes

**Update Process:**
1. Identify need for update
2. Draft proposed changes
3. Team review and feedback
4. Test new procedures
5. Document and communicate changes
6. Implement and monitor

---

**Last Updated:** January 2026  
**Maintained By:** Hydra-Termux Operations Team  
**Review Schedule:** Quarterly  
**Next Review:** April 2026
