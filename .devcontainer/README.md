# GitHub Codespaces Configuration

This directory contains the configuration for GitHub Codespaces, providing an optimized development environment for Hydra-Termux.

## What's Included

### `devcontainer.json`
Main configuration file that defines:
- **Base Image**: Universal Docker image with common development tools
- **Features**: Node.js 18, Python 3.11, and Git
- **Extensions**: VSCode extensions for shell scripting, Node.js, and YAML
- **Port Forwarding**: Automatic forwarding of ports 3000 (Backend API) and 3001 (Frontend UI)
- **Post-Create Command**: Runs `setup-codespace.sh` automatically after container creation

## How It Works

1. **Open in Codespaces**: Click "Code" → "Codespaces" → "Create codespace on main" on GitHub
2. **Automatic Setup**: The devcontainer automatically:
   - Installs all system dependencies (hydra, nmap, jq, etc.)
   - Sets up Node.js environment for full-stack app
   - Installs npm dependencies for backend and frontend
   - Creates directory structure
   - Sets up environment files
   - Makes all scripts executable
   - Configures helpful aliases

3. **Ready to Use**: Once setup completes, you can immediately:
   - Run the CLI tool: `./hydra.sh`
   - Start the web app: `cd fullstack-app && bash start.sh`
   - Use quick scripts: `bash Library/ssh_quick.sh`

## Port Forwarding

The Codespace automatically forwards these ports:
- **Port 3000**: Backend API server (auto-notifies when ready)
- **Port 3001**: Frontend UI (auto-opens in browser when ready)

## VSCode Extensions

Pre-installed extensions:
- **ESLint**: JavaScript linting
- **Prettier**: Code formatting
- **ShellCheck**: Shell script linting
- **Python**: Python development
- **YAML**: YAML file support

## Manual Setup

If you need to re-run the setup:

```bash
bash setup-codespace.sh
```

## Customization

To customize the Codespace:

1. Edit `devcontainer.json` to change:
   - Base image or features
   - VSCode extensions
   - Port forwarding settings
   - Post-create commands

2. Edit `../setup-codespace.sh` to modify:
   - Installed packages
   - Configuration setup
   - Environment variables

## Troubleshooting

If the Codespace doesn't work correctly:

```bash
# Re-run setup
bash setup-codespace.sh

# Check dependencies
bash scripts/check_dependencies.sh

# View setup log
cat /tmp/codespace-setup.log
```

## Documentation

- See `../CODESPACE_QUICKSTART.md` for quick start guide
- See `../README.md` for full project documentation
- See `../docs/USAGE.md` for detailed usage instructions

## Learn More

- [GitHub Codespaces Documentation](https://docs.github.com/codespaces)
- [Dev Container Specification](https://containers.dev/)
