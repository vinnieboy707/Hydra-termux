# Git Bash Optimization Guide

## Quick Setup for Git Bash on Windows

### Prerequisites
1. Git for Windows (includes Git Bash)
2. Install location: `C:\Program Files\Git` (default)

### Installation Steps

```bash
# 1. Clone the repository
git clone https://github.com/vinnieboy707/Hydra-termux.git
cd Hydra-termux

# 2. Make scripts executable
chmod +x hydra.sh install.sh
chmod +x scripts/*.sh
chmod +x Library/*.sh

# 3. Run the main launcher
./hydra.sh
```

## Git Bash Compatibility Features

### ✅ Path Resolution (Cross-Platform)
- Uses `realpath` with fallbacks for Git Bash
- Handles both Unix and Windows paths
- Works with symlinks

### ✅ Color Support
- ANSI colors work in Git Bash by default
- All menu items display correctly with colors and emojis

### ✅ Command Compatibility
- All commands tested on Git Bash
- No Windows-specific issues
- Works with MINGW64 environment

## Running the Tool

### Main Launcher
```bash
./hydra.sh
```

### Quick Start Scripts
```bash
# Email & IP Attack
./Library/email_ip_pentest_quick.sh

# Supreme Combo Attacks
./Library/combo_supreme_email_web_db.sh
./Library/combo_supreme_cloud_infra.sh
./Library/combo_supreme_network_complete.sh
./Library/combo_supreme_active_directory.sh
./Library/combo_supreme_webapp_api.sh
```

## Menu Options (38-43)

| Option | Script | Description |
|--------|--------|-------------|
| 38 | `scripts/email_ip_attack.sh` | Email & IP Penetration Test |
| 39 | `Library/combo_supreme_email_web_db.sh` | Corporate Stack Attack |
| 40 | `Library/combo_supreme_cloud_infra.sh` | Cloud Infrastructure Attack |
| 41 | `Library/combo_supreme_network_complete.sh` | Complete Network Attack |
| 42 | `Library/combo_supreme_active_directory.sh` | Active Directory Attack |
| 43 | `Library/combo_supreme_webapp_api.sh` | Web Apps & APIs Attack |

## Troubleshooting

### Line Ending Issues
If you get "bad interpreter" errors:
```bash
# Convert line endings
dos2unix hydra.sh install.sh scripts/*.sh Library/*.sh

# Or manually
sed -i 's/\r$//' hydra.sh
```

### Permission Issues
```bash
# Make all scripts executable
find . -name "*.sh" -type f -exec chmod +x {} \;
```

### Path Issues
Git Bash automatically converts Unix paths:
- `/c/Users/` works as `C:\Users\`
- Scripts handle both path styles

## Performance Tips

1. **Use Git Bash (not CMD)**
   - Better POSIX compatibility
   - Faster script execution
   - Full color support

2. **Run from SSD**
   - Faster file operations
   - Better for wordlist handling

3. **Antivirus Exclusions**
   - Add Hydra-termux folder to exclusions
   - Prevents false positives

## Verified Compatibility

✅ Git Bash (MINGW64)
✅ Windows 10/11
✅ Windows Subsystem for Linux (WSL)
✅ Git for Windows (latest)
✅ All menu options (0-43)
✅ All combo scripts
✅ Color output
✅ Emoji support

## Full Feature List

All features work in Git Bash:
- Interactive menu system
- 43 attack options
- AI assistant integration
- Real-time logging
- Result export (HTML/JSON/CSV)
- Wordlist management
- Attack orchestration
- Supreme combo attacks

---
Last Updated: 2026-01-26
Tested on: Git Bash 2.43+, Windows 10/11
