# 🐍 Hydra-Termux Enterprise Platform

Complete enterprise-grade penetration testing platform with modern web interface, advanced security features, and comprehensive API coverage for all 18 CLI menu operations.

## 🚀 Quick Start - One Command Deployment

```bash
cd fullstack-app
./start.sh
```

**That's it!** The script will:
- ✅ Check prerequisites and install dependencies
- ✅ Configure backend and frontend automatically
- ✅ Initialize database with proper schema
- ✅ Create your admin account (username: admin, password: admin)
- ✅ Start both backend (port 3000) and frontend (port 3001)
- ✅ Ready to use in under 2 minutes!

**📚 First time? See [GETTING_STARTED.md](GETTING_STARTED.md) for complete walkthrough.**

---

## 🤖 Termux/Android Setup

**Running on Android via Termux?** Use the automated fix script for a smooth setup:

### Quick Fix (Recommended)

```bash
# From the repository root, run:
npm run fix-termux

# Or directly:
bash scripts/fix-termux-setup.sh
```

The fix script automatically:
- ✅ Detects Termux environment
- ✅ Replaces native `bcrypt` with pure JS `bcryptjs`
- ✅ Installs all dependencies with mobile optimizations
- ✅ Creates necessary environment files
- ✅ Runs health checks and validates setup
- ✅ Provides detailed next steps

### Why This Is Needed

The default `bcrypt` package requires native compilation (C++ bindings) which fails on Android because:
- ❌ No pre-built binaries for `android-arm64-unknown` platform
- ❌ node-gyp requires Android NDK which isn't available in Termux
- ❌ Compilation errors: `gyp ERR! Undefined variable android_ndk_path`

**Solution:** `bcryptjs` is a pure JavaScript implementation that:
- ✅ Works identically to bcrypt (same API)
- ✅ No native dependencies or compilation needed
- ✅ Perfect for Termux and mobile environments
- ✅ Slightly slower but fully functional

### Manual Setup (If Needed)

If you prefer manual setup or the script doesn't work:

```bash
# 1. Replace bcrypt in backend
cd fullstack-app/backend
sed -i 's/"bcrypt"/"bcryptjs"/g' package.json
npm install --legacy-peer-deps

# 2. Install frontend dependencies
cd ../frontend
npm install --legacy-peer-deps

# 3. Start the application
cd ../backend && npm start
# In new terminal:
cd fullstack-app/frontend && npm start
```

### Troubleshooting

**Port already in use:**
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9
# Or use a different port in backend/.env
```

**Low memory issues:**
```bash
# Close other apps, or install with fewer concurrent jobs
npm install --legacy-peer-deps --maxsockets=1
```

**Check system health:**
```bash
npm run health-check
```

---

## ✨ What's Included

### Complete Feature Set
- **18 Attack Types**: All CLI menu items accessible via web interface
- **Real-time Monitoring**: WebSocket-based live attack progress
- **Enterprise Security**: RBAC, WAF, 2FA, encryption, audit logging
- **Dual Database**: SQLite (default) or PostgreSQL (production)
- **Webhook System**: 8 event types with HMAC-SHA256 signatures
- **External APIs**: VirusTotal, Shodan, AbuseIPDB, Censys, HIBP
- **Modern UI**: Contemporary dark theme with smooth transitions
- **76+ Validation Checks**: All JavaScript syntax validated

### Security Features (Bank-Grade)
1. **Role-Based Access Control (RBAC)** - 5-tier hierarchy with granular permissions
2. **Web Application Firewall (WAF)** - Blocks 7 attack types automatically
3. **AES-256-GCM Encryption** - Protect sensitive data at rest
4. **Two-Factor Authentication (2FA)** - TOTP with QR codes
5. **IP Whitelisting** - Restrict access to trusted networks
6. **Session Management** - Per-device tracking with auto-expiration
7. **Audit Logging** - Complete security event trail
8. **Protocol Enforcement** - Automated compliance checking

### Documentation (70,000+ characters)
- **GETTING_STARTED.md** - Complete setup guide
- **ONBOARDING_TUTORIAL.md** - 15,000+ word walkthrough
- **API_DOCUMENTATION.md** - Complete API reference
- **SECURITY_PROTOCOLS.md** - 21,000+ char protocol guide
- **POSTGRESQL_SETUP.md** - Production database setup
- **DEPLOYMENT_GUIDE.md** - Production deployment checklist

---
cp .env.example .env

# Edit .env file with your settings
nano .env

# Start the server
npm start
```

The backend API will start on `http://localhost:3000`

### 2. Frontend Setup

```bash
cd fullstack-app/frontend

# Install dependencies
npm install

# Create .env file (optional)
echo "REACT_APP_API_URL=http://localhost:3000/api" > .env

# Start the development server
npm start
```

The frontend will open at `http://localhost:3001`

**Note:** The frontend is configured with a proxy to forward API requests to `http://localhost:3000` (backend). This is the standard React development setup where the frontend dev server runs on port 3001 and proxies API calls to the backend on port 3000.

## 🎯 Usage

### First Time Setup

1. **Start the backend server**
   ```bash
   cd fullstack-app/backend
   npm start
   ```

2. **Start the frontend**
   ```bash
   cd fullstack-app/frontend
   npm start
   ```

3. **Create an admin user**
   The first time you run the app, you'll need to register a user. Use the login page to create an account.

4. **Login and explore**
   - Dashboard: View overall statistics
   - Attacks: Create and monitor attacks
   - Targets: Manage target systems
   - Results: View discovered credentials
   - Wordlists: Import and manage wordlists

### Launching an Attack

1. Navigate to **Attacks** page
2. Click **+ New Attack**
3. Select attack type (SSH, FTP, HTTP, etc.)
4. Enter target host/IP
5. Configure options (port, threads, etc.)
6. Click **Launch Attack**
7. Monitor progress in real-time
8. View results in the **Results** page

### Managing Targets

1. Navigate to **Targets** page
2. Click **+ Add Target**
3. Fill in target information
4. Save target for future attacks

### Viewing Results

1. Navigate to **Results** page
2. Filter by protocol or success status
3. Export results as JSON or CSV
4. View discovered credentials

## 🔒 Security Considerations

⚠️ **IMPORTANT SECURITY NOTES:**

1. **Change the JWT secret** in `.env` before production use
2. **Use HTTPS** in production environments
3. **Implement proper firewall rules** to restrict API access
4. **Only use on authorized systems** - Unauthorized access is illegal
5. **Keep credentials secure** - Never commit real credentials to version control
6. **Regular updates** - Keep all dependencies up to date

## 📁 Project Structure

```
fullstack-app/
├── backend/
│   ├── server.js              # Main server file
│   ├── database.js            # Database setup and helpers
│   ├── routes/
│   │   ├── auth.js           # Authentication routes
│   │   ├── attacks.js        # Attack management routes
│   │   ├── targets.js        # Target management routes
│   │   ├── results.js        # Results and reporting routes
│   │   ├── wordlists.js      # Wordlist management routes
│   │   └── dashboard.js      # Dashboard statistics routes
│   ├── services/
│   │   └── attackService.js  # Attack execution service
│   ├── middleware/
│   │   └── auth.js           # Authentication middleware
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── App.js            # Main application component
    │   ├── App.css           # Global styles
    │   ├── components/
    │   │   └── Layout.js     # Layout with sidebar
    │   ├── pages/
    │   │   ├── Login.js      # Login page
    │   │   ├── Dashboard.js  # Dashboard page
    │   │   ├── Attacks.js    # Attacks management page
    │   │   ├── Targets.js    # Targets page
    │   │   ├── Results.js    # Results page
    │   │   └── Wordlists.js  # Wordlists page
    │   ├── contexts/
    │   │   └── AuthContext.js # Authentication context
    │   └── services/
    │       └── api.js        # API client
    └── package.json
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/verify` - Verify token

### Attacks (Menu Items 1-8)
- `GET /api/attacks` - List all attacks
- `GET /api/attacks/:id` - Get attack details
- `POST /api/attacks` - Create new attack
- `POST /api/attacks/:id/stop` - Stop running attack
- `DELETE /api/attacks/:id` - Delete attack
- `GET /api/attacks/types/list` - Get available attack types

### Targets (Menu Item 11)
- `GET /api/targets` - List all targets
- `GET /api/targets/:id` - Get target details
- `POST /api/targets` - Create new target
- `PUT /api/targets/:id` - Update target
- `DELETE /api/targets/:id` - Delete target

### Results (Menu Items 12, 15)
- `GET /api/results` - List all results
- `GET /api/results/attack/:attackId` - Get results for specific attack
- `GET /api/results/stats` - Get result statistics
- `GET /api/results/export` - Export results

### Wordlists (Menu Item 9)
- `GET /api/wordlists` - List all wordlists
- `POST /api/wordlists/scan` - Scan wordlist directory

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

### Configuration (Menu Item 13)
- `GET /api/config` - Get configuration
- `PUT /api/config` - Update configuration
- `GET /api/config/schema` - Get configuration schema

### Logs (Menu Item 14)
- `GET /api/logs` - Get database logs
- `GET /api/logs/files` - Get log files
- `GET /api/logs/files/:filename` - Get log file content
- `DELETE /api/logs/cleanup` - Cleanup old logs

### System (Menu Items 16, 17, 18)
- `GET /api/system/info` - Get system information
- `GET /api/system/update/check` - Check for updates
- `POST /api/system/update/apply` - Apply update
- `GET /api/system/help` - Get help documentation
- `GET /api/system/about` - Get about information

### Webhooks (NEW!)
- `GET /api/webhooks` - List all webhooks
- `GET /api/webhooks/:id` - Get webhook details
- `POST /api/webhooks` - Create new webhook
- `PUT /api/webhooks/:id` - Update webhook
- `DELETE /api/webhooks/:id` - Delete webhook
- `POST /api/webhooks/:id/test` - Test webhook
- `GET /api/webhooks/:id/deliveries` - Get webhook delivery logs

**📚 Full API Documentation:** See [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

## 🗄️ Database Support

The backend now supports **both SQLite and PostgreSQL**:

### SQLite (Default)
- Lightweight and zero-configuration
- Perfect for development and single-user setups
- File-based, portable database
- Set `DB_TYPE=sqlite` in `.env`

### PostgreSQL (Production-Ready)
- Better performance and concurrent access
- Industry standard for web applications
- Advanced features and scalability
- Network accessible database
- Set `DB_TYPE=postgres` in `.env`

**📚 PostgreSQL Setup Guide:** See [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md)

## 🪝 Webhook Integration (NEW!)

Configure webhooks to receive real-time notifications about attacks and events:

### Supported Events
- `attack.started` - Attack has started
- `attack.completed` - Attack completed successfully
- `attack.failed` - Attack failed with error
- `attack.stopped` - Attack stopped by user
- `credentials.found` - New credentials discovered
- `target.created` - New target added
- `target.updated` - Target information updated
- `target.deleted` - Target removed

### Example Webhook Payload
```json
{
  "event": "credentials.found",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "data": {
    "attack_id": 123,
    "target_host": "192.168.1.100",
    "protocol": "ssh",
    "username": "admin",
    "password": "password123"
  }
}
```

### Security
- HMAC-SHA256 signature verification
- Secret keys for each webhook
- Delivery logs and retry mechanism

## 📋 Menu Items to API Mapping

All 18 menu items from `hydra.sh` are now accessible via API:

| Menu # | Feature | API Endpoint |
|--------|---------|--------------|
| 1-8 | Attack Scripts | `POST /api/attacks` |
| 9 | Download Wordlists | `POST /api/wordlists/scan` |
| 10 | Generate Wordlist | Script-based |
| 11 | Scan Target | `POST /api/targets` |
| 12 | View Results | `GET /api/results` |
| 13 | View Configuration | `GET /api/config` |
| 14 | View Logs | `GET /api/logs` |
| 15 | Export Results | `GET /api/results/export` |
| 16 | Update System | `GET/POST /api/system/update/*` |
| 17 | Help | `GET /api/system/help` |
| 18 | About | `GET /api/system/about` |

## 🐛 Troubleshooting

### Backend won't start
- Check if port 3000 is available
- Verify all dependencies are installed
- Check database permissions

### Frontend can't connect to backend
- Ensure backend is running
- Check REACT_APP_API_URL in frontend .env
- Verify CORS settings in backend

### Attacks not executing
- Verify Hydra is installed: `hydra -h`
- Check script permissions: `chmod +x scripts/*.sh`
- Verify SCRIPTS_PATH in backend .env

### WebSocket connection fails
- Check firewall settings
- Verify WebSocket port is open
- Check browser console for errors

## 🚀 Production Deployment

### Backend
```bash
# Set production environment
export NODE_ENV=production

# Use a process manager
npm install -g pm2
pm2 start server.js --name hydra-api

# Set up reverse proxy (nginx)
# Configure SSL/TLS certificates
```

### Frontend
```bash
# Build for production
npm run build

# Serve with nginx or similar
# Configure API URL for production
```

## 📝 Development

### Adding a new attack type
1. Add script to `/scripts/` directory
2. Update attack types in `routes/attacks.js`
3. Update frontend attack types dropdown

### Adding a new page
1. Create component in `frontend/src/pages/`
2. Add route in `App.js`
3. Add navigation link in `Layout.js`

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## ⚠️ Legal Disclaimer

This tool is provided for **educational and authorized security testing purposes ONLY**.

- ✅ Only use on systems you own or have explicit permission to test
- ✅ Obtain written authorization before any testing
- ✅ Comply with all applicable laws and regulations
- ❌ Unauthorized access to computer systems is illegal
- ❌ The developers assume NO liability for misuse

**USE AT YOUR OWN RISK.**

## 📄 License

MIT License - See LICENSE file for details

## 👥 Credits

- Built on top of Hydra-Termux by vinnieboy707
- Uses THC-Hydra for penetration testing
- React, Express, and other open-source libraries

---

**Made with ❤️ for ethical hackers and security professionals**
