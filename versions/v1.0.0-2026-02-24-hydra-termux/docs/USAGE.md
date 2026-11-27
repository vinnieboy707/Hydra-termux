# Hydra-Termux Usage Guide

Complete guide for using Hydra-Termux Ultimate Edition.

## 🆘 **HAVING PROBLEMS?**

**Run this first:**
```bash
./fix-hydra.sh
```

One command to diagnose and fix 99% of issues!

---

## Table of Contents

- [Getting Started](#getting-started)
- [Diagnostic Tools](#diagnostic-tools-new)
- [Attack Scripts](#attack-scripts)
- [Utility Scripts](#utility-scripts)
- [Configuration](#configuration)
- [Advanced Usage](#advanced-usage)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Getting Started

### First-Time Setup

**Option 1: Interactive Setup Wizard (Recommended)**
```bash
bash scripts/setup_wizard.sh
```
Guides you through complete setup step-by-step.

**Option 2: Manual Start**
```bash
cd Hydra-termux
./hydra.sh
```

### Verify Installation

**Check if everything is working:**
```bash
bash scripts/system_diagnostics.sh
```

Shows system health score (A-F) and identifies any issues.

### Download Wordlists

Before running attacks, download wordlists:

1. From main menu, select option `9` (Download Wordlists)
2. Or run directly:
   ```bash
   bash scripts/download_wordlists.sh --all
   ```

This downloads common password lists from SecLists.

---

## Diagnostic Tools (NEW!)

### 1. fix-hydra.sh - One-Command Fix

**Fastest way to solve any problem:**
```bash
./fix-hydra.sh
```

Interactive menu helps you:
- Auto-install hydra
- Fix permissions
- Run diagnostics
- View troubleshooting

### 2. help.sh - Interactive Help Center

**Get problem-specific solutions:**
```bash
bash scripts/help.sh
```

Choose your issue from menu:
1. Hydra not installed
2. Scripts won't run
3. Attacks fail
4. Installation problems
5. Performance issues
6. Run full diagnostics
7. Show all help tools

### 3. system_diagnostics.sh - Health Check

**Comprehensive system analysis:**
```bash
bash scripts/system_diagnostics.sh
```

Provides:
- Health score (0-100, A-F grade)
- Detailed issue detection
- Specific recommendations
- Performance analysis
- Security assessment

### 4. auto_fix.sh - Automatic Repair

**Tries 5 different methods to install hydra:**
```bash
bash scripts/auto_fix.sh
```

Attempts:
1. Package manager installation
2. Alternative package names
3. Source compilation
4. Pre-built binaries
5. Manual troubleshooting

### 5. check_dependencies.sh - Quick Check

**Fast dependency verification:**
```bash
bash scripts/check_dependencies.sh
```

Lists:
- ✅ Installed tools
- ❌ Missing required tools
- ⚠️ Missing optional tools
- 🔧 How to fix each issue

### 6. setup_wizard.sh - Guided Setup

**Interactive first-time installation:**
```bash
bash scripts/setup_wizard.sh
```

Steps:
1. System compatibility check
2. Automatic installation
3. Verification & testing

---

## Attack Scripts

### 1. SSH Admin Attack

Brute-force SSH services targeting admin accounts.

**Basic usage:**
```bash
bash scripts/ssh_admin_attack.sh -t 192.168.1.100
```

**With custom options:**
```bash
bash scripts/ssh_admin_attack.sh -t 192.168.1.100 \
  -p 2222 \
  -u usernames.txt \
  -w passwords.txt \
  -T 32 \
  -v
```

**Options:**
- `-t, --target` : Target IP or hostname (required)
- `-p, --port` : SSH port (default: 22)
- `-u, --user-list` : Custom username file
- `-w, --word-list` : Custom password file
- `-T, --threads` : Parallel threads (default: 16)
- `-o, --timeout` : Connection timeout (default: 30s)
- `-r, --resume` : Resume previous attack
- `-v, --verbose` : Verbose output

**Features:**
- Auto-tries common usernames (root, admin, administrator)
- Multiple wordlist support
- Resume interrupted attacks
- Real-time progress feedback

### 2. FTP Admin Attack

Attack FTP services on port 21.

**Basic usage:**
```bash
bash scripts/ftp_admin_attack.sh -t 192.168.1.100
```

**Options:** Same as SSH attack

**Features:**
- Common FTP usernames (ftp, ftpuser, ftpadmin)
- Connection timeout handling
- Anonymous login detection

### 3. Web Admin Attack

Attack web admin panels (HTTP/HTTPS).

**Basic usage:**
```bash
bash scripts/web_admin_attack.sh -t example.com
```

**Attack WordPress:**
```bash
bash scripts/web_admin_attack.sh -t example.com -P /wp-login.php -s
```

**Attack with custom failure string:**
```bash
bash scripts/web_admin_attack.sh -t 192.168.1.100 \
  -P /admin \
  -m POST \
  -f "Login failed"
```

**Options:**
- `-P, --path` : Login path (default: /admin)
- `-m, --method` : HTTP method: GET or POST
- `-s, --ssl` : Use HTTPS
- `-f, --fail-string` : Failure detection string

**Features:**
- Auto-detects admin panels
- Supports common CMS (WordPress, Joomla, Drupal)
- Custom form parameter support
- Session handling

### 4. RDP Admin Attack

Attack Windows RDP (port 3389).

**Basic usage:**
```bash
bash scripts/rdp_admin_attack.sh -t 192.168.1.100
```

**With domain:**
```bash
bash scripts/rdp_admin_attack.sh -t 192.168.1.100 -d WORKGROUP
```

**Options:**
- `-d, --domain` : Windows domain name
- `-T, --threads` : Threads (default: 4, low to avoid lockouts)

**Features:**
- Windows-specific usernames
- Rate limiting to prevent lockouts
- Domain/workgroup support

### 5. MySQL Admin Attack

Attack MySQL databases.

**Basic usage:**
```bash
bash scripts/mysql_admin_attack.sh -t 192.168.1.100
```

**Custom port:**
```bash
bash scripts/mysql_admin_attack.sh -t 192.168.1.100 -p 3307
```

**Features:**
- Database usernames (root, admin, mysql)
- Connection string generation
- Multiple database support

### 6. PostgreSQL Admin Attack

Attack PostgreSQL databases.

**Basic usage:**
```bash
bash scripts/postgres_admin_attack.sh -t 192.168.1.100
```

**With database name:**
```bash
bash scripts/postgres_admin_attack.sh -t 192.168.1.100 -d mydb
```

**Options:**
- `-d, --database` : Database name (default: postgres)

### 7. SMB Admin Attack

Attack Windows SMB/CIFS shares.

**Basic usage:**
```bash
bash scripts/smb_admin_attack.sh -t 192.168.1.100
```

**With domain:**
```bash
bash scripts/smb_admin_attack.sh -t 192.168.1.100 -d WORKGROUP
```

**Features:**
- SMB/CIFS protocol support
- Domain authentication
- Share enumeration

### 8. Multi-Protocol Auto Attack

Automated reconnaissance and attack chain.

**Basic usage:**
```bash
bash scripts/admin_auto_attack.sh -t 192.168.1.100
```

**Full scan with report:**
```bash
bash scripts/admin_auto_attack.sh -t 192.168.1.100 \
  -s full \
  -r \
  -v
```

**Options:**
- `-s, --scan-type` : Scan type: fast, full, aggressive
- `-r, --report` : Generate HTML report
- `-o, --output` : Output directory

**Features:**
- Nmap port scanning
- Service identification
- Automatic attack selection
- HTML report generation
- Sequential attack execution

## Utility Scripts

### Download Wordlists

Download password lists from SecLists.

**Download all:**
```bash
bash scripts/download_wordlists.sh --all
```

**List available:**
```bash
bash scripts/download_wordlists.sh --list
```

**Custom directory:**
```bash
bash scripts/download_wordlists.sh --all --dir /path/to/wordlists
```

### Wordlist Generator

Create custom password wordlists.

**Combine multiple files:**
```bash
bash scripts/wordlist_generator.sh \
  --combine \
  --input file1.txt,file2.txt,file3.txt \
  --output combined.txt
```

**Remove duplicates:**
```bash
bash scripts/wordlist_generator.sh \
  --dedupe \
  --input passwords.txt \
  --output unique.txt
```

**Filter by length:**
```bash
bash scripts/wordlist_generator.sh \
  --input passwords.txt \
  --output filtered.txt \
  --min-length 8 \
  --max-length 16
```

**Sort by strength:**
```bash
bash scripts/wordlist_generator.sh \
  --sort \
  --input passwords.txt \
  --output sorted.txt
```

### Target Scanner

Quick nmap wrapper for reconnaissance.

**Quick scan:**
```bash
bash scripts/target_scanner.sh -t 192.168.1.100
```

**Full scan:**
```bash
bash scripts/target_scanner.sh -t 192.168.1.100 -s full
```

**Aggressive scan:**
```bash
bash scripts/target_scanner.sh -t 192.168.1.100 -s aggressive
```

**Custom ports:**
```bash
bash scripts/target_scanner.sh -t 192.168.1.100 -p 1-1000
```

**Scan types:**
- `quick` - Fast scan (top 100 ports)
- `full` - Complete scan (all 65535 ports)
- `stealth` - SYN stealth scan
- `aggressive` - OS detection and service versioning

### Results Viewer

View and manage attack results.

**View all results:**
```bash
bash scripts/results_viewer.sh --all
```

**Filter by protocol:**
```bash
bash scripts/results_viewer.sh --protocol ssh
```

**Filter by target:**
```bash
bash scripts/results_viewer.sh --target 192.168.1.100
```

**Export to CSV:**
```bash
bash scripts/results_viewer.sh --export results.csv --format csv
```

**Export to JSON:**
```bash
bash scripts/results_viewer.sh --export results.json --format json
```

**Clear old results:**
```bash
bash scripts/results_viewer.sh --clear
```

## Configuration

### Main Configuration File

Edit `config/hydra.conf`:

```ini
[GENERAL]
default_threads=16        # Default thread count
timeout=30                # Connection timeout
verbose=true              # Verbose output
output_format=json        # Output format
log_directory=~/hydra-logs

[SECURITY]
vpn_check=true           # Check VPN before attack
rate_limit=true          # Enable rate limiting
max_attempts=1000        # Maximum attempts per target
random_delay=true        # Random delay between attempts

[WORDLISTS]
default_passwords=~/wordlists/common_passwords.txt
admin_passwords=~/wordlists/admin_passwords.txt
usernames=~/wordlists/admin_usernames.txt
```

### Custom Usernames

Edit `config/admin_usernames.txt`:

```
root
admin
administrator
[add your usernames]
```

### Custom Passwords

Edit `config/admin_passwords.txt`:

```
password123
admin123
[add your passwords]
```

## Advanced Usage

### Resume Interrupted Attacks

SSH attacks support resume:

```bash
# Start attack
bash scripts/ssh_admin_attack.sh -t 192.168.1.100

# If interrupted, resume
bash scripts/ssh_admin_attack.sh -t 192.168.1.100 --resume
```

### Chain Multiple Attacks

Use bash scripting:

```bash
#!/bin/bash
targets=("192.168.1.100" "192.168.1.101" "192.168.1.102")

for target in "${targets[@]}"; do
    echo "Attacking $target..."
    bash scripts/ssh_admin_attack.sh -t "$target"
    sleep 5
done
```

### Custom Wordlist Pipeline

Create targeted wordlists:

```bash
# Download base lists
bash scripts/download_wordlists.sh --all

# Combine
bash scripts/wordlist_generator.sh \
  --combine \
  --input ~/wordlists/common_passwords.txt,~/wordlists/admin_default.txt \
  --output combined.txt

# Remove duplicates
bash scripts/wordlist_generator.sh \
  --dedupe \
  --input combined.txt \
  --output unique.txt

# Filter by length
bash scripts/wordlist_generator.sh \
  --input unique.txt \
  --output final.txt \
  --min-length 6 \
  --max-length 20

# Use in attack
bash scripts/ssh_admin_attack.sh -t 192.168.1.100 -w final.txt
```

### Automated Reconnaissance

Full recon pipeline:

```bash
# Step 1: Scan
bash scripts/target_scanner.sh -t 192.168.1.100 -s full

# Step 2: Auto attack
bash scripts/admin_auto_attack.sh -t 192.168.1.100 -r

# Step 3: View results
bash scripts/results_viewer.sh --all

# Step 4: Export
bash scripts/results_viewer.sh --export report.csv --format csv
```

## Best Practices

### Before Testing

1. **Always use VPN** for anonymity
2. **Get written permission** to test targets
3. **Document authorization** and scope
4. **Verify target is correct**
5. **Test from safe environment**

### During Testing

1. **Start with quick scans** before full attacks
2. **Use lower thread counts** to avoid detection
3. **Monitor logs** for errors
4. **Save results regularly**
5. **Be patient** - attacks take time

### After Testing

1. **Document all findings**
2. **Export results** for reports
3. **Clean up logs** if needed
4. **Report vulnerabilities** responsibly
5. **Secure found credentials**

### Performance Tips

1. Use WiFi instead of mobile data
2. Close other apps to free memory
3. Keep Termux in foreground
4. Use smaller wordlists first
5. Reduce threads on slow connections
6. Enable verbose only for debugging

### Security Tips

1. Always check VPN connection
2. Use random delays between attempts
3. Limit maximum attempts
4. Don't attack production systems
5. Rotate attack patterns
6. Monitor for defensive responses

## Troubleshooting

See main README.md troubleshooting section.

## See Also

- [EXAMPLES.md](EXAMPLES.md) - Real-world examples
- [README.md](../README.md) - Main documentation
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contributing guide


---

## Troubleshooting

### Quick Diagnostic Commands

**Having any issues? Start here:**

```bash
# ONE command to fix most issues:
./fix-hydra.sh

# Full system health check:
bash scripts/system_diagnostics.sh

# Auto-repair installation:
bash scripts/auto_fix.sh

# Interactive help:
bash scripts/help.sh

# Quick dependency check:
bash scripts/check_dependencies.sh
```

### Common Issues

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions to:
- Hydra not installed
- Permission errors
- Installation failures
- Attack failures
- Performance issues
- Network connectivity
- And much more...

### Getting Help

1. Run `./fix-hydra.sh` - solves 99% of issues
2. Read `docs/TROUBLESHOOTING.md` - comprehensive 10,000+ word guide
3. Open GitHub issue with diagnostic output

---

