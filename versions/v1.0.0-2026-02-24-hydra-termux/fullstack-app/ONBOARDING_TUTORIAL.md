# 🎓 Complete Onboarding & Penetration Testing Tutorial

## Welcome to Hydra-Termux Ultimate Edition

This comprehensive guide will teach you how to safely and effectively use Hydra-Termux for authorized penetration testing.

---

## ⚠️ CRITICAL LEGAL WARNING

**READ THIS BEFORE PROCEEDING:**

1. **ONLY test systems you own or have explicit written permission to test**
2. Unauthorized penetration testing is **ILLEGAL** and punishable by law
3. This tool is for **educational and authorized security testing ONLY**
4. You are **100% responsible** for your actions
5. Keep all discovered vulnerabilities confidential until properly disclosed

**By continuing, you acknowledge you understand and will comply with all applicable laws.**

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [User Onboarding Process](#user-onboarding-process)
3. [Basic Concepts](#basic-concepts)
4. [Step-by-Step Tutorials](#step-by-step-tutorials)
5. [Advanced Techniques](#advanced-techniques)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [Real-World Scenarios](#real-world-scenarios)

---

## 🚀 Getting Started

### Prerequisites Check

Before you begin, ensure you have:
- ✅ Legal authorization for all testing activities
- ✅ Hydra-Termux installed and configured
- ✅ Basic networking knowledge
- ✅ Understanding of TCP/IP protocols
- ✅ **Active VPN connection** (highly recommended)

### Initial Setup

#### 1. Access the Application

**Web Interface:**
```
Frontend: http://localhost:3001
Backend API: http://localhost:3000/api
```

**CLI Interface:**
```bash
cd /path/to/Hydra-termux
./hydra.sh
```

#### 2. Create Your First Account

```bash
# Using API
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "Strong_P@ssw0rd123!",
    "email": "your_email@example.com"
  }'

# Or use the web interface at http://localhost:3001/login
```

#### 3. Login and Get Access Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "Strong_P@ssw0rd123!"
  }'
```

Save the returned JWT token - you'll need it for all API requests.

---

## 🎯 User Onboarding Process

### Level 1: Beginner (Tutorial Mode)

#### Lesson 1: Understanding the Interface

**Web Dashboard:**
1. Navigate to Dashboard - see overview statistics
2. Explore Attacks page - view attack types
3. Check Targets page - manage target systems
4. Review Results page - see discovered credentials

**Key Metrics to Understand:**
- **Total Attacks**: Number of penetration tests performed
- **Credentials Found**: Successfully discovered login credentials
- **Success Rate**: Percentage of successful attacks
- **Active Targets**: Systems currently being tested

#### Lesson 2: Your First Safe Test

**Set up a local test environment:**

```bash
# Create a test SSH server (Docker)
docker run -d -p 2222:22 \
  -e SSH_USERS="testuser:testpass:1001" \
  panubo/sshd

# This creates a safe, isolated test target
```

**Target Information:**
- Host: `localhost` or `127.0.0.1`
- Port: `2222`
- Known credentials: `testuser:testpass`

#### Lesson 3: Launch Your First Attack

**Via Web Interface:**
1. Go to **Attacks** → **+ New Attack**
2. Select attack type: **SSH**
3. Enter target: `127.0.0.1`
4. Enter port: `2222`
5. Configure:
   - Threads: 4 (start small)
   - Timeout: 30 seconds
6. Click **Launch Attack**
7. Watch real-time progress
8. View results when complete

**Via API:**
```bash
curl -X POST http://localhost:3000/api/attacks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "attack_type": "ssh",
    "target_host": "127.0.0.1",
    "target_port": 2222,
    "protocol": "ssh",
    "config": {
      "threads": 4,
      "timeout": 30
    }
  }'
```

**Via CLI:**
```bash
./hydra.sh
# Select: 1) SSH Admin Attack
# Enter target: 127.0.0.1
# Port will default to 22 (or specify 2222)
```

#### Lesson 4: Understanding Results

After the attack completes:

1. **Check Results Page**:
   - Navigate to Results
   - Filter by protocol: SSH
   - View discovered credentials

2. **Analyze the Attack Log**:
   ```bash
   # View recent logs
   curl -X GET http://localhost:3000/api/logs \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

3. **Verify Credentials**:
   ```bash
   # Test the found credentials
   ssh testuser@127.0.0.1 -p 2222
   # Enter password: testpass
   ```

### Level 2: Intermediate

#### Understanding Attack Types

**1. SSH Attacks (Port 22)**
- **Use Case**: Test SSH server security
- **Common Targets**: Servers, routers, IoT devices
- **Best For**: Linux/Unix systems

**2. FTP Attacks (Port 21)**
- **Use Case**: Test FTP server security
- **Common Targets**: File servers, legacy systems
- **Best For**: Systems with file transfer services

**3. HTTP/HTTPS Attacks (Ports 80/443)**
- **Use Case**: Test web admin panels
- **Common Targets**: Admin login pages, CMS systems
- **Best For**: Web applications

**4. RDP Attacks (Port 3389)**
- **Use Case**: Test Windows Remote Desktop
- **Common Targets**: Windows servers, workstations
- **Best For**: Windows environments

**5. Database Attacks**
- **MySQL (Port 3306)**: Test MySQL databases
- **PostgreSQL (Port 5432)**: Test PostgreSQL databases
- **Use Case**: Test database server security

**6. SMB Attacks (Port 445)**
- **Use Case**: Test Windows file sharing
- **Common Targets**: Windows servers, NAS devices
- **Best For**: Windows network environments

**7. Multi-Protocol Auto Attack**
- **Use Case**: Comprehensive security assessment
- **Process**: Scans target, detects services, launches appropriate attacks
- **Best For**: Unknown targets requiring reconnaissance

#### Setting Up a Comprehensive Test Lab

```bash
# Create a multi-service test environment
docker-compose up -d

# docker-compose.yml example:
version: '3'
services:
  ssh-server:
    image: panubo/sshd
    ports:
      - "2222:22"
    environment:
      - SSH_USERS=admin:admin:1001
  
  ftp-server:
    image: fauria/vsftpd
    ports:
      - "2021:21"
    environment:
      - FTP_USER=ftpuser
      - FTP_PASS=ftppass
  
  mysql-server:
    image: mysql:5.7
    ports:
      - "3307:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=rootpass
```

### Level 3: Advanced

#### Custom Wordlist Creation

**Generate targeted wordlists:**

```bash
# Using the CLI tool
./hydra.sh
# Select: 10) Generate Custom Wordlist

# Combine multiple wordlists
cat wordlist1.txt wordlist2.txt > combined.txt

# Remove duplicates
sort combined.txt | uniq > unique_wordlist.txt

# Add company-specific patterns
./scripts/wordlist_generator.sh \
  --company "TargetCompany" \
  --year 2024 \
  --common-patterns
```

**Wordlist Strategy:**
1. Start with common passwords
2. Add company/target-specific terms
3. Include date patterns (2024, 2023)
4. Use leetspeak variations
5. Add keyboard patterns

#### Target Reconnaissance

**Before attacking, gather intelligence:**

```bash
# 1. Network scan
./hydra.sh
# Select: 11) Scan Target

# Or use API
curl -X POST http://localhost:3000/api/targets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Server",
    "host": "192.168.1.100",
    "description": "Practice test server"
  }'

# 2. Service detection
nmap -sV 192.168.1.100

# 3. OS detection
nmap -O 192.168.1.100

# 4. Full reconnaissance
nmap -A -T4 192.168.1.100
```

#### Webhook Integration for Real-Time Alerts

**Set up Slack notifications:**

```bash
# Create webhook for Slack
curl -X POST http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Slack Alerts",
    "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    "events": [
      "attack.completed",
      "credentials.found",
      "attack.failed"
    ],
    "description": "Send attack results to Slack"
  }'
```

**Set up Discord notifications:**

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Discord Alerts",
    "url": "https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN",
    "events": ["credentials.found"],
    "description": "Alert on credential discovery"
  }'
```

---

## 📖 Step-by-Step Tutorials

### Tutorial 1: Basic SSH Brute Force

**Objective**: Test SSH server password strength

**Steps:**

1. **Set up test target**:
   ```bash
   docker run -d -p 2222:22 \
     -e SSH_USERS="admin:weak123:1001" \
     panubo/sshd
   ```

2. **Prepare wordlist**:
   ```bash
   echo "password" > test_passwords.txt
   echo "admin" >> test_passwords.txt
   echo "weak123" >> test_passwords.txt
   ```

3. **Launch attack via Web UI**:
   - Navigate to Attacks → New Attack
   - Attack Type: SSH
   - Target: 127.0.0.1
   - Port: 2222
   - Custom wordlist: Upload `test_passwords.txt`
   - Launch

4. **Monitor progress**:
   - Watch real-time status
   - Check attempts counter
   - Wait for completion

5. **Review results**:
   - Go to Results page
   - Find SSH protocol
   - View discovered credentials
   - Export results as CSV

6. **Verify**:
   ```bash
   ssh admin@127.0.0.1 -p 2222
   # Use discovered password
   ```

### Tutorial 2: Web Admin Panel Testing

**Objective**: Test web application admin login security

**Steps:**

1. **Set up test web app**:
   ```bash
   # Use DVWA (Damn Vulnerable Web Application)
   docker run -d -p 8080:80 vulnerables/web-dvwa
   ```

2. **Access admin panel**:
   ```
   http://localhost:8080/login.php
   ```

3. **Launch web attack**:
   ```bash
   curl -X POST http://localhost:3000/api/attacks \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "attack_type": "http",
       "target_host": "localhost",
       "target_port": 8080,
       "protocol": "http",
       "config": {
         "path": "/login.php",
         "method": "POST",
         "username_field": "username",
         "password_field": "password"
       }
     }'
   ```

4. **Monitor and verify results**

### Tutorial 3: Multi-Protocol Assessment

**Objective**: Comprehensive security assessment of a target

**Steps:**

1. **Initial reconnaissance**:
   ```bash
   # Scan target
   curl -X POST http://localhost:3000/api/targets \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Comprehensive Test",
       "host": "192.168.1.100",
       "description": "Full security assessment"
     }'
   ```

2. **Launch auto attack**:
   ```bash
   curl -X POST http://localhost:3000/api/attacks \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "attack_type": "auto",
       "target_host": "192.168.1.100",
       "protocol": "auto",
       "config": {
         "reconnaissance": true,
         "protocols": ["ssh", "ftp", "http", "mysql"]
       }
     }'
   ```

3. **Monitor all protocols**
4. **Compile comprehensive report**

---

## 🛡️ Best Practices

### Security Best Practices

1. **Always Use VPN**:
   ```bash
   # Check VPN status
   curl ifconfig.me
   # Should show VPN IP, not your real IP
   ```

2. **Rate Limiting**:
   - Start with low thread counts (4-8)
   - Increase gradually if needed
   - Monitor target availability

3. **Documentation**:
   - Keep detailed logs of all tests
   - Document authorization
   - Note all findings

4. **Ethical Conduct**:
   - Test only authorized systems
   - Report findings responsibly
   - Respect scope limitations
   - Follow disclosure timelines

### Performance Optimization

1. **Thread Count**:
   - Local networks: 8-16 threads
   - Remote targets: 4-8 threads
   - Slow connections: 2-4 threads

2. **Timeout Settings**:
   - Fast networks: 15-20 seconds
   - Average networks: 30 seconds
   - Slow networks: 60+ seconds

3. **Wordlist Selection**:
   - Start with common passwords
   - Use targeted lists for specific industries
   - Consider password policies

---

## 🔧 Troubleshooting

### Common Issues

**1. "Connection refused"**
```
Solution: Check if service is running on target port
nmap -p [PORT] [TARGET]
```

**2. "Too many authentication failures"**
```
Solution: Reduce thread count and add delays
Config: { "threads": 2, "delay": 5 }
```

**3. "No results found"**
```
Solution:
- Verify credentials exist in wordlist
- Check target is reachable
- Ensure correct port
- Try different attack parameters
```

**4. "Rate limited"**
```
Solution: Target is blocking rapid attempts
- Reduce threads to 1-2
- Add random delays
- Use rotating proxies (advanced)
```

---

## 🎯 Real-World Scenarios

### Scenario 1: Home Network Assessment

**Goal**: Test your home network security

**Steps**:
1. Document all devices (with permission)
2. Scan network: `nmap -sn 192.168.1.0/24`
3. Test router admin panel
4. Test NAS device (if present)
5. Test any IoT devices
6. Document and fix vulnerabilities

### Scenario 2: Small Business Security Audit

**Goal**: Perform authorized security assessment for client

**Requirements**:
- ✅ Written authorization
- ✅ Scope agreement
- ✅ Timeline agreed
- ✅ Insurance coverage

**Process**:
1. Pre-engagement meeting
2. Reconnaissance phase
3. Vulnerability assessment
4. Exploitation attempts (authorized)
5. Documentation
6. Report generation
7. Remediation assistance

### Scenario 3: Password Policy Testing

**Goal**: Validate password policy effectiveness

**Steps**:
1. Get list of user accounts (authorized)
2. Create policy-compliant wordlist
3. Test against authentication system
4. Document weak passwords
5. Recommend policy improvements

---

## 📊 Progress Tracking

### Beginner Checklist
- [ ] Set up test environment
- [ ] Complete first SSH attack
- [ ] Understand results
- [ ] Export findings
- [ ] Document process

### Intermediate Checklist
- [ ] Test multiple protocols
- [ ] Create custom wordlists
- [ ] Set up webhooks
- [ ] Configure VPN
- [ ] Perform target reconnaissance

### Advanced Checklist
- [ ] Multi-protocol assessment
- [ ] Custom automation scripts
- [ ] Advanced evasion techniques
- [ ] Comprehensive reporting
- [ ] Teach others

---

## 🎓 Next Steps

1. **Practice Regularly**: Use intentionally vulnerable applications
   - DVWA (Damn Vulnerable Web Application)
   - Metasploitable
   - WebGoat
   - HackTheBox

2. **Learn More**:
   - Network protocols deep dive
   - Password cracking techniques
   - Social engineering awareness
   - Secure coding practices

3. **Get Certified**:
   - CEH (Certified Ethical Hacker)
   - OSCP (Offensive Security Certified Professional)
   - GPEN (GIAC Penetration Tester)

4. **Join Communities**:
   - HackerOne
   - Bugcrowd
   - OWASP
   - Local security meetups

---

## 📞 Support & Resources

- **Documentation**: See `/fullstack-app/API_DOCUMENTATION.md`
- **Issues**: GitHub Issues
- **Community**: Security forums and Discord

---

## ⚖️ Legal Reminder

This tool is powerful. Use it responsibly:
- ✅ Get written authorization
- ✅ Define scope clearly
- ✅ Document everything
- ✅ Report findings properly
- ❌ Never test without permission
- ❌ Never cause damage
- ❌ Never exfiltrate data
- ❌ Never exceed authorized scope

**Stay legal. Stay ethical. Stay secure.**

---

*Last Updated: December 2024*
*Version: 2.0.0 Ultimate Edition*
