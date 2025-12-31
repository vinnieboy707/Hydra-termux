# Enhanced Web Interface Features Guide

This guide explains how to use the new web interface features added to Hydra-Termux.

## Overview

The web interface now includes enhanced features for menu options 1-12, providing a modern, user-friendly way to:
- Generate attack scripts (Options 1-8)
- Manage wordlists (Option 9)
- Create custom wordlists (Option 10)
- Scan targets (Option 11)
- View results (Option 12)

## Accessing the Web Interface

1. **Start the Backend Server:**
   ```bash
   cd fullstack-app/backend
   npm install  # First time only
   npm start
   ```
   The backend API will be available at `http://localhost:3000`

2. **Start the Frontend:**
   ```bash
   cd fullstack-app/frontend
   npm install  # First time only
   npm start
   ```
   The web interface will open at `http://localhost:3001`

3. **Login:**
   - Default credentials: `admin` / `admin`
   - Change these immediately in production!

## New Features

### 1. Script Generator (Options 1-8: Attack Scripts)

**Location:** Navigate to "Script Generator" in the sidebar

**Purpose:** Generate ready-to-use terminal commands for all attack types without manually crafting Hydra commands.

**How to Use:**

1. **Select Attack Type:**
   - SSH Admin Attack
   - FTP Admin Attack
   - Web Admin Attack
   - RDP Admin Attack
   - MySQL Admin Attack
   - PostgreSQL Admin Attack
   - SMB Admin Attack
   - Multi-Protocol Auto Attack

2. **Fill in Parameters:**
   - **Target:** IP address or hostname (required)
   - **Port:** Custom port (optional, uses default if not specified)
   - **Username/Password:** Single credentials or select from wordlists
   - **Wordlists:** Choose from uploaded/downloaded wordlists
   - **Threads:** Number of parallel connections
   - **Additional options:** Verbose mode, HTTPS, domains, etc.

3. **Generate Script:**
   - Click "Generate Script" button
   - Copy the generated command
   - Open terminal and navigate to Hydra-termux directory
   - Paste and run the command

**Example Output:**
```bash
# SSH Admin Attack
# Target: 192.168.1.100:22
# This script uses THC-Hydra to brute-force SSH credentials

bash scripts/ssh_admin_attack.sh -t 192.168.1.100 -p 22 -u wordlists/usernames.txt -w wordlists/passwords.txt -T 16

# Results will be saved to logs/ directory
# Check results with: bash scripts/results_viewer.sh --protocol ssh
```

### 2. Wordlists Management (Option 9)

**Location:** Navigate to "Wordlists" in the sidebar

**Purpose:** View, upload, and manage password/username wordlists.

**Features:**

1. **View Wordlists:**
   - See all downloaded and created wordlists
   - View details: name, type, size, line count, path
   - Click "View" to see first 100 lines

2. **Upload Wordlists:**
   - Click "Upload Wordlist" button
   - Select a `.txt` file from your computer
   - File is automatically added to the wordlists directory
   - Available immediately for use in attacks

3. **Scan Directory:**
   - Click "Scan Directory" to import existing wordlists
   - Scans the wordlists/ folder and adds new files to database

4. **Delete Wordlists:**
   - Click "Delete" to remove unwanted wordlists
   - Deletes both file and database entry

**Supported Locations:**
- Upload via web interface (recommended)
- Place files in `wordlists/` directory and scan
- Download using option 9 in CLI menu

### 3. Custom Wordlist Generator (Option 10)

**Location:** Navigate to "Wordlist Generator" in the sidebar

**Purpose:** Create custom, targeted wordlists for specific attacks.

**Generation Modes:**

#### A. Combine Lists
Merge multiple existing wordlists into one:
1. Select wordlists to combine
2. Choose processing options (dedupe, sort)
3. Generate combined list

#### B. Pattern-Based
Generate passwords from base words and patterns:
1. **Enter Base Words:** One per line (e.g., "password", "admin", "user")
2. **Choose Options:**
   - Add numbers (0-9, 123, 2024)
   - Add special characters (!, @, #, $, *)
   - Add uppercase variations
3. **Set Pattern:** Use placeholders like `{word}{number}` or `{word}{year}`
4. **Set Length Limits:** Minimum and maximum password length

**Example:**
- Base word: "admin"
- Pattern: "{word}{number}"
- Output: admin0, admin1, admin2, ... admin999, Admin0, Admin1, ...

#### C. Custom List
Manually enter entries:
1. Type or paste entries (one per line)
2. Apply deduplication and sorting
3. Save with custom name

**Processing Options:**
- **Remove Duplicates:** Eliminate duplicate entries
- **Sort Alphabetically:** Order entries A-Z

### 4. Target Scanner (Option 11)

**Location:** Navigate to "Target Scanner" in the sidebar

**Purpose:** Scan targets to identify open ports, services, and attack vectors.

**Supported Target Types:**

1. **IP Address:** `192.168.1.100`
2. **Domain:** `example.com`
3. **Email:** `user@example.com`

**Scan Types:**

- **Auto-detect:** Automatically choose best scan method
- **Quick Scan:** Top 100 common ports (fast)
- **Full Scan:** All 65,535 ports (thorough but slow)
- **Aggressive:** OS and service version detection

**How to Use:**

1. Enter target (IP, domain, or email)
2. Select scan type
3. Click "Start Scan"
4. Wait for results (1-5 minutes depending on scan type)

**Results Include:**

- **Target Type:** IP, domain, or email
- **Open Ports:** Count of accessible ports
- **Services Detected:** Identified services running
- **Protocol Details:**
  - Port number and service name
  - Service information
  - Recommended attack script
- **Email Information** (for email targets):
  - Domain extracted
  - MX records
  - Potential attack vectors
- **Recommended Scripts:**
  - Copy-paste commands for detected services
  - Prioritized by likelihood of success

**Example Output:**
```
Port 22 - SSH
Secure Shell - Remote login service
State: open

Recommended Script:
bash scripts/ssh_admin_attack.sh
```

### 5. View Attack Results (Option 12)

**Location:** Navigate to "Results" in the sidebar

**Purpose:** View all attack results, successful credentials, and logs.

**Features:**

- Filter by protocol (SSH, FTP, Web, etc.)
- Filter by status (success, failed)
- Export results to CSV, JSON, or TXT
- View detailed attack logs
- Search and sort results

## Integration with CLI Scripts

All web interface features integrate with the existing CLI scripts:

### Web → CLI Flow:

1. **Generate script in web interface**
2. **Copy generated command**
3. **Run in terminal:**
   ```bash
   cd /path/to/Hydra-termux
   # Paste generated command
   bash scripts/ssh_admin_attack.sh -t 192.168.1.100 -w wordlists/passwords.txt
   ```

### CLI → Web Flow:

1. **Run attack via CLI**
2. **Results saved to logs/**
3. **View in web interface** under "Results"

## Best Practices

1. **Wordlist Management:**
   - Upload specific wordlists for targeted attacks
   - Use "Combine Lists" to merge related wordlists
   - Generate custom wordlists for known targets (company names, dates, etc.)

2. **Target Scanning:**
   - Always scan before attacking to identify services
   - Use "Quick Scan" first, then "Full Scan" if needed
   - Review recommended scripts before running

3. **Script Generation:**
   - Fill all optional fields for better results
   - Use wordlists instead of single credentials for brute-force
   - Adjust thread count based on target and network speed

4. **Security:**
   - Only test authorized targets
   - Use VPN for anonymity
   - Monitor attack progress and stop if needed

## Troubleshooting

### "Wordlist not found" Error
- Ensure wordlist is uploaded or scanned
- Check wordlists directory exists: `wordlists/`
- Re-scan directory via web interface

### "Target scanner not working"
- Install nmap if not present: `pkg install nmap`
- Check target is reachable
- Try different scan type

### "Script generation failed"
- Verify target format (IP or domain)
- Ensure at least target field is filled
- Check wordlist selection if using wordlists

### "Upload failed"
- Only `.txt` files are supported
- Check file size (recommended < 100MB)
- Ensure proper permissions on wordlists/ directory

## API Endpoints (for developers)

The new features add these backend endpoints:

- `POST /api/scan/target` - Scan a target
- `POST /api/wordlists/upload` - Upload wordlist
- `GET /api/wordlists/:id/content` - Get wordlist content
- `POST /api/wordlists/generate` - Generate custom wordlist
- `DELETE /api/wordlists/:id` - Delete wordlist

## Navigation Structure

```
Dashboard
├── Script Generator (Options 1-8)
│   ├── SSH Admin Attack
│   ├── FTP Admin Attack
│   ├── Web Admin Attack
│   ├── RDP Admin Attack
│   ├── MySQL Admin Attack
│   ├── PostgreSQL Admin Attack
│   ├── SMB Admin Attack
│   └── Multi-Protocol Auto Attack
├── Attacks (Create/manage attacks)
├── Target Scanner (Option 11)
├── Targets (Manage target list)
├── Results (Option 12)
├── Wordlists (Option 9)
└── Wordlist Generator (Option 10)
```

## Command Line to Web Interface Mapping

| CLI Option | Web Interface Location | Purpose |
|------------|------------------------|---------|
| 1-8 | Script Generator | Generate attack scripts |
| 9 | Wordlists | View/upload wordlists |
| 10 | Wordlist Generator | Create custom wordlists |
| 11 | Target Scanner | Scan targets |
| 12 | Results | View attack results |
| 13 | Config (planned) | View configuration |
| 14 | Logs (planned) | View logs |
| 15 | Results → Export | Export results |

## Summary

The enhanced web interface provides:

✅ **User-friendly script generation** - No need to memorize command syntax
✅ **Complete wordlist management** - Upload, view, generate, and delete
✅ **Intelligent target scanning** - Automatic protocol detection
✅ **Seamless CLI integration** - Generated commands work with existing scripts
✅ **Real-time results** - View attack progress and results instantly

All features are designed to complement the existing CLI tools while providing a modern, accessible interface for users who prefer graphical interaction.
