# Changelog

All notable changes to Hydra-Termux will be documented in this file.

## [2.0.0] - 2025-01-01 - Ultimate Edition

### Added
- **8 Pre-built Attack Scripts**:
  - SSH Admin Attack with resume support
  - FTP Admin Attack with timeout handling
  - Web Admin Attack with form detection
  - RDP Admin Attack with lockout prevention
  - MySQL Admin Attack with connection strings
  - PostgreSQL Admin Attack
  - SMB Admin Attack with domain support
  - Multi-Protocol Auto Attack with nmap integration

- **Utility Scripts**:
  - Wordlist Download Manager (SecLists integration)
  - Wordlist Generator (combine, dedupe, sort)
  - Target Scanner (nmap wrapper with multiple scan types)
  - Results Viewer (filter, export, manage results)

- **Enhanced Main Launcher**:
  - Beautiful ASCII art banner
  - Interactive menu system (18 options)
  - Quick access to all tools
  - Configuration management
  - Update system

- **Configuration System**:
  - hydra.conf with customizable settings
  - Default username and password lists
  - Centralized configuration management

- **Logging System**:
  - Timestamped log entries
  - Color-coded output
  - JSON results tracking
  - Export to TXT, CSV, JSON formats
  - Automatic log rotation

- **Documentation**:
  - Comprehensive README.md
  - Usage guide (docs/USAGE.md)
  - Examples (docs/EXAMPLES.md)
  - Contributing guidelines
  - MIT License

### Enhanced
- **Installation Script**:
  - VPN check and warning
  - Additional packages (nmap, jq, figlet, termux-api)
  - Directory structure creation
  - Verification of installed components
  - Optional wordlist download

- **Security Features**:
  - VPN usage reminder
  - Rate limiting options
  - Random delay between attempts
  - Resume support for interrupted attacks

### Fixed
- Improved error handling across all scripts
- Better input validation
- Graceful degradation when tools unavailable

## [1.0.0] - 2024-12-01

### Added
- Initial release
- Basic Hydra installation script
- README with installation instructions
- Package management via need.txt

### Features
- Simple installation process
- Termux optimization
- Basic documentation

---

## Version Numbering

This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible changes
- **MINOR** version for new functionality
- **PATCH** version for bug fixes
