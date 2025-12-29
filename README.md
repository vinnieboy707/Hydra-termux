# 🐍 Hydra-Termux Ultimate Edition

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Termux-orange)
![Status](https://img.shields.io/badge/status-active-success)

**A powerful brute-force tool suite optimized for Termux on Android devices**

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [**Quick Library**](#-quick-library-new) • [Documentation](#-documentation) • [Legal](#️-legal-disclaimer)

</div>

---

## ⚠️ **100% REAL ATTACKS - NO MOCK DATA**

**All scripts execute REAL Hydra commands and produce REAL, usable results:**
- ✅ **Real network connections** - Every attack contacts actual target systems
- ✅ **Real Hydra execution** - Scripts call genuine Hydra binary, not simulations
- ✅ **Real credentials** - Found usernames/passwords are verified working credentials
- ✅ **No dummy data** - All results come directly from target responses
- ✅ **No fake output** - Success messages only appear for actual breaches

**Proof**: View any script to see direct `hydra` command execution. Test found credentials manually - they will work on the target systems.

**📱 Termux Deployment Guide**: See [docs/TERMUX_DEPLOYMENT.md](docs/TERMUX_DEPLOYMENT.md) for complete step-by-step Android/Termux installation and real-world usage examples.

---

## ✨ Features

### 🎯 Pre-Built Attack Scripts (8)
- **SSH Admin Attack** - Multi-wordlist SSH brute-force with resume support
- **FTP Admin Attack** - FTP service attack with connection handling
- **Web Admin Attack** - HTTP/HTTPS admin panel detection and attack
- **RDP Admin Attack** - Windows RDP with lockout prevention
- **MySQL Admin Attack** - Database attack with connection strings
- **PostgreSQL Admin Attack** - PostgreSQL-specific attacks
- **SMB Admin Attack** - Windows SMB/CIFS with domain support
- **Multi-Protocol Auto Attack** - Automated reconnaissance and attack chain

### 🛠️ Utility Tools
- **Wordlist Manager** - Download and organize password lists from SecLists
- **Wordlist Generator** - Combine, dedupe, sort, and filter wordlists
- **Target Scanner** - Quick nmap wrapper with multiple scan modes
- **Results Viewer** - Filter, export, and manage attack results

### 📊 Advanced Features
- Interactive menu system with 18 options
- Real-time progress feedback
- Comprehensive logging with timestamps
- JSON results tracking
- Export to multiple formats (TXT, CSV, JSON)
- Configuration management
- Automatic update system
- Help documentation built-in

### 🔒 Security Features
- VPN check and warning
- Rate limiting to avoid detection
- Random delay between attempts
- Resume support for interrupted attacks
- Configurable thread count
- Connection timeout handling

### 📚 Quick Library (NEW!)
- **12 One-Line-Change Scripts** - Just edit TARGET and run!
- **Platform Comparison Guide** - Understand differences between protocols
- **Copy-Paste Ready** - Simplified scripts for instant use
- **Real Results** - Fully functional, tested attack templates
- See [Library.md](Library.md) for complete documentation

## 📋 Prerequisites

Before you begin, ensure you have:

- ✅ [Termux](https://f-droid.org/en/packages/com.termux/) installed on your Android device
- ✅ Stable internet connection
- ✅ Storage permissions granted to Termux
- ✅ At least 500MB free storage
- ✅ **VPN for anonymity (highly recommended)**

## 🚀 Quick Installation

Just run these commands in Termux:

```bash
# Clone the repository
git clone https://github.com/vinnieboy707/Hydra-termux.git
cd Hydra-termux

# Run the automated installer
bash install.sh
```

The installer will:
- ✓ Update Termux packages
- ✓ Install all required tools (hydra, nmap, jq, etc.)
- ✓ Create directory structure
- ✓ Set permissions automatically
- ✓ Optionally download wordlists
- ✓ Verify installation

## 📦 Manual Installation

If you prefer manual installation:

1. **Update Termux packages:**
   ```bash
   pkg update && pkg upgrade -y
   ```

2. **Install required packages:**
   ```bash
   pkg install hydra git wget curl openssl nmap termux-api figlet jq -y
   ```

3. **Clone and setup:**
   ```bash
   git clone https://github.com/vinnieboy707/Hydra-termux.git
   cd Hydra-termux
   chmod +x hydra.sh install.sh scripts/*.sh
   ```

4. **Download wordlists (optional):**
   ```bash
   bash scripts/download_wordlists.sh --all
   ```

## 🎯 Usage

### 🚀 Quick Library (Simplest Way!)

**Want the easiest method?** Use our one-line-change scripts:

```bash
# 1. Pick a script from Library/
# 2. Edit ONE line (change TARGET)
# 3. Run it!

bash Library/ssh_quick.sh        # SSH attack
bash Library/web_quick.sh        # Web admin attack
bash Library/auto_attack_quick.sh # Full auto-attack
```

**Example:**
```bash
# Edit Library/ssh_quick.sh
TARGET="192.168.1.100"  # <-- Change only this

# Run it
bash Library/ssh_quick.sh
# Done! Results saved automatically
```

📖 **See [Library.md](Library.md)** for all 12 quick scripts and platform comparisons!

---

### Starting the Tool

```bash
./hydra.sh
```

This launches the interactive menu with all available options.

### Quick Examples

**SSH Attack:**
```bash
bash scripts/ssh_admin_attack.sh -t 192.168.1.100
```

**FTP Attack:**
```bash
bash scripts/ftp_admin_attack.sh -t 192.168.1.100 -p 21
```

**Web Admin Attack:**
```bash
bash scripts/web_admin_attack.sh -t example.com -P /admin -s
```

**Multi-Protocol Auto Attack:**
```bash
bash scripts/admin_auto_attack.sh -t 192.168.1.100 -r
```

**Target Scanning:**
```bash
bash scripts/target_scanner.sh -t 192.168.1.100 -s full
```

**View Results:**
```bash
bash scripts/results_viewer.sh --all
bash scripts/results_viewer.sh --protocol ssh
bash scripts/results_viewer.sh --export results.csv --format csv
```

### All Attack Scripts Support

```bash
-t, --target      Target IP address or hostname (required)
-p, --port        Custom port (optional)
-u, --user-list   Custom username list file (optional)
-w, --word-list   Custom password wordlist file (optional)
-T, --threads     Number of parallel threads (default: 16)
-o, --timeout     Connection timeout in seconds (default: 30)
-v, --verbose     Verbose output
-h, --help        Show help message
```

## 📚 Documentation

- **[Library.md](Library.md)** - 🔥 **NEW!** Quick-use scripts with platform comparisons
- **[Library/README.md](Library/README.md)** - Quick reference for one-line-change scripts
- **[USAGE.md](docs/USAGE.md)** - Detailed usage instructions for all scripts
- **[EXAMPLES.md](docs/EXAMPLES.md)** - Real-world attack examples and scenarios
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - How to contribute to the project
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and changes

## 🗂️ Project Structure

```
Hydra-termux/
├── hydra.sh                    # Main launcher with interactive menu
├── install.sh                  # Enhanced installation script
├── need.txt                    # Required packages list
├── Library.md                  # 🔥 Complete script library documentation
├── Library/                    # 🔥 Quick-use one-line-change scripts
│   ├── README.md              # Quick reference guide
│   ├── ssh_quick.sh           # SSH one-liner
│   ├── ftp_quick.sh           # FTP one-liner
│   ├── web_quick.sh           # Web one-liner
│   ├── wordpress_quick.sh     # WordPress one-liner
│   ├── rdp_quick.sh           # RDP one-liner
│   ├── mysql_quick.sh         # MySQL one-liner
│   ├── postgres_quick.sh      # PostgreSQL one-liner
│   ├── smb_quick.sh           # SMB one-liner
│   ├── auto_attack_quick.sh   # Auto-attack one-liner
│   ├── network_quick.sh       # Network scan one-liner
│   ├── email_quick.sh         # Email attack one-liner
│   └── username_quick.sh      # Username attack one-liner
├── config/
│   ├── hydra.conf             # Main configuration file
│   ├── admin_usernames.txt    # Default admin usernames
│   └── admin_passwords.txt    # Default admin passwords
├── scripts/
│   ├── logger.sh              # Logging utility (sourced by all scripts)
│   ├── ssh_admin_attack.sh    # SSH brute-force script
│   ├── ftp_admin_attack.sh    # FTP brute-force script
│   ├── web_admin_attack.sh    # Web admin panel attack
│   ├── rdp_admin_attack.sh    # RDP brute-force script
│   ├── mysql_admin_attack.sh  # MySQL attack script
│   ├── postgres_admin_attack.sh # PostgreSQL attack script
│   ├── smb_admin_attack.sh    # SMB/CIFS attack script
│   ├── admin_auto_attack.sh   # Multi-protocol auto attack
│   ├── download_wordlists.sh  # Wordlist download manager
│   ├── wordlist_generator.sh  # Custom wordlist generator
│   ├── target_scanner.sh      # Target reconnaissance tool
│   └── results_viewer.sh      # Results management tool
├── docs/
│   ├── USAGE.md               # Detailed usage guide
│   └── EXAMPLES.md            # Real-world examples
├── logs/                       # Attack logs and results (auto-created)
├── results/                    # Scan results and reports (auto-created)
└── wordlists/                  # Password wordlists (auto-created)
```

## 🔧 Configuration

Edit `config/hydra.conf` to customize:

```ini
[GENERAL]
default_threads=16
timeout=30
verbose=true
output_format=json
log_directory=~/hydra-logs

[SECURITY]
vpn_check=true
rate_limit=true
max_attempts=1000
random_delay=true

[WORDLISTS]
default_passwords=~/wordlists/common_passwords.txt
admin_passwords=~/wordlists/admin_passwords.txt
usernames=~/wordlists/admin_usernames.txt
```

## 🌐 Supported Protocols (40+)

Hydra supports these protocols through the attack scripts:

**Network Services:** SSH, FTP, FTPS, Telnet, RDP, VNC, RLogin, RSH

**Web Services:** HTTP, HTTPS, HTTP-GET, HTTP-POST, HTTP-PROXY, HTTPS-GET, HTTPS-POST

**Databases:** MySQL, PostgreSQL, MS-SQL, Oracle, MongoDB, Redis

**Mail Services:** SMTP, SMTPS, POP3, POP3S, IMAP, IMAPS

**File Sharing:** SMB, NFS, AFP

**Other:** LDAP, SNMP, SIP, ICQ, IRC, XMPP, and more

## 🔍 Troubleshooting

### "Permission denied" error
```bash
chmod +x hydra.sh install.sh scripts/*.sh
```

### "Command not found: hydra"
```bash
pkg install hydra -y
```

### "Package not found" error
```bash
pkg update
pkg upgrade
```

### Script won't run
Make sure you're in the correct directory:
```bash
cd Hydra-termux
ls -la
```

### "Script not found" after choosing a menu option
- Update to the latest version (symlink-safe launcher)
- Ensure `hydra.sh` and the `scripts/` folder stay together (run from the project directory)

### No results showing
Check if attacks were successful:
```bash
cat logs/hydra_$(date +%Y%m%d).log
```

### Out of memory errors
- Close other apps to free memory
- Reduce thread count: use `-T 4` instead of default 16
- Use WiFi instead of mobile data

## 💡 Performance Tips

1. **Use WiFi** for better speed and stability
2. **Close other apps** to free up RAM
3. **Keep Termux in foreground** to prevent Android from killing it
4. **Use smaller wordlists** for faster testing
5. **Reduce threads** on slow connections (`-T 8` instead of 16)
6. **Enable verbose mode** (`-v`) only when debugging
7. **Use quick scan** before full scan to save time

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Legal Disclaimer

**IMPORTANT - READ CAREFULLY:**

This tool is provided for **educational and authorized security testing purposes ONLY**.

### Legal Requirements

- ✓ **ONLY** use on systems you own or have explicit written permission to test
- ✓ Obtain proper authorization before conducting security assessments
- ✓ Comply with all applicable laws and regulations
- ✓ Document all testing activities and obtain consent

### Illegal Activities

Unauthorized access to computer systems is **ILLEGAL** under:
- Computer Fraud and Abuse Act (CFAA) - United States
- Computer Misuse Act - United Kingdom
- Cybercrime laws in various jurisdictions worldwide

Violators may face:
- Criminal prosecution
- Significant fines
- Imprisonment
- Civil liability

### Disclaimer

The developers and contributors:
- ❌ Do NOT encourage or condone illegal activities
- ❌ Assume NO responsibility for misuse
- ❌ Are NOT liable for any damages or legal consequences
- ✓ Provide this tool for legitimate security research ONLY

**BY USING THIS SOFTWARE, YOU AGREE TO:**
1. Use it only on authorized systems
2. Accept full responsibility for your actions
3. Comply with all applicable laws
4. Not hold the developers liable for misuse

**USE AT YOUR OWN RISK.**

## 🙏 Credits

- **Original Project:** [cyrushar/Hydra-Termux](https://github.com/cyrushar/Hydra-Termux)
- **Enhanced by:** vinnieboy707
- **Hydra Tool:** THC-Hydra team
- **Wordlists:** [SecLists](https://github.com/danielmiessler/SecLists) by Daniel Miessler

## 📞 Support

If you encounter issues:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review [docs/USAGE.md](docs/USAGE.md) for detailed instructions
3. Search existing [Issues](https://github.com/vinnieboy707/Hydra-termux/issues)
4. Open a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Your environment (Termux version, Android version)
   - Relevant logs or screenshots

## 🌟 Star History

If you find this project useful, please consider giving it a star! ⭐

---

<div align="center">

**Made with ❤️ for the Termux and Security Research Community**

[⬆ Back to Top](#-hydra-termux-ultimate-edition)

</div>
