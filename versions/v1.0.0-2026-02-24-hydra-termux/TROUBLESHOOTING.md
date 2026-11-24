# 🔧 Hydra-Termux Troubleshooting Guide

## Common Issues and Solutions

### 1. bcrypt Compilation Errors

#### Symptoms
```
gyp ERR! configure error
gyp ERR! stack Error: Command failed: python -c import sys; print "%s.%s.%s"
gyp ERR! Undefined variable android_ndk_path
node-pre-gyp ERR! install error
```

#### Root Cause
- `bcrypt` requires native C++ compilation
- Termux/Android doesn't have pre-built binaries
- Android NDK is not configured

#### Solution
✅ **Automated Fix** (Recommended):
```bash
npm run fix-termux
```

✅ **Manual Fix**:
```bash
cd fullstack-app/backend
# Remove bcrypt
npm uninstall bcrypt
# Install bcryptjs (pure JavaScript alternative)
npm install bcryptjs@^2.4.3
```

---

### 2. Admin Login Not Working

#### Symptoms
- "Invalid credentials" error
- Cannot log in with admin/admin

#### Root Cause
Password validation requires:
- Minimum 8 characters
- Uppercase letter
- Lowercase letter
- Number
- Special character

Old password "admin" doesn't meet requirements.

#### Solution
✅ **Use correct password**:
```
Username: admin
Password: Admin@123
```

✅ **Reset admin user**:
```bash
cd fullstack-app/backend
npm run reset-admin
```

✅ **Manually create user**:
```bash
cd fullstack-app/backend
node init-users.js
```

---

### 3. Port Already in Use

#### Symptoms
```
Error: listen EADDRINUSE: address already in use :::3000
```

#### Solution
✅ **Kill the process**:
```bash
# Find process
lsof -ti:3000

# Kill it
lsof -ti:3000 | xargs kill -9

# Or combined
kill -9 $(lsof -ti:3000)
```

✅ **Use different port**:
```bash
# Edit backend/.env
echo "PORT=3001" >> fullstack-app/backend/.env

# Restart backend
cd fullstack-app/backend && npm start
```

---

### 4. ENOENT: package.json Not Found

#### Symptoms
```
ENOENT: no such file or directory, open 'package.json'
```

#### Root Cause
Running commands from wrong directory

#### Solution
✅ **Navigate to repo root**:
```bash
cd /path/to/Hydra-termux
npm run fix-termux
```

✅ **Or use absolute paths**:
```bash
cd fullstack-app/backend
npm install
```

---

### 5. Cannot Find Module 'bcryptjs'

#### Symptoms
```
Error: Cannot find module 'bcryptjs'
```

#### Solution
✅ **Install bcryptjs**:
```bash
cd fullstack-app/backend
npm install bcryptjs
```

✅ **Clean install**:
```bash
cd fullstack-app/backend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

---

### 6. Database Locked / Busy

#### Symptoms
```
Error: SQLITE_BUSY: database is locked
```

#### Solution
✅ **Stop all instances**:
```bash
# Kill all node processes
pkill -f node

# Or manually
ps aux | grep node
kill <PID>
```

✅ **Remove database lock**:
```bash
cd fullstack-app/backend
rm -f database.sqlite-journal
```

---

### 7. Low Memory / Installation Fails

#### Symptoms
- Installation stops mid-way
- "ENOMEM: not enough memory"
- Process killed

#### Solution
✅ **Reduce concurrent connections**:
```bash
npm install --maxsockets=1 --legacy-peer-deps
```

✅ **Clear cache**:
```bash
npm cache clean --force
```

✅ **Close other apps**:
```bash
# In Termux, free up memory
# Close browser, other apps
```

---

### 8. Frontend Won't Start

#### Symptoms
```
sh: react-scripts: not found
```

#### Solution
✅ **Reinstall frontend**:
```bash
cd fullstack-app/frontend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

---

### 9. WebSocket Connection Failed

#### Symptoms
- Real-time updates not working
- "WebSocket connection failed"

#### Solution
✅ **Check backend is running**:
```bash
curl http://localhost:3000/api/health
```

✅ **Check WebSocket URL in frontend**:
```bash
# Should be in frontend/.env
echo "REACT_APP_WS_URL=ws://localhost:3000" >> fullstack-app/frontend/.env
```

---

### 10. CORS Errors

#### Symptoms
```
Access to fetch at 'http://localhost:3000/api/...' has been blocked by CORS policy
```

#### Solution
✅ **Check backend .env**:
```bash
# In backend/.env
CORS_ORIGIN=http://localhost:3001
```

✅ **Restart backend** after changing .env

---

## Advanced Diagnostics

### Run Health Check
```bash
npm run health-check
```

### Check System Requirements
```bash
# Node.js version (need 14+)
node --version

# npm version (need 6+)
npm --version

# Available memory
free -m

# Disk space
df -h
```

### Check Port Availability
```bash
# Using netstat
netstat -tuln | grep 3000

# Using ss
ss -tuln | grep 3000

# Using lsof
lsof -i :3000
```

### View Logs
```bash
# Setup logs
ls -la /tmp/hydra-termux-setup-*.log
tail -f /tmp/hydra-termux-setup-*.log

# Application logs
cd fullstack-app/backend
npm start 2>&1 | tee backend.log
```

### Verify Installation
```bash
# Check bcryptjs is installed
ls fullstack-app/backend/node_modules/bcryptjs

# Check bcrypt is NOT installed
ls fullstack-app/backend/node_modules/bcrypt
# Should show: No such file or directory
```

---

## Emergency Reset

If all else fails, nuclear option:

```bash
# 1. Stop everything
pkill -f node

# 2. Clean everything
cd /path/to/Hydra-termux
npm run clean

# 3. Remove databases
rm -f fullstack-app/backend/database.sqlite
rm -f fullstack-app/backend/database.sqlite-journal

# 4. Reinstall
npm run fix-termux

# 5. Initialize users
cd fullstack-app/backend
npm run init-users

# 6. Start fresh
npm start
```

---

## Getting Help

### Before Asking for Help

1. ✅ Run health check: `npm run health-check`
2. ✅ Check logs: `/tmp/hydra-termux-setup-*.log`
3. ✅ Try emergency reset (above)
4. ✅ Read error messages carefully

### Include in Help Request

- Node.js version: `node --version`
- npm version: `npm --version`
- Operating system/device
- Error message (full output)
- Steps you've already tried
- Log file contents

---

## Prevention Tips

### Best Practices
- ✅ Always run `npm run fix-termux` on first setup
- ✅ Use `--legacy-peer-deps` flag for all npm installs
- ✅ Keep Node.js updated: `pkg upgrade nodejs`
- ✅ Don't use `sudo` with npm in Termux
- ✅ Close other apps before installation
- ✅ Use tmux for multiple terminal sessions

### Performance Optimization
```bash
# Set npm config for Termux
npm config set maxsockets 5
npm config set fetch-timeout 60000
npm config set legacy-peer-deps true
```

---

## Quick Reference

| Issue | Quick Fix |
|-------|-----------|
| bcrypt error | `npm run fix-termux` |
| Login fails | Use `admin / Admin@123` |
| Port in use | `lsof -ti:3000 \| xargs kill -9` |
| Module not found | `cd backend && npm install` |
| Low memory | Close apps, use `--maxsockets=1` |
| CORS error | Check `backend/.env` CORS_ORIGIN |
| Database locked | `pkill -f node` |
| Admin reset | `npm run reset-admin` |

---

**Still stuck? Check `/tmp/hydra-setup-summary.txt` for your setup details!**
