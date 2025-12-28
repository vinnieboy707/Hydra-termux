# 📚 Hydra-Termux Complete Library

## 🎯 38 One-Line-Change Scripts | 40+ Protocols | 7 Attack Combinations

**The Ultimate Pen-Testing Script Collection**

---

## 📊 Quick Stats

- **Total Scripts**: 38
- **Individual Protocols**: 22
- **Protocol Combinations**: 7
- **Advanced Scanning Tools**: 9
- **Protocols Covered**: 40+
- **Lines Changed to Use**: **1 per script**

---

## 🚀 Getting Started (3 Steps)

### Step 1: Pick a Script
```bash
cd Library
ls *.sh  # See all available scripts
```

### Step 2: Edit ONE Line
```bash
nano ssh_quick.sh
# Change: TARGET="192.168.1.100"  # <-- Only edit this!
```

### Step 3: Run It
```bash
bash ssh_quick.sh
# Done! Results auto-saved with timestamps
```

---

## 📁 Complete Script Index

### 🔐 INDIVIDUAL PROTOCOLS (22 Scripts)

#### Network Services (8)
| Script | Protocol | Port | Use Case |
|--------|----------|------|----------|
| `ssh_quick.sh` | SSH | 22 | Remote access brute-force |
| `ftp_quick.sh` | FTP | 21 | File transfer attack |
| `telnet_quick.sh` | Telnet | 23 | Legacy device testing |
| `rdp_quick.sh` | RDP | 3389 | Windows remote desktop |
| `smb_quick.sh` | SMB/CIFS | 445 | Windows file shares |
| `vnc_quick.sh` | VNC | 5900 | Remote desktop (Linux) |
| `snmp_quick.sh` | SNMP | 161 | Network device enumeration |
| `ldap_quick.sh` | LDAP | 389 | Directory service attack |

#### Databases (5)
| Script | Database | Port | Use Case |
|--------|----------|------|----------|
| `mysql_quick.sh` | MySQL | 3306 | MySQL database attack |
| `postgres_quick.sh` | PostgreSQL | 5432 | PostgreSQL attack |
| `mssql_quick.sh` | MS SQL | 1433 | Microsoft SQL Server |
| `mongodb_quick.sh` | MongoDB | 27017 | NoSQL database |
| `redis_quick.sh` | Redis | 6379 | Cache database |

#### Mail Services (4)
| Script | Protocol | Port | Use Case |
|--------|----------|------|----------|
| `smtp_quick.sh` | SMTP | 25 | Mail server attack |
| `pop3_quick.sh` | POP3 | 110 | Mail retrieval |
| `imap_quick.sh` | IMAP | 143 | Mail access |
| `email_quick.sh` | Multi-Protocol | Various | Email enumeration |

#### Web Applications (3)
| Script | Target | Port | Use Case |
|--------|--------|------|----------|
| `web_quick.sh` | Generic Web | 80/443 | Admin panel attack |
| `wordpress_quick.sh` | WordPress | 80/443 | WP-specific attack |
| `username_quick.sh` | Multi | Various | Username across protocols |

#### Network Tools (2)
| Script | Function | Use Case |
|--------|----------|----------|
| `network_quick.sh` | Quick Scanner | Fast network recon |
| `multi_target_ssh.sh` | Bulk SSH | CIDR range attacks |

---

### 🔄 PROTOCOL COMBINATIONS (7 Scripts)

These test multiple related protocols in sequence:

| Script | Protocols | Scenario | Use Case |
|--------|-----------|----------|----------|
| `combo_web_db.sh` | HTTP + MySQL | Web App + Backend | Full-stack web attack |
| `combo_network_stack.sh` | SSH + FTP + MySQL + SMB | Enterprise Server | Credential reuse detection |
| `combo_windows_infra.sh` | RDP + SMB + MSSQL + LDAP | Windows Domain | AD environment audit |
| `combo_mail_stack.sh` | SMTP + POP3 + IMAP + Web | Mail Server | Complete mail infrastructure |
| `combo_db_cluster.sh` | MySQL + PostgreSQL + MongoDB + Redis + MSSQL | Multi-DB | Database cluster audit |
| `combo_iot_devices.sh` | Telnet + SNMP + HTTP + FTP | IoT/Network Devices | Router/IoT testing |
| `combo_full_infrastructure.sh` | **ALL 16 PROTOCOLS** | Complete Infrastructure | Enterprise-wide audit |

---

### 🔍 ADVANCED SCANNING (9 Scripts)

#### Nmap Variants (5)
| Script | Type | Speed | Use Case |
|--------|------|-------|----------|
| `nmap_full_scan.sh` | All 65535 Ports | Slow | Complete port scan |
| `nmap_stealth_scan.sh` | SYN Stealth | Medium | Avoid IDS detection |
| `nmap_vuln_scan.sh` | Vulnerability Check | Medium | Known CVE detection |
| `nmap_os_detection.sh` | OS Fingerprint | Fast | Operating system ID |
| `nmap_network_discovery.sh` | Live Host Discovery | Fast | Map network topology |

#### Web Analysis (3)
| Script | Function | Use Case |
|--------|----------|----------|
| `ssl_analyzer.sh` | SSL/TLS Check | Certificate analysis |
| `web_header_analyzer.sh` | Security Headers | HTTP header audit |
| `web_directory_bruteforce.sh` | Hidden Paths | Directory enumeration |

#### Network Recon (1)
| Script | Function | Use Case |
|--------|----------|----------|
| `auto_attack_quick.sh` | Full Auto | Scan + Attack + Report |

---

## 💡 Real-World Examples

### Example 1: Test Corporate Web Server
```bash
# Step 1: Scan for vulnerabilities
nano nmap_vuln_scan.sh
TARGET="corporate-web.com"
bash nmap_vuln_scan.sh

# Step 2: Check SSL security
nano ssl_analyzer.sh
TARGET="corporate-web.com"
bash ssl_analyzer.sh

# Step 3: Test web + database
nano combo_web_db.sh
TARGET="192.168.10.50"
bash combo_web_db.sh
```

### Example 2: Audit Windows Domain
```bash
# All-in-one Windows test
nano combo_windows_infra.sh
TARGET="192.168.1.100"  # Domain controller
bash combo_windows_infra.sh

# Results show: RDP, SMB, MSSQL, LDAP status
```

### Example 3: IoT Device Assessment
```bash
# Test router/IoT security
nano combo_iot_devices.sh
TARGET="192.168.1.1"  # Router IP
bash combo_iot_devices.sh

# Tests: Telnet, SNMP, Web, FTP
```

### Example 4: Full Network Pen-Test
```bash
# Ultimate comprehensive scan
nano combo_full_infrastructure.sh
TARGET="192.168.1.100"
bash combo_full_infrastructure.sh

# Tests ALL 16 protocols
# Generates detailed report
```

---

## 📖 Protocol Definitions

See `PROTOCOL_GUIDE.md` for complete definitions including:
- Detailed protocol explanations
- Real-world pen-testing use cases
- Attack flow diagrams
- Security best practices
- Protocol complexity matrix

---

## 🛡️ Built-in Security Features

✅ **Automatic VPN Check** - Verifies VPN before attacks  
✅ **Multi-Target Support** - Single IP, CIDR, or file list  
✅ **Resume Capability** - Interrupted attacks resume  
✅ **JSON Logging** - Structured result tracking  
✅ **Error Handling** - Enterprise-grade debugging  
✅ **Rate Limiting** - Avoid lockouts (RDP, etc.)  
✅ **Timestamped Logs** - All results dated/timed  
✅ **Permission Checks** - Validate tool dependencies  

---

## 🎓 Attack Methodology

### Phase 1: Reconnaissance
```bash
1. nmap_network_discovery.sh  # Find hosts
2. nmap_os_detection.sh       # Identify OS
3. nmap_full_scan.sh          # All ports
```

### Phase 2: Vulnerability Assessment
```bash
1. nmap_vuln_scan.sh          # Known CVEs
2. ssl_analyzer.sh            # SSL/TLS issues
3. web_header_analyzer.sh     # Web security
```

### Phase 3: Exploitation
```bash
1. combo_full_infrastructure.sh  # Try all protocols
   OR
2. Protocol-specific scripts      # Targeted attack
```

### Phase 4: Reporting
```bash
1. Check logs/results_YYYYMMDD.json
2. Use ../scripts/results_viewer.sh
3. Generate reports
```

---

## 📊 Performance Guide

| Protocol | Speed | Threads | Lockout Risk | Notes |
|----------|-------|---------|--------------|-------|
| FTP | Fast | 16 | Low | Quick testing |
| SSH | Medium | 16 | Medium | Key-based auth safer |
| MySQL | Fast | 8 | Low | Good for testing |
| RDP | Slow | 2 | **HIGH** | Use minimal threads |
| SMB | Medium | 4 | Medium | Domain aware |
| Web | Medium | 8 | Low | Form dependent |
| Telnet | Fast | 16 | Low | Legacy devices |
| VNC | Fast | 4 | Low | Password-only |

---

## 🐛 Enterprise Debugging

All scripts include:
- **`-v` flag**: Verbose output
- **`--help` flag**: Usage information
- **Error logs**: `../logs/hydra_YYYYMMDD.log`
- **JSON results**: `../logs/results_YYYYMMDD.json`
- **Exit codes**: Standard shell exit codes
- **Input validation**: Check all parameters
- **Dependency checks**: Verify tool availability

### Debug Example
```bash
# Enable verbose mode
bash ssh_quick.sh -v

# Check error log
cat ../logs/hydra_$(date +%Y%m%d).log

# View JSON results
cat ../logs/results_$(date +%Y%m%d).json | jq .

# Test script syntax
bash -n ssh_quick.sh
```

---

## 🔒 Legal & Ethical Use

### ✅ AUTHORIZED USE
- Systems you own
- Written permission obtained
- Controlled lab environments
- Bug bounty programs
- Professional pen-testing contracts

### ❌ UNAUTHORIZED USE
- Public websites without permission
- Corporate networks without authorization
- Educational institutions without approval
- Government systems
- Any system you don't own/control

**Violating these rules is ILLEGAL and prosecuted under:**
- CFAA (USA)
- Computer Misuse Act (UK)
- EU Cybercrime Directive
- Local cyber laws

---

## 📈 Script Statistics

```
Category                  Count
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Individual Protocols      22
Protocol Combinations     7
Advanced Scanning         9
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL SCRIPTS            38

Protocols Coverage:
- Network Services: 8
- Databases: 5
- Mail: 4
- Web: 3
- Management: 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL PROTOCOLS          40+
```

---

## 🆘 Troubleshooting

### Script Won't Execute
```bash
chmod +x Library/*.sh
```

### Hydra Not Found
```bash
pkg install hydra -y
```

### VPN Check Fails
```bash
# Skip VPN check (NOT recommended)
bash script.sh --skip-vpn
```

### No Results
```bash
# Check if attack succeeded
cat ../logs/hydra_$(date +%Y%m%d).log | grep "login:"
```

### Syntax Errors
```bash
# Validate script
bash -n script_name.sh
```

---

## 📚 Additional Documentation

- **`PROTOCOL_GUIDE.md`** - Complete protocol reference
- **`../docs/USAGE.md`** - Advanced usage guide
- **`../docs/EXAMPLES.md`** - Real-world scenarios
- **`../README.md`** - Main documentation

---

## 🎯 Quick Command Reference

```bash
# List all scripts
ls Library/*.sh

# Individual protocol attack
bash Library/ssh_quick.sh

# Combination attack
bash Library/combo_windows_infra.sh

# Advanced scanning
bash Library/nmap_full_scan.sh

# View results
bash scripts/results_viewer.sh --all

# Check logs
cat logs/hydra_$(date +%Y%m%d).log
```

---

**Version**: 2.0  
**Total Scripts**: 38  
**Protocols**: 40+  
**Lines to Change**: 1  
**Ready to Use**: YES ✅