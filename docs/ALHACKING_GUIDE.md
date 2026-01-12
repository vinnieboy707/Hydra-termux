# ALHacking Tools Integration Guide

## Overview

Hydra-Termux now includes 18 powerful tools from the ALHacking suite, providing expanded capabilities for penetration testing, information gathering, and security research.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Tool Categories](#tool-categories)
3. [Installation & Setup](#installation--setup)
4. [Tool Descriptions](#tool-descriptions)
5. [Usage Examples](#usage-examples)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Quick Start

### First Time Setup

1. **Install Dependencies** (Option 20)
   ```bash
   # From main menu, select option 20
   # This installs git, python, pip, curl, and updates system
   ```

2. **Choose Your Tool** (Options 21-37)
   - Tools auto-download on first use
   - Installed in `Tools/` directory
   - No manual configuration needed

3. **Get Help**
   - Option 36: ALHacking video tutorial
   - Option 18: General documentation
   - This file: Detailed tool descriptions

## Tool Categories

### 🎣 Phishing & Social Engineering

**Option 21: Phishing Tool (zphisher)**
- Advanced phishing framework
- 30+ templates (Instagram, Facebook, Google, etc.)
- Automatic credential capture
- Custom page creation

**Option 22: WebCam Hack (CamPhish)**
- Camera phishing attacks
- Image/video capture
- Location tracking
- Multiple templates

**Option 33: Facebash**
- Facebook account brute force
- Proxy support
- Custom wordlist support
- Tor integration recommended

**Option 32: BadMod**
- Instagram brute force tool
- PHP-based
- Fast credential testing
- Error handling

### 🔍 Information Gathering

**Option 26: IP Info (track-ip)**
- IP address geolocation
- ISP information
- Organization lookup
- Interactive interface

**Option 23: Subscan**
- Subdomain enumeration
- Fast scanning
- DNS record lookup
- Export results

**Option 27: dorks-eye**
- Google dorking automation
- Predefined dork lists
- Custom dork support
- Result filtering

**Option 29: RED_HAWK**
- Comprehensive website scanner
- WHOIS lookup
- DNS analysis
- Cloudflare detection
- CMS detection

**Option 31: Info-Site**
- Website information gathering
- SSL certificate info
- Server headers
- Technology stack detection

**Option 28: HackerPro**
- All-in-one pentesting tool
- 15+ modules
- Network scanning
- Exploitation tools

**Option 34: DARKARMY**
- Multi-purpose hacking suite
- Information gathering
- Attack tools
- Utility features

### ⚔️ Attack Tools

**Option 25: DDOS Attack (DDoS-Ripper)**
- Layer 4/7 DDoS attacks
- Multiple attack methods
- Configurable threads
- ⚠️ **Use VPN/Proxy before using!**

**Option 24: Gmail Bomber**
- Email bombing tool
- Multiple providers
- Fast delivery
- ⚠️ **Educational purposes only!**

### 🛠️ Utilities

**Option 20: Requirements & Update**
- Install all dependencies
- Update system packages
- Python, git, curl installation
- Run this first!

**Option 35: AUTO-IP-CHANGER**
- Automatic Tor IP rotation
- SOCKS proxy setup
- Browser integration
- Requires ROOT access

**Option 36: ALHacking Help**
- Opens YouTube tutorial
- Step-by-step guide
- Tool demonstrations

**Option 37: Uninstall Tools**
- Remove all ALHacking tools
- Clean up Tools/ directory
- Free disk space

## Installation & Setup

### System Requirements

**Minimum:**
- Termux on Android OR Linux system
- 2GB free storage
- Active internet connection
- Python 3.x
- Git

**Recommended:**
- 4GB+ free storage
- Stable internet
- VPN for attack tools
- Root access (for some tools)

### Step-by-Step Installation

1. **Update Hydra-Termux**
   ```bash
   bash hydra.sh
   # Select option 17
   ```

2. **Install ALHacking Dependencies**
   ```bash
   # From main menu
   # Select option 20
   # Wait for completion
   ```

3. **Test Installation**
   ```bash
   # Try a safe tool first
   # Select option 26 (IP Info)
   # Enter any IP address
   ```

4. **Download Wordlists (for brute force tools)**
   ```bash
   # Select option 9
   # Download all wordlists
   ```

## Tool Descriptions

### Detailed Tool Information

#### 21. Phishing Tool (zphisher)

**Purpose:** Create convincing phishing pages

**Features:**
- 30+ pre-built templates
- Automatic credential capture
- Custom page support
- Cloudflare bypass

**Usage:**
1. Select option 21
2. Choose template
3. Start server
4. Share link with target
5. Captured credentials saved

**Files:**
- Tool location: `Tools/zphisher/`
- Credentials: Check tool output

#### 22. WebCam Hack (CamPhish)

**Purpose:** Capture images/video via phishing

**Features:**
- Camera access phishing
- Location tracking
- Multiple templates
- Mobile-friendly

**Usage:**
1. Select option 22
2. Choose template
3. Start server
4. Share link
5. Images saved locally

#### 23. Subscan

**Purpose:** Discover subdomains

**Usage:**
1. Select option 23
2. Enter domain (e.g., example.com)
3. Wait for scan
4. Review discovered subdomains

**Example:**
```
Enter domain: example.com
Found:
- www.example.com
- mail.example.com
- ftp.example.com
```

#### 24. Gmail Bomber

**Purpose:** Email stress testing

**⚠️ WARNING:** Only use on your own accounts!

**Usage:**
1. Select option 24
2. Wait for provider update (first time)
3. Enter target email
4. Bombing starts

**Note:** Initial setup takes 10-15 minutes

#### 25. DDOS Attack

**Purpose:** DDoS testing on authorized targets

**⚠️ WARNING:** 
- Use VPN/Proxy
- Only test your own servers
- Illegal without permission

**Usage:**
1. Enable VPN
2. Select option 25
3. Enter target details
4. Configure attack

#### 26. IP Info

**Purpose:** IP address information lookup

**Safe Tool:** No attack, information only

**Usage:**
1. Select option 26
2. Enter IP address
3. View information:
   - Country/City
   - ISP
   - Organization
   - Coordinates

#### 27. dorks-eye

**Purpose:** Automated Google dorking

**Features:**
- 500+ dorks included
- Custom dork support
- Multiple search engines
- Result export

**Usage:**
1. Select option 27
2. Choose category or custom
3. Results saved

**Example Dorks:**
- `inurl:admin`
- `filetype:pdf password`
- `site:example.com intext:"confidential"`

#### 28-34. Additional Tools

Refer to individual tool repositories for detailed documentation:
- HackerPro: Multi-tool suite
- RED_HAWK: Website scanner
- VirusCrafter: Payload generator
- Info-Site: Site information
- BadMod: Instagram tool
- Facebash: Facebook tool
- DARKARMY: Pentesting suite

#### 35. AUTO-IP-CHANGER

**Purpose:** Automatic IP rotation via Tor

**Requirements:**
- Tor installed
- Root access (usually)
- SOCKS proxy support

**Usage:**
1. Install Tor first
2. Select option 35
3. Configure browser proxy: 127.0.0.1:9050
4. IP changes automatically

## Usage Examples

### Example 1: Information Gathering Workflow

```bash
# 1. Check target IP info
Select: 26 (IP Info)
Enter: 93.184.216.34

# 2. Scan for subdomains
Select: 23 (Subscan)
Enter: example.com

# 3. Detailed site scan
Select: 29 (RED_HAWK)
Enter: https://example.com

# 4. Check with dorks
Select: 27 (dorks-eye)
Enter custom: site:example.com
```

### Example 2: Phishing Simulation (Authorized Test)

```bash
# 1. Setup phishing page
Select: 21 (Phishing Tool)
Choose: Instagram template
Note the URL

# 2. Test with yourself
Open URL in browser
Enter test credentials
Verify capture works

# 3. In real test
Share with authorized test user
Monitor captures
Document findings
```

### Example 3: Account Security Testing

```bash
# 1. Test your own account
Select: 33 (Facebash) or 32 (BadMod)
Enter: Your own account details
Use: Your own wordlist

# 2. Monitor attempts
Watch for rate limiting
Note security responses
Document weaknesses

# 3. Implement fixes
Enable 2FA
Use stronger password
Enable login alerts
```

## Best Practices

### 🛡️ Security & Safety

1. **Always Use Protection**
   - VPN for all activities
   - Tor for anonymous tools
   - Never use home IP for attacks

2. **Legal Authorization**
   - Get written permission
   - Document authorization
   - Stay within scope

3. **Tool Management**
   - Keep tools updated
   - Remove after use (option 37)
   - Secure credentials

4. **Data Handling**
   - Encrypt captured data
   - Secure storage
   - Proper disposal

### 📋 Testing Methodology

1. **Reconnaissance**
   - IP Info (26)
   - Subscan (23)
   - RED_HAWK (29)

2. **Vulnerability Assessment**
   - dorks-eye (27)
   - Info-Site (31)
   - HackerPro (28)

3. **Exploitation** (Authorized Only)
   - Phishing (21, 22)
   - Brute Force (32, 33)
   - Custom attacks

4. **Reporting**
   - Document findings
   - Use option 15 (reports)
   - Professional write-up

## Troubleshooting

### Common Issues

**Problem:** Tool fails to clone
```bash
Solution:
1. Check internet connection
2. Run option 20 (update dependencies)
3. Try again
4. Manual: cd Tools && git clone [repo-url]
```

**Problem:** Python errors
```bash
Solution:
1. Install Python 3: pkg install python3
2. Install pip: pkg install python3-pip
3. Install requirements: pip3 install -r requirements.txt
4. Run option 20
```

**Problem:** Permission denied
```bash
Solution:
chmod +x script_name.sh
# Or use bash directly:
bash script_name.sh
```

**Problem:** Tool not working
```bash
Solution:
1. Check dependencies
2. Read tool's README
3. Check internet connection
4. Try reinstalling: option 37 then redownload
```

**Problem:** Out of space
```bash
Solution:
# Check space
df -h

# Remove old tools
Select option 37

# Clean package cache
pkg clean  # Termux
apt-get clean  # Linux
```

### Getting Help

1. **In-App Help**
   - Option 18: General help
   - Option 36: ALHacking tutorial

2. **Documentation**
   - `README.md` - Main documentation
   - `docs/` - Detailed guides
   - Tool directories: Individual READMEs

3. **Community Support**
   - GitHub Issues
   - Tool repositories
   - Security forums

4. **Video Tutorials**
   - Option 36 opens YouTube guide
   - Search for tool-specific videos

## Legal Disclaimer

⚠️ **IMPORTANT:** These tools are provided for:
- Educational purposes
- Authorized security testing
- Research

**NEVER:**
- Attack systems without permission
- Use for illegal activities
- Harass or harm others
- Violate privacy laws

**You are responsible for:**
- Your actions
- Legal compliance
- Ethical use

The developers assume **NO LIABILITY** for misuse.

## Additional Resources

- Main README: `/README.md`
- Hydra Documentation: `/docs/`
- Original ALHacking: https://github.com/4lbH4cker/ALHacking
- Security Resources: See option 18

---

**Version:** 2.0.0 Ultimate Edition  
**Last Updated:** 2026-01-11  
**License:** See LICENSE file

For questions or issues, please open a GitHub issue or refer to the main documentation.
