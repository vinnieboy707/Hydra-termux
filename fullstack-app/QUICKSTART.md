# 🚀 Quick Start Guide - Full-Stack Penetration Testing Platform

Get up and running in 5 minutes!

## Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js 14.x or higher installed
- ✅ npm or yarn package manager
- ✅ Hydra tool installed (for actual attacks)
- ✅ Basic terminal/command line knowledge

Quick check:
```bash
node --version  # Should show v14.x or higher
npm --version   # Should show 6.x or higher
hydra -h        # Should show Hydra help (if you want to run attacks)
```

## Step 1: Navigate to the App

```bash
cd fullstack-app
```

## Step 2: Automated Setup (Recommended)

```bash
# Run the all-in-one startup script
bash start.sh
```

The script will:
1. Install all dependencies
2. Create configuration files
3. Initialize the database
4. Create default admin user
5. Ask if you want to start backend, frontend, or both

**Default credentials**: `admin` / `admin`

⚠️ **Important**: Change the default password immediately after first login!

## Step 3: Manual Setup (Alternative)

If you prefer manual setup or the script doesn't work:

### 3.1 Backend Setup

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# (Optional) Edit .env with your preferences
nano .env

# Start the server
npm start
```

Backend will start on **http://localhost:3000**

### 3.2 Frontend Setup

Open a new terminal:

```bash
# Navigate to frontend
cd fullstack-app/frontend

# Install dependencies
npm install

# (Optional) Set API URL if different from default
echo "REACT_APP_API_URL=http://localhost:3000/api" > .env

# Start the development server
npm start
```

Frontend will open automatically at **http://localhost:3001**

## Step 4: First Login

1. Open your browser to **http://localhost:3001**
2. You'll see the login page
3. Use default credentials:
   - Username: `admin`
   - Password: `admin`
4. Click "Login"

## Step 5: Change Default Password

⚠️ **SECURITY**: Change the default password immediately!

1. Go to Settings (coming soon) or recreate user via database
2. For now, create a new admin user:

```bash
cd backend
node << 'EOF'
const bcrypt = require('bcryptjs');
const { run } = require('./database');

async function createUser() {
  const hashedPassword = await bcrypt.hash('your-secure-password', 10);
  await run(
    'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
    ['yourusername', hashedPassword, 'your@email.com', 'admin']
  );
  console.log('✅ User created');
  process.exit(0);
}

createUser();
EOF
```

## Step 6: First Attack

Let's launch your first test attack!

### Option A: Via Web Interface

1. Click **"Attacks"** in the sidebar
2. Click **"+ New Attack"**
3. Fill in the form:
   - Attack Type: `SSH`
   - Target Host: `127.0.0.1` (for testing)
   - Port: `22` (or your SSH port)
   - Threads: `4` (low for testing)
4. Click **"Launch Attack"**
5. Watch the real-time progress!

### Option B: Test Without Hydra

If you don't have Hydra installed yet, you can:
- Browse the **Dashboard** to see the interface
- Add **Targets** to organize your future attacks
- Import **Wordlists** to prepare
- Explore the UI and features

## Step 7: View Results

After an attack completes:

1. Click **"Results"** in the sidebar
2. See all discovered credentials
3. Filter by protocol, status, or date
4. Export results as JSON or CSV

## Common First-Time Issues

### Issue: "EADDRINUSE: address already in use"
**Solution**: Another process is using port 3000 or 3001
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Issue: "Cannot find module 'xyz'"
**Solution**: Dependencies not installed properly
```bash
cd backend && npm install
cd ../frontend && npm install
```

### Issue: "Hydra not found"
**Solution**: Install Hydra first
```bash
# On Termux
pkg install hydra -y

# On Ubuntu/Debian
sudo apt-get install hydra -y

# On macOS
brew install hydra
```

### Issue: Backend starts but frontend can't connect
**Solution**: Check CORS settings
- Ensure frontend .env has correct API URL
- Check backend .env has proper CORS config
- Verify both servers are running

### Issue: "Database is locked"
**Solution**: Close any existing connections
```bash
cd backend
rm database.sqlite  # This will reset the database
npm start  # Restart to recreate
```

## Next Steps

### 1. Configure Your Environment

Edit `backend/.env`:
```env
PORT=3000
JWT_SECRET=your-secure-random-string-here
SCRIPTS_PATH=../../scripts
LOG_PATH=../../logs
```

### 2. Import Wordlists

```bash
# Download common wordlists
cd ../..  # Back to repo root
bash scripts/download_wordlists.sh --all

# Or import your own
cp /path/to/wordlists/*.txt wordlists/

# Scan them in the UI
# Go to Wordlists > Scan Directory
```

### 3. Add Your Targets

Go to **Targets** page and add systems you're authorized to test:
- Name: Descriptive name
- Host: IP or hostname
- Port: Service port
- Protocol: ssh, http, etc.
- Description: Notes about the target

### 4. Launch Real Attacks

⚠️ **ONLY on authorized systems!**

Configure a proper attack:
- Choose appropriate attack type
- Select target from your targets list
- Pick suitable wordlist
- Set thread count (start low, increase if needed)
- Monitor progress in real-time
- Review results when complete

### 5. Explore Advanced Features

- **Dashboard**: Monitor all activity
- **Filters**: Find specific results quickly
- **Export**: Generate reports for clients
- **Scheduling**: Plan attacks for later (coming soon)
- **API**: Integrate with other tools

## Testing Without Real Attacks

Want to explore the interface without running actual attacks?

1. **Add mock targets**: Create fictional targets in the Targets page
2. **Browse empty results**: See how the results interface works
3. **Check dashboard**: View the statistics layout
4. **Import wordlists**: Prepare your wordlist library
5. **Explore settings**: Familiarize yourself with options

## Production Deployment

For production use:

```bash
# Backend
cd backend
export NODE_ENV=production
npm start

# Frontend
cd ../frontend
npm run build
# Serve the 'build' folder with nginx or similar
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed production setup.

## Getting Help

- 📖 **Documentation**: Check README.md and FEATURES.md
- 🐛 **Issues**: Report bugs on GitHub Issues
- 💬 **Questions**: Ask in GitHub Discussions
- 📧 **Email**: Contact repository owner for critical issues

## Quick Reference

### Default URLs
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- API Health Check: http://localhost:3000/api/health

### Default Credentials
- Username: `admin`
- Password: `admin`
- ⚠️ Change immediately!

### Key Directories
- `backend/` - API server
- `frontend/` - React app
- `../../scripts/` - Attack scripts
- `../../wordlists/` - Password lists
- `../../logs/` - Attack logs

### Important Files
- `backend/.env` - Backend configuration
- `backend/database.sqlite` - SQLite database
- `frontend/.env` - Frontend configuration

## Tips for Success

1. **Start small**: Test with low thread counts first
2. **Use VPN**: Always use VPN for real attacks
3. **Check authorization**: Only test systems you own or have permission for
4. **Monitor resources**: Watch CPU/memory usage
5. **Keep logs**: Results are stored in database automatically
6. **Export regularly**: Backup your results periodically
7. **Update often**: Pull latest changes from repository
8. **Stay legal**: Follow all applicable laws and regulations

## Quick Command Reference

```bash
# Start everything
cd fullstack-app && bash start.sh

# Start backend only
cd fullstack-app/backend && npm start

# Start frontend only
cd fullstack-app/frontend && npm start

# Reset database
cd fullstack-app/backend && rm database.sqlite && npm start

# View logs
cd fullstack-app/backend && tail -f *.log

# Check running processes
ps aux | grep node

# Stop all Node processes (careful!)
killall node
```

---

**You're all set! Happy (ethical) hacking! 🎉**

Remember: Always get authorization before testing any system!
