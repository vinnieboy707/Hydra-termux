#!/bin/bash

# Attack Report Generator
# Generates detailed attack reports with prevention recommendations

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger if available
if [ -f "$SCRIPT_DIR/logger.sh" ]; then
    source "$SCRIPT_DIR/logger.sh"
fi

# Report directory
REPORT_DIR="${REPORT_DIR:-$PROJECT_ROOT/reports}"
mkdir -p "$REPORT_DIR"

# Function to get prevention recommendations for a protocol
get_prevention_recommendations() {
    local protocol="$1"
    
    case "$protocol" in
        ssh)
            cat << 'EOF'
## Prevention & Mitigation Recommendations

### Immediate Actions (Critical Priority)
1. **Change Compromised Credentials Immediately**
   - Reset passwords for all affected accounts
   - Audit all accounts with similar weak passwords
   - Check for any unauthorized access or changes made using compromised credentials

2. **Implement Key-Based Authentication**
   - Generate SSH key pairs for legitimate users
   - Disable password authentication in `/etc/ssh/sshd_config`:
     ```
     PasswordAuthentication no
     PubkeyAuthentication yes
     ```
   - Restart SSH service: `sudo systemctl restart sshd`

3. **Enable Multi-Factor Authentication (MFA)**
   - Install Google Authenticator PAM module: `sudo apt install libpam-google-authenticator`
   - Configure in `/etc/pam.d/sshd`
   - Require both SSH key AND OTP code for access

### Short-Term Security Enhancements
4. **Configure Fail2Ban**
   - Install: `sudo apt install fail2ban`
   - Create SSH jail in `/etc/fail2ban/jail.local`:
     ```
     [sshd]
     enabled = true
     port = ssh
     maxretry = 3
     bantime = 3600
     findtime = 600
     ```
   - This blocks IPs after 3 failed login attempts

5. **Restrict SSH Access**
   - Limit SSH to specific users in `/etc/ssh/sshd_config`:
     ```
     AllowUsers user1 user2
     DenyUsers root
     ```
   - Disable root login completely:
     ```
     PermitRootLogin no
     ```

6. **Change Default SSH Port**
   - Modify port in `/etc/ssh/sshd_config`:
     ```
     Port 2222  # Or any non-standard port
     ```
   - Update firewall rules accordingly

### Long-Term Best Practices
7. **Implement Network-Level Controls**
   - Use VPN or jump host (bastion) for SSH access
   - Configure firewall rules to allow SSH only from trusted IPs
   - Use cloud security groups to restrict access by source IP

8. **Strong Password Policy**
   - Enforce minimum 16-character passwords with complexity requirements
   - Use password manager for generating and storing credentials
   - Implement automatic password rotation every 90 days

9. **Regular Security Auditing**
   - Monitor `/var/log/auth.log` for suspicious login attempts
   - Set up SIEM alerts for multiple failed logins
   - Regular penetration testing and vulnerability assessments
   - Review active SSH sessions: `who` or `w` commands

10. **Additional SSH Hardening**
    - Disable empty passwords: `PermitEmptyPasswords no`
    - Set login grace time: `LoginGraceTime 30`
    - Limit authentication attempts: `MaxAuthTries 3`
    - Use SSH protocol 2 only: `Protocol 2`
    - Disable X11 forwarding if not needed: `X11Forwarding no`
    - Enable strict mode: `StrictModes yes`

### Detection & Response
- **Monitor for breach indicators:**
  - Unusual login times or locations
  - Unexpected service startups
  - Unauthorized file modifications
  - New user accounts or privilege escalations
  
- **Incident response plan:**
  - Disconnect compromised system from network
  - Preserve logs for forensic analysis
  - Rebuild system from trusted backup
  - Implement additional monitoring

### Compliance Considerations
- Document all security changes for audit trails
- Ensure compliance with regulations (PCI-DSS, HIPAA, SOC 2, etc.)
- Maintain password policy documentation
- Regular security awareness training for users
EOF
            ;;
        ftp)
            cat << 'EOF'
## Prevention & Mitigation Recommendations

### Immediate Actions (Critical Priority)
1. **Change Compromised Credentials**
   - Reset passwords for all FTP accounts immediately
   - Audit all users with similar weak passwords
   - Review FTP logs for unauthorized access

2. **Migrate to Secure Protocols**
   - **SFTP (SSH File Transfer Protocol)** - Recommended
     - Use SSH infrastructure for secure file transfer
     - Encrypted authentication and data transfer
   - **FTPS (FTP over SSL/TLS)** - Alternative
     - Requires SSL/TLS certificates
     - Configure explicit or implicit FTPS

3. **Disable Standard FTP**
   - Stop FTP service: `sudo systemctl stop vsftpd` or `sudo service proftpd stop`
   - Prevent autostart: `sudo systemctl disable vsftpd`
   - Consider removing FTP server entirely if not needed

### Short-Term Security Enhancements
4. **If FTP Must Continue (Not Recommended)**
   - Configure Fail2Ban for FTP:
     ```
     [vsftpd]
     enabled = true
     port = ftp,ftp-data,ftps,ftps-data
     maxretry = 3
     bantime = 7200
     ```
   - Limit login attempts in vsftpd.conf:
     ```
     max_login_fails=3
     max_per_ip=2
     ```

5. **Restrict FTP Access**
   - Use chroot jails to restrict users to home directories:
     ```
     chroot_local_user=YES
     ```
   - Create user whitelist in `/etc/vsftpd.user_list`
   - Deny anonymous access:
     ```
     anonymous_enable=NO
     ```

6. **Network-Level Controls**
   - Restrict FTP to internal networks only
   - Use firewall rules to limit source IPs
   - Place FTP server in DMZ with restricted access

### Long-Term Best Practices
7. **Implement Modern File Transfer Solutions**
   - Cloud storage with API access (AWS S3, Azure Blob, etc.)
   - Managed file transfer services (MFT)
   - WebDAV over HTTPS
   - SCP (Secure Copy Protocol)

8. **Strong Authentication**
   - Enforce 16+ character passwords
   - Implement certificate-based authentication
   - Use LDAP/Active Directory integration for centralized auth
   - Enable two-factor authentication if supported

9. **Monitoring & Logging**
   - Enable detailed FTP logging
   - Monitor for unusual file access patterns
   - Set up alerts for multiple failed login attempts
   - Regular log review and retention (90+ days)

10. **Regular Security Audits**
    - Quarterly vulnerability scans
    - Annual penetration testing
    - Review and remove unused FTP accounts
    - Audit file permissions regularly

### Additional Hardening
- Use passive FTP mode to simplify firewall rules
- Disable unused FTP features
- Implement rate limiting
- Regular security patches and updates
- Encrypt data at rest on FTP server

### Why FTP is Insecure
- **Plaintext transmission** - Passwords and data sent unencrypted
- **Vulnerable to sniffing** - Easy to capture credentials on network
- **No integrity checking** - Files can be modified in transit
- **Compliance issues** - Fails PCI-DSS, HIPAA requirements

### Migration Path
1. Set up SFTP server (OpenSSH)
2. Create user accounts with SSH keys
3. Test file transfers with new system
4. Update client applications/scripts
5. Run FTP and SFTP in parallel during transition
6. Decommission FTP after full migration
EOF
            ;;
        http|https|web)
            cat << 'EOF'
## Prevention & Mitigation Recommendations

### Immediate Actions (Critical Priority)
1. **Reset Compromised Admin Credentials**
   - Change admin passwords immediately (all administrators)
   - Review admin access logs for unauthorized activities
   - Check for backdoor accounts or unauthorized changes
   - Audit database for malicious modifications

2. **Review Recent Admin Activities**
   - Check for uploaded malicious files (shells, backdoors)
   - Review user management changes
   - Audit plugin/module installations
   - Check for modified core files

3. **Lockdown Admin Panel Immediately**
   - Change admin URL/path if possible (rename /admin, /wp-admin)
   - Add IP whitelist for admin access
   - Enable maintenance mode during investigation

### Short-Term Security Enhancements
4. **Implement Strong Authentication**
   - Use password manager to generate 20+ character passwords
   - Enable Multi-Factor Authentication (MFA/2FA)
     - Google Authenticator
     - Duo Security
     - YubiKey hardware tokens
   - Enforce password complexity and rotation policies

5. **Web Application Firewall (WAF)**
   - Cloudflare (free plan available)
   - ModSecurity for Apache/Nginx
   - AWS WAF for cloud deployments
   - Configure rules to block brute-force attempts

6. **Rate Limiting & Brute-Force Protection**
   - Install security plugins:
     - **WordPress:** Wordfence, iThemes Security, Limit Login Attempts
     - **Drupal:** Login Security module
     - **Joomla:** AdminTools
   - Configure login attempt limits (3-5 attempts)
   - Implement progressive delays after failed attempts
   - CAPTCHA on login forms (reCAPTCHA v3)

7. **Admin Access Restrictions**
   - IP whitelist for admin panel
   - Restrict admin access to VPN only
   - Separate admin interface from public site
   - Use different domain/subdomain for admin

### Long-Term Best Practices
8. **Network-Level Security**
   - Configure nginx/Apache to block admin paths:
     ```nginx
     location ~* /(wp-admin|admin|administrator) {
         allow 203.0.113.0/24;  # Your office IP
         deny all;
         auth_basic "Admin Area";
         auth_basic_user_file /etc/nginx/.htpasswd;
     }
     ```

9. **HTTPS Enforcement**
   - Install valid SSL/TLS certificate (Let's Encrypt - free)
   - Force HTTPS for entire site
   - Enable HSTS (HTTP Strict Transport Security)
   - Use strong cipher suites (TLS 1.3)

10. **Security Headers**
    - Configure security headers:
      ```
      X-Frame-Options: DENY
      X-Content-Type-Options: nosniff
      X-XSS-Protection: 1; mode=block
      Content-Security-Policy: default-src 'self'
      Referrer-Policy: no-referrer-when-downgrade
      ```

11. **Regular Updates & Patching**
    - Enable automatic security updates
    - Keep CMS core updated (WordPress, Drupal, Joomla)
    - Update all plugins/modules/themes
    - Remove unused plugins/themes
    - Subscribe to security mailing lists

12. **Database Security**
    - Change database table prefix (wp_ to something random)
    - Use dedicated database user with minimal privileges
    - Restrict database access to localhost only
    - Regular database backups
    - Encrypt database at rest

### Application-Specific Hardening

#### WordPress
- Disable XML-RPC: `add_filter('xmlrpc_enabled', '__return_false');`
- Disable file editing in wp-config.php:
  ```php
  define('DISALLOW_FILE_EDIT', true);
  define('DISALLOW_FILE_MODS', true);
  ```
- Hide WordPress version
- Use security keys and salts (generate new ones)

#### General Web Applications
- Implement account lockout policies
- Add login attempt logging
- Use secure session management
- Implement CSRF protection
- Sanitize all user inputs
- Use parameterized queries (prevent SQL injection)

### Monitoring & Detection
13. **Implement Security Monitoring**
    - File integrity monitoring (AIDE, Tripwire)
    - Real-time log analysis (fail2ban, Wazuh)
    - Uptime monitoring (UptimeRobot, Pingdom)
    - Security scanner (Sucuri, Qualys)

14. **Logging & Alerting**
    - Enable detailed access logs
    - Log all admin activities
    - Set up alerts for:
      - Multiple failed login attempts
      - Successful logins from new IPs
      - Admin file modifications
      - Plugin installations
    - Retain logs for 90+ days

### Incident Response
15. **Post-Breach Actions**
    - Conduct full security audit
    - Scan for malware and backdoors
    - Review all user accounts
    - Check for SEO spam or hidden pages
    - Restore from clean backup if compromised
    - Consider professional security audit

### Compliance & Best Practices
- Follow OWASP Top 10 guidelines
- Implement principle of least privilege
- Regular security training for admin users
- Documented incident response plan
- Regular penetration testing
- Maintain security documentation
EOF
            ;;
        rdp)
            cat << 'EOF'
## Prevention & Mitigation Recommendations

### Immediate Actions (Critical Priority)
1. **Reset Compromised Credentials**
   - Change passwords for all affected RDP accounts
   - Reset local Administrator password
   - Review event logs (Event ID 4624, 4625) for unauthorized access
   - Check for unauthorized changes, new accounts, or installed software

2. **Enable Network Level Authentication (NLA)**
   - Require NLA before RDP session establishment
   - Windows: Computer Configuration → Policies → Administrative Templates → Windows Components → Remote Desktop Services
   - Set "Require user authentication for remote connections by using Network Level Authentication" to **Enabled**

3. **Restrict RDP Access Immediately**
   - Block RDP from internet if exposed (Port 3389)
   - Use firewall to allow RDP only from trusted IPs
   - Windows Firewall rule: Restrict source IPs to known ranges

### Short-Term Security Enhancements
4. **Change Default RDP Port**
   - Modify registry: `HKEY_LOCAL_MACHINE\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp\PortNumber`
   - Set to non-standard port (e.g., 33890)
   - Update firewall rules accordingly
   - **Note:** This is obscurity, not security - still use other measures

5. **Implement Account Lockout Policies**
   - Group Policy → Computer Configuration → Windows Settings → Security Settings → Account Policies → Account Lockout Policy
   - Set:
     - Account lockout threshold: 5 invalid attempts
     - Account lockout duration: 30 minutes
     - Reset account lockout counter after: 30 minutes

6. **Configure Fail2Ban or RDP Defender**
   - **Windows:** Use RDP Defender or EvlWatcher
   - Automatically block IPs after failed attempts
   - Configure email alerts for multiple failures
   - Whitelist known good IPs

7. **Strong Authentication**
   - Enforce strong password policy (16+ characters, complexity)
   - Enable Multi-Factor Authentication
     - Azure MFA for cloud-connected systems
     - Duo Security for on-premises
     - Windows Hello for Business
   - Use smart cards or certificate-based authentication

### Long-Term Best Practices
8. **Implement Remote Desktop Gateway (RD Gateway)**
   - Central access point for RDP connections
   - SSL/TLS encryption for RDP traffic
   - Centralized authentication and authorization
   - Additional layer of security and auditing
   - Users connect to gateway (443), then to internal systems

9. **Use VPN for Remote Access**
   - Require VPN connection before RDP access
   - Never expose RDP directly to internet
   - Use modern VPN with MFA (WireGuard, OpenVPN, IPSec)
   - Consider Zero Trust Network Access (ZTNA) solutions

10. **Principle of Least Privilege**
    - Remove Administrator rights from regular users
    - Use separate admin accounts for administrative tasks
    - Implement Just-In-Time (JIT) admin access
    - Regular user access reviews

11. **Enable Advanced Security Features**
    - Windows Defender Advanced Threat Protection (ATP)
    - Enable audit logging for RDP connections
    - Configure Windows Event Forwarding (WEF)
    - Implement Restricted Admin Mode:
      - Registry: `HKLM\System\CurrentControlSet\Control\Lsa\DisableRestrictedAdmin` = 0
      - Prevents credential exposure on compromised systems

12. **Network Segmentation**
    - Place servers in separate VLANs
    - Use jump boxes/bastion hosts for admin access
    - Implement microsegmentation with internal firewalls
    - Zero Trust network architecture

### Monitoring & Detection
13. **Enhanced Logging & Monitoring**
    - Enable RDP connection logging:
      - Event ID 4624: Successful logon
      - Event ID 4625: Failed logon
      - Event ID 4778: Session reconnected
      - Event ID 4779: Session disconnected
    - Forward logs to SIEM (Splunk, ELK, Azure Sentinel)
    - Set up alerts for:
      - Multiple failed login attempts
      - Off-hours RDP connections
      - RDP from unexpected countries/IPs
      - Multiple concurrent sessions

14. **Regular Security Audits**
    - Review RDP access logs weekly
    - Quarterly access rights review
    - Check for stale/unused accounts
    - Validate MFA enforcement
    - Penetration testing annually

### Additional Hardening
15. **Group Policy Hardening**
    - Set idle session timeout (15 minutes)
    - Limit session time (2 hours)
    - Disable drive redirection
    - Disable clipboard redirection
    - Disable printer redirection
    - Set encryption level to "High"
    - Require secure RPC communication

16. **Certificate-Based Authentication**
    - Deploy SSL certificate for RDP
    - Configure RDP to require certificate validation
    - Prevents man-in-the-middle attacks

17. **Windows Security Baseline**
    - Apply Microsoft Security Compliance Toolkit
    - CIS Benchmarks for Windows Server
    - Regular Windows Updates and patches
    - Disable legacy protocols (SMBv1, etc.)

### Cloud-Specific Recommendations
- **Azure VMs:** Use Azure Bastion (no public IPs needed)
- **AWS EC2:** Use AWS Systems Manager Session Manager
- **GCP:** Use Identity-Aware Proxy (IAP)

### Incident Response
- Disconnect compromised systems from network
- Preserve memory dump and disk images
- Analyze event logs and installed software
- Check for persistence mechanisms (scheduled tasks, services)
- Rebuild system from trusted image if compromised
- Implement additional monitoring post-incident

### Why RDP is High-Risk
- Commonly targeted by ransomware operators
- Frequent credential stuffing attacks
- BlueKeep and other RDP vulnerabilities
- Often exposed to internet with weak passwords
- Lateral movement vector in networks
EOF
            ;;
        mysql|mariadb)
            cat << 'EOF'
## Prevention & Mitigation Recommendations

### Immediate Actions (Critical Priority)
1. **Reset Compromised Database Credentials**
   - Change passwords for all affected accounts immediately:
     ```sql
     ALTER USER 'root'@'localhost' IDENTIFIED BY 'NewStrongPassword123!@#';
     FLUSH PRIVILEGES;
     ```
   - Reset passwords for all database users
   - Audit user permissions and remove unnecessary accounts

2. **Review Database Activity**
   - Check for unauthorized database/table creation:
     ```sql
     SHOW DATABASES;
     SHOW TABLES FROM database_name;
     ```
   - Review MySQL/MariaDB logs for suspicious queries
   - Check for new user accounts or privilege escalations:
     ```sql
     SELECT user, host, authentication_string FROM mysql.user;
     ```

3. **Restrict Database Network Access**
   - Edit `/etc/mysql/mysql.conf.d/mysqld.cnf` (Ubuntu) or `/etc/my.cnf`:
     ```
     bind-address = 127.0.0.1  # Localhost only
     ```
   - Use firewall to block MySQL port (3306) from external access
   - Restart MySQL: `sudo systemctl restart mysql`

### Short-Term Security Enhancements
4. **Disable Remote Root Login**
   - Delete remote root accounts:
     ```sql
     DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
     FLUSH PRIVILEGES;
     ```
   - Create dedicated users for remote access with minimal privileges

5. **Implement Strong Password Policy**
   - Install password validation plugin:
     ```sql
     INSTALL PLUGIN validate_password SONAME 'validate_password.so';
     SET GLOBAL validate_password.length = 16;
     SET GLOBAL validate_password.policy = STRONG;
     ```
   - Enforce password expiration:
     ```sql
     ALTER USER 'username'@'host' PASSWORD EXPIRE INTERVAL 90 DAY;
     ```

6. **Configure Fail2Ban for MySQL**
   - Create jail in `/etc/fail2ban/jail.local`:
     ```
     [mysqld-auth]
     enabled = true
     filter = mysqld-auth
     port = 3306
     logpath = /var/log/mysql/error.log
     maxretry = 3
     bantime = 3600
     ```
   - Create filter in `/etc/fail2ban/filter.d/mysqld-auth.conf`

7. **Principle of Least Privilege**
   - Grant only necessary permissions:
     ```sql
     CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'StrongPassword';
     GRANT SELECT, INSERT, UPDATE ON app_db.* TO 'app_user'@'localhost';
     FLUSH PRIVILEGES;
     ```
   - Remove ALL PRIVILEGES, FILE, SUPER, PROCESS grants unless required
   - Regularly audit user privileges:
     ```sql
     SHOW GRANTS FOR 'username'@'host';
     ```

### Long-Term Best Practices
8. **Network-Level Security**
   - Use SSH tunneling for remote database access:
     ```bash
     ssh -L 3306:localhost:3306 user@database-server
     ```
   - Place database in private subnet (no direct internet access)
   - Use VPN for database administration
   - Implement database firewall or proxy (ProxySQL, MaxScale)

9. **SSL/TLS Encryption**
   - Enable SSL for MySQL connections
   - Generate SSL certificates
   - Configure in my.cnf:
     ```
     [mysqld]
     require_secure_transport = ON
     ssl-ca=/path/to/ca.pem
     ssl-cert=/path/to/server-cert.pem
     ssl-key=/path/to/server-key.pem
     ```
   - Force SSL for users:
     ```sql
     ALTER USER 'user'@'host' REQUIRE SSL;
     ```

10. **Disable Unnecessary Features**
    - Disable remote file loading:
      ```
      local-infile = 0
      ```
    - Disable LOAD DATA LOCAL INFILE
    - Remove test database: `DROP DATABASE test;`
    - Remove anonymous users:
      ```sql
      DELETE FROM mysql.user WHERE User='';
      FLUSH PRIVILEGES;
      ```

11. **Regular Security Audits**
    - Review user accounts monthly:
      ```sql
      SELECT user, host, plugin FROM mysql.user;
      ```
    - Audit table permissions
    - Check for empty passwords:
      ```sql
      SELECT user, host FROM mysql.user WHERE authentication_string='';
      ```
    - Review and rotate credentials quarterly

### Monitoring & Logging
12. **Enable Comprehensive Logging**
    - Enable general query log (temporarily for auditing):
      ```
      [mysqld]
      general_log = 1
      general_log_file = /var/log/mysql/mysql.log
      ```
    - Enable slow query log:
      ```
      slow_query_log = 1
      slow_query_log_file = /var/log/mysql/mysql-slow.log
      long_query_time = 2
      ```
    - Enable error log and review regularly

13. **Implement Monitoring & Alerting**
    - Use MySQL Enterprise Monitor, Percona Monitoring, or Zabbix
    - Set up alerts for:
      - Failed login attempts
      - New user creation
      - Privilege grants
      - Unusual query patterns
    - Monitor connection count and sources

14. **Database Activity Monitoring (DAM)**
    - Implement real-time query monitoring
    - Alert on suspicious queries (DROP, DELETE without WHERE)
    - Track data access patterns
    - Compliance reporting (PCI-DSS, HIPAA)

### Backup & Recovery
15. **Regular Backups**
    - Automated daily backups (mysqldump or Percona XtraBackup)
    - Test restore procedures quarterly
    - Store backups encrypted and off-site
    - Implement point-in-time recovery
    - Backup retention policy (30+ days)

### Advanced Hardening
16. **Application-Level Security**
    - Use prepared statements (prevent SQL injection)
    - Connection pooling with credential rotation
    - Application-specific database users
    - ORM security best practices

17. **MySQL Security Hardening Script**
    - Run `mysql_secure_installation`:
      - Set root password
      - Remove anonymous users
      - Disallow root login remotely
      - Remove test database
      - Reload privilege tables

18. **System-Level Security**
    - Run MySQL as non-privileged user
    - Secure file permissions:
      ```bash
      chmod 640 /etc/mysql/my.cnf
      chown mysql:mysql /var/lib/mysql
      ```
    - Disable MySQL history:
      ```bash
      export MYSQL_HISTFILE=/dev/null
      ```

19. **Cloud Database Services**
    - Consider managed database services (AWS RDS, Azure Database, Google Cloud SQL)
    - Built-in security features
    - Automated backups and patching
    - Network isolation by default

### Compliance & Best Practices
- Follow CIS MySQL Benchmark
- Implement data encryption at rest (InnoDB tablespace encryption)
- Regular security patches and updates
- Documented security procedures
- Annual penetration testing
- SOX, PCI-DSS, HIPAA compliance configurations

### Container/Docker Specific
- Use official MySQL images only
- Don't use root MySQL user in applications
- Store credentials in secrets manager
- Use read-only file systems where possible
- Regular image updates
EOF
            ;;
        postgresql|postgres)
            cat << 'EOF'
## Prevention & Mitigation Recommendations

### Immediate Actions (Critical Priority)
1. **Reset Compromised Credentials**
   - Change passwords immediately:
     ```sql
     ALTER USER postgres WITH PASSWORD 'NewStrongPassword123!@#';
     ALTER USER username WITH PASSWORD 'AnotherStrongPassword456$%^';
     ```
   - Review all database users:
     ```sql
     SELECT usename, usesuper, usecreatedb FROM pg_user;
     ```

2. **Review Database Activity**
   - Check for unauthorized databases:
     ```sql
     SELECT datname FROM pg_database;
     ```
   - Review active connections:
     ```sql
     SELECT * FROM pg_stat_activity;
     ```
   - Check for suspicious queries in logs
   - Audit role permissions:
     ```sql
     SELECT * FROM pg_roles;
     ```

3. **Restrict Network Access**
   - Edit `/etc/postgresql/*/main/postgresql.conf`:
     ```
     listen_addresses = 'localhost'  # Only local connections
     ```
   - Edit `/etc/postgresql/*/main/pg_hba.conf`:
     ```
     # TYPE  DATABASE        USER            ADDRESS                 METHOD
     local   all             all                                     peer
     host    all             all             127.0.0.1/32            scram-sha-256
     ```
   - Restart PostgreSQL: `sudo systemctl restart postgresql`

### Short-Term Security Enhancements
4. **Configure Strong Password Authentication**
   - Use scram-sha-256 authentication (strongest available)
   - Edit pg_hba.conf to replace 'md5' with 'scram-sha-256'
   - Set password encryption:
     ```sql
     ALTER SYSTEM SET password_encryption = 'scram-sha-256';
     SELECT pg_reload_conf();
     ```

5. **Implement Connection Limits**
   - Set max connections per user:
     ```sql
     ALTER USER username CONNECTION LIMIT 5;
     ```
   - Configure connection limits in postgresql.conf:
     ```
     max_connections = 100
     ```

6. **Configure Fail2Ban for PostgreSQL**
   - Create jail in `/etc/fail2ban/jail.local`:
     ```
     [postgresql]
     enabled = true
     port = 5432
     filter = postgresql
     logpath = /var/log/postgresql/postgresql-*-main.log
     maxretry = 3
     bantime = 3600
     findtime = 600
     ```

7. **Principle of Least Privilege**
   - Create role-based access:
     ```sql
     CREATE ROLE app_readonly;
     GRANT CONNECT ON DATABASE mydb TO app_readonly;
     GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;
     CREATE USER app_user WITH PASSWORD 'pass123';
     GRANT app_readonly TO app_user;
     ```
   - Revoke public schema privileges:
     ```sql
     REVOKE CREATE ON SCHEMA public FROM PUBLIC;
     ```
   - Audit and minimize superuser accounts

### Long-Term Best Practices
8. **SSL/TLS Encryption**
   - Generate SSL certificates
   - Configure in postgresql.conf:
     ```
     ssl = on
     ssl_cert_file = '/path/to/server.crt'
     ssl_key_file = '/path/to/server.key'
     ssl_ca_file = '/path/to/root.crt'
     ```
   - Enforce SSL in pg_hba.conf:
     ```
     hostssl  all  all  0.0.0.0/0  scram-sha-256
     ```
   - Require SSL for users:
     ```sql
     ALTER USER username REQUIRE SSL;
     ```

9. **Network-Level Security**
   - Use SSH tunneling for remote access:
     ```bash
     ssh -L 5432:localhost:5432 user@database-server
     ```
   - Place database in private subnet
   - Use connection pooler (PgBouncer) with authentication
   - Implement database firewall or proxy

10. **Enable Row-Level Security (RLS)**
    - Implement fine-grained access control:
      ```sql
      ALTER TABLE sensitive_table ENABLE ROW LEVEL SECURITY;
      CREATE POLICY user_policy ON sensitive_table
        USING (user_id = current_user);
      ```

11. **Disable Dangerous Functions**
    - Revoke file system access:
      ```sql
      REVOKE EXECUTE ON FUNCTION pg_read_file FROM PUBLIC;
      REVOKE EXECUTE ON FUNCTION pg_ls_dir FROM PUBLIC;
      ```
    - Disable untrusted languages if not needed:
      ```sql
      DROP EXTENSION IF EXISTS plpythonu;
      ```

### Monitoring & Logging
12. **Comprehensive Logging Configuration**
    - Edit postgresql.conf:
      ```
      logging_collector = on
      log_directory = 'pg_log'
      log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
      log_connections = on
      log_disconnections = on
      log_duration = on
      log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
      log_statement = 'ddl'  # Log DDL statements
      log_min_duration_statement = 1000  # Log slow queries (>1s)
      ```

13. **Enable Audit Logging**
    - Install pgAudit extension:
      ```sql
      CREATE EXTENSION pgaudit;
      ```
    - Configure in postgresql.conf:
      ```
      shared_preload_libraries = 'pgaudit'
      pgaudit.log = 'all'  # Or 'read', 'write', 'ddl', etc.
      ```

14. **Monitoring & Alerting**
    - Monitor failed connection attempts
    - Track query performance (pg_stat_statements)
    - Set up alerts for:
      - Multiple authentication failures
      - New role/user creation
      - Permission changes (GRANT/REVOKE)
      - Unusual connection sources
    - Use tools: Pgbadger, check_postgres, Datadog, etc.

### Backup & Recovery
15. **Implement Robust Backup Strategy**
    - Use pg_dump for logical backups:
      ```bash
      pg_dump -U postgres -F c mydb > backup_$(date +%Y%m%d).dump
      ```
    - Use pg_basebackup for physical backups
    - Implement Point-In-Time Recovery (PITR):
      ```
      wal_level = replica
      archive_mode = on
      archive_command = 'cp %p /path/to/archive/%f'
      ```
    - Test restore procedures regularly
    - Store backups encrypted off-site

### Advanced Hardening
16. **PostgreSQL Security Hardening**
    - Run as non-root user (postgres)
    - Secure file permissions:
      ```bash
      chmod 700 /var/lib/postgresql/*/main
      chmod 600 /etc/postgresql/*/main/*.conf
      ```
    - Disable command history:
      ```bash
      export PSQL_HISTORY=/dev/null
      ```

17. **Query Security**
    - Use prepared statements (prevent SQL injection)
    - Implement query timeouts:
      ```sql
      ALTER DATABASE mydb SET statement_timeout = '30s';
      ```
    - Set connection idle timeout:
      ```
      idle_in_transaction_session_timeout = 300000  # 5 minutes
      ```

18. **Data Encryption**
    - Enable transparent data encryption (TDE) if available
    - Use pgcrypto extension for column-level encryption:
      ```sql
      CREATE EXTENSION pgcrypto;
      ```
    - Encrypt sensitive data in application before storing

19. **Regular Security Maintenance**
    - Apply security patches promptly
    - Update PostgreSQL regularly (minor versions)
    - Review and rotate credentials quarterly
    - Audit user privileges monthly
    - Run security scans (Nessus, OpenVAS)

20. **Cloud Database Services**
    - Consider managed PostgreSQL (AWS RDS, Azure Database, Google Cloud SQL)
    - Built-in security features
    - Automated backups and patching
    - VPC/VNET isolation
    - IAM integration

### Application-Level Security
- Use connection pooling (PgBouncer, Pgpool-II)
- Implement read replicas for read-only queries
- Use ORM securely (SQLAlchemy, Django ORM)
- Validate and sanitize all user inputs
- Use database-specific user accounts per application

### Compliance & Best Practices
- Follow CIS PostgreSQL Benchmark
- Implement least privilege access
- Document security procedures
- Regular penetration testing
- Compliance configurations (PCI-DSS, HIPAA, SOC 2)
- Security awareness training

### Monitoring System-Level Access
- Monitor PostgreSQL service file changes
- Track systemd service status
- Alert on PostgreSQL process restarts
- File integrity monitoring (AIDE, Tripwire)
EOF
            ;;
        smb|cifs)
            cat << 'EOF'
## Prevention & Mitigation Recommendations

### Immediate Actions (Critical Priority)
1. **Reset Compromised Credentials**
   - Change passwords for all affected accounts
   - Reset local Administrator and Guest accounts
   - Review shared folder access logs
   - Audit for unauthorized file access or modifications

2. **Disable Guest Access**
   - Disable guest account:
     ```cmd
     net user guest /active:no
     ```
   - Configure via Group Policy: Computer Configuration → Windows Settings → Security Settings → Local Policies → Security Options
     - "Network access: Shares that can be accessed anonymously" = (empty)
     - "Network access: Do not allow anonymous enumeration of SAM accounts" = Enabled

3. **Restrict SMB Network Access**
   - Block SMB ports at firewall (TCP 445, 139, UDP 137-138)
   - Allow SMB only from trusted internal networks
   - Never expose SMB to internet (verify with Shodan/external scans)

### Short-Term Security Enhancements
4. **Disable SMBv1 (Critical)**
   - SMBv1 has known vulnerabilities (EternalBlue, WannaCry)
   - Disable via PowerShell:
     ```powershell
     Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol
     Set-SmbServerConfiguration -EnableSMB1Protocol $false
     ```
   - Verify: `Get-SmbServerConfiguration | Select EnableSMB1Protocol`
   - **Linux/Samba:** Edit `/etc/samba/smb.conf`:
     ```
     [global]
     min protocol = SMB2
     ```

5. **Enable SMB Signing**
   - Prevents man-in-the-middle attacks
   - Windows via Group Policy:
     - "Microsoft network server: Digitally sign communications (always)" = Enabled
   - PowerShell:
     ```powershell
     Set-SmbServerConfiguration -RequireSecuritySignature $true
     ```
   - **Samba:** Edit `/etc/samba/smb.conf`:
     ```
     [global]
     server signing = mandatory
     ```

6. **Enable SMB Encryption**
   - Encrypt all SMB traffic (SMB3+):
     ```powershell
     Set-SmbServerConfiguration -EncryptData $true
     ```
   - For specific shares:
     ```powershell
     Set-SmbShare -Name "ShareName" -EncryptData $true
     ```

7. **Configure Account Lockout Policy**
   - Group Policy: Account Policies → Account Lockout Policy
     - Account lockout threshold: 5 attempts
     - Account lockout duration: 30 minutes
     - Reset lockout counter after: 30 minutes

### Long-Term Best Practices
8. **Implement Least Privilege Access**
   - Remove "Everyone" from share permissions
   - Use security groups for access control
   - Grant specific permissions per user/group:
     ```powershell
     Grant-SmbShareAccess -Name "ShareName" -AccountName "Domain\User" -AccessRight Read
     Revoke-SmbShareAccess -Name "ShareName" -AccountName "Everyone"
     ```
   - Separate read-only and read-write shares

9. **Share Permissions Best Practices**
   - Share-level permissions: Control who can access
   - NTFS permissions: Control what they can do
   - Apply both layers (principle of least privilege)
   - Audit share permissions regularly:
     ```powershell
     Get-SmbShare | Get-SmbShareAccess
     ```

10. **Network-Level Security**
    - Place file servers in isolated VLAN
    - Use VPN for remote file access (not direct SMB)
    - Implement network segmentation
    - Use jump servers for administrative access
    - Consider DFS (Distributed File System) with proper security

11. **Regular Security Auditing**
    - Enable audit object access (success/failure)
    - Review Event IDs:
      - 5140: Network share accessed
      - 5142: Network share added
      - 5143: Network share modified
      - 5144: Network share deleted
    - Weekly review of access logs
    - Quarterly user access reviews

### Monitoring & Detection
12. **Enable Comprehensive Logging**
    - Windows Event Logs:
      - Security Log: Object Access auditing
      - System Log: SMB server events
    - Enable via Group Policy:
      - Audit object access: Success, Failure
      - Audit logon events: Success, Failure
    - **Samba:** Configure in smb.conf:
      ```
      [global]
      log level = 2
      max log size = 50000
      log file = /var/log/samba/%m.log
      ```

13. **Implement Monitoring & Alerting**
    - Monitor for:
      - Multiple failed authentication attempts
      - Access from unusual IPs/locations
      - Bulk file downloads
      - After-hours access
      - Permission changes
    - Use SIEM (Splunk, ELK, Azure Sentinel)
    - File integrity monitoring on shared files

14. **Deploy Access-Based Enumeration (ABE)**
    - Users only see folders they have access to
    - Enable via PowerShell:
      ```powershell
      Set-SmbShare -Name "ShareName" -FolderEnumerationMode AccessBased
      ```

### Advanced Hardening
15. **Windows File Server Hardening**
    - Disable unnecessary services
    - Apply Windows Server security baselines
    - Install latest security updates
    - Remove legacy protocols (NetBIOS if not needed)
    - Implement Windows Defender ATP

16. **Samba Server Hardening**
    - Run Samba as non-root user
    - Use apparmor/SELinux profiles
    - Disable NTLMv1 authentication:
      ```
      [global]
      ntlm auth = ntlmv2-only
      ```
    - Restrict hosts:
      ```
      [share]
      hosts allow = 192.168.1. 127.
      hosts deny = ALL
      ```

17. **Password Policies**
    - Enforce strong passwords (16+ characters)
    - Implement password complexity requirements
    - Regular password rotation (90 days)
    - Use Group Policy or Samba password policies

18. **Multi-Factor Authentication**
    - Implement MFA for VPN access to file shares
    - Use Azure AD + MFA for cloud-connected environments
    - Smart card authentication for sensitive shares

### Backup & Recovery
19. **File Server Backup Strategy**
    - Automated daily backups
    - Version control (shadow copies)
    - Off-site backup storage
    - Test restore procedures quarterly
    - Implement ransomware protection
    - Use VSS (Volume Shadow Copy Service)

### Alternative Solutions
20. **Modern File Sharing Alternatives**
    - Consider cloud storage (OneDrive, SharePoint, Google Drive)
    - Managed file sync services (Dropbox Business, Box)
    - Zero Trust access with Azure Files or AWS FSx
    - Benefits:
      - Better security controls
      - Easier remote access
      - Built-in versioning and recovery
      - Advanced threat protection

### Linux/Samba Specific
- Use Kerberos authentication
- Integrate with Active Directory
- Configure SELinux contexts:
  ```bash
  setsebool -P samba_enable_home_dirs on
  semanage fcontext -a -t samba_share_t "/path/to/share(/.*)?"
  ```
- Regular security updates: `apt update && apt upgrade samba`

### Compliance & Standards
- Follow CIS Benchmarks for Windows File Servers
- Implement file classification (FIPS 199)
- Data loss prevention (DLP) policies
- Regular compliance audits (PCI-DSS, HIPAA)
- Document access control policies

### Incident Response
- Disconnect infected systems immediately
- Preserve logs and forensic evidence
- Check for ransomware indicators
- Restore from clean backups
- Conduct post-incident security assessment
- Implement additional controls based on findings

### Known Vulnerabilities to Patch
- EternalBlue (MS17-010) - Disable SMBv1
- BlueKeep (CVE-2019-0708) - RDP but often chained with SMB
- SMBGhost (CVE-2020-0796) - Update Windows
- Regular patching cadence (monthly)
EOF
            ;;
        *)
            cat << 'EOF'
## General Security Prevention & Mitigation Recommendations

### Immediate Actions
1. **Reset Compromised Credentials**
   - Change all affected passwords immediately
   - Use strong, unique passwords (16+ characters, mixed case, numbers, symbols)
   - Implement password manager organization-wide

2. **Review Access Logs**
   - Check for unauthorized access or activities
   - Identify scope of potential breach
   - Document timeline of events

3. **Implement Network Restrictions**
   - Block unauthorized IP addresses
   - Restrict service access to trusted networks only
   - Use firewall rules to limit exposure

### Short-Term Enhancements
4. **Enable Multi-Factor Authentication (MFA)**
   - Implement 2FA/MFA for all accounts
   - Use authenticator apps, hardware tokens, or biometrics
   - Require MFA for administrative access

5. **Rate Limiting & Brute-Force Protection**
   - Implement login attempt limits
   - Configure progressive delays
   - Enable CAPTCHA for repeated failures
   - Use fail2ban or similar tools

6. **Strong Authentication Policies**
   - Minimum 16-character passwords
   - Password complexity requirements
   - Regular password rotation (90 days)
   - No password reuse across services

### Long-Term Best Practices
7. **Network Security**
   - Use VPN for remote access
   - Implement network segmentation
   - Deploy intrusion detection/prevention systems
   - Regular security audits

8. **Monitoring & Alerting**
   - Enable comprehensive logging
   - Set up real-time alerts for suspicious activities
   - Regular log review and analysis
   - Use SIEM for centralized monitoring

9. **Regular Updates & Patching**
   - Keep all systems up to date
   - Apply security patches promptly
   - Maintain patch management schedule
   - Test updates in staging first

10. **Principle of Least Privilege**
    - Grant minimum necessary permissions
    - Regular access reviews
    - Separate admin and user accounts
    - Role-based access control (RBAC)

### Compliance & Documentation
- Maintain security documentation
- Regular security training
- Incident response plan
- Compliance with regulations (GDPR, HIPAA, PCI-DSS)
EOF
            ;;
    esac
}

# Function to generate detailed attack report
generate_report() {
    local protocol="$1"
    local target="$2"
    local port="$3"
    local start_time="$4"
    local end_time="$5"
    local status="$6"
    local username="${7:-N/A}"
    local password="${8:-N/A}"
    local attempts="${9:-0}"
    local wordlist_count="${10:-0}"
    
    # Generate unique report filename
    local report_file="$REPORT_DIR/attack_report_${protocol}_$(date +%Y%m%d_%H%M%S).md"
    
    # Calculate duration
    local start_epoch=$(date -d "$start_time" +%s 2>/dev/null || echo 0)
    local end_epoch=$(date -d "$end_time" +%s 2>/dev/null || echo 0)
    local duration=$((end_epoch - start_epoch))
    local duration_human
    if [ "$start_epoch" -eq 0 ] || [ "$end_epoch" -eq 0 ]; then
        duration_human="calculation failed"
    else
        duration_human=$(printf '%02d:%02d:%02d' $((duration/3600)) $((duration%3600/60)) $((duration%60)))
    fi
    
    # Generate report content
    cat > "$report_file" << EOF
# 🔐 Hydra-Termux Attack Report

## Executive Summary
This report documents a security assessment conducted using Hydra-Termux against a target system. The assessment was performed for authorized penetration testing purposes to identify security vulnerabilities.

---

## Attack Information

### Target Details
- **Target**: ${target}
- **Protocol**: ${protocol^^}
- **Port**: ${port}
- **Status**: ${status}

### Timeline
- **Start Time**: ${start_time}
- **End Time**: ${end_time}
- **Duration**: ${duration_human}

### Attack Statistics
- **Total Attempts**: ${attempts}
- **Wordlists Used**: ${wordlist_count}
- **Attack Method**: Brute-force authentication

---

## Results

### Discovered Credentials
EOF

    if [ "$status" = "SUCCESS" ] && [ "$username" != "N/A" ]; then
        cat >> "$report_file" << EOF
✅ **Valid credentials were discovered:**

\`\`\`
Username: ${username}
Password: ${password}
Protocol: ${protocol}://${target}:${port}
\`\`\`

**⚠️ CRITICAL SECURITY WARNING:**
These credentials provide unauthorized access to the system and represent a significant security vulnerability.

**Immediate Action Required:**
1. Change these credentials immediately
2. Review access logs for unauthorized usage
3. Implement recommended security measures below

---

## Vulnerability Assessment

### Severity: 🔴 CRITICAL

**CVSS Score**: 9.8 (Critical)

**Vulnerability Description:**
The target system was vulnerable to brute-force authentication attacks, allowing an attacker to gain unauthorized access through weak or commonly-used credentials.

**Risk Impact:**
- **Confidentiality**: HIGH - Unauthorized access to system data
- **Integrity**: HIGH - Ability to modify system configuration and data
- **Availability**: HIGH - Potential for system disruption or denial of service

**Affected Component:** ${protocol^^} Authentication Service

**Attack Vector:** Network-based brute-force authentication

---

## Technical Details

### Attack Methodology
1. **Reconnaissance**: Port scanning identified ${protocol^^} service on port ${port}
2. **Enumeration**: Common username enumeration
3. **Exploitation**: Automated brute-force attack using wordlist
4. **Validation**: Credentials verified through successful authentication

### Tools Used
- **Hydra-Termux**: Password brute-forcing tool
- **Wordlist**: Common password lists and default credentials

### Success Factors
- Weak password policy or default credentials in use
- No rate limiting or account lockout mechanisms detected
- No multi-factor authentication implemented
- Service exposed to network without additional security controls

---

EOF
    else
        cat >> "$report_file" << EOF
❌ **No valid credentials were discovered.**

While this attack was unsuccessful, it does not guarantee the system is secure. The system may still be vulnerable to:
- More sophisticated attack techniques
- Different wordlists or password patterns
- Other attack vectors (exploits, social engineering, etc.)
- Vulnerabilities in other services

**Recommendations:**
Continue implementing security best practices as detailed below.

---

EOF
    fi

    # Add prevention recommendations
    get_prevention_recommendations "$protocol" >> "$report_file"
    
    # Add footer
    cat >> "$report_file" << EOF

---

## Disclaimer

**IMPORTANT LEGAL NOTICE:**

This security assessment report is provided for **authorized penetration testing purposes only**. Unauthorized access to computer systems is illegal under:
- Computer Fraud and Abuse Act (CFAA) - United States
- Computer Misuse Act - United Kingdom  
- Equivalent cybercrime laws worldwide

**Authorization:**
This assessment should only be conducted:
- On systems you own
- With explicit written permission from system owner
- Within scope of authorized security testing engagement
- In compliance with all applicable laws and regulations

**Responsibility:**
The user of this tool assumes full responsibility for:
- Obtaining proper authorization
- Compliance with legal requirements
- Any consequences of unauthorized use
- Implementation of security recommendations

**Report Security:**
This report contains sensitive security information including:
- Discovered credentials (if any)
- System vulnerabilities
- Technical attack details

**Protect this report:**
- Store securely with encryption
- Limit access to authorized personnel only
- Delete securely when no longer needed
- Never share publicly or with unauthorized parties

---

## Report Metadata

- **Generated By**: Hydra-Termux Ultimate Edition v2.0
- **Report Date**: $(date '+%Y-%m-%d %H:%M:%S %Z')
- **Report Format**: Markdown
- **Report ID**: $(basename "$report_file" .md)

---

## Additional Resources

### Security References
- **OWASP**: https://owasp.org/
- **NIST Cybersecurity Framework**: https://www.nist.gov/cyberframework
- **CIS Benchmarks**: https://www.cisecurity.org/cis-benchmarks/
- **SANS Security Resources**: https://www.sans.org/security-resources/

### Tools & Documentation
- **Hydra-Termux GitHub**: https://github.com/vinnieboy707/Hydra-termux
- **Security Hardening Guides**: See project documentation
- **Penetration Testing Methodology**: PTES, OSSTMM

---

**End of Report**

*This report was automatically generated by Hydra-Termux. Review and customize as needed for your specific requirements.*
EOF

    # Set secure permissions (owner read/write only)
    chmod 600 "$report_file"
    
    # Return the report file path
    echo "$report_file"
}

# Function to generate quick summary report (for CLI output)
generate_summary() {
    local protocol="$1"
    local target="$2"
    local status="$3"
    local report_file="$4"
    
    echo ""
    print_message "═══════════════════════════════════════════════════════" "$CYAN"
    print_message "           📋 ATTACK REPORT GENERATED" "$GREEN"
    print_message "═══════════════════════════════════════════════════════" "$CYAN"
    echo ""
    print_message "Target: $target" "$YELLOW"
    print_message "Protocol: ${protocol^^}" "$YELLOW"
    print_message "Status: $status" "$YELLOW"
    echo ""
    print_message "📄 Detailed Report: $report_file" "$GREEN"
    echo ""
    print_message "The report includes:" "$CYAN"
    echo "  ✓ Complete attack details and timeline"
    echo "  ✓ Discovered credentials (if any)"
    echo "  ✓ Vulnerability assessment"
    echo "  ✓ Comprehensive prevention recommendations"
    echo "  ✓ Step-by-step remediation guide"
    echo ""
    print_message "View report:" "$BLUE"
    echo "  cat $report_file"
    echo "  less $report_file"
    echo ""
    print_message "Export report (if needed):" "$BLUE"
    echo "  cp $report_file ~/attack_reports/"
    echo ""
    print_message "⚠️  Keep this report secure - it contains sensitive information!" "$RED"
    print_message "═══════════════════════════════════════════════════════" "$CYAN"
    echo ""
}

# Export functions for use by other scripts
export -f get_prevention_recommendations
export -f generate_report
export -f generate_summary
