# GitHub Actions Workflows

This directory contains automated workflows for continuous integration, security scanning, and deployment.

## Workflows

### 1. CI - Continuous Integration (`ci.yml`)

**Purpose:** Automated testing and validation on every push and pull request

**Triggers:**
- Push to `main`, `develop`, or `copilot/**` branches
- Pull requests to `main` or `develop` branches

**Jobs:**

#### `lint-and-test`
- Tests on Node.js versions 20.x and 22.x (Node >= 20.0.0 required)
- Installs dependencies for backend and frontend
- Validates JavaScript syntax
- Builds frontend
- Runs tests

#### `shellcheck`
- Runs ShellCheck on all shell scripts
- Checks `scripts/`, main scripts, and `Library/` scripts
- Warning severity level

#### `validate-json`
- Validates all JSON files
- Ensures proper syntax
- Excludes `node_modules`

#### `validate-sql`
- Spins up PostgreSQL 15 service
- Applies complete database schema
- Validates SQL syntax and structure

#### `integration-test`
- Runs integration validation script
- Checks documentation links
- Validates overall system integrity

#### `build-check`
- Builds frontend for production
- Verifies build artifacts exist
- Ensures production readiness

**Status Badge:**
```markdown
![CI](https://github.com/vinnieboy707/Hydra-termux/workflows/CI%20-%20Continuous%20Integration/badge.svg)
```

---

### 2. Security Scanning (`security.yml`)

**Purpose:** Automated security analysis and vulnerability detection

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Weekly schedule (Sunday at midnight)

**Jobs:**

#### `codeql-analysis`
- GitHub CodeQL security analysis
- JavaScript language analysis
- Security and quality queries
- Automatic vulnerability detection

#### `dependency-scan`
- npm audit for backend dependencies
- npm audit for frontend dependencies
- Reports moderate and higher severity issues
- Suggests fixes

#### `secret-scan`
- TruffleHog secret scanning
- Scans entire commit history
- Detects accidentally committed secrets
- Verified secrets only

#### `security-headers`
- Checks for Helmet.js usage
- Verifies CORS configuration
- Confirms rate limiting implementation
- Validates security best practices

#### `sql-injection-check`
- Scans for unsafe SQL patterns
- Ensures parameterized queries
- Prevents SQL injection vulnerabilities

#### `shellscript-security`
- Checks for dangerous shell patterns
- Validates against eval usage
- ShellCheck in security mode

**Status Badge:**
```markdown
![Security](https://github.com/vinnieboy707/Hydra-termux/workflows/Security%20Scanning/badge.svg)
```

---

### 3. Deploy to Production (`deploy.yml`)

**Purpose:** Automated deployment to production environments

**Triggers:**
- Push to `main` branch
- Tags matching `v*` pattern
- Manual workflow dispatch

**Jobs:**

#### `deploy-backend`
- Deploys backend API to production server
- Uses SSH for deployment
- Installs production dependencies
- Restarts with PM2
- **Requires secrets:** `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KEY`

#### `deploy-frontend`
- Builds React frontend
- Deploys to CDN (Netlify/Vercel)
- Configures environment variables
- **Requires secrets:** `REACT_APP_API_URL`

#### `deploy-supabase-functions`
- Deploys all 3 edge functions
- Uses Supabase CLI
- Validates deployment
- **Requires secrets:** `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`

#### `deploy-database`
- Applies database migrations
- Updates schema if needed
- Validates database integrity
- **Requires secrets:** `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`

#### `create-release`
- Creates GitHub release for tags
- Generates changelog
- Uploads artifacts
- Only runs on version tags

#### `notify-deployment`
- Sends deployment notifications
- Slack integration (optional)
- Email alerts (optional)
- **Requires secrets:** `SLACK_WEBHOOK_URL` (optional)

**Status Badge:**
```markdown
![Deploy](https://github.com/vinnieboy707/Hydra-termux/workflows/Deploy%20to%20Production/badge.svg)
```

---

## Required Secrets

To use these workflows, configure the following secrets in your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

### For Deployment
- `DEPLOY_HOST` - Production server hostname
- `DEPLOY_USER` - SSH username
- `DEPLOY_KEY` - SSH private key (not password)

### For Supabase
- `SUPABASE_ACCESS_TOKEN` - From Supabase dashboard settings
- `SUPABASE_PROJECT_ID` - Your project reference ID

### For Frontend Deployment
- `REACT_APP_API_URL` - Production API URL (e.g., https://api.yourdomain.com)

### Optional
- `SLACK_WEBHOOK_URL` - For deployment notifications

---

## Setting Up SSH Deployment

### 1. Generate SSH Key Pair

On your local machine:
```bash
ssh-keygen -t ed25519 -C "github-actions" -f github-deploy-key
```

### 2. Add Public Key to Server

Copy the public key to your server:
```bash
ssh-copy-id -i github-deploy-key.pub user@your-server.com
```

Or manually add to `~/.ssh/authorized_keys` on server:
```bash
cat github-deploy-key.pub >> ~/.ssh/authorized_keys
```

### 3. Add Private Key to GitHub Secrets

- Copy the private key:
  ```bash
  cat github-deploy-key
  ```
- Go to GitHub: Settings → Secrets → New secret
- Name: `DEPLOY_KEY`
- Value: Paste the entire private key (including `-----BEGIN` and `-----END` lines)

---

## Manual Workflow Triggers

### Trigger Deployment Manually

1. Go to GitHub repository → Actions
2. Select "Deploy to Production"
3. Click "Run workflow"
4. Select branch
5. Click "Run workflow"

### View Workflow Logs

1. Go to GitHub repository → Actions
2. Click on any workflow run
3. View job logs and details

---

## Workflow Status in README

Add these badges to your main README.md:

```markdown
![CI](https://github.com/vinnieboy707/Hydra-termux/workflows/CI%20-%20Continuous%20Integration/badge.svg)
![Security](https://github.com/vinnieboy707/Hydra-termux/workflows/Security%20Scanning/badge.svg)
![Deploy](https://github.com/vinnieboy707/Hydra-termux/workflows/Deploy%20to%20Production/badge.svg)
```

---

## Troubleshooting

### Workflow Fails on Secrets

**Error:** `Error: Secret DEPLOY_HOST not found`

**Solution:** Add required secrets in repository settings

### SSH Deployment Fails

**Error:** `Permission denied (publickey)`

**Solutions:**
1. Verify SSH key is added to server's `authorized_keys`
2. Check file permissions on server: `chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`
3. Verify private key in GitHub secrets is complete and correct

### Build Fails

**Error:** `npm install` fails

**Solutions:**
1. Check package-lock.json is committed
2. Verify Node.js version compatibility
3. Check for dependency conflicts

### CodeQL Analysis Fails

**Solution:** Usually resolves on retry. If persistent, check:
1. JavaScript syntax is valid
2. No circular dependencies
3. Code follows standard patterns

---

## Customization

### Modify Node.js Versions

In `ci.yml`, update the matrix:
```yaml
strategy:
  matrix:
    node-version: [20.x, 22.x]  # Add or remove versions (minimum 20.x required)
```

**Note:** Node.js >= 20.0.0 is required due to Supabase package dependencies.

### Change Security Scan Schedule

In `security.yml`, update the cron:
```yaml
schedule:
  - cron: '0 0 * * 0'  # Weekly on Sunday
  # Daily: '0 0 * * *'
  # Monthly: '0 0 1 * *'
```

### Add Additional Deployment Steps

In `deploy.yml`, add steps to jobs:
```yaml
- name: Custom Deployment Step
  run: |
    echo "Running custom deployment"
    # Your commands here
```

---

## Best Practices

1. **Never commit secrets** - Always use GitHub Secrets
2. **Test locally first** - Ensure scripts work before relying on CI
3. **Monitor workflow runs** - Check Actions tab regularly
4. **Update dependencies** - Keep workflow actions up to date
5. **Use protected branches** - Require workflow success before merging
6. **Review security alerts** - Act on CodeQL and dependency scan findings

---

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [CodeQL Documentation](https://codeql.github.com/docs/)
- [Deployment Guide](../fullstack-app/COMPLETE_DEPLOYMENT_GUIDE.md)
- [Security Protocols](../fullstack-app/SECURITY_PROTOCOLS.md)

---

**For questions or issues, open a GitHub issue or discussion.**
