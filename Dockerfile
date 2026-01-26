# Hydra-Termux Production Dockerfile
# Multi-stage build for optimized image size

FROM node:20-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY fullstack-app/backend/package*.json ./backend/
COPY fullstack-app/frontend/package*.json ./frontend/

# Install dependencies
RUN cd backend && npm ci --only=production
RUN cd frontend && npm ci && npm run build

# Production stage
FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=sqlite:./database.sqlite

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    # Core utilities
    curl \
    wget \
    git \
    nano \
    vim \
    # Node.js
    nodejs \
    npm \
    # Penetration testing tools
    hydra \
    nmap \
    sqlmap \
    nikto \
    john \
    hashcat \
    aircrack-ng \
    metasploit-framework \
    # Network utilities
    netcat-openbsd \
    netcat-traditional \
    nc \
    dnsutils \
    whois \
    traceroute \
    tcpdump \
    # Python and tools
    python3 \
    python3-pip \
    python3-requests \
    python3-bs4 \
    # Security tools
    openssl \
    nmap-common \
    masscan \
    # Database
    sqlite3 \
    postgresql-client \
    # Monitoring
    htop \
    iftop \
    && rm -rf /var/lib/apt/lists/*

# Install additional Python security tools
RUN pip3 install --no-cache-dir \
    requests \
    beautifulsoup4 \
    dnspython \
    impacket \
    pwntools \
    paramiko

# Create application user
RUN useradd -m -u 1000 -s /bin/bash hydra && \
    mkdir -p /app /data /logs && \
    chown -R hydra:hydra /app /data /logs

# Set working directory
WORKDIR /app

# Copy application files
COPY --chown=hydra:hydra . .

# Copy built frontend and backend dependencies from builder
COPY --from=builder --chown=hydra:hydra /app/backend/node_modules ./fullstack-app/backend/node_modules
COPY --from=builder --chown=hydra:hydra /app/frontend/build ./fullstack-app/frontend/build

# Make scripts executable
RUN find /app -name "*.sh" -type f -exec chmod +x {} \;

# Create necessary directories
RUN mkdir -p \
    /app/results \
    /app/wordlists \
    /app/logs \
    /data/database \
    /data/backups \
    && chown -R hydra:hydra /app /data /logs

# Switch to application user
USER hydra

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Set entrypoint
COPY --chown=hydra:hydra docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default command
CMD ["npm", "start"]
