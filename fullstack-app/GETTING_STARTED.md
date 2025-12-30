# 🚀 Getting Started with Hydra-Termux Platform

## Quick Start (Recommended)

**One command to rule them all:**

```bash
cd fullstack-app
./quickstart.sh
```

This single script will:
- ✅ Check all prerequisites
- ✅ Install all dependencies (backend + frontend)
- ✅ Create configuration files
- ✅ Initialize the database
- ✅ Create your super admin account
- ✅ Start both backend and frontend servers
- ✅ Open your browser automatically

**That's it! You're ready to start penetration testing!**

---

## Prerequisites

- **Node.js** 14.0.0 or higher
- **npm** (comes with Node.js)
- **Terminal access** (Termux for Android, or any Linux/Mac/Windows terminal)

### Installation on Termux (Android):
```bash
pkg update && pkg upgrade
pkg install nodejs git
```

### Installation on Linux/Mac:
```bash
# Use your package manager or download from nodejs.org
# Ubuntu/Debian:
sudo apt install nodejs npm

# macOS (with Homebrew):
brew install node
```

---

## Manual Setup (Alternative)

If you prefer to set up manually:

### Step 1: Install Dependencies

```bash
cd fullstack-app

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
cd ..
```

### Step 2: Configure Backend

```bash
cd backend
cp .env.example .env
nano .env  # Edit with your settings
```

**Minimal configuration** (works out of the box):
```bash
DB_TYPE=sqlite
JWT_SECRET=your-secret-key-here
PORT=3000
```

### Step 3: Configure Frontend

```bash
cd ../frontend
echo "PORT=3001" > .env
echo "REACT_APP_API_URL=http://localhost:3000" >> .env
```

### Step 4: Create Super Admin Account

```bash
cd ../backend
node -e "
const bcrypt = require('bcrypt');
const { run } = require('./database');
(async () => {
  await new Promise(r => setTimeout(r, 2000));
  const hash = await bcrypt.hash('your-password', 10);
  await run('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
    ['your-username', hash, 'your@email.com', 'super_admin']);
  console.log('Super admin created!');
  process.exit(0);
})();
"
```

### Step 5: Start Services

**Option A: Two terminals**
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
PORT=3001 npm start
```

**Option B: Background mode**
```bash
cd backend
npm start &
cd ../frontend
PORT=3001 npm start
```

---

## Access the Platform

After starting:

1. **Frontend UI**: http://localhost:3001
2. **Backend API**: http://localhost:3000
3. **API Docs**: http://localhost:3000/api/health

Login with your super admin credentials!

---

## First Steps After Login

### 1. Change Your Password
Navigate to **Settings** → **Security** → **Change Password**

### 2. Enable 2FA (Recommended)
Navigate to **Settings** → **Security** → **Enable 2FA**
- Scan QR code with Google Authenticator or Authy
- Save backup codes securely

### 3. Create Additional Users
Navigate to **Admin** → **Users** → **Add User**
- Assign appropriate roles (admin, analyst, auditor, viewer)

### 4. Configure External APIs (Optional)
Navigate to **Settings** → **Integrations**
- Add VirusTotal API key for malware scanning
- Add Shodan API key for network reconnaissance
- Add other service keys as needed

### 5. Review Security Settings
Navigate to **Settings** → **Security Protocols**
- Configure IP whitelisting
- Set password policies
- Review session timeouts

---

## Running Your First Penetration Test

### Quick Test: SSH Brute Force

1. **Add a Target**
   - Navigate to **Targets** → **Add New**
   - Enter target details (host, port, protocol)

2. **Launch Attack**
   - Go to **Attacks** → **New Attack**
   - Select attack type: **SSH Brute Force**
   - Configure options (threads, timeout, etc.)
   - Choose or upload wordlist
   - Click **Launch**

3. **Monitor Progress**
   - Real-time progress updates via WebSocket
   - View logs in **Logs** section
   - Check results in **Results** section

4. **Export Results**
   - Navigate to **Results** → Select attack
   - Click **Export** → Choose format (JSON, CSV)

---

## Architecture Overview

```
Hydra-Termux Platform
├── Backend (Express.js) - Port 3000
│   ├── REST API endpoints
│   ├── WebSocket server (real-time updates)
│   ├── Database (SQLite/PostgreSQL)
│   └── Security middleware (RBAC, WAF, encryption)
│
├── Frontend (React) - Port 3001
│   ├── Modern UI with dark theme
│   ├── Real-time attack monitoring
│   ├── Dashboard and analytics
│   └── Security management interface
│
└── CLI Tools (Bash scripts)
    ├── Hydra attack scripts
    ├── Wordlist generators
    └── Target scanners
```

---

## Available Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Super Admin** | Full access to everything, including system configuration |
| **Admin** | Manage users, configure platform, launch attacks |
| **Security Analyst** | Launch attacks, view results, manage targets |
| **Auditor** | View-only access to all data, export capabilities |
| **Viewer** | Read-only access to dashboards and results |
| **User** | Basic access to launch attacks and view own results |

---

## Configuration Options

### Database Options

**SQLite (Default - Easy)**
```bash
DB_TYPE=sqlite
DB_PATH=../database.sqlite
```

**PostgreSQL (Production - Scalable)**
```bash
DB_TYPE=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=hydra_termux
POSTGRES_USER=hydra_user
POSTGRES_PASSWORD=secure_password
```

### Security Options

```bash
# JWT Secret (required)
JWT_SECRET=your-very-secure-random-string

# 2FA Configuration
TOTP_ISSUER=Hydra-Termux

# Session Settings
SESSION_TIMEOUT=30  # minutes
MAX_CONCURRENT_SESSIONS=5
```

### External API Integrations

```bash
# VirusTotal
VIRUSTOTAL_API_KEY=your_key_here

# Shodan
SHODAN_API_KEY=your_key_here

# AbuseIPDB
ABUSEIPDB_API_KEY=your_key_here

# Censys
CENSYS_API_ID=your_id
CENSYS_API_SECRET=your_secret
```

---

## Troubleshooting

### Port Already in Use

**Problem**: `Error: Port 3000 already in use`

**Solution**:
```bash
# Find process using port
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Kill process or change port
kill -9 <PID>
# OR edit .env and change PORT
```

### Database Connection Error

**Problem**: `Error: Cannot connect to database`

**Solution**:
```bash
# For SQLite - check file permissions
ls -la ../database.sqlite
chmod 644 ../database.sqlite

# For PostgreSQL - check if service is running
sudo systemctl status postgresql
# or
pg_ctl status
```

### Module Not Found

**Problem**: `Error: Cannot find module 'express'`

**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Frontend Not Loading

**Problem**: Frontend shows blank page or connection error

**Solution**:
```bash
# Check if backend is running
curl http://localhost:3000/api/health

# Check frontend .env
cat frontend/.env
# Should have: REACT_APP_API_URL=http://localhost:3000

# Clear cache and restart
rm -rf frontend/node_modules/.cache
cd frontend && npm start
```

---

## Security Best Practices

### 1. Strong Passwords
- Minimum 12 characters
- Mix of upper/lower case, numbers, symbols
- No dictionary words
- Use a password manager

### 2. Enable 2FA
- Required for all admin accounts
- Use app-based 2FA (Google Authenticator, Authy)
- Store backup codes securely offline

### 3. IP Whitelisting
- Restrict access to known IPs
- Use VPN for remote access
- Regularly review whitelist

### 4. Regular Updates
- Check for updates weekly
- Review security logs daily
- Update API keys if compromised

### 5. Audit Logging
- Monitor all security events
- Review failed login attempts
- Set up alerts for suspicious activity

---

## Support & Documentation

### Documentation Files
- **ONBOARDING_TUTORIAL.md** - Complete walkthrough (15,000+ words)
- **API_DOCUMENTATION.md** - Complete API reference
- **SECURITY_PROTOCOLS.md** - Security guidelines
- **POSTGRESQL_SETUP.md** - Database setup guide
- **DEPLOYMENT_GUIDE.md** - Production deployment

### Need Help?
1. Check documentation files
2. Review error logs in `logs/` directory
3. Check issues on GitHub
4. Contact support

---

## Legal Notice

⚠️ **IMPORTANT**: This is a penetration testing tool. Only use on systems you own or have explicit permission to test.

**Authorized Use Only:**
- Own infrastructure testing
- Authorized penetration testing engagements
- Security research with proper authorization
- Educational purposes in controlled environments

**Prohibited Uses:**
- Unauthorized access attempts
- Attacking third-party systems without permission
- Any illegal activities

**Disclaimer**: The developers are not responsible for misuse. Users assume all legal responsibility.

---

## Quick Reference Card

**Start Platform**: `./quickstart.sh`

**Backend Only**: `cd backend && npm start`

**Frontend Only**: `cd frontend && PORT=3001 npm start`

**View Logs**: `tail -f logs/*.log`

**Check Status**: `curl http://localhost:3000/api/health`

**Stop Services**: `Ctrl+C` or `pkill -f "node server.js"`

---

🎉 **You're all set! Happy (ethical) hacking!** 🎉
