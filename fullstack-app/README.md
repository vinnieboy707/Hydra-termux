# 🐍 Hydra Penetration Testing Platform - Full Stack Application

A modern, full-stack web application that provides a comprehensive interface for managing penetration testing activities using Hydra and related tools.

## 🚀 Features

### Backend API
- **RESTful API** with Express.js
- **Real-time updates** via WebSocket
- **SQLite database** for data persistence
- **JWT authentication** for secure access
- **Attack orchestration** - Queue and manage multiple concurrent attacks
- **Result tracking** - Store and query discovered credentials
- **Target management** - Organize and track target systems
- **Wordlist management** - Import and manage wordlists

### Frontend Web UI
- **Modern React interface** with responsive design
- **Real-time dashboard** with attack statistics
- **Interactive attack configuration** - Easy-to-use forms for launching attacks
- **Live progress monitoring** - Watch attacks in real-time
- **Results visualization** - View and filter discovered credentials
- **Dark theme** optimized for security professionals

### Security Features
- JWT-based authentication
- Role-based access control (RBAC)
- Rate limiting on API endpoints
- Secure password hashing with bcrypt
- Helmet.js security headers
- CORS configuration

## 📋 Prerequisites

- Node.js 14.x or higher
- npm or yarn
- Hydra installed and accessible
- Linux/Unix environment (Termux on Android supported)

## 🔧 Installation

### 1. Backend Setup

```bash
cd fullstack-app/backend

# Install dependencies
npm install

# Create .env file
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

### Attacks
- `GET /api/attacks` - List all attacks
- `GET /api/attacks/:id` - Get attack details
- `POST /api/attacks` - Create new attack
- `POST /api/attacks/:id/stop` - Stop running attack
- `DELETE /api/attacks/:id` - Delete attack
- `GET /api/attacks/types/list` - Get available attack types

### Targets
- `GET /api/targets` - List all targets
- `GET /api/targets/:id` - Get target details
- `POST /api/targets` - Create new target
- `PUT /api/targets/:id` - Update target
- `DELETE /api/targets/:id` - Delete target

### Results
- `GET /api/results` - List all results
- `GET /api/results/attack/:attackId` - Get results for specific attack
- `GET /api/results/stats` - Get result statistics
- `GET /api/results/export` - Export results

### Wordlists
- `GET /api/wordlists` - List all wordlists
- `POST /api/wordlists/scan` - Scan wordlist directory

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

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
