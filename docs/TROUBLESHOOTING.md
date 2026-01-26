# Hydra-Termux Troubleshooting Guide

This guide helps diagnose and fix common issues with Hydra-Termux.

## 🔍 Quick Diagnosis

**First step: Run the dependency checker**

```bash
bash scripts/check_dependencies.sh
```

This will identify missing dependencies and provide specific fix instructions.

---

## 🚨 Critical Issue: "Hydra Not Found" or "Command Not Found: hydra"

### Symptoms
- Error message: "Hydra is not installed"
- Scripts fail immediately when run
- Main launcher shows error about missing hydra
- No attacks work at all

### Root Cause
The hydra tool (THC-Hydra) is not installed on your system. **This is the most common issue.**

### Solution

#### On Termux (Android)

1. **Update package repositories first:**
   ```bash
   pkg update
   pkg upgrade -y
   ```

2. **Install hydra:**
   ```bash
   pkg install hydra -y
   ```

3. **Verify installation:**
   ```bash
   hydra -h
   ```
   
   You should see hydra's help message. If you get "command not found", continue to advanced steps.

4. **If hydra package is not found, compile from source:**
   ```bash
   # Install build dependencies
   pkg install git make clang -y
   
   # Clone THC-Hydra
   git clone https://github.com/vanhauser-thc/thc-hydra
   cd thc-hydra
   
   # Configure and build
   ./configure
   make
   make install
   ```

#### On Linux/Unix

**Debian/Ubuntu:**
```bash
sudo apt update
sudo apt install hydra -y
```

**Fedora/RHEL/CentOS:**
```bash
sudo dnf install hydra -y
# or on older systems:
sudo yum install hydra -y
```

**Arch Linux:**
```bash
sudo pacman -S hydra
```

**macOS (with Homebrew):**
```bash
brew install hydra
```

#### Verify Fix

After installing, verify with:
```bash
bash scripts/check_dependencies.sh
```

All required dependencies should show ✅ green checkmarks.

---

## ⚠️ Issue: Scripts Won't Execute / Permission Denied

### Symptoms
- Error: "Permission denied"
- Scripts don't run when called
- `./hydra.sh` fails with permission error

### Solution

Make scripts executable:
```bash
cd Hydra-termux
chmod +x hydra.sh install.sh
chmod +x scripts/*.sh
chmod +x scripts/*.sh
```

Verify permissions:
```bash
ls -la hydra.sh
# Should show: -rwxr-xr-x (execute permission)
```

---

## 📦 Issue: Package Installation Fails

### Symptoms
- "Package not found" errors during install.sh
- Some tools install, others fail
- Installation completes but tools missing

### Solution

#### Termux-Specific

1. **Clear package cache:**
   ```bash
   pkg clean
   ```

2. **Update repository metadata:**
   ```bash
   pkg update
   ```

3. **Try installing problematic package individually:**
   ```bash
   pkg install hydra
   ```

4. **Check if package exists in repo:**
   ```bash
   pkg search hydra
   ```

5. **If package truly doesn't exist, compile from source** (see hydra section above)

#### General Linux

1. **Update package lists:**
   ```bash
   sudo apt update
   # or
   sudo dnf check-update
   ```

2. **Enable necessary repositories:**
   
   For Debian/Ubuntu, you may need universe repository:
   ```bash
   sudo add-apt-repository universe
   sudo apt update
   ```

3. **Try alternative package manager:**
   ```bash
   # If apt fails, try snap:
   sudo snap install hydra
   ```

---

## 🌐 Issue: VPN Check Fails / VPN Warning

### Symptoms
- Warning: "VPN not detected"
- Scripts prompt about VPN
- Cannot proceed without VPN

### Solution

**If you have a VPN:**
1. Connect to your VPN first
2. Verify connection: Check your IP with `curl ifconfig.me`
3. Run scripts again

**If testing on local network (no VPN needed):**
```bash
# Skip VPN check with --skip-vpn flag
bash scripts/ssh_admin_attack.sh -t 192.168.1.100 --skip-vpn
```

**For Library scripts, edit the file:**
```bash
nano scripts/ssh_quick.sh

# Change line near top:
SKIP_VPN="--skip-vpn"
```

---

## 📂 Issue: "Script not found" or "File not found"

### Symptoms
- Error: "scripts/ssh_admin_attack.sh: No such file or directory"
- Menu options fail to launch scripts
- Scripts can't find other scripts

### Solution

1. **Ensure you're in the correct directory:**
   ```bash
   cd Hydra-termux
   pwd
   # Should show: /path/to/Hydra-termux
   ```

2. **Verify script files exist:**
   ```bash
   ls scripts/
   # Should list all attack scripts
   ```

3. **If files are missing, re-clone the repository:**
   ```bash
   cd ..
   rm -rf Hydra-termux
   git clone https://github.com/vinnieboy707/Hydra-termux
   cd Hydra-termux
   bash install.sh
   ```

---

## 💾 Issue: No Results / Results Not Saving

### Symptoms
- Attacks run but no results shown
- Results viewer shows empty
- JSON files are empty or missing

### Solution

1. **Check logs directory exists:**
   ```bash
   mkdir -p logs results
   ```

2. **Verify write permissions:**
   ```bash
   ls -la logs/
   # Should be writable by your user
   ```

3. **Check for results manually:**
   ```bash
   ls -la logs/
   cat logs/hydra_$(date +%Y%m%d).log
   cat logs/results_$(date +%Y%m%d).json
   ```

4. **Run with verbose mode to see what's happening:**
   ```bash
   bash scripts/ssh_admin_attack.sh -t TARGET -v
   ```

---

## 🎯 Issue: Attacks Always Fail / No Credentials Found

### Symptoms
- All attacks fail immediately
- No credentials ever found
- Connection errors or timeouts

### Diagnosis & Solutions

**Test 1: Verify target is reachable**
```bash
ping -c 3 TARGET_IP
```

If ping fails, target is offline or unreachable.

**Test 2: Check if service is running**
```bash
# For SSH:
nmap -p 22 TARGET_IP

# General scan:
nmap TARGET_IP
```

If nmap shows "closed" or "filtered", the service isn't accessible.

**Test 3: Manual connection test**
```bash
# For SSH:
ssh user@TARGET_IP

# For FTP:
ftp TARGET_IP

# For MySQL:
mysql -h TARGET_IP -u root -p
```

If manual connection fails, fix network/firewall issues before running attacks.

**Common Causes:**

1. **Wrong target IP/hostname**
   - Double-check IP address
   - Try using IP instead of hostname (or vice versa)

2. **Firewall blocking connections**
   - Target may have firewall enabled
   - Your network may block outbound connections
   - Try from different network

3. **Wrong port**
   - Service may be on non-standard port
   - Use nmap to scan: `nmap -p- TARGET_IP`

4. **Service not running**
   - SSH/FTP/etc. may not be running on target
   - Verify with nmap

5. **Account lockout policy**
   - After too many failed attempts, account locks
   - Wait 30+ minutes before retrying
   - Use slower attack: `-T 4 -o 60`

6. **Rate limiting / IDS**
   - Intrusion Detection System may be blocking
   - Reduce threads: `-T 4`
   - Add delays between attempts

7. **Wrong credentials in wordlist**
   - Try different wordlist
   - Generate custom wordlist with: `bash scripts/wordlist_generator.sh`
   - Download larger wordlists: `bash scripts/download_wordlists.sh`

---

## 🐌 Issue: Attacks Are Very Slow

### Symptoms
- Scripts run for hours without results
- Progress is extremely slow
- System becomes unresponsive

### Solution

**Reduce thread count:**
```bash
bash scripts/ssh_admin_attack.sh -t TARGET -T 8
# Instead of default 32 threads
```

**Reduce timeout:**
```bash
bash scripts/ssh_admin_attack.sh -t TARGET -o 10
# Instead of default 15 seconds
```

**Use smaller wordlist first:**
```bash
# Test with small list first
bash scripts/ssh_admin_attack.sh -t TARGET -w config/admin_passwords.txt
```

**Close other apps (Termux):**
- Free up RAM
- Keep Termux in foreground
- Connect to WiFi (not mobile data)

---

## 🔒 Issue: SSL/TLS Connection Errors

### Symptoms
- "SSL handshake failed"
- "Certificate verification failed"
- HTTPS attacks fail

### Solution

1. **Ensure openssl is installed:**
   ```bash
   pkg install openssl -y
   ```

2. **Update CA certificates:**
   ```bash
   pkg install ca-certificates -y
   ```

3. **For web attacks, try HTTP instead of HTTPS:**
   ```bash
   # Instead of https://target.com
   bash scripts/web_admin_attack.sh -t http://target.com
   ```

---

## 📱 Issue: Termux-Specific Problems

### "Battery optimization is killing Termux"

**Solution:**
1. Go to Android Settings
2. Apps → Termux
3. Battery → Battery Optimization
4. Select "Don't optimize"

### "Wake lock" for long attacks

```bash
# Acquire wake lock before starting
termux-wake-lock

# Run your attack
bash scripts/ssh_admin_attack.sh -t TARGET

# Release when done
termux-wake-unlock
```

### "Storage permission denied"

```bash
# Request storage permission
termux-setup-storage

# Grant permission in Android prompt
```

---

## 🆘 Getting Help

### Before Asking for Help

1. **Run the dependency checker:**
   ```bash
   bash scripts/check_dependencies.sh
   ```

2. **Check the logs:**
   ```bash
   tail -f logs/hydra_$(date +%Y%m%d).log
   ```

3. **Search existing issues:**
   https://github.com/vinnieboy707/Hydra-termux/issues

### Creating an Issue

Include this information:

1. **Output of dependency checker:**
   ```bash
   bash scripts/check_dependencies.sh > diagnosis.txt 2>&1
   ```

2. **Your environment:**
   - OS: Termux / Linux / macOS
   - Android version (if Termux)
   - Termux version
   - Output of: `pkg --version` or `uname -a`

3. **Command you ran:**
   ```
   Exact command that failed
   ```

4. **Error message:**
   ```
   Full error output (copy/paste)
   ```

5. **What you've tried:**
   - List troubleshooting steps already attempted

---

## 📚 Additional Resources

- **README.md** - Overview and quick start
- **docs/USAGE.md** - Detailed usage guide
- **docs/EXAMPLES.md** - Real-world examples
- **docs/TERMUX_DEPLOYMENT.md** - Termux-specific guide
- **QUICKSTART.md** - 5-minute quick start
- **Library.md** - One-line-change scripts

---

## ✅ Verification Checklist

After troubleshooting, verify everything works:

- [ ] `bash scripts/check_dependencies.sh` shows all ✅
- [ ] `hydra -h` displays help message
- [ ] `./hydra.sh` launches main menu without errors
- [ ] Can run test attack: `bash scripts/ssh_admin_attack.sh --help`
- [ ] Logs directory exists: `ls logs/`
- [ ] Results directory exists: `ls results/`

---

**Still having issues?** Open an issue on GitHub with details from the "Getting Help" section.
