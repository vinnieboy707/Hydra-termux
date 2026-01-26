# Hydra Compilation Issues - Complete Fix Guide

This guide addresses the common compilation issues encountered when building THC-Hydra from source, specifically the missing library errors for PostgreSQL, MySQL, MongoDB, SMB, and GTK.

## 🔍 Understanding the Error

The compilation errors you're seeing indicate missing development libraries:

```
... NOT found, module pgsql disabled      # PostgreSQL library missing
... NOT found, module mysql disabled      # MySQL library missing
... NOT found, module mongodb disabled    # MongoDB library missing
... NOT found, module smb2 disabled       # SMB/Samba library missing
... NOT found, optional anyway            # GUI (GTK) library missing (optional)
```

These are **NOT fatal errors** - Hydra will compile without these modules, but you'll have reduced protocol support.

## ✅ Quick Fix (Recommended)

Run our automated fix script:

```bash
bash scripts/fix_hydra_dependencies.sh
```

This script will:
1. Detect your platform (Termux/Debian/Red Hat/Arch)
2. Install all required development libraries
3. Offer to compile Hydra with full feature support
4. Verify the installation

## 📦 Manual Installation by Platform

### Termux (Android)

```bash
# Update package lists
pkg update && pkg upgrade

# Install build dependencies
pkg install -y clang make autoconf automake libtool pkg-config

# Install protocol libraries
pkg install -y openssl libpq mariadb libssh libpcre zlib libidn2 subversion

# Install Hydra (pre-built)
pkg install -y hydra

# OR compile from source for latest features
git clone https://github.com/vanhauser-thc/thc-hydra.git
cd thc-hydra
./configure
make -j4
make install
```

### Debian/Ubuntu

```bash
# Update package lists
sudo apt-get update

# Install build dependencies
sudo apt-get install -y build-essential autoconf automake libtool pkg-config

# Install protocol libraries
sudo apt-get install -y \
    libssl-dev \
    libpq-dev postgresql-client \
    libmysqlclient-dev default-libmysqlclient-dev \
    libmongoc-dev libbson-dev \
    libsmbclient-dev \
    libssh-dev \
    libpcre3-dev zlib1g-dev libidn2-dev libsvn-dev

# Install Hydra (pre-built)
sudo apt-get install -y hydra

# OR compile from source
git clone https://github.com/vanhauser-thc/thc-hydra.git
cd thc-hydra
./configure
make -j$(nproc)
sudo make install
```

### Red Hat/CentOS/Fedora

```bash
# Install build dependencies
sudo yum install -y gcc make autoconf automake libtool pkgconfig

# Install protocol libraries
sudo yum install -y \
    openssl-devel \
    postgresql-devel \
    mysql-devel \
    libsmbclient-devel \
    libssh-devel \
    pcre-devel zlib-devel libidn2-devel subversion-devel

# Compile from source (no pre-built package available)
git clone https://github.com/vanhauser-thc/thc-hydra.git
cd thc-hydra
./configure
make -j$(nproc)
sudo make install
```

### Arch Linux

```bash
# Install build dependencies
sudo pacman -S --noconfirm base-devel autoconf automake libtool pkg-config

# Install protocol libraries
sudo pacman -S --noconfirm \
    openssl \
    postgresql-libs \
    mariadb-libs \
    mongo-c-driver \
    smbclient \
    libssh \
    pcre zlib libidn2 subversion

# Install Hydra (pre-built)
sudo pacman -S --noconfirm hydra

# OR compile from source
git clone https://github.com/vanhauser-thc/thc-hydra.git
cd thc-hydra
./configure
make -j$(nproc)
sudo make install
```

## 🎯 What Each Library Provides

| Library | Protocol Support | Impact if Missing |
|---------|------------------|-------------------|
| **libpq** (PostgreSQL) | PostgreSQL database | Cannot brute-force PostgreSQL |
| **libmysqlclient** (MySQL) | MySQL/MariaDB database | Cannot brute-force MySQL |
| **libmongoc** (MongoDB) | MongoDB database | Cannot brute-force MongoDB |
| **libsmbclient** (SMB) | SMB/CIFS file sharing | Cannot brute-force SMB shares |
| **libssh** (SSH) | SSH protocol | Cannot brute-force SSH (critical!) |
| **libssl** (OpenSSL) | HTTPS, FTPS, IMAPS, etc. | Cannot brute-force encrypted protocols |
| **GTK** (GUI) | Graphical interface | CLI works fine without this |

## 🔧 Compilation Options

### Minimal Install (No Database Support)

If you don't need database protocol support, you can install Hydra with just the core features:

```bash
# Termux
pkg install hydra

# Debian/Ubuntu
sudo apt-get install hydra

# This gives you support for:
# - HTTP/HTTPS
# - FTP/FTPS
# - SSH (if libssh is available)
# - Telnet
# - SMTP/POP3/IMAP
# - And 50+ other protocols
```

### Full Install (All Features)

For complete protocol support including databases:

```bash
# Install ALL development libraries first (see platform sections above)

# Then compile from source
git clone https://github.com/vanhauser-thc/thc-hydra.git
cd thc-hydra
./configure
make -j$(nproc)
make install  # or: sudo make install
```

## 🐛 Troubleshooting

### Error: "configure: command not found"

```bash
# Termux
pkg install autoconf automake

# Debian/Ubuntu
sudo apt-get install autoconf automake

# Red Hat/CentOS
sudo yum install autoconf automake
```

### Error: "make: command not found"

```bash
# Termux
pkg install make clang

# Debian/Ubuntu
sudo apt-get install build-essential

# Red Hat/CentOS
sudo yum groupinstall "Development Tools"
```

### Error: "git: command not found"

```bash
# Termux
pkg install git

# Debian/Ubuntu
sudo apt-get install git

# Red Hat/CentOS
sudo yum install git
```

### Compilation Takes Too Long

Use parallel compilation to speed up the process:

```bash
# Use all available CPU cores
make -j$(nproc)

# Or specify a number
make -j4  # Uses 4 cores
```

### Permission Denied During Installation

```bash
# Use sudo for system-wide installation
sudo make install

# OR install to user directory
./configure --prefix=$HOME/.local
make -j$(nproc)
make install
# Then add $HOME/.local/bin to your PATH
```

## ✅ Verification

After installation, verify Hydra is working:

```bash
# Check if Hydra is installed
which hydra

# Show version and supported modules
hydra -h | head -20

# List all supported protocols
hydra -h | grep "Supported services"

# Test with a safe target
hydra -l test -p test localhost ssh -t 1
```

## 📊 Expected Output

After successful installation, you should see:

```
Hydra v9.x (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes.

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2026-01-24 ...

Supported services: 
adam6500 asterisk cisco cisco-enable cobaltstrike cvs firebird ftp[s] http[s]-{head|get|post} 
http[s]-{get|post}-form http-proxy http-proxy-urlenum icq imap[s] irc ldap2[s] ldap3[-{cram|digest}md5][s] 
memcached mongodb mssql mysql nntp oracle-listener oracle-sid pcanywhere pcnfs pop3[s] postgres radmin2 rdp 
redis rexec rlogin rpcap rsh rtsp s7-300 sip smb smtp[s] smtp-enum snmp socks5 ssh sshkey svn teamspeak 
telnet[s] vmauthd vnc xmpp
```

## 🔗 Additional Resources

- **THC-Hydra GitHub**: https://github.com/vanhauser-thc/thc-hydra
- **Hydra Wiki**: https://github.com/vanhauser-thc/thc-hydra/wiki
- **Hydra-Termux Issues**: https://github.com/vinnieboy707/Hydra-termux/issues
- **Dependency Checker**: Run `bash scripts/check_dependencies.sh`

## 💡 Pro Tips

1. **Pre-built vs Source**: Pre-built packages are faster but may not include all protocols. Compile from source for maximum compatibility.

2. **Storage Space**: Compilation requires ~200MB temporary space. Ensure you have enough free space.

3. **Time Required**: Compilation typically takes 2-5 minutes depending on your device.

4. **Root Access**: Not required for Termux. Required for system-wide installation on Linux.

5. **Updates**: To update Hydra, simply re-run the compilation process or use your package manager's update command.

## 🎯 Quick Decision Matrix

| Scenario | Recommended Action |
|----------|-------------------|
| **Just want SSH/HTTP/FTP** | Install pre-built package |
| **Need database protocols** | Compile from source with all libs |
| **Limited storage** | Install pre-built package |
| **Maximum features** | Compile from source |
| **Quick setup** | Run `fix_hydra_dependencies.sh` |

## 🆘 Still Having Issues?

If you're still experiencing problems:

1. Run the automated fix: `bash scripts/fix_hydra_dependencies.sh`
2. Check dependencies: `bash scripts/check_dependencies.sh`
3. Review logs: Check `/tmp/hydra_build_*/configure.log`
4. Open an issue: https://github.com/vinnieboy707/Hydra-termux/issues
5. Join community: https://github.com/vanhauser-thc/thc-hydra/discussions

---

**Last Updated**: 2026-01-24  
**Tested On**: Termux (Android 11+), Debian 11, Ubuntu 20.04+, CentOS 8, Arch Linux
