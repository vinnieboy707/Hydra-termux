# Complete Scripts Library Documentation

**Version:** 2.0.0  
**Last Updated:** January 2026  
**Total Scripts:** 50+

---

## Table of Contents

1. [Overview](#overview)
2. [Core Attack Scripts](#core-attack-scripts)
3. [Quick-Use Library Scripts](#quick-use-library-scripts)
4. [Utility Scripts](#utility-scripts)
5. [Advanced Tools](#advanced-tools)
6. [ALHacking Integration Scripts](#alhacking-integration-scripts)
7. [Script Parameters Reference](#script-parameters-reference)
8. [Usage Examples](#usage-examples)

---

## Overview

Hydra-Termux contains a comprehensive suite of penetration testing scripts organized into several categories:

### Script Organization
```
Hydra-termux/
├── scripts/          # Core attack and utility scripts
├── Library/          # Quick-use one-line-change scripts
├── config/           # Configuration and wordlists
├── reports/          # Auto-generated attack reports
└── logs/             # Execution logs and results
```

### Script Types
1. **Core Attack Scripts** - Full-featured penetration testing tools
2. **Quick-Use Scripts** - Simplified one-line-change versions
3. **Utility Scripts** - Support tools and helpers
4. **Advanced Tools** - AI-assisted and enhanced features

---

## Core Attack Scripts

### 1. SSH Admin Attack (`scripts/ssh_admin_attack.sh`)

**Purpose:** Brute-force SSH authentication to gain remote shell access

**Protocol:** SSH (Secure Shell)  
**Default Port:** 22  
**Optimization:** 2x faster with 32 threads, 15s timeout

**Key Features:**
- Multi-wordlist support with automatic fallback
- Session resume capability for interrupted attacks
- Automatic report generation
- Root and admin user prioritization
- Key-based authentication detection

**Usage:**
```bash
# Basic attack
bash scripts/ssh_admin_attack.sh -t 192.168.1.100

# Custom wordlist and threads
bash scripts/ssh_admin_attack.sh -t example.com -w custom.txt -T 16

# Verbose with custom port
bash scripts/ssh_admin_attack.sh -t 10.0.0.5 -p 2222 -v
```

**Parameters:**
- `-t, --target` - Target IP or hostname (required)
- `-p, --port` - Custom SSH port (default: 22)
- `-u, --user-list` - Custom username list
- `-w, --word-list` - Custom password wordlist
- `-T, --threads` - Number of parallel threads (default: 32)
- `-o, --timeout` - Connection timeout (default: 15s)
- `-v, --verbose` - Enable verbose output
- `-r, --resume` - Resume interrupted attack

**Common Usernames Tested:**
- root (45% success rate)
- admin
- administrator
- user
- sysadmin
- ubuntu
- centos

**Output:**
- Results saved to: `results/ssh_admin_results_[timestamp].json`
- Report saved to: `reports/attack_report_ssh_[timestamp].md`
- Logs saved to: `logs/hydra_[date].log`

---

### 2. FTP Admin Attack (`scripts/ftp_admin_attack.sh`)

**Purpose:** Brute-force FTP authentication for file server access

**Protocol:** FTP (File Transfer Protocol)  
**Default Port:** 21  
**Optimization:** 3x faster with 48 threads, 10s timeout

**Key Features:**
- Anonymous FTP detection and testing
- Binary/ASCII transfer mode support
- Automatic report generation
- FTPS (FTP over SSL) support
- Blank password priority testing

**Usage:**
```bash
# Basic FTP attack
bash scripts/ftp_admin_attack.sh -t 192.168.1.50

# Test anonymous first
bash scripts/ftp_admin_attack.sh -t ftp.example.com --anonymous

# Custom port with SSL
bash scripts/ftp_admin_attack.sh -t 10.0.0.10 -p 990 --ssl
```

**Parameters:**
- `-t, --target` - Target IP or hostname (required)
- `-p, --port` - Custom FTP port (default: 21)
- `-u, --user-list` - Custom username list
- `-w, --word-list` - Custom password wordlist
- `-T, --threads` - Number of parallel threads (default: 48)
- `-o, --timeout` - Connection timeout (default: 10s)
- `--anonymous` - Try anonymous login first
- `--ssl` - Use FTPS (FTP over SSL)
- `-v, --verbose` - Enable verbose output

**Common Credentials Tested:**
- anonymous:anonymous (try first)
- ftp:ftp
- admin:admin
- root:root
- user:user

**Output:**
- Results: `results/ftp_admin_results_[timestamp].json`
- Report: `reports/attack_report_ftp_[timestamp].md`
- Logs: `logs/hydra_[date].log`

---

### 3. Web Admin Attack (`scripts/web_admin_attack.sh`)

**Purpose:** Brute-force web admin panels and login forms

**Protocol:** HTTP/HTTPS  
**Default Ports:** 80 (HTTP), 443 (HTTPS)  
**Optimization:** 2x faster with 32 threads

**Key Features:**
- 13+ admin path detection (/admin, /wp-admin, /administrator, etc.)
- WordPress priority testing
- Form parameter auto-detection
- SSL/TLS support
- Session cookie handling
- Automatic report generation

**Usage:**
```bash
# Basic web attack
bash scripts/web_admin_attack.sh -t example.com

# WordPress specific
bash scripts/web_admin_attack.sh -t blog.example.com -P /wp-login.php

# HTTPS with custom path
bash scripts/web_admin_attack.sh -t 192.168.1.100 -P /admin -s

# Custom form parameters
bash scripts/web_admin_attack.sh -t site.com -P /login -U username -W password
```

**Parameters:**
- `-t, --target` - Target domain or IP (required)
- `-P, --path` - Login path (default: auto-detect)
- `-p, --port` - Custom port (default: 80/443)
- `-s, --ssl` - Use HTTPS
- `-U, --user-param` - Username form parameter
- `-W, --pass-param` - Password form parameter
- `-u, --user-list` - Custom username list
- `-w, --word-list` - Custom password wordlist
- `-T, --threads` - Parallel threads (default: 32)
- `-v, --verbose` - Enable verbose output

**Common Admin Paths:**
- /admin
- /wp-admin
- /wp-login.php
- /administrator
- /login
- /admin.php
- /cpanel
- /phpmyadmin
- /manager
- /console
- /adminpanel
- /controlpanel
- /dashboard

**Output:**
- Results: `results/web_admin_results_[timestamp].json`
- Report: `reports/attack_report_web_[timestamp].md`
- Logs: `logs/hydra_[date].log`

---

### 4. RDP Admin Attack (`scripts/rdp_admin_attack.sh`)

**Purpose:** Brute-force Remote Desktop Protocol for Windows access

**Protocol:** RDP (Remote Desktop Protocol)  
**Default Port:** 3389  
**Optimization:** 2x faster with lockout prevention (8 threads, 45s timeout)

**Key Features:**
- Account lockout prevention
- Session hijacking detection
- Network Level Authentication (NLA) support
- Domain account support
- Automatic report generation
- Smart delay between attempts

**Usage:**
```bash
# Basic RDP attack
bash scripts/rdp_admin_attack.sh -t 192.168.1.200

# Domain authentication
bash scripts/rdp_admin_attack.sh -t server.company.local -d COMPANY

# Custom port with careful threading
bash scripts/rdp_admin_attack.sh -t 10.0.0.50 -p 3390 -T 4
```

**Parameters:**
- `-t, --target` - Target IP or hostname (required)
- `-p, --port` - Custom RDP port (default: 3389)
- `-d, --domain` - Windows domain name
- `-u, --user-list` - Custom username list
- `-w, --word-list` - Custom password wordlist
- `-T, --threads` - Parallel threads (default: 8, max 16)
- `-o, --timeout` - Connection timeout (default: 45s)
- `-v, --verbose` - Enable verbose output

**Important Notes:**
- RDP has strict account lockout policies (typically 3-5 failed attempts)
- Use low thread count (4-8) to avoid detection
- Allow delays between attempts (45s timeout recommended)
- Consider testing during off-hours to avoid admin attention

**Common Usernames:**
- Administrator
- Admin
- User
- Guest (often disabled)
- Domain-specific accounts

**Output:**
- Results: `results/rdp_admin_results_[timestamp].json`
- Report: `reports/attack_report_rdp_[timestamp].md`
- Logs: `logs/hydra_[date].log`

---

### 5. MySQL Admin Attack (`scripts/mysql_admin_attack.sh`)

**Purpose:** Brute-force MySQL database authentication

**Protocol:** MySQL  
**Default Port:** 3306  
**Optimization:** 50% faster with 24 threads, root blank password priority

**Key Features:**
- Root blank password testing (50% success rate)
- Database enumeration
- MySQL version detection
- Automatic report generation
- Common default credentials

**Usage:**
```bash
# Basic MySQL attack
bash scripts/mysql_admin_attack.sh -t 192.168.1.100

# Custom port and database
bash scripts/mysql_admin_attack.sh -t db.example.com -p 3307 -D production

# Specific user targeting
bash scripts/mysql_admin_attack.sh -t 10.0.0.20 -u users.txt
```

**Parameters:**
- `-t, --target` - Target IP or hostname (required)
- `-p, --port` - Custom MySQL port (default: 3306)
- `-D, --database` - Database name to connect to
- `-u, --user-list` - Custom username list
- `-w, --word-list` - Custom password wordlist
- `-T, --threads` - Parallel threads (default: 24)
- `-v, --verbose` - Enable verbose output

**Priority Testing Order:**
1. root: (blank password)
2. root:root
3. root:password
4. root:admin
5. admin:admin
6. mysql:mysql

**Output:**
- Results: `results/mysql_admin_results_[timestamp].json`
- Report: `reports/attack_report_mysql_[timestamp].md`
- Logs: `logs/hydra_[date].log`

---

### 6. PostgreSQL Admin Attack (`scripts/postgres_admin_attack.sh`)

**Purpose:** Brute-force PostgreSQL database authentication

**Protocol:** PostgreSQL  
**Default Port:** 5432  
**Optimization:** 25% faster with 20 threads, postgres user priority

**Key Features:**
- Postgres user priority testing
- Database enumeration
- Version detection
- Role-based access testing
- Automatic report generation

**Usage:**
```bash
# Basic PostgreSQL attack
bash scripts/postgres_admin_attack.sh -t 192.168.1.100

# Custom database
bash scripts/postgres_admin_attack.sh -t db.example.com -D myapp

# Specific port
bash scripts/postgres_admin_attack.sh -t 10.0.0.30 -p 5433
```

**Parameters:**
- `-t, --target` - Target IP or hostname (required)
- `-p, --port` - Custom PostgreSQL port (default: 5432)
- `-D, --database` - Database name (default: postgres)
- `-u, --user-list` - Custom username list
- `-w, --word-list` - Custom password wordlist
- `-T, --threads` - Parallel threads (default: 20)
- `-v, --verbose` - Enable verbose output

**Common Users:**
- postgres (default superuser)
- admin
- root
- user
- Application-specific users

**Output:**
- Results: `results/postgres_admin_results_[timestamp].json`
- Report: `reports/attack_report_postgres_[timestamp].md`
- Logs: `logs/hydra_[date].log`

---

### 7. SMB Admin Attack (`scripts/smb_admin_attack.sh`)

**Purpose:** Brute-force SMB/CIFS authentication for Windows file shares

**Protocol:** SMB/CIFS (Windows File Sharing)  
**Default Port:** 445  
**Optimization:** 2x faster with 16 threads, guest account priority

**Key Features:**
- Guest account detection
- Domain authentication support
- Share enumeration
- Null session testing
- Automatic report generation

**Usage:**
```bash
# Basic SMB attack
bash scripts/smb_admin_attack.sh -t 192.168.1.100

# Domain authentication
bash scripts/smb_admin_attack.sh -t fileserver.company.local -d COMPANY

# Test guest access first
bash scripts/smb_admin_attack.sh -t 10.0.0.40 --guest
```

**Parameters:**
- `-t, --target` - Target IP or hostname (required)
- `-p, --port` - Custom SMB port (default: 445)
- `-d, --domain` - Windows domain/workgroup
- `-u, --user-list` - Custom username list
- `-w, --word-list` - Custom password wordlist
- `-T, --threads` - Parallel threads (default: 16)
- `--guest` - Try guest account first
- `-v, --verbose` - Enable verbose output

**Priority Testing:**
1. Guest: (blank)
2. :(blank)/null session
3. Administrator:Administrator
4. admin:admin
5. Common credentials

**Output:**
- Results: `results/smb_admin_results_[timestamp].json`
- Report: `reports/attack_report_smb_[timestamp].md`
- Logs: `logs/hydra_[date].log`

---

### 8. Multi-Protocol Auto Attack (`scripts/admin_auto_attack.sh`)

**Purpose:** Automated multi-protocol reconnaissance and attack

**Protocols:** All supported (SSH, FTP, HTTP, RDP, MySQL, PostgreSQL, SMB, etc.)  
**Optimization:** Parallel execution with 35+ protocol mappings

**Key Features:**
- Automatic port scanning
- Service detection and identification
- Intelligent protocol selection
- Parallel attack execution
- Comprehensive reporting
- Resume capability

**Usage:**
```bash
# Full auto-attack
bash scripts/admin_auto_attack.sh -t 192.168.1.0/24

# Single target, all services
bash scripts/admin_auto_attack.sh -t 192.168.1.100 -a

# Resume interrupted scan
bash scripts/admin_auto_attack.sh -t 10.0.0.0/24 -r
```

**Parameters:**
- `-t, --target` - Target IP/range/hostname (required)
- `-a, --all` - Test all detected services
- `-p, --protocols` - Specific protocols (ssh,ftp,web,rdp,mysql,postgres,smb)
- `-T, --threads` - Max parallel threads per service
- `-r, --resume` - Resume interrupted attack
- `-v, --verbose` - Enable verbose output

**Attack Phases:**
1. **Reconnaissance** - Port scanning and service detection
2. **Protocol Mapping** - Identify attack vectors (35+ protocols)
3. **Parallel Execution** - Launch coordinated attacks
4. **Result Aggregation** - Collect and correlate findings
5. **Comprehensive Reporting** - Generate unified report

**Supported Protocols (35+):**
- SSH, Telnet, FTP, FTPS
- HTTP, HTTPS, HTTP-Proxy
- RDP, VNC, RLogin
- MySQL, PostgreSQL, MSSQL, Oracle, MongoDB, Redis
- SMTP, POP3, IMAP
- SMB, NFS, AFP
- LDAP, SNMP, SIP
- And more...

**Output:**
- Results: `results/auto_attack_results_[timestamp].json`
- Reports: `reports/attack_report_[protocol]_[timestamp].md` (one per protocol)
- Summary: `reports/auto_attack_summary_[timestamp].md`
- Logs: `logs/hydra_[date].log`

---

## Quick-Use Library Scripts

Located in `Library/` directory - simplified one-line-change versions of all scripts.

### SSH Quick (`Library/ssh_quick.sh`)
```bash
#!/bin/bash
TARGET="192.168.1.100"  # <-- Change this
cd "$(dirname "$0")/.."
bash scripts/ssh_admin_attack.sh -t "$TARGET" -v
```

### FTP Quick (`Library/ftp_quick.sh`)
```bash
#!/bin/bash
TARGET="192.168.1.100"  # <-- Change this
cd "$(dirname "$0")/.."
bash scripts/ftp_admin_attack.sh -t "$TARGET" -v
```

### Web Quick (`Library/web_quick.sh`)
```bash
#!/bin/bash
TARGET="example.com"  # <-- Change this
cd "$(dirname "$0")/.."
bash scripts/web_admin_attack.sh -t "$TARGET" -v
```

### Complete Library (45+ Scripts)
See [Library/README.md](../Library/README.md) for complete list including:
- WordPress Quick
- RDP Quick
- MySQL Quick
- PostgreSQL Quick
- SMB Quick
- Auto Attack Quick
- Network Quick
- Email Quick
- IMAP/POP3/SMTP Quick
- MongoDB Quick
- Redis Quick
- LDAP Quick
- VNC Quick
- Telnet Quick
- Oracle Quick
- MSSQL Quick
- SNMP Quick
- HTTP Proxy Quick
- SSL Analyzer
- Web Directory Bruteforce
- Web Header Analyzer
- Network Discovery
- Vulnerability Scanner
- OS Detection
- Stealth Scanner
- Combo Scripts (Infrastructure, Database Cluster, IoT, Mail Stack, etc.)

---

## Utility Scripts

### Wordlist Manager (`scripts/download_wordlists.sh`)
**Purpose:** Download and manage password wordlists from SecLists

**Usage:**
```bash
# Download all wordlists
bash scripts/download_wordlists.sh --all

# Download specific category
bash scripts/download_wordlists.sh --passwords

# Update existing wordlists
bash scripts/download_wordlists.sh --update
```

**Categories:**
- Common passwords
- Admin passwords
- Default credentials
- Common usernames
- Top 10,000 passwords
- RockYou wordlist
- Custom wordlists

---

### Wordlist Generator (`scripts/wordlist_generator.sh`)
**Purpose:** Create custom targeted wordlists

**Usage:**
```bash
# Combine multiple wordlists
bash scripts/wordlist_generator.sh --combine file1.txt file2.txt -o combined.txt

# Generate permutations
bash scripts/wordlist_generator.sh --permute "Password" --years 2020-2024

# Filter by rules
bash scripts/wordlist_generator.sh --filter 8-16 --alpha-num file.txt
```

**Features:**
- Combine and merge wordlists
- Remove duplicates
- Sort and filter
- Generate permutations
- Apply transformation rules
- Filter by length/complexity

---

### Target Scanner (`scripts/target_scanner.sh`)
**Purpose:** Quick network reconnaissance with nmap

**Usage:**
```bash
# Quick scan
bash scripts/target_scanner.sh -t 192.168.1.100 -s quick

# Full scan with OS detection
bash scripts/target_scanner.sh -t 192.168.1.0/24 -s full

# Specific ports
bash scripts/target_scanner.sh -t example.com -p 80,443,8080
```

**Scan Types:**
- Quick scan (common ports)
- Full scan (all ports)
- Stealth scan (SYN scan)
- Version detection
- OS fingerprinting
- Vulnerability scanning

---

### Results Viewer (`scripts/results_viewer.sh`)
**Purpose:** View, filter, and export attack results

**Usage:**
```bash
# View all results
bash scripts/results_viewer.sh --all

# Filter by protocol
bash scripts/results_viewer.sh --protocol ssh

# Export to CSV
bash scripts/results_viewer.sh --export results.csv --format csv

# Last 7 days
bash scripts/results_viewer.sh --days 7
```

**Features:**
- Filter by protocol, date, target
- Export to CSV, JSON, TXT
- Statistics and summaries
- 30-day history view
- Result search

---

### VPN Checker (`scripts/vpn_check.sh`)
**Purpose:** Verify VPN connection and IP anonymity

**Usage:**
```bash
# Check VPN status
bash scripts/vpn_check.sh

# Verbose diagnostics
bash scripts/vpn_check.sh -v

# Track IP rotation
bash scripts/vpn_check.sh --track
```

**Features:**
- Multi-method VPN detection
- IP rotation tracking (up to 1000 IPs)
- Anonymity enforcement
- Connection audit trail
- DNS leak testing

---

### System Diagnostics (`scripts/system_diagnostics.sh`)
**Purpose:** Comprehensive system health check

**Usage:**
```bash
# Run diagnostics
bash scripts/system_diagnostics.sh

# Detailed output
bash scripts/system_diagnostics.sh -v
```

**Checks:**
- Hydra installation
- Dependencies (nmap, jq, curl, etc.)
- System resources (RAM, storage, CPU)
- Network connectivity
- Configuration validity
- Wordlist availability
- Health score (A-F grade)

---

### Auto Fix (`scripts/auto_fix.sh`)
**Purpose:** Automatically fix common installation issues

**Usage:**
```bash
# Run auto-fix
bash scripts/auto_fix.sh

# Force reinstall hydra
bash scripts/auto_fix.sh --force
```

**Fixes:**
- Install missing hydra
- Install missing dependencies
- Fix permissions
- Update package repositories
- Repair configurations

---

## Advanced Tools

### AI Assistant (`scripts/ai_assistant.sh`)
**Purpose:** AI-powered attack planning and optimization

**Features:**
- Intelligent target analysis
- Attack strategy recommendations
- Parameter optimization
- Result interpretation
- Natural language interface

---

### Enhanced UI (`scripts/enhanced_ui.sh`)
**Purpose:** Improved terminal user interface

**Features:**
- Rich formatting
- Progress indicators
- Interactive menus
- Color-coded output
- Dashboard views

---

### Report Generator (`scripts/report_generator.sh`)
**Purpose:** Generate professional penetration testing reports

**Features:**
- Automatic report generation (triggered by all attacks)
- Vulnerability assessment with CVSS scoring
- Prevention recommendations
- Remediation guides
- Compliance guidance (PCI-DSS, HIPAA, SOC 2)
- Multiple export formats (Markdown, PDF, HTML)

**Report Sections:**
1. Executive Summary
2. Attack Timeline
3. Discovered Credentials
4. Vulnerability Assessment
5. Prevention Recommendations (Immediate, Short-term, Long-term)
6. Security Best Practices
7. Compliance Guidance
8. Technical Details

---

### Security Validation (`scripts/security_validation.sh`)
**Purpose:** Validate security configurations and best practices

**Features:**
- Configuration auditing
- Password policy validation
- Service hardening checks
- Compliance validation
- Security scoring

---

## ALHacking Integration Scripts

Additional tools integrated from ALHacking framework:

1. **Auto IP Changer** (`scripts/alhacking_autoipchanger.sh`)
2. **BadMod** (`scripts/alhacking_badmod.sh`)
3. **DarkArmy** (`scripts/alhacking_darkarmy.sh`)
4. **DDoS Tools** (`scripts/alhacking_ddos.sh`)
5. **Dorks Eye** (`scripts/alhacking_dorkseye.sh`)
6. **FaceBash** (`scripts/alhacking_facebash.sh`)
7. **Gmail Bomber** (`scripts/alhacking_gmail_bomber.sh`)
8. **Hacker Pro** (`scripts/alhacking_hackerpro.sh`)
9. **Info Site** (`scripts/alhacking_infosite.sh`)
10. **IP Info** (`scripts/alhacking_ipinfo.sh`)
11. **Phishing** (`scripts/alhacking_phishing.sh`)
12. **RedHawk** (`scripts/alhacking_redhawk.sh`)
13. **SubScan** (`scripts/alhacking_subscan.sh`)
14. **Virus Crafter** (`scripts/alhacking_viruscrafter.sh`)
15. **Webcam** (`scripts/alhacking_webcam.sh`)

**Note:** These tools are advanced and should be used with caution and proper authorization.

---

## Script Parameters Reference

### Common Parameters (All Attack Scripts)

| Parameter | Short | Description | Default | Required |
|-----------|-------|-------------|---------|----------|
| --target | -t | Target IP or hostname | - | Yes |
| --port | -p | Custom port | Protocol default | No |
| --user-list | -u | Custom username file | config/admin_usernames.txt | No |
| --word-list | -w | Custom password file | config/admin_passwords.txt | No |
| --threads | -T | Parallel threads | 16 (varies) | No |
| --timeout | -o | Connection timeout (sec) | 30 (varies) | No |
| --verbose | -v | Verbose output | false | No |
| --help | -h | Show help | - | No |

### Protocol-Specific Parameters

#### SSH
- `--resume, -r` - Resume interrupted attack
- `--key-auth` - Try key-based authentication

#### FTP
- `--anonymous` - Try anonymous login first
- `--ssl` - Use FTPS (FTP over SSL)

#### Web
- `--path, -P` - Login page path
- `--ssl, -s` - Use HTTPS
- `--user-param, -U` - Username form field
- `--pass-param, -W` - Password form field

#### RDP
- `--domain, -d` - Windows domain name

#### MySQL/PostgreSQL
- `--database, -D` - Database name to connect

#### SMB
- `--domain, -d` - Windows domain/workgroup
- `--guest` - Try guest account

#### Auto Attack
- `--all, -a` - Test all detected services
- `--protocols` - Specific protocols to test
- `--resume, -r` - Resume interrupted scan

---

## Usage Examples

### Example 1: Basic SSH Attack
```bash
# Simple SSH brute-force
bash scripts/ssh_admin_attack.sh -t 192.168.1.100

# With custom wordlist
bash scripts/ssh_admin_attack.sh -t 192.168.1.100 -w rockyou.txt

# High-performance attack
bash scripts/ssh_admin_attack.sh -t 192.168.1.100 -T 64 -o 10
```

### Example 2: Web Admin Testing
```bash
# Auto-detect admin panel
bash scripts/web_admin_attack.sh -t example.com

# WordPress specific
bash scripts/web_admin_attack.sh -t blog.site.com -P /wp-login.php

# Custom HTTPS admin panel
bash scripts/web_admin_attack.sh -t 192.168.1.50 -P /admin -s -p 8443
```

### Example 3: Full Network Assessment
```bash
# Scan entire subnet
bash scripts/admin_auto_attack.sh -t 192.168.1.0/24 -v

# Single target, all services
bash scripts/admin_auto_attack.sh -t server.example.com -a

# Specific protocols only
bash scripts/admin_auto_attack.sh -t 10.0.0.0/24 -p ssh,ftp,web
```

### Example 4: Quick-Use Library
```bash
# Edit target in file, then run
nano Library/ssh_quick.sh  # Change TARGET line
bash Library/ssh_quick.sh

# One-line change for FTP
sed -i 's/TARGET=.*/TARGET="192.168.1.100"/' Library/ftp_quick.sh
bash Library/ftp_quick.sh
```

### Example 5: Comprehensive Audit
```bash
# Step 1: Scan target
bash scripts/target_scanner.sh -t 192.168.1.100 -s full

# Step 2: Auto-attack discovered services
bash scripts/admin_auto_attack.sh -t 192.168.1.100 -a

# Step 3: View results
bash scripts/results_viewer.sh --all

# Step 4: Generate reports
ls -lt reports/  # View generated reports
```

---

## Best Practices

### 1. Always Check VPN
```bash
# Before any attack
bash scripts/vpn_check.sh -v
```

### 2. Start with Quick Scan
```bash
# Identify services first
bash scripts/target_scanner.sh -t [target] -s quick
```

### 3. Use Appropriate Threading
- SSH: 16-32 threads
- FTP: 32-48 threads
- Web: 16-32 threads
- RDP: 4-8 threads (lockout risk)
- Databases: 16-24 threads
- SMB: 8-16 threads

### 4. Monitor Resource Usage
```bash
# Check system during attacks
bash scripts/system_diagnostics.sh
```

### 5. Review Logs Regularly
```bash
# Daily log review
tail -f logs/hydra_$(date +%Y%m%d).log
```

### 6. Generate Reports After Attacks
All attacks auto-generate reports, but review them:
```bash
# View latest report
ls -lt reports/ | head -5
cat reports/attack_report_[protocol]_[timestamp].md
```

---

## Troubleshooting Scripts

### Script Not Found
```bash
# Fix permissions
chmod +x hydra.sh install.sh scripts/*.sh Library/*.sh

# Verify location
ls -la scripts/
ls -la Library/
```

### Hydra Not Working
```bash
# Run auto-fix
bash scripts/auto_fix.sh

# Or use interactive fixer
./fix-hydra.sh
```

### No Results
```bash
# Check if attack succeeded
cat logs/hydra_$(date +%Y%m%d).log | grep "valid password"

# View all results
bash scripts/results_viewer.sh --all
```

### Performance Issues
```bash
# Reduce threads
bash scripts/ssh_admin_attack.sh -t [target] -T 8

# Increase timeout
bash scripts/ssh_admin_attack.sh -t [target] -o 60
```

---

## Additional Resources

- **[Library.md](../Library.md)** - Complete quick-use library guide
- **[USAGE.md](USAGE.md)** - Detailed usage instructions
- **[EXAMPLES.md](EXAMPLES.md)** - Real-world attack examples
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Comprehensive troubleshooting
- **[OPTIMIZATION_GUIDE.md](OPTIMIZATION_GUIDE.md)** - Performance optimization
- **[ATTACK_REPORTS.md](ATTACK_REPORTS.md)** - Report documentation

---

**Last Updated:** January 2026  
**Maintained By:** Hydra-Termux Development Team  
**License:** MIT License
