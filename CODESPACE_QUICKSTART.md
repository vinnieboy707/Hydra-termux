# 🚀 Codespace Quick Start Guide

Welcome to your Hydra-Termux Codespace! Everything is set up and ready to go.

## Quick Commands

### Start the CLI Tool
```bash
./hydra.sh
```

### Start the Web Application
```bash
# Option 1: Use the start script
cd fullstack-app
bash start.sh

# Option 2: Start both services manually
cd fullstack-app/backend && npm start &
cd fullstack-app/frontend && npm start
```

### Useful Aliases
```bash
hydra-start       # Start main CLI tool
hydra-web         # Start full-stack web app
hydra-backend     # Start backend API only
hydra-frontend    # Start frontend UI only
hydra-fix         # Fix common issues
hydra-check       # Check dependencies
```

## Access Points

- **Backend API**: http://localhost:3000
- **Frontend UI**: http://localhost:3001
- **Default Login**: admin / admin (change immediately!)

## Quick Library Scripts

The fastest way to get started:

```bash
# Edit target and run
bash Library/ssh_quick.sh
bash Library/ftp_quick.sh
bash Library/web_quick.sh
```

## Important Files

- `README.md` - Main documentation
- `docs/USAGE.md` - Detailed usage guide
- `Library.md` - Quick script documentation
- `fullstack-app/README.md` - Web app documentation

## Troubleshooting

If you encounter issues:

```bash
./fix-hydra.sh                        # Interactive problem solver
bash scripts/check_dependencies.sh    # Check what's installed
bash scripts/system_diagnostics.sh    # Full system check
```

## Security Reminder

⚠️ **IMPORTANT**: This tool is for educational and authorized testing ONLY.
- Always get written permission before testing any systems
- Use a VPN when performing security testing
- Comply with all applicable laws and regulations

## Need Help?

- Check the documentation in `docs/`
- Read the troubleshooting section in README.md
- Open an issue on GitHub

Happy testing! 🐍
