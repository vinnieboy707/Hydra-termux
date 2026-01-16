# 🚀 Hydra-Termux Quick Start Guide

## Ultra-Fast Setup (60 seconds)

### For Termux/Android Users

```bash
# 1. Clone and enter repository
cd Hydra-termux

# 2. Run the automated fix (ONE COMMAND!)
npm run fix-termux

# 3. Start backend (in current terminal)
cd fullstack-app/backend && npm start

# 4. Start frontend (open NEW terminal with Ctrl+C, then open new session)
cd fullstack-app/frontend && npm start

# 5. Login
# URL: http://localhost:3001
# Username: admin
# Password: Admin@123
```

**🎉 That's it! You're done!**

---

## For Non-Termux Users (Linux/macOS)

```bash
# 1. Install backend
cd fullstack-app/backend
npm install
npm run init-users

# 2. Install frontend
cd ../frontend
npm install

# 3. Start both
cd ../backend && npm start  # Terminal 1
cd ../frontend && npm start  # Terminal 2 (NEW terminal)
```

---

## 🔐 Default Credentials

| Account | Username | Password | Role |
|---------|----------|----------|------|
| **Admin** | `admin` | `Admin@123` | super_admin |
| Demo | `demo` | `Demo@123` | user |

⚠️ **CRITICAL**: Change passwords immediately after first login!

---

## 🐛 Troubleshooting

### Problem: "bcrypt compilation failed"
**Solution**: This is exactly what the fix script solves!
```bash
npm run fix-termux
```

### Problem: "Port 3000 already in use"
**Solution**: Kill the process or use different port
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9

# Or change port in backend/.env
echo "PORT=3001" >> fullstack-app/backend/.env
```

### Problem: "Cannot find module 'bcryptjs'"
**Solution**: Reinstall dependencies
```bash
cd fullstack-app/backend
npm install bcryptjs
```

### Problem: "Invalid credentials" when logging in
**Solution**: Reset admin user
```bash
cd fullstack-app/backend
npm run reset-admin
# Then use: admin / Admin@123
```

### Problem: "ENOENT: no such file or directory, open 'package.json'"
**Solution**: Run from repository root
```bash
cd /path/to/Hydra-termux
npm run fix-termux
```

### Problem: Low memory / slow installation
**Solution**: Reduce concurrent connections
```bash
npm install --maxsockets=1 --legacy-peer-deps
```

---

## 📊 Health Check

Run anytime to verify system status:
```bash
npm run health-check
```

---

## 🎯 What Works Now

✅ **bcrypt replaced with bcryptjs** - No more compilation errors  
✅ **Admin user auto-created** - Login ready immediately  
✅ **All dependencies installed** - Backend + Frontend  
✅ **Environment configured** - .env files created  
✅ **Performance optimized** - Mobile-friendly settings  
✅ **Ports checked** - No conflicts  
✅ **Database initialized** - SQLite ready  

---

## 🌟 Pro Tips

### Use tmux for multiple terminals in Termux
```bash
# Install tmux
pkg install tmux

# Start tmux
tmux

# Split horizontally (Ctrl+b, then ")
# Split vertically (Ctrl+b, then %)
# Switch panes (Ctrl+b, then arrow keys)

# Now run backend in one pane, frontend in another!
```

### Quick Commands from Root

```bash
npm run install:all      # Install both backend & frontend
npm run start:backend    # Start backend
npm run start:frontend   # Start frontend
npm run fix-termux       # Fix Termux issues
npm run health-check     # Check system health
npm run clean            # Remove all node_modules
```

### Backend Commands

```bash
cd fullstack-app/backend
npm start           # Start server
npm run dev         # Start with auto-reload
npm run init-users  # Create/reset admin user
npm run db:reset    # Reset database (WARNING: deletes all data!)
```

---

## 🔒 Security Checklist

After first login:

- [ ] Change admin password
- [ ] Change demo user password (or delete account)
- [ ] Update JWT_SECRET in backend/.env
- [ ] Review CORS settings
- [ ] Enable HTTPS for production
- [ ] Configure firewall rules
- [ ] Set up regular backups

---

## 📱 Accessing from Other Devices

### From phone browser
```
http://localhost:3001
```

### From another device on same network
1. Find your IP: `ifconfig` or `ip addr`
2. Access: `http://YOUR_IP:3001`
3. Update backend/.env: `CORS_ORIGIN=http://YOUR_IP:3001`

---

## 🎓 Next Steps

1. **Read the full docs**: `fullstack-app/GETTING_STARTED.md`
2. **Learn the API**: `fullstack-app/API_DOCUMENTATION.md`
3. **Security guide**: `fullstack-app/SECURITY_PROTOCOLS.md`
4. **Deploy to production**: `fullstack-app/DEPLOYMENT_GUIDE.md`

---

## 🆘 Still Having Issues?

1. Check the log file: `/tmp/hydra-termux-setup-*.log`
2. Run health check: `npm run health-check`
3. Review setup summary: `cat /tmp/hydra-setup-summary.txt`
4. Clean and retry:
   ```bash
   npm run clean
   npm run install:all
   npm run fix-termux
   ```

---

## 🏆 Success Indicators

You'll know everything is working when:

- ✅ Backend starts without errors on port 3000
- ✅ Frontend starts without errors on port 3001
- ✅ Browser opens automatically to frontend
- ✅ Login page loads
- ✅ Can log in with admin/Admin@123
- ✅ Dashboard loads with data

**Happy Hacking! 🐍**
