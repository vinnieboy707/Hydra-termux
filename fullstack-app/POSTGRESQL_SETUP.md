# PostgreSQL Setup Guide for Hydra-Termux

This guide explains how to set up and use PostgreSQL as the database backend for Hydra-Termux Full-Stack Application.

## Why PostgreSQL?

While SQLite is the default database (perfect for development and single-user setups), PostgreSQL offers several advantages for production environments:

- **Better concurrent access** - Multiple users and processes can access the database simultaneously
- **Advanced features** - Full ACID compliance, better transaction support
- **Scalability** - Handles larger datasets and more complex queries efficiently
- **Production-ready** - Industry standard for web applications
- **Network access** - Can be accessed remotely (unlike SQLite which is file-based)

## Prerequisites

- PostgreSQL 12 or higher installed
- Access to PostgreSQL server (local or remote)
- Basic knowledge of SQL and database administration

## Installation

### On Ubuntu/Debian (including Termux with proot-distro)

```bash
# Update package lists
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo service postgresql start
```

### On Termux (Native - Limited Support)

```bash
# Install PostgreSQL in Termux
pkg install postgresql

# Initialize database cluster
initdb $PREFIX/var/lib/postgresql

# Start PostgreSQL server
pg_ctl -D $PREFIX/var/lib/postgresql start
```

### On macOS

```bash
# Using Homebrew
brew install postgresql

# Start PostgreSQL
brew services start postgresql
```

### On Windows

Download and install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)

## Database Setup

### 1. Create Database and User

Connect to PostgreSQL as the superuser:

```bash
# On Linux/macOS
sudo -u postgres psql

# On Termux
psql postgres
```

Create the database and user:

```sql
-- Create database
CREATE DATABASE hydra_termux;

-- Create user with password
CREATE USER hydra_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE hydra_termux TO hydra_user;

-- Connect to the database
\c hydra_termux

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO hydra_user;

-- Exit
\q
```

### 2. Configure Backend

Update your backend `.env` file:

```bash
cd fullstack-app/backend
cp .env.example .env
```

Edit `.env` and set:

```ini
# Database Configuration
DB_TYPE=postgres

# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=hydra_termux
POSTGRES_USER=hydra_user
POSTGRES_PASSWORD=your_secure_password
```

### 3. Install Dependencies

```bash
cd fullstack-app/backend
npm install
```

This will install the `pg` (PostgreSQL) package along with other dependencies.

### 4. Start the Backend

```bash
npm start
```

The backend will automatically:
- Connect to PostgreSQL
- Create all necessary tables
- Initialize the schema

You should see:
```
Using PostgreSQL database
Connected to PostgreSQL database
PostgreSQL database tables initialized
```

## Verify Setup

### Check Database Connection

```bash
psql -U hydra_user -d hydra_termux -h localhost
```

### List Tables

```sql
\dt
```

You should see tables like:
- users
- attacks
- targets
- results
- wordlists
- attack_logs
- webhooks
- webhook_deliveries

### Check Backend Health

```bash
curl http://localhost:3000/api/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

## Remote PostgreSQL Setup

If you want to connect to a remote PostgreSQL server:

### 1. Configure PostgreSQL for Remote Access

⚠️ **Security Warning:** Exposing PostgreSQL to the internet is dangerous. Only use for trusted networks.

Edit `postgresql.conf`:
```ini
# For production, specify exact IPs instead of '*'
listen_addresses = 'localhost,192.168.1.100'  # Specific IPs only
# Or for development on private network:
# listen_addresses = '*'
```

Edit `pg_hba.conf` to allow remote connections **from specific IPs only**:
```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
# ⚠️ NEVER use 0.0.0.0/0 in production - specify exact IPs/subnets
# Example for specific subnet:
host    hydra_termux    hydra_user      192.168.1.0/24         scram-sha-256

# For VPN or private network:
host    hydra_termux    hydra_user      10.0.0.0/8             scram-sha-256

# ❌ AVOID in production (allows any IP):
# host    hydra_termux    hydra_user      0.0.0.0/0              md5
```

**Additional Security Measures:**
1. Use firewall rules to restrict port 5432:
   ```bash
   sudo ufw allow from 192.168.1.0/24 to any port 5432
   ```

2. Enable SSL/TLS encryption:
   ```ini
   # In postgresql.conf
   ssl = on
   ssl_cert_file = '/path/to/server.crt'
   ssl_key_file = '/path/to/server.key'
   ```

3. Use strong authentication (scram-sha-256 instead of md5)

4. Regular security audits and updates

Restart PostgreSQL:
```bash
sudo service postgresql restart
```

### 2. Update Backend Configuration

```ini
POSTGRES_HOST=your-server-ip
POSTGRES_PORT=5432
POSTGRES_DB=hydra_termux
POSTGRES_USER=hydra_user
POSTGRES_PASSWORD=your_secure_password
```

## Migration from SQLite to PostgreSQL

If you're currently using SQLite and want to migrate to PostgreSQL:

### 1. Export Data from SQLite

```bash
cd fullstack-app/backend

# Export users
sqlite3 database.sqlite "SELECT * FROM users;" > users.csv

# Export other tables similarly
```

### 2. Import Data to PostgreSQL

```bash
psql -U hydra_user -d hydra_termux

# Copy data from CSV
\copy users FROM 'users.csv' WITH CSV HEADER;
```

Or use a migration tool like `pgloader`:

```bash
pgloader database.sqlite postgresql://hydra_user:password@localhost/hydra_termux
```

## Performance Tuning

### Optimize PostgreSQL for Hydra-Termux

Edit `postgresql.conf`:

```ini
# Memory Settings
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB

# Connection Settings
max_connections = 100

# Logging
log_statement = 'all'  # For debugging (disable in production)
log_duration = on
```

### Create Indexes

For better query performance:

```sql
-- Index on attacks
CREATE INDEX idx_attacks_user_id ON attacks(user_id);
CREATE INDEX idx_attacks_status ON attacks(status);
CREATE INDEX idx_attacks_created_at ON attacks(created_at);

-- Index on results
CREATE INDEX idx_results_attack_id ON results(attack_id);
CREATE INDEX idx_results_success ON results(success);

-- Index on logs
CREATE INDEX idx_logs_attack_id ON attack_logs(attack_id);
CREATE INDEX idx_logs_timestamp ON attack_logs(timestamp);
```

## Backup and Restore

### Backup Database

```bash
# Full backup
pg_dump -U hydra_user hydra_termux > hydra_backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump -U hydra_user hydra_termux | gzip > hydra_backup_$(date +%Y%m%d).sql.gz
```

### Restore Database

```bash
# Restore from SQL file
psql -U hydra_user hydra_termux < hydra_backup_20240101.sql

# Restore from compressed file
gunzip -c hydra_backup_20240101.sql.gz | psql -U hydra_user hydra_termux
```

### Automated Backups

Create a cron job for daily backups:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * pg_dump -U hydra_user hydra_termux | gzip > /path/to/backups/hydra_$(date +\%Y\%m\%d).sql.gz
```

## Troubleshooting

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
- Check if PostgreSQL is running: `sudo service postgresql status`
- Check if port 5432 is open: `netstat -an | grep 5432`
- Verify `listen_addresses` in `postgresql.conf`

### Authentication Failed

```
Error: password authentication failed for user "hydra_user"
```

**Solution:**
- Verify credentials in `.env` file
- Check `pg_hba.conf` for authentication method
- Reset password: `ALTER USER hydra_user WITH PASSWORD 'new_password';`

### Permission Denied

```
Error: permission denied for schema public
```

**Solution:**
```sql
GRANT ALL ON SCHEMA public TO hydra_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO hydra_user;
```

### Tables Not Created

```
Error: relation "users" does not exist
```

**Solution:**
- Restart the backend server (it auto-creates tables on startup)
- Or manually run the initialization script
- Check server logs for errors during table creation

## Security Best Practices

1. **Use Strong Passwords**
   - Generate secure password: `openssl rand -base64 32`
   - Store in environment variables, not in code

2. **Restrict Network Access**
   - Use firewall rules to limit PostgreSQL access
   - Only allow specific IPs in `pg_hba.conf`
   - Use SSL/TLS for remote connections

3. **Regular Backups**
   - Implement automated backup strategy
   - Test restore procedures regularly
   - Store backups securely off-site

4. **Monitor Access**
   - Enable query logging
   - Review access logs regularly
   - Set up alerts for suspicious activity

5. **Update Regularly**
   - Keep PostgreSQL updated
   - Apply security patches promptly
   - Monitor PostgreSQL security advisories

## Performance Monitoring

### Check Active Connections

```sql
SELECT * FROM pg_stat_activity;
```

### Check Database Size

```sql
SELECT pg_size_pretty(pg_database_size('hydra_termux'));
```

### Check Table Sizes

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Slow Query Analysis

```sql
-- Enable slow query logging in postgresql.conf
log_min_duration_statement = 1000  # Log queries taking > 1 second

-- View slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Additional Resources

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [pg Node.js Driver](https://node-postgres.com/)

## Support

If you encounter issues with PostgreSQL setup:

1. Check the backend logs for detailed error messages
2. Verify PostgreSQL server logs: `/var/log/postgresql/postgresql-*.log`
3. Test database connection manually: `psql -U hydra_user -d hydra_termux`
4. Open an issue on GitHub with error details

---

**Note:** PostgreSQL support is optional. The application works perfectly fine with SQLite for most use cases. Use PostgreSQL if you need better performance, concurrent access, or production deployment features.
