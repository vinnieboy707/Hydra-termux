# Quick Reference: CLI to Web Interface Mapping

This document provides a quick reference for how CLI menu options (1-18) map to the new web interface features.

## 🎯 Attack Scripts (Options 1-8)

### CLI Access:
```bash
./hydra.sh
# Select options 1-8 from menu
```

### Web Interface:
- **Location:** Click "Script Generator" in sidebar
- **URL:** http://localhost:3001/script-generator

### Features:
- Select attack type from left panel
- Fill in configuration form
- Click "Generate Script" to create command
- Copy and run in terminal

**All 8 Attack Types Available:**
1. SSH Admin Attack
2. FTP Admin Attack
3. Web Admin Attack
4. RDP Admin Attack
5. MySQL Admin Attack
6. PostgreSQL Admin Attack
7. SMB Admin Attack
8. Multi-Protocol Auto Attack

---

## 📚 Download Wordlists (Option 9)

### CLI Access:
```bash
./hydra.sh
# Select option 9
```

### Web Interface:
- **Location:** Click "Wordlists" in sidebar
- **URL:** http://localhost:3001/wordlists

### Features:
- **View All Wordlists:** See list of all available wordlists
- **Upload:** Click "Upload Wordlist" to add new .txt files
- **Scan Directory:** Import wordlists from wordlists/ folder
- **View Content:** Click "View" to see first 100 lines
- **Delete:** Remove unwanted wordlists

**Integration:** Uploaded wordlists automatically appear in Script Generator dropdown menus

---

## 🔧 Generate Custom Wordlist (Option 10)

### CLI Access:
```bash
./hydra.sh
# Select option 10
```

### Web Interface:
- **Location:** Click "Wordlist Generator" in sidebar
- **URL:** http://localhost:3001/wordlist-generator

### Features:

**3 Generation Modes:**

1. **Combine Lists**
   - Select multiple wordlists to merge
   - Automatic deduplication
   - Alphabetical sorting

2. **Pattern-Based**
   - Enter base words
   - Add numbers, special chars, uppercase
   - Use patterns: `{word}{number}`, `{word}{year}`
   - Set min/max length

3. **Custom List**
   - Manually enter entries
   - One per line
   - Save with custom name

**Generated wordlists are immediately available in "Wordlists" page**

---

## 🔍 Scan Target (Option 11)

### CLI Access:
```bash
./hydra.sh
# Select option 11
```

### Web Interface:
- **Location:** Click "Target Scanner" in sidebar
- **URL:** http://localhost:3001/scanner

### Features:
- **Input Types:** IP address, domain name, or email
- **Scan Types:** Auto, Quick (top 100 ports), Full (all ports), Aggressive
- **Results Show:**
  - Open ports and services
  - Protocol recommendations
  - Suggested attack scripts
  - Email MX records (for email targets)

**Example:**
```
Input: 192.168.1.100
Scan Type: Quick
Output: Port 22 (SSH) open → Recommends ssh_admin_attack.sh
```

---

## ✅ View Attack Results (Option 12)

### CLI Access:
```bash
./hydra.sh
# Select option 12
```

### Web Interface:
- **Location:** Click "Results" in sidebar
- **URL:** http://localhost:3001/results

### Features:
- View all attack results
- Filter by protocol (SSH, FTP, Web, etc.)
- Filter by status (success, failed)
- Export to CSV, JSON, or TXT
- Search and sort

**Note:** This page was already available in the web interface and has been preserved.

---

## 📊 Management Options (13-16)

### Option 13: View Configuration
- **CLI:** View config/hydra.conf
- **Web:** Currently accessed via backend API
- **Planned:** Dedicated Config page in web interface

### Option 14: View Logs
- **CLI:** View today's logs
- **Web:** Accessible via Results page
- **Planned:** Dedicated Logs viewer

### Option 15: Export Results
- **CLI:** Export to TXT/CSV/JSON
- **Web:** Available in Results page → Export button

### Option 16: Update Hydra-Termux
- **CLI:** Git pull updates
- **Web:** Not applicable (web interface auto-updates)

---

## 📖 Other Options (17-18)

### Option 17: Help & Documentation
- **CLI:** Display help text
- **Web:** See `/docs/WEB_INTERFACE_GUIDE.md`

### Option 18: About & Credits
- **CLI:** Display version and credits
- **Web:** Available in Dashboard or footer

### Option 0: Exit
- **CLI:** Exit program
- **Web:** Logout button in sidebar

---

## 🚀 Quick Start Workflow

### For Web Interface Users:

1. **Start Services:**
   ```bash
   cd fullstack-app/backend && npm start
   cd fullstack-app/frontend && npm start
   ```

2. **Login:** http://localhost:3001 (admin/admin)

3. **Upload Wordlists:**
   - Navigate to "Wordlists"
   - Click "Upload Wordlist"
   - Select your .txt files

4. **Scan Target:**
   - Navigate to "Target Scanner"
   - Enter target IP/domain
   - Click "Start Scan"
   - Review open ports and services

5. **Generate Attack Script:**
   - Navigate to "Script Generator"
   - Select attack type (e.g., SSH)
   - Fill in target and wordlists
   - Click "Generate Script"
   - Copy command

6. **Execute Attack:**
   - Open terminal
   - Navigate to Hydra-termux directory
   - Paste and run generated command

7. **View Results:**
   - Return to web interface
   - Navigate to "Results"
   - Filter and export as needed

---

## 📋 Feature Comparison Table

| Feature | CLI Menu | Web Interface | Notes |
|---------|----------|---------------|-------|
| SSH Attack | Option 1 | Script Generator | Form-based generation |
| FTP Attack | Option 2 | Script Generator | Form-based generation |
| Web Attack | Option 3 | Script Generator | Form-based generation |
| RDP Attack | Option 4 | Script Generator | Form-based generation |
| MySQL Attack | Option 5 | Script Generator | Form-based generation |
| PostgreSQL Attack | Option 6 | Script Generator | Form-based generation |
| SMB Attack | Option 7 | Script Generator | Form-based generation |
| Auto Attack | Option 8 | Script Generator | Form-based generation |
| Download Wordlists | Option 9 | Wordlists | Upload + view + scan |
| Generate Wordlist | Option 10 | Wordlist Generator | 3 generation modes |
| Scan Target | Option 11 | Target Scanner | Protocol detection |
| View Results | Option 12 | Results | Filter + export |
| View Config | Option 13 | API/Planned | Configuration viewer |
| View Logs | Option 14 | Results/Planned | Log viewer |
| Export Results | Option 15 | Results | Multiple formats |
| Update Tool | Option 16 | N/A | CLI only |
| Help | Option 17 | Documentation | Web docs |
| About | Option 18 | Dashboard | Version info |

---

## 🎯 Best Use Cases

### When to Use CLI:
- Quick single attacks
- Scripting/automation
- Remote server access (no GUI)
- Termux on Android

### When to Use Web Interface:
- First-time users
- Complex configurations
- Managing multiple attacks
- Visual feedback preferred
- Target reconnaissance
- Wordlist management

### Hybrid Approach (Recommended):
1. Use web interface for reconnaissance and script generation
2. Copy generated commands to CLI
3. Execute attacks via terminal
4. View results in web interface

---

## 💡 Pro Tips

1. **Wordlists:**
   - Upload wordlists via web for easy management
   - Generate custom lists for specific targets
   - Combine generic lists with target-specific words

2. **Target Scanning:**
   - Always scan before attacking
   - Use Quick scan first, Full scan if needed
   - Note the recommended scripts

3. **Script Generation:**
   - Fill all fields for better results
   - Save generated commands for reuse
   - Adjust threads based on target

4. **Results:**
   - Export results regularly
   - Filter by protocol for organization
   - Review logs for troubleshooting

---

## 🔗 Navigation Links

| Page | URL Path | CLI Equivalent |
|------|----------|----------------|
| Dashboard | `/` | Main menu |
| Script Generator | `/script-generator` | Options 1-8 |
| Attacks | `/attacks` | Running attacks |
| Target Scanner | `/scanner` | Option 11 |
| Targets | `/targets` | Target management |
| Results | `/results` | Option 12 |
| Wordlists | `/wordlists` | Option 9 |
| Wordlist Generator | `/wordlist-generator` | Option 10 |

---

## 📞 Support

**Web Interface Issues:**
- Check browser console (F12)
- Verify backend is running (port 3000)
- Verify frontend is running (port 3001)

**CLI Issues:**
- See main README.md
- Check script permissions
- Verify hydra installation

**Both:**
- Review logs in logs/ directory
- Check configuration in config/
- See docs/WEB_INTERFACE_GUIDE.md

---

**Last Updated:** December 2024
**Version:** 2.0.0 Ultimate Edition
