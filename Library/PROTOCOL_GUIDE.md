# Protocol Combinations Library - Complete Guide

## 📘 Overview

This library contains all possible meaningful combinations of protocols for comprehensive penetration testing. Each combination represents a real-world attack scenario.

---

## 🎯 Protocol Definitions

### Network Services

#### SSH (Secure Shell) - Port 22
**Definition**: Encrypted remote access protocol for secure command-line interface.
**Use in Pen-Testing**: 
- Test for weak credentials on administrative accounts
- Identify default credentials on embedded devices
- Verify SSH key management
**Example**: `bash ssh_quick.sh` → Tests root/admin accounts

#### FTP (File Transfer Protocol) - Port 21
**Definition**: File transfer protocol for uploading/downloading files.
**Use in Pen-Testing**:
- Test for anonymous FTP access
- Identify weak admin credentials
- Check for sensitive file exposure
**Example**: `bash ftp_quick.sh` → Tests admin/anonymous access

#### Telnet - Port 23
**Definition**: Unencrypted remote access protocol (insecure).
**Use in Pen-Testing**:
- Identify legacy systems still using Telnet
- Test for default credentials on network devices
- Verify if encryption is enforced
**Example**: `bash telnet_quick.sh` → Tests router/switch admin panels

#### RDP (Remote Desktop Protocol) - Port 3389
**Definition**: Microsoft's protocol for graphical remote desktop access.
**Use in Pen-Testing**:
- Test Windows administrator credentials
- Identify RDP vulnerabilities (BlueKeep, etc.)
- Check for weak domain passwords
**Example**: `bash rdp_quick.sh` → Tests Windows admin accounts

#### SMB/CIFS - Port 445
**Definition**: Windows file sharing and network communication protocol.
**Use in Pen-Testing**:
- Test domain credentials
- Enumerate network shares
- Identify EternalBlue vulnerability
**Example**: `bash smb_quick.sh` → Tests domain admin access

#### VNC (Virtual Network Computing) - Port 5900
**Definition**: Graphical desktop sharing protocol.
**Use in Pen-Testing**:
- Test for password-only authentication
- Identify systems with no VNC password
- Check for weak VNC passwords
**Example**: `bash vnc_quick.sh` → Tests VNC password protection

---

### Database Services

#### MySQL - Port 3306
**Definition**: Open-source relational database management system.
**Use in Pen-Testing**:
- Test for default root passwords
- Check remote root access
- Verify privilege escalation paths
**Example**: `bash mysql_quick.sh` → Tests root/admin database access

#### PostgreSQL - Port 5432
**Definition**: Advanced open-source relational database.
**Use in Pen-Testing**:
- Test postgres superuser credentials
- Check for weak database passwords
- Verify access control policies
**Example**: `bash postgres_quick.sh` → Tests postgres admin account

#### MSSQL - Port 1433
**Definition**: Microsoft SQL Server database.
**Use in Pen-Testing**:
- Test 'sa' (system administrator) account
- Check Windows authentication
- Verify xp_cmdshell execution
**Example**: `bash mssql_quick.sh` → Tests sa account

#### MongoDB - Port 27017
**Definition**: NoSQL document-oriented database.
**Use in Pen-Testing**:
- Test for no authentication
- Check admin credentials
- Verify network exposure
**Example**: `bash mongodb_quick.sh` → Tests admin/no-auth

#### Redis - Port 6379
**Definition**: In-memory data structure store (cache).
**Use in Pen-Testing**:
- Test for no authentication
- Check requirepass setting
- Verify network exposure
**Example**: `bash redis_quick.sh` → Tests password/no-auth

---

### Mail Services

#### SMTP (Simple Mail Transfer Protocol) - Port 25
**Definition**: Protocol for sending email messages.
**Use in Pen-Testing**:
- Test mail server authentication
- Check for open relay configuration
- Identify email spoofing possibilities
**Example**: `bash smtp_quick.sh` → Tests postmaster/admin

#### POP3 (Post Office Protocol) - Port 110
**Definition**: Protocol for retrieving email from server.
**Use in Pen-Testing**:
- Test email account credentials
- Verify encryption enforcement
- Check for cleartext password transmission
**Example**: `bash pop3_quick.sh` → Tests email accounts

#### IMAP (Internet Message Access Protocol) - Port 143
**Definition**: Protocol for accessing email on server.
**Use in Pen-Testing**:
- Test email credentials
- Check folder access permissions
- Verify TLS enforcement
**Example**: `bash imap_quick.sh` → Tests email accounts

---

### Directory & Management

#### LDAP (Lightweight Directory Access Protocol) - Port 389
**Definition**: Protocol for accessing directory services.
**Use in Pen-Testing**:
- Test directory admin credentials
- Enumerate domain users
- Check for anonymous bind
**Example**: `bash ldap_quick.sh` → Tests cn=admin

#### SNMP (Simple Network Management Protocol) - Port 161
**Definition**: Protocol for network device management.
**Use in Pen-Testing**:
- Test community strings (public/private)
- Enumerate network devices
- Check for device configuration exposure
**Example**: `bash snmp_quick.sh` → Tests community strings

---

## 🔄 Protocol Combinations

### Combination 1: Web + Database
**Scenario**: Web application with backend database
**Protocols**: HTTP/HTTPS + MySQL/PostgreSQL
**Use Case**: Test web login → then database if credentials found
**Script**: `combo_web_db.sh`

### Combination 2: Network Services Stack
**Scenario**: Enterprise server with multiple services
**Protocols**: SSH + FTP + MySQL + SMB
**Use Case**: Test all services with same credentials (credential reuse)
**Script**: `combo_network_stack.sh`

### Combination 3: Windows Infrastructure
**Scenario**: Windows domain environment
**Protocols**: RDP + SMB + MSSQL + LDAP
**Use Case**: Test domain credentials across all Windows services
**Script**: `combo_windows_infra.sh`

### Combination 4: Mail Server Stack
**Scenario**: Complete mail server
**Protocols**: SMTP + POP3 + IMAP + Web (Webmail)
**Use Case**: Test email credentials across all mail protocols
**Script**: `combo_mail_stack.sh`

### Combination 5: Database Cluster
**Scenario**: Multi-database environment
**Protocols**: MySQL + PostgreSQL + MongoDB + Redis + MSSQL
**Use Case**: Test for database misconfigurations and weak credentials
**Script**: `combo_db_cluster.sh`

### Combination 6: IoT/Embedded Devices
**Scenario**: Network devices and IoT
**Protocols**: Telnet + SNMP + HTTP + FTP
**Use Case**: Test legacy protocols on network equipment
**Script**: `combo_iot_devices.sh`

### Combination 7: Complete Infrastructure
**Scenario**: Full enterprise network
**Protocols**: ALL protocols sequentially
**Use Case**: Comprehensive pen-test of entire infrastructure
**Script**: `combo_full_infrastructure.sh`

---

## 📊 Attack Flow Diagrams

### Web Application Attack Flow
```
1. nmap_vuln_scan.sh        → Find web vulnerabilities
2. web_directory_bruteforce.sh → Discover admin panels
3. web_quick.sh             → Brute-force login
4. mysql_quick.sh           → Attack backend database
```

### Windows Domain Attack Flow
```
1. nmap_network_discovery.sh → Find Windows hosts
2. smb_quick.sh              → Test SMB shares
3. rdp_quick.sh              → Test RDP access
4. ldap_quick.sh             → Enumerate domain
```

### Database Server Attack Flow
```
1. nmap_full_scan.sh         → Find database ports
2. mysql_quick.sh            → Test MySQL
3. postgres_quick.sh         → Test PostgreSQL
4. mongodb_quick.sh          → Test MongoDB
```

---

## 🎓 Pen-Testing Methodology

### Phase 1: Reconnaissance
- `nmap_network_discovery.sh` - Find live hosts
- `nmap_os_detection.sh` - Identify operating systems
- `nmap_full_scan.sh` - Discover all open ports

### Phase 2: Vulnerability Assessment
- `nmap_vuln_scan.sh` - Check for known vulnerabilities
- `ssl_analyzer.sh` - Test SSL/TLS security
- `web_header_analyzer.sh` - Check web security headers

### Phase 3: Exploitation
- Protocol-specific brute-force scripts
- Combination scripts for credential reuse
- `auto_attack_quick.sh` for automated exploitation

### Phase 4: Post-Exploitation
- `results_viewer.sh` - Analyze successful attacks
- Document findings in reports

---

## 💡 Real-World Use Cases

### Use Case 1: Corporate Network Audit
**Scenario**: Test security of corporate office network
**Steps**:
```bash
1. bash nmap_network_discovery.sh    # Map network
2. bash combo_windows_infra.sh       # Test Windows systems
3. bash combo_network_stack.sh       # Test servers
4. bash results_viewer.sh            # Generate report
```

### Use Case 2: Web Application Pen-Test
**Scenario**: Security audit of web application
**Steps**:
```bash
1. bash nmap_vuln_scan.sh             # Find vulnerabilities
2. bash ssl_analyzer.sh               # Check SSL
3. bash web_header_analyzer.sh        # Check headers
4. bash combo_web_db.sh               # Test app + DB
```

### Use Case 3: Database Security Assessment
**Scenario**: Audit database server security
**Steps**:
```bash
1. bash nmap_full_scan.sh             # Find DB ports
2. bash combo_db_cluster.sh           # Test all DBs
3. bash results_viewer.sh             # Review results
```

### Use Case 4: IoT Device Testing
**Scenario**: Security testing of IoT devices
**Steps**:
```bash
1. bash nmap_network_discovery.sh     # Find devices
2. bash combo_iot_devices.sh          # Test IoT protocols
3. bash snmp_quick.sh                 # SNMP enumeration
```

---

## 🔐 Security Best Practices

### Before Testing
✅ Obtain written authorization
✅ Connect to VPN
✅ Document test scope
✅ Set up logging

### During Testing
✅ Use appropriate thread counts
✅ Monitor system impact
✅ Document all findings
✅ Follow responsible disclosure

### After Testing
✅ Review all logs
✅ Generate reports
✅ Securely store credentials found
✅ Provide remediation recommendations

---

## 📈 Protocol Complexity Matrix

| Protocol | Complexity | Auth Type | Lockout Risk | Speed |
|----------|-----------|-----------|--------------|-------|
| FTP | Low | User/Pass | Low | Fast |
| SSH | Medium | User/Pass/Key | Medium | Medium |
| Telnet | Low | User/Pass | Low | Fast |
| HTTP | Medium | User/Pass | Low | Medium |
| MySQL | Medium | User/Pass | Low | Fast |
| PostgreSQL | Medium | User/Pass | Low | Fast |
| RDP | High | User/Pass/Domain | High | Slow |
| SMB | High | User/Pass/Domain | Medium | Medium |
| LDAP | High | DN/Password | Medium | Medium |
| SNMP | Low | Community | Low | Fast |
| VNC | Low | Password-only | Low | Fast |
| MongoDB | Medium | User/Pass/None | Low | Fast |
| Redis | Low | Password/None | Low | Fast |

---

## 🐛 Enterprise Debugging

All scripts include:
- ✅ Verbose mode (`-v` flag)
- ✅ Error logging to files
- ✅ JSON-formatted results
- ✅ Timestamp tracking
- ✅ Exit code handling
- ✅ Input validation
- ✅ Dependency checking

### Debug a Script
```bash
# Enable verbose mode
bash ssh_quick.sh -v

# Check logs
cat ../logs/hydra_$(date +%Y%m%d).log

# View results
cat ../logs/results_$(date +%Y%m%d).json | jq .
```

---

## 📚 Protocol Reference Quick Guide

**Network Access**: SSH, Telnet, RDP, VNC
**File Transfer**: FTP, SMB
**Databases**: MySQL, PostgreSQL, MSSQL, MongoDB, Redis
**Mail**: SMTP, POP3, IMAP
**Management**: LDAP, SNMP
**Web**: HTTP, HTTPS

**Total Protocols**: 16 core + 24 variants = **40+ protocols**

---

**Document Version**: 2.0  
**Last Updated**: 2025-01-28  
**Total Scripts**: 31 individual + 7 combinations = **38 scripts**