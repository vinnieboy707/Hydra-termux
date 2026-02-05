# Hydra-Termux Development Container

This directory contains the development container configuration for Hydra-Termux, providing a fully-configured development environment using VS Code Dev Containers.

## 🚀 Quick Start

### Prerequisites
- Docker Desktop or Docker Engine
- VS Code with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

### Getting Started

1. **Open in Dev Container**
   - Open this project in VS Code
   - Press `F1` and select "Dev Containers: Reopen in Container"
   - Wait for the container to build and start (first time takes 5-10 minutes)

2. **Start Development**
   ```bash
   # Run the dev container onboarding
   onboard-dev
   
   # Or start services directly
   npm run dev
   ```

## 📦 What's Included

### Development Tools
- **Node.js 20 LTS** - Latest stable Node.js version
- **Python 3.11** - With pip and development packages
- **ShellCheck** - Bash script linter (integrated with VS Code)
- **Git** - With user configuration persistence
- **Docker-in-Docker** - For container testing

### Penetration Testing Tools
- **Hydra** - Password cracking tool
- **Nmap** - Network scanner
- **SQLMap** - SQL injection tool
- **Nikto** - Web server scanner
- **John the Ripper** - Password cracker
- **Hashcat** - Advanced password recovery
- **Metasploit Framework** - Penetration testing framework
- And many more...

### Database Services
- **PostgreSQL 15** - Main database (localhost:5432)
  - User: `hydra_dev`
  - Password: `hydra_dev_pass`
  - Database: `hydra_dev_db`
  
- **Redis 7** - Caching service (localhost:6379)

### Management Tools
- **Adminer** - Database management UI (http://localhost:8080)
- **Redis Insight** - Redis management UI (http://localhost:8001)

### VS Code Extensions (Auto-installed)
- ESLint & Prettier - Code formatting
- Python & Pylance - Python development
- ShellCheck - Bash script linting
- GitLens - Git visualization
- GitHub Copilot - AI pair programmer
- Docker - Container management
- YAML support
- Spell checker

## 🔧 Configuration Files

### `devcontainer.json`
Main configuration file defining:
- VS Code extensions
- Port forwarding
- Post-create commands
- Environment variables

### `docker-compose.dev.yml`
Development services including:
- Main development container
- PostgreSQL database
- Redis cache
- Adminer (database UI)
- Redis Insight (Redis UI)

### `Dockerfile.dev`
Development container image with:
- All development tools
- Penetration testing tools
- Pre-configured user environment

### `post-create.sh`
Runs once after container creation:
- Installs npm dependencies
- Sets up project structure
- Creates convenience commands
- Displays welcome message

### `post-start.sh`
Runs every time container starts:
- Checks service connectivity
- Ensures proper permissions
- Displays status

## 💡 Convenience Commands

The dev container includes several custom commands:

```bash
# Run development-specific onboarding
onboard-dev

# Check service status
hydra-status

# Standard development commands
npm run dev              # Start all services
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only
npm test                 # Run tests
npm run lint             # Run linters
```

## 🌐 Service URLs

When the dev container is running, access services at:

| Service | URL | Purpose |
|---------|-----|---------|
| Backend API | http://localhost:3000 | REST API endpoints |
| Frontend | http://localhost:3001 | React/Vue frontend |
| Adminer | http://localhost:8080 | Database management |
| Redis Insight | http://localhost:8001 | Redis management |
| PostgreSQL | localhost:5432 | Database connection |
| Redis | localhost:6379 | Cache connection |

## 🔐 Security Notes

### Development Environment Only
- Default passwords are for **development only**
- Never use these credentials in production
- Always change secrets before deployment

### Network Capabilities
The dev container includes elevated network capabilities:
- `NET_RAW` - For network packet manipulation
- `NET_ADMIN` - For network administration
- `SYS_PTRACE` - For debugging

These are required for penetration testing tools but should be used responsibly.

## 📂 Volume Mounts

### Source Code
- Host: `../` (project root)
- Container: `/workspace`
- Sync: Cached (for performance)

### Persistent Data
- `dev-data:/data` - Application data
- `dev-logs:/logs` - Log files
- `postgres-dev-data:/var/lib/postgresql/data` - Database
- `redis-dev-data:/data` - Redis cache
- `dev-bash-history:/commandhistory` - Shell history

## 🐛 Debugging

### Node.js Debugging
Debug port `9229` is exposed. VS Code launch configurations:

```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to Node",
  "port": 9229
}
```

### Database Debugging
Use Adminer at http://localhost:8080:
- System: PostgreSQL
- Server: postgres-dev
- Username: hydra_dev
- Password: hydra_dev_pass
- Database: hydra_dev_db

## 🔄 Rebuilding Container

If you make changes to dev container configuration:

```bash
# Rebuild container
F1 > Dev Containers: Rebuild Container

# Or rebuild without cache
F1 > Dev Containers: Rebuild Container Without Cache
```

## 🚨 Troubleshooting

### Container Won't Start
1. Check Docker is running
2. Check for port conflicts (3000, 3001, 5432, 6379)
3. Try rebuilding: `F1 > Dev Containers: Rebuild Container`

### Services Not Connecting
1. Wait for services to start (check `hydra-status`)
2. Verify services are running: `docker-compose ps`
3. Check logs: `docker-compose logs`

### Permission Issues
```bash
# Fix ownership
sudo chown -R vscode:vscode /workspace
```

### Database Connection Failed
```bash
# Check if PostgreSQL is ready
PGPASSWORD=hydra_dev_pass psql -h postgres-dev -U hydra_dev -d hydra_dev_db -c '\q'

# View PostgreSQL logs
docker logs hydra-postgres-dev
```

## 📚 Additional Resources

- [Dev Containers Documentation](https://code.visualstudio.com/docs/devcontainers/containers)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Project README](../README.md)
- [Quickstart Guide](../QUICKSTART.md)

## 🤝 Contributing

When developing in the dev container:
1. All changes are automatically synced
2. Hot reload is enabled for rapid development
3. Use ShellCheck for bash scripts (integrated)
4. Run tests before committing
5. Use the dev onboarding to learn the workflow

## 📄 License

Same as main project - see [LICENSE](../LICENSE)
