# Complete Scripts Directory Reference

## 📚 Overview

This document provides a comprehensive reference for all scripts and their locations within the Hydra-Termux repository.

## 📁 Directory Structure

```
Hydra-Termux/
├── Library/              # Quick-use and combo scripts
├── scripts/              # Main attack scripts
├── docs/                 # Documentation
├── fullstack-app/        # Backend modules and frontend
└── hydra.sh              # Main menu interface
```

## 🎯 Email & IP Penetration Testing Scripts

### Main Attack Script
- **Location**: `scripts/email_ip_attack.sh`
- **Size**: 48KB (1,227 lines)
- **Features**: 5 attack modes, 6+ protocols
- **Menu Option**: 38
- **Protocols**: IMAP, POP3, SMTP, IMAPS, POP3S, SMTPS

### Quick Library Scripts
- **Location**: `Library/email_ip_pentest_quick.sh`
- **Size**: 16KB
- **Features**: 2-line configuration, auto-detection
- **Execution**: 3-10 minutes
- **Usage**: Edit TARGET and EMAIL, then run

### Domain-Wide Script
- **Location**: `Library/combo_email_domain.sh`
- **Size**: 12KB
- **Features**: 4-phase workflow, complete domain assessment
- **Execution**: 15-30 minutes

## 🏆 Supreme Combo Scripts

### 1. Corporate Stack
- **Location**: `Library/combo_supreme_email_web_db.sh`
- **Size**: 13KB
- **Menu Option**: 39
- **Protocols**: 7 (SMTP, IMAP, POP3, HTTP, HTTPS, MySQL, PostgreSQL)
- **Best For**: Corporate infrastructure audits
- **Execution Time**: 20-40 minutes

### 2. Cloud Infrastructure
- **Location**: `Library/combo_supreme_cloud_infra.sh`
- **Size**: 13KB
- **Menu Option**: 40
- **Protocols**: 8+ (SSH, RDP, MySQL/RDS, PostgreSQL, Redis, MongoDB, APIs)
- **Best For**: AWS/Azure/GCP cloud services
- **Execution Time**: 25-45 minutes

### 3. Complete Network
- **Location**: `Library/combo_supreme_network_complete.sh`
- **Size**: 15KB
- **Menu Option**: 41
- **Protocols**: 10 (SSH, Telnet, FTP, SMB, HTTP, HTTPS, MySQL, PostgreSQL, RDP, VNC)
- **Best For**: Full network infrastructure assessment
- **Execution Time**: 30-60 minutes

### 4. Active Directory
- **Location**: `Library/combo_supreme_active_directory.sh`
- **Size**: 15KB
- **Menu Option**: 42
- **Protocols**: 7+ (LDAP, LDAPS, SMB, RDP, MSSQL, OWA, SharePoint, DNS)
- **Best For**: Windows domain environments
- **Execution Time**: 35-70 minutes

### 5. Web Apps & APIs
- **Location**: `Library/combo_supreme_webapp_api.sh`
- **Size**: 17KB
- **Menu Option**: 43
- **Protocols**: 10+ (Forms, REST APIs, WordPress, Joomla, Drupal, Admin panels)
- **Best For**: Modern web application testing
- **Execution Time**: 25-50 minutes

## 📝 Backend Modules

### Location: `fullstack-app/backend/modules/`

#### Core Modules (10 files)
1. **dnsIntelligence.js** (493 lines) - DNS analysis, SPF/DMARC/DKIM
2. **attackOrchestrator.js** (482 lines) - Bull queue management
3. **credentialManager.js** (486 lines) - AES-256 encryption
4. **resultParser.js** (489 lines) - Multi-tool parsing
5. **notificationManager.js** (601 lines) - Email/webhook notifications
6. **analyticsEngine.js** (551 lines) - Statistics and trends
7. **exportManager.js** (594 lines) - CSV/JSON/PDF exports
8. **cacheManager.js** (431 lines) - Redis caching
9. **logManager.js** (338 lines) - Winston logging
10. **validationSchemas.js** (409 lines) - Joi validation

#### Support Files
- **index.js** (186 lines) - Centralized exports
- **test-modules.js** (227 lines) - Integration tests
- **example-integration.js** (380 lines) - Express examples
- **README.md** (407 lines) - API documentation
- **IMPLEMENTATION_SUMMARY.md** (263 lines) - Technical details

## 🌐 Backend Routes

### Location: `fullstack-app/backend/routes/`

- **attack-analytics.js** - Attack statistics and analytics
- **dns-intelligence.js** - DNS intelligence endpoints
- Additional route files for various attack modules

## 📖 Documentation

### Location: `docs/`

#### Email & IP Testing
- **EMAIL_IP_PENTEST_GUIDE.md** (27KB) - Complete usage guide
- **EMAIL_IP_IMPLEMENTATION_SUMMARY.md** (8KB) - Technical summary

#### Supreme Combos
- **SUPREME_COMBO_SCRIPTS_GUIDE.md** (12KB) - Comprehensive guide
- **SCRIPTS_DIRECTORY_REFERENCE.md** (this file) - Complete reference

#### Library Documentation
- **Library/README.md** (6.5KB) - Quick script guide
- **Library/PROTOCOL_GUIDE.md** (11KB) - Protocol explanations

#### General Guides
- **USAGE.md** - General usage instructions
- **TROUBLESHOOTING.md** - Problem resolution
- **EXAMPLES.md** - Usage examples

## 🚀 Usage Quick Reference

### Via Main Menu (hydra.sh)
```bash
./hydra.sh
# Select option:
# 38 - Email & IP Penetration Test
# 39 - Corporate Stack Attack
# 40 - Cloud Infrastructure Attack
# 41 - Complete Network Attack
# 42 - Active Directory Attack
# 43 - Web Apps & APIs Attack
```

### Direct Script Execution
```bash
# Email-IP attack with all options
bash scripts/email_ip_attack.sh -e admin@example.com -m full -v

# Quick email-IP test
bash Library/email_ip_pentest_quick.sh

# Supreme combo scripts
bash Library/combo_supreme_email_web_db.sh
bash Library/combo_supreme_cloud_infra.sh
bash Library/combo_supreme_network_complete.sh
bash Library/combo_supreme_active_directory.sh
bash Library/combo_supreme_webapp_api.sh
```

## 🔍 Finding Scripts

### By Protocol
- **Email protocols** (SMTP/IMAP/POP3): `scripts/email_ip_attack.sh`
- **Web protocols** (HTTP/HTTPS): `combo_supreme_webapp_api.sh`
- **Database protocols**: `combo_supreme_email_web_db.sh`, `combo_supreme_cloud_infra.sh`
- **Network protocols**: `combo_supreme_network_complete.sh`
- **Windows/AD protocols**: `combo_supreme_active_directory.sh`

### By Use Case
- **Single email account**: `Library/email_quick.sh`
- **Mail server assessment**: `scripts/email_ip_attack.sh`
- **Domain-wide email**: `Library/combo_email_domain.sh`
- **Corporate infrastructure**: `combo_supreme_email_web_db.sh`
- **Cloud services**: `combo_supreme_cloud_infra.sh`
- **Complete network**: `combo_supreme_network_complete.sh`
- **Active Directory**: `combo_supreme_active_directory.sh`
- **Web applications**: `combo_supreme_webapp_api.sh`

### By Execution Time
- **Quick (3-10 min)**: `email_ip_pentest_quick.sh`
- **Medium (20-40 min)**: Supreme combo scripts
- **Long (30-70 min)**: `combo_supreme_network_complete.sh`, `combo_supreme_active_directory.sh`

## ✅ Integration Status

### Main Menu Integration
- ✅ Option 38: Email & IP Penetration Test
- ✅ Option 39: Corporate Stack (Email+Web+DB)
- ✅ Option 40: Cloud Infrastructure
- ✅ Option 41: Complete Network
- ✅ Option 42: Active Directory
- ✅ Option 43: Web Apps & APIs

### Script Locations
- ✅ All scripts in correct directories
- ✅ All scripts have execute permissions
- ✅ All scripts pass syntax validation

### Documentation
- ✅ Complete usage guides
- ✅ Technical implementation summaries
- ✅ Protocol references
- ✅ Directory structure documented

### Backend Integration
- ✅ 10 production-ready modules
- ✅ API routes implemented
- ✅ Database schema defined
- ✅ Frontend components prepared

## 📊 Statistics Summary

- **Total Scripts**: 8 (3 email-IP + 5 supreme combos)
- **Total Backend Modules**: 14 files
- **Total Documentation**: 6 comprehensive guides (85KB)
- **Total Lines of Code**: 13,000+
- **Total Size**: 350KB+
- **Protocols Supported**: 35+ unique protocols
- **Attack Modes**: 5 distinct modes
- **Functions**: 200+ in backend modules

## 🔐 Security Status

✅ All security vulnerabilities fixed
✅ Command injection eliminated
✅ SQL injection prevented
✅ Input validation implemented
✅ Password validation enforced
✅ Zero unused variables
✅ Production-ready code

## 📝 Notes

- All scripts require configuration before use
- Edit TARGET/DOMAIN/EMAIL variables as needed
- Run with appropriate permissions
- VPN recommended for production attacks
- Follow responsible disclosure practices

---

**Last Updated**: 2026-01-20
**Version**: 2.0 (Production Ready)
**Maintainer**: Hydra-Termux Development Team
