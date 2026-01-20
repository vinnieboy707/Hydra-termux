# Troubleshooting Runbooks & Standard Operating Procedures

**Version:** 2.0.0  
**Last Updated:** January 2026  
**Criticality Level:** ESSENTIAL

---

## Table of Contents

1. [Emergency Response Procedures](#emergency-response-procedures)
2. [Installation Issues](#installation-issues)
3. [Runtime Errors](#runtime-errors)
4. [Configuration Problems](#configuration-problems)
5. [Performance Issues](#performance-issues)
6. [Network & Connectivity](#network--connectivity)
7. [Platform-Specific Issues](#platform-specific-issues)
8. [Security & VPN Issues](#security--vpn-issues)
9. [Data & Results Management](#data--results-management)
10. [Advanced Diagnostics](#advanced-diagnostics)

---

## Emergency Response Procedures

### 🚨 CRITICAL: System Not Working

**Symptom:** Nothing works, complete failure

**IMMEDIATE ACTION - Run this first:**
```bash
./fix-hydra.sh
```

**What it does:**
- Diagnoses your specific issue
- Provides tailored solutions
- Auto-fixes common problems
- Guides you step-by-step

**If fix-hydra.sh doesn't exist or won't run:**
```bash
chmod +x *.sh scripts/*.sh
bash scripts/auto_fix.sh
```

---

### 🔴 CRITICAL: Hydra Command Not Found

**This is Issue #1 - Without hydra, NOTHING works**

**Priority:** CRITICAL  
**Impact:** Complete system failure  
**Fix Time:** 2-5 minutes

#### Diagnostic Steps

**Step 1: Verify Hydra Installation**
```bash
which hydra
hydra -h
```

**Expected Output:**
```
/data/data/com.termux/files/usr/bin/hydra
Hydra v9.5 (c) 2023 by van Hauser/THC...
```

**If you see:** "command not found" → Hydra is NOT installed

#### Solution 1: Termux Installation (Android)
```bash
# Method 1: Standard installation
pkg update && pkg upgrade -y
pkg install hydra -y

# Method 2: If "package not found"
pkg install root-repo -y
pkg update
pkg install hydra -y

# Method 3: If still failing
pkg install unstable-repo -y
pkg update
pkg install hydra -y

# Verify installation
hydra -h
```

#### Solution 2: Debian/Ubuntu Installation
```bash
sudo apt update
sudo apt install hydra -y

# Verify
hydra -h
```

#### Solution 3: From Source (Last Resort)
```bash
# Install dependencies
pkg install git gcc make libssh-dev -y

# Clone and build
git clone https://github.com/vanhauser-thc/thc-hydra.git
cd thc-hydra
./configure
make
make install

# Verify
hydra -h
```

#### Verification Checklist
- [ ] `which hydra` returns path
- [ ] `hydra -h` shows help
- [ ] `hydra -U` shows available modules
- [ ] Version is 9.x or higher

**If still failing:** See [Advanced Hydra Troubleshooting](#advanced-hydra-troubleshooting)

---

### 🟠 HIGH PRIORITY: Permission Denied Errors

**Symptom:** "Permission denied" when running scripts

**Priority:** HIGH  
**Impact:** Cannot execute scripts  
**Fix Time:** 30 seconds

#### Quick Fix
```bash
# From Hydra-termux directory
chmod +x hydra.sh install.sh fix-hydra.sh
chmod +x scripts/*.sh
chmod +x Library/*.sh

# Verify
ls -la hydra.sh
# Should show: -rwxr-xr-x (executable)
```

#### Deep Fix (If Quick Fix Fails)
```bash
# Fix ownership
chown -R $(whoami) .

# Fix all permissions recursively
find . -type f -name "*.sh" -exec chmod +x {} \;

# Fix directory permissions
chmod 755 scripts/ Library/ config/

# Verify
./hydra.sh
```

#### Prevention
Add to `.bashrc` or `.zshrc`:
```bash
# Auto-fix permissions on cd
cd() {
    builtin cd "$@" && [[ -d "scripts" ]] && chmod +x *.sh scripts/*.sh 2>/dev/null
}
```

---

## Installation Issues

### Issue: Package Not Found

**Error:** `Unable to locate package hydra` or `E: Package 'hydra' has no installation candidate`

#### Termux Solutions

**Solution 1: Enable Required Repositories**
```bash
# Enable root repository (hydra location)
pkg install root-repo -y

# Update package lists
pkg update

# Install hydra
pkg install hydra -y
```

**Solution 2: Alternative Repositories**
```bash
# Try unstable repo if root-repo fails
pkg install unstable-repo -y
pkg update
pkg install hydra -y
```

**Solution 3: Manual Repository Addition**
```bash
# Edit sources
nano $PREFIX/etc/apt/sources.list

# Add these lines:
deb https://packages-cf.termux.org/apt/termux-main stable main
deb https://packages-cf.termux.org/apt/termux-root root stable

# Save and update
pkg update
pkg install hydra -y
```

#### Ubuntu/Debian Solutions

**Solution 1: Standard Installation**
```bash
sudo apt update
sudo apt install hydra -y
```

**Solution 2: Add Universe Repository**
```bash
sudo add-apt-repository universe
sudo apt update
sudo apt install hydra -y
```

**Solution 3: Kali Repositories (Advanced)**
```bash
# Add Kali repo
echo "deb http://http.kali.org/kali kali-rolling main contrib non-free" | sudo tee /etc/apt/sources.list.d/kali.list

# Add Kali GPG key
wget -q -O - https://archive.kali.org/archive-key.asc | sudo apt-key add -

# Update and install
sudo apt update
sudo apt install hydra -y
```

---

### Issue: Dependencies Missing

**Error:** Missing jq, nmap, curl, wget, git, or other dependencies

#### Quick Dependency Installation

**Termux:**
```bash
pkg update && pkg upgrade -y
pkg install hydra git wget curl openssl nmap termux-api figlet jq bc coreutils -y
```

**Debian/Ubuntu:**
```bash
sudo apt update
sudo apt install hydra git wget curl openssl nmap figlet jq bc coreutils -y
```

#### Check Missing Dependencies
```bash
bash scripts/check_dependencies.sh
```

**Output Example:**
```
✓ hydra - INSTALLED (v9.5)
✓ git - INSTALLED (v2.39.0)
✓ wget - INSTALLED (v1.21.3)
✗ jq - MISSING (Install: pkg install jq -y)
✓ nmap - INSTALLED (v7.93)
```

#### Individual Dependency Fixes

**jq (Required for JSON processing):**
```bash
# Termux
pkg install jq -y

# Ubuntu/Debian
sudo apt install jq -y
```

**nmap (Required for target scanning):**
```bash
# Termux
pkg install nmap -y

# Ubuntu/Debian
sudo apt install nmap -y
```

**figlet (Optional, for banners):**
```bash
pkg install figlet -y
```

---

### Issue: Installation Script Fails

**Error:** `install.sh` exits with errors

#### Diagnostic Run
```bash
# Run with verbose output
bash -x install.sh 2>&1 | tee install_debug.log

# Review errors
grep -i error install_debug.log
grep -i failed install_debug.log
```

#### Common Installation Failures

**Failure 1: Storage Full**
```bash
# Check storage
df -h

# Clean package cache
pkg clean

# Remove old logs
rm -rf logs/*.log

# Free up space (move wordlists)
mv wordlists/ ~/storage/downloads/
ln -s ~/storage/downloads/wordlists wordlists
```

**Failure 2: Network Issues**
```bash
# Test connectivity
ping -c 4 8.8.8.8

# Test DNS
nslookup google.com

# Try different mirror
pkg install termux-tools -y
termux-change-repo

# Retry installation
bash install.sh
```

**Failure 3: Interrupted Installation**
```bash
# Clean up
pkg clean
rm -rf $PREFIX/var/lib/apt/lists/*

# Start fresh
pkg update --fix-missing
bash install.sh
```

---

## Runtime Errors

### Issue: "Connection Refused" Errors

**Error:** `connect: Connection refused` or `Unable to connect to target`

#### Diagnosis Steps

**Step 1: Verify Target Reachability**
```bash
# Test basic connectivity
ping -c 4 [target]

# Test specific port
nc -zv [target] [port]

# Example for SSH
nc -zv 192.168.1.100 22
```

**Step 2: Check Service Status**
```bash
# Scan target ports
nmap -p 22,21,80,443,3389,3306,5432,445 [target]

# Quick scan
bash scripts/target_scanner.sh -t [target] -s quick
```

**Step 3: Verify Network Path**
```bash
# Trace route
traceroute [target]

# Check firewall
nmap -Pn [target]  # Skip ping
```

#### Common Causes & Solutions

**Cause 1: Service Not Running**
- **Solution:** Verify service is active on target
- **Alternative:** Try different port or service

**Cause 2: Firewall Blocking**
- **Solution:** Use VPN or different source IP
- **Alternative:** Try different attack vectors

**Cause 3: Target Offline**
- **Solution:** Verify target is online
- **Alternative:** Check target later

**Cause 4: Wrong Port**
- **Solution:** Scan for correct port
```bash
nmap -p- [target]  # Scan all ports
```

---

### Issue: "Timeout" Errors

**Error:** `timeout during connect` or `No response from target`

#### Quick Fixes

**Fix 1: Increase Timeout**
```bash
# Default timeout: 30s, increase to 60s
bash scripts/ssh_admin_attack.sh -t [target] -o 60

# For slow targets, use 120s
bash scripts/ssh_admin_attack.sh -t [target] -o 120
```

**Fix 2: Reduce Thread Count**
```bash
# High threads can cause timeouts
# Reduce from 32 to 8
bash scripts/ssh_admin_attack.sh -t [target] -T 8
```

**Fix 3: Network Optimization**
```bash
# Use WiFi instead of mobile data
# Close bandwidth-heavy apps
# Test connectivity
ping -c 10 [target]
```

#### Advanced Solutions

**For RDP (Slow Protocol):**
```bash
# Use very conservative settings
bash scripts/rdp_admin_attack.sh -t [target] -T 4 -o 90
```

**For Web Services:**
```bash
# Increase timeout, reduce threads
bash scripts/web_admin_attack.sh -t [target] -T 16 -o 45
```

**For Database Services:**
```bash
# Medium settings
bash scripts/mysql_admin_attack.sh -t [target] -T 12 -o 45
```

---

### Issue: "Out of Memory" Errors

**Error:** `Cannot allocate memory` or script crashes

#### Immediate Actions

**Action 1: Free Memory**
```bash
# Close other apps
# Restart Termux
exit
# Reopen Termux

# Check memory
free -h
```

**Action 2: Reduce Resource Usage**
```bash
# Use fewer threads
bash scripts/ssh_admin_attack.sh -t [target] -T 4

# Use smaller wordlists
bash scripts/ssh_admin_attack.sh -t [target] -w config/admin_passwords.txt

# Disable verbose mode
bash scripts/ssh_admin_attack.sh -t [target]  # No -v flag
```

**Action 3: System Optimization**
```bash
# Clear cache
pkg clean

# Remove old logs
rm logs/*.log

# Optimize system
bash scripts/system_optimizer.sh
```

#### Prevention

**1. Monitor Memory Usage**
```bash
# Before attack
free -h

# During attack (separate terminal)
watch -n 5 free -h
```

**2. Use Resource Limits**
```bash
# Limit thread count in config
nano config/hydra.conf
# Set: default_threads=8
```

**3. Close Unused Apps**
- Close browsers
- Close media players
- Close other Termux sessions
- Disable background sync

---

### Issue: No Results Found

**Symptom:** Attack completes but no credentials discovered

**This is NORMAL if:**
- Target has strong passwords
- Target uses key-based auth (SSH)
- Target has account lockout enabled
- Target is properly secured

#### Diagnostic Checklist

**Check 1: Verify Attack Executed**
```bash
# Check logs
cat logs/hydra_$(date +%Y%m%d).log

# Look for attempts
grep "attempt" logs/hydra_$(date +%Y%m%d).log

# Check if target responded
grep "connected" logs/hydra_$(date +%Y%m%d).log
```

**Check 2: Verify Service Accessible**
```bash
# Manual test
ssh root@[target]  # For SSH
ftp [target]        # For FTP
curl http://[target]/admin  # For Web
```

**Check 3: Review Wordlists**
```bash
# Check wordlist size
wc -l config/admin_passwords.txt

# Ensure not empty
cat config/admin_passwords.txt | head -10
```

#### Improvement Strategies

**Strategy 1: Use Better Wordlists**
```bash
# Download comprehensive wordlists
bash scripts/download_wordlists.sh --all

# Use RockYou
bash scripts/ssh_admin_attack.sh -t [target] -w wordlists/rockyou.txt
```

**Strategy 2: Try Different Users**
```bash
# Custom username list
bash scripts/ssh_admin_attack.sh -t [target] -u custom_users.txt
```

**Strategy 3: Target Enumeration**
```bash
# Enumerate valid usernames first
# For SSH - check if user exists
# For Web - check login responses
# For FTP - try anonymous first
```

**Strategy 4: Multiple Attack Vectors**
```bash
# Don't rely on one service
bash scripts/admin_auto_attack.sh -t [target] -a
```

---

## Configuration Problems

### Issue: Config File Not Found

**Error:** `Config file not found: config/hydra.conf`

#### Solution
```bash
# Check config directory
ls -la config/

# If missing, create from template
mkdir -p config

# Create default config
cat > config/hydra.conf << 'EOF'
[GENERAL]
default_threads=16
timeout=30
verbose=false
output_format=json
log_directory=logs
results_directory=results

[SECURITY]
vpn_check=true
vpn_enforce=false
track_ip_rotation=true
min_ip_rotation=0
rate_limit=true
max_attempts=1000
random_delay=true

[WORDLISTS]
default_passwords=config/admin_passwords.txt
admin_passwords=config/admin_passwords.txt
usernames=config/admin_usernames.txt
EOF

# Create default username list
cat > config/admin_usernames.txt << 'EOF'
root
admin
administrator
user
sysadmin
guest
test
ubuntu
centos
debian
EOF

# Create default password list
cat > config/admin_passwords.txt << 'EOF'
admin
password
123456
admin123
root
password123
12345678
qwerty
abc123
letmein
EOF
```

---

### Issue: Invalid Configuration Values

**Error:** Script fails due to config issues

#### Validate Configuration
```bash
# Check config syntax
bash scripts/security_validation.sh

# Manual validation
cat config/hydra.conf

# Look for common issues:
# - Missing closing brackets
# - Invalid values (threads=-1)
# - Wrong paths
# - Typos in keys
```

#### Reset to Defaults
```bash
# Backup current config
cp config/hydra.conf config/hydra.conf.backup

# Download fresh config
wget -O config/hydra.conf https://raw.githubusercontent.com/vinnieboy707/Hydra-termux/main/config/hydra.conf

# Or use manual creation from above
```

---

## Performance Issues

### Issue: Very Slow Attack Speed

**Symptom:** Attack takes too long, minimal progress

#### Performance Diagnostics

**Check 1: Network Speed**
```bash
# Test network
ping -c 50 [target]

# Check for packet loss
# Should be 0% loss
# <10ms = excellent
# 10-50ms = good
# 50-100ms = acceptable
# >100ms = slow (increase timeout)
```

**Check 2: Resource Usage**
```bash
# System diagnostics
bash scripts/system_diagnostics.sh

# CPU usage
top -n 1

# Memory usage
free -h
```

**Check 3: Thread Count**
```bash
# Check current threads
ps aux | grep hydra | wc -l

# Optimal thread counts:
# SSH: 16-32
# FTP: 32-48
# Web: 16-32
# RDP: 4-8 (lockout risk)
# MySQL: 16-24
# SMB: 8-16
```

#### Optimization Solutions

**Solution 1: Optimize Thread Count**
```bash
# For fast network, high-end device
bash scripts/ssh_admin_attack.sh -t [target] -T 64

# For slow network or low-end device
bash scripts/ssh_admin_attack.sh -t [target] -T 8

# Auto-optimization
bash scripts/system_optimizer.sh --auto
```

**Solution 2: Reduce Timeout**
```bash
# For fast, nearby targets
bash scripts/ssh_admin_attack.sh -t [target] -o 10

# For distant but responsive targets
bash scripts/ssh_admin_attack.sh -t [target] -o 20
```

**Solution 3: Network Optimization**
```bash
# Use WiFi, not mobile data
# Disable VPN if affecting speed (use with caution)
# Close bandwidth-heavy apps
# Use wired connection if possible
```

**Solution 4: Wordlist Optimization**
```bash
# Use smaller, targeted wordlist first
bash scripts/ssh_admin_attack.sh -t [target] -w config/admin_passwords.txt

# Then escalate to larger wordlist
bash scripts/ssh_admin_attack.sh -t [target] -w wordlists/rockyou.txt
```

---

### Issue: High Battery Drain

**Symptom:** Device battery drains quickly during attacks

#### Power Management

**Solution 1: Reduce Resource Usage**
```bash
# Lower thread count
bash scripts/ssh_admin_attack.sh -t [target] -T 8

# Disable verbose output
bash scripts/ssh_admin_attack.sh -t [target]  # No -v

# Use longer delays
# Edit config/hydra.conf: random_delay=true
```

**Solution 2: Device Settings**
- Keep Termux in foreground
- Disable screen timeout temporarily
- Lower screen brightness
- Close other apps
- Enable battery saver (may slow attacks)

**Solution 3: Scheduled Attacks**
```bash
# Run during charging
# Use at command for scheduling
echo "bash scripts/ssh_admin_attack.sh -t [target]" | at 22:00
```

---

## Network & Connectivity

### Issue: DNS Resolution Failures

**Error:** `Unable to resolve hostname`

#### Solutions

**Solution 1: Test DNS**
```bash
# Test DNS resolution
nslookup google.com
nslookup [your-target]

# Use IP address instead
bash scripts/ssh_admin_attack.sh -t 192.168.1.100
```

**Solution 2: Change DNS Servers**
```bash
# Termux DNS configuration
# Use Google DNS
echo "nameserver 8.8.8.8" > $PREFIX/etc/resolv.conf
echo "nameserver 8.8.4.4" >> $PREFIX/etc/resolv.conf

# Or Cloudflare DNS
echo "nameserver 1.1.1.1" > $PREFIX/etc/resolv.conf
echo "nameserver 1.0.0.1" >> $PREFIX/etc/resolv.conf
```

**Solution 3: Use /etc/hosts**
```bash
# Add manual DNS entry
echo "192.168.1.100 target.local" >> $PREFIX/etc/hosts

# Test
ping target.local
```

---

### Issue: Network Unreachable

**Error:** `Network is unreachable`

#### Diagnosis

**Check 1: Basic Connectivity**
```bash
# Test internet
ping -c 4 8.8.8.8

# Test DNS
ping -c 4 google.com

# Check routing
ip route show
```

**Check 2: VPN Issues**
```bash
# If using VPN, test without it
bash scripts/vpn_check.sh

# Disconnect VPN temporarily
# Test target reachability
ping [target]
```

**Check 3: Target Network**
```bash
# Check if target is on same subnet
ip addr show

# If different subnet, check gateway
ip route | grep default
```

#### Solutions

**Solution 1: Fix Network Connection**
- Reconnect WiFi
- Switch to mobile data
- Restart network interface
- Restart device

**Solution 2: Route Configuration**
```bash
# Check routes
ip route show

# Add manual route if needed
# ip route add [target-network] via [gateway]
```

**Solution 3: VPN/Proxy Configuration**
```bash
# If VPN required for target access
# Ensure VPN is connected
bash scripts/vpn_check.sh -v
```

---

## Platform-Specific Issues

### Termux-Specific Issues

#### Issue: "Termux API Not Found"

**Solution:**
```bash
# Install Termux:API app from F-Droid
# Install termux-api package
pkg install termux-api -y

# Test
termux-battery-status
```

#### Issue: Storage Permission Denied

**Solution:**
```bash
# Request storage permission
termux-setup-storage

# Grant permission in Android settings
# Settings > Apps > Termux > Permissions > Storage
```

#### Issue: Termux Killed by Android

**Solution:**
- Disable battery optimization for Termux
- Settings > Battery > Battery optimization
- Find Termux > Don't optimize
- Keep Termux in foreground
- Use wake lock
```bash
termux-wake-lock
# Run your commands
termux-wake-unlock
```

#### Issue: Package Architecture Mismatch

**Solution:**
```bash
# Check architecture
uname -m

# Update repositories for correct arch
pkg update --fix-missing
```

---

### Android-Specific Issues

#### Issue: Background Process Killed

**Solution:**
- Disable battery optimization
- Keep screen on during attacks
- Use wake lock
- Run during active use
- Consider split-screen with dummy app

#### Issue: Insufficient Storage

**Solution:**
```bash
# Check storage
df -h $PREFIX

# Clean cache
pkg clean
apt clean

# Move wordlists to external storage
mkdir -p ~/storage/downloads/hydra-wordlists
mv wordlists/* ~/storage/downloads/hydra-wordlists/
ln -s ~/storage/downloads/hydra-wordlists wordlists

# Remove old logs
find logs/ -type f -mtime +7 -delete
```

---

## Security & VPN Issues

### Issue: VPN Not Detected

**Error:** `Warning: VPN not detected`

#### Check VPN Status
```bash
# Run VPN check
bash scripts/vpn_check.sh -v

# Manual checks
ip addr show tun0  # VPN interface
curl ifconfig.me   # Check public IP
```

#### Solutions

**Solution 1: Connect VPN**
- Use VPN app (ProtonVPN, NordVPN, etc.)
- Verify connection
- Re-run attack

**Solution 2: Disable VPN Check**
```bash
# Edit config (USE WITH CAUTION)
nano config/hydra.conf
# Change: vpn_check=false

# Or use command flag
bash scripts/ssh_admin_attack.sh -t [target] --no-vpn-check
```

**Solution 3: Configure VPN Detection**
```bash
# Test VPN interfaces
ip addr show

# Update VPN check script if needed
# Add your VPN interface name
nano scripts/vpn_check.sh
```

---

### Issue: IP Not Rotating

**Symptom:** IP rotation statistics show same IP

#### Solutions

**Solution 1: Verify VPN IP Rotation**
```bash
# Some VPNs don't rotate automatically
# Use VPN with automatic rotation
# Or manually reconnect between attacks
```

**Solution 2: Use Tor (Advanced)**
```bash
# Install Tor
pkg install tor -y

# Start Tor
tor &

# Use proxychains with attacks
# pkg install proxychains-ng -y
# proxychains bash scripts/ssh_admin_attack.sh -t [target]
```

**Solution 3: Script-Based Rotation**
```bash
# Use IP changer script
bash scripts/alhacking_autoipchanger.sh

# Integrate with attacks
# Rotate IP every N attempts
```

---

## Data & Results Management

### Issue: Results Not Saving

**Symptom:** Attack completes but no results file

#### Diagnosis

**Check 1: Results Directory**
```bash
# Verify directory exists
ls -la results/

# Create if missing
mkdir -p results logs reports
```

**Check 2: Permissions**
```bash
# Check write permissions
touch results/test.txt

# Fix permissions if needed
chmod 755 results/ logs/ reports/
```

**Check 3: Disk Space**
```bash
# Check available space
df -h

# Free up space if needed
pkg clean
rm logs/*.log
```

#### Solutions

**Solution 1: Manual Result Check**
```bash
# Check logs for successful credentials
grep "valid password" logs/hydra_$(date +%Y%m%d).log

# Extract credentials manually
grep "host:" logs/hydra_$(date +%Y%m%d).log
```

**Solution 2: Re-run with Explicit Output**
```bash
# Specify output file
bash scripts/ssh_admin_attack.sh -t [target] -o results/manual_results.txt
```

---

### Issue: Cannot View Results

**Symptom:** Results viewer shows no data

#### Solutions

**Solution 1: Check Results Files**
```bash
# List all results
ls -lh results/

# View specific result
cat results/ssh_admin_results_*.json

# Pretty print JSON
cat results/ssh_admin_results_*.json | jq .
```

**Solution 2: Use Alternative Viewer**
```bash
# Direct file viewing
cat results/*.json

# Search for credentials
grep -r "password" results/

# Export to readable format
bash scripts/results_viewer.sh --export all_results.txt --format txt
```

**Solution 3: Check Result Format**
```bash
# Ensure jq is installed
pkg install jq -y

# Validate JSON
cat results/ssh_admin_results_*.json | jq . > /dev/null
echo $?  # Should be 0 if valid
```

---

## Advanced Diagnostics

### Complete System Health Check

```bash
# Run full diagnostics
bash scripts/system_diagnostics.sh -v

# Check specific components
bash scripts/check_dependencies.sh
bash scripts/vpn_check.sh -v
bash scripts/security_validation.sh
```

### Debug Mode Execution

```bash
# Run script with debug output
bash -x scripts/ssh_admin_attack.sh -t [target] 2>&1 | tee debug.log

# Review debug log
less debug.log

# Search for errors
grep -i error debug.log
grep -i fail debug.log
```

### Log Analysis

```bash
# View today's logs
tail -100 logs/hydra_$(date +%Y%m%d).log

# Search for specific issues
grep "connection refused" logs/*.log
grep "timeout" logs/*.log
grep "error" logs/*.log

# Count attempts
grep "attempt" logs/*.log | wc -l

# Find successful logins
grep "valid password" logs/*.log
```

### Network Diagnostics

```bash
# Full network test
ping -c 10 8.8.8.8
traceroute google.com
nslookup google.com

# Port scanning
nmap -sV [target]
nmap -O [target]  # OS detection

# Advanced scan
bash scripts/target_scanner.sh -t [target] -s full
```

---

## Getting Help

### Self-Service Resources

1. **Interactive Fix Tool**
   ```bash
   ./fix-hydra.sh
   ```

2. **System Diagnostics**
   ```bash
   bash scripts/system_diagnostics.sh
   ```

3. **Help System**
   ```bash
   bash scripts/help.sh
   ```

4. **Documentation**
   - [README.md](../README.md)
   - [USAGE.md](USAGE.md)
   - [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
   - [EXAMPLES.md](EXAMPLES.md)

### Community Support

1. **GitHub Issues**
   - Search existing: https://github.com/vinnieboy707/Hydra-termux/issues
   - Create new issue with:
     - Clear problem description
     - Steps to reproduce
     - System information (`uname -a`)
     - Error logs
     - Screenshot if applicable

2. **Discussion Forum**
   - GitHub Discussions
   - Community Q&A

### Professional Support

For enterprise or professional support:
- See [PRICING_QUOTES.md](PRICING_QUOTES.md)
- Contact via GitHub

---

## Preventive Maintenance

### Weekly Tasks

```bash
# Update packages
pkg update && pkg upgrade -y

# Clean cache
pkg clean

# Update wordlists
bash scripts/download_wordlists.sh --update

# Check system health
bash scripts/system_diagnostics.sh
```

### Monthly Tasks

```bash
# Full system check
bash scripts/system_diagnostics.sh -v

# Archive old logs
mkdir -p logs/archive
mv logs/hydra_*.log logs/archive/

# Update repository
cd ~/Hydra-termux
git pull

# Review security
bash scripts/security_validation.sh
```

### Best Practices

1. **Always use VPN** for anonymity
2. **Monitor system resources** during attacks
3. **Keep logs** for at least 30 days
4. **Regular updates** to tools and wordlists
5. **Backup configurations** before changes
6. **Test on known targets** before real operations
7. **Review reports** after each attack
8. **Document findings** professionally

---

**Last Updated:** January 2026  
**Maintained By:** Hydra-Termux Development Team  
**Support:** https://github.com/vinnieboy707/Hydra-termux/issues
