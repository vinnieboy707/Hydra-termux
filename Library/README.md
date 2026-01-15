# Quick-Use Script Library

This directory contains simplified, one-line-change scripts for easy attacks.

## 📁 What's Inside

12 ready-to-use attack scripts where you only need to change ONE value:

```
Library/
├── ssh_quick.sh           # SSH attacks (port 22)
├── ftp_quick.sh           # FTP attacks (port 21)
├── web_quick.sh           # Web admin attacks (auto-detect)
├── wordpress_quick.sh     # WordPress specific attacks
├── rdp_quick.sh           # Windows RDP attacks (port 3389)
├── mysql_quick.sh         # MySQL database attacks (port 3306)
├── postgres_quick.sh      # PostgreSQL attacks (port 5432)
├── smb_quick.sh           # Windows SMB share attacks (port 445)
├── auto_attack_quick.sh   # Full auto-attack (all services)
├── network_quick.sh       # Network range attacks
├── email_quick.sh         # Email account attacks
└── username_quick.sh      # Single username across protocols
```

## 🚀 How to Use

### Step 1: Pick a Script

Choose based on your target:
- Known SSH? → `ssh_quick.sh`
- Web application? → `web_quick.sh`
- Don't know? → `auto_attack_quick.sh`

### Step 2: Edit ONE Line

Open the script and change the TARGET line:

```bash
# ====== CHANGE THIS LINE ======
TARGET="192.168.1.100"    # Replace with YOUR target
# ==============================
```

### Step 3: Run It!

```bash
bash Library/ssh_quick.sh
```

That's it! The script does everything else automatically.

## 📖 Examples

### Example 1: Attack SSH Server

```bash
# Edit ssh_quick.sh
TARGET="192.168.1.50"

# Run it
bash Library/ssh_quick.sh
```

**Output:**
```
🎯 Starting SSH Attack on 192.168.1.50...
📝 Using common admin credentials
✅ Valid credentials found: root:admin123
```

### Example 2: Attack WordPress Site

```bash
# Edit wordpress_quick.sh
TARGET="myblog.com"

# Run it
bash Library/wordpress_quick.sh
```

**Output:**
```
🎯 Starting WordPress Attack on myblog.com...
📝 Target: /wp-login.php
✅ Valid credentials found: admin:password123
```

### Example 3: Full Network Scan & Attack

```bash
# Edit network_quick.sh
TARGET="192.168.1.0/24"

# Run it
bash Library/network_quick.sh
```

**Output:**
```
🎯 Starting NETWORK RANGE ATTACK on 192.168.1.0/24...
🔍 Scanning network range...
Found 10 hosts with open services
💥 Attacking all discovered hosts...
✅ Network attack complete! Check results/
```

## 🎯 Quick Reference

| Script | Change This | What It Attacks | Speed |
|--------|-------------|-----------------|-------|
| `ssh_quick.sh` | TARGET | SSH servers | Fast |
| `ftp_quick.sh` | TARGET | FTP servers | Fast |
| `web_quick.sh` | TARGET | Web admin panels | Medium |
| `wordpress_quick.sh` | TARGET | WordPress sites | Medium |
| `rdp_quick.sh` | TARGET | Windows RDP | Slow |
| `mysql_quick.sh` | TARGET | MySQL databases | Fast |
| `postgres_quick.sh` | TARGET | PostgreSQL databases | Fast |
| `smb_quick.sh` | TARGET | Windows shares | Medium |
| `auto_attack_quick.sh` | TARGET | All services (auto) | Varies |
| `network_quick.sh` | TARGET | Entire network | Long |
| `email_quick.sh` | EMAIL + TARGET | Email accounts | Fast |
| `username_quick.sh` | USERNAME + TARGET | Multi-protocol | Medium |

## 📊 View Results

After running any script, view results:

```bash
# View all results
bash scripts/results_viewer.sh --all

# View specific protocol
bash scripts/results_viewer.sh --protocol ssh

# Export to CSV
bash scripts/results_viewer.sh --export report.csv --format csv
```

## ⚠️ Important Notes

1. **Legal Use Only:** Only attack systems you own or have permission to test
2. **VPN Required:** Always use VPN for anonymity
3. **Be Patient:** Some attacks take time (especially RDP and network scans)
4. **Check Logs:** All results saved to `logs/` directory

## 🆘 Need Help?

See the main documentation:
- **Full Guide:** `Library.md` in root directory
- **Usage Details:** `docs/USAGE.md`
- **Examples:** `docs/EXAMPLES.md`

## 🔥 Pro Tips

1. **Start Small:** Test single host before network scans
2. **Use Auto-Attack:** When you don't know what's running
3. **Chain Scripts:** Run multiple scripts on same target
4. **Save Results:** Always check results after attacks
5. **Stay Legal:** Document all authorized testing

---

**Remember:** One line change, then run. Simple as that! 🐍

---

## 🚀 Supreme Combo Scripts

Advanced multi-protocol penetration testing scripts that test multiple services simultaneously for comprehensive security assessments.

### Available Supreme Combos

1. **combo_supreme_email_web_db.sh** - Corporate Stack (7 protocols)
   - Email (SMTP, IMAP, POP3) + Web (HTTP, HTTPS) + DB (MySQL, PostgreSQL)
   - Perfect for: Corporate infrastructure, web applications with backend

2. **combo_supreme_cloud_infra.sh** - Cloud Services (8+ protocols)
   - SSH, RDP, MySQL/RDS, PostgreSQL, Redis, MongoDB, API endpoints
   - Perfect for: AWS/Azure/GCP, cloud databases, DevOps environments

3. **combo_supreme_network_complete.sh** - Full Network (10 protocols)
   - SSH, Telnet, FTP, SMB, HTTP, HTTPS, MySQL, PostgreSQL, RDP, VNC
   - Perfect for: Complete network audits, internal infrastructure

4. **combo_supreme_active_directory.sh** - Windows AD (7+ services)
   - LDAP, LDAPS, SMB, RDP, MSSQL, OWA, SharePoint, DNS
   - Perfect for: Windows domains, Active Directory, enterprise environments

5. **combo_supreme_webapp_api.sh** - Web Apps & APIs (10+ interfaces)
   - Login forms, REST APIs, WordPress, Joomla, Drupal, phpMyAdmin, cPanel
   - Perfect for: Web applications, API testing, CMS platforms

### How to Use Supreme Combos

```bash
# 1. Edit the script
nano Library/combo_supreme_email_web_db.sh

# 2. Change the target variables (at the top)
TARGET="corporate.example.com"
EMAIL="admin@corporate.example.com"

# 3. Run the comprehensive test
bash Library/combo_supreme_email_web_db.sh
```

### Comparison: Regular vs Supreme

| Feature | Regular Combos | Supreme Combos |
|---------|---------------|----------------|
| Protocols | 3-4 | 7-10+ |
| Execution Time | 5-15 min | 20-70 min |
| Logging | Basic | Comprehensive |
| Results Format | Simple | Detailed + Summary |
| Recommendations | None | Security guidance |
| Use Case | Quick tests | Professional audits |

### Documentation

For complete details, see: `docs/SUPREME_COMBO_SCRIPTS_GUIDE.md`

- Detailed protocol explanations
- Usage patterns and examples
- Best practices and security tips
- Troubleshooting guide
- Integration with other tools

---
