#!/bin/bash

# Hydra-Termux System Diagnostics
# Comprehensive system analysis and recommendations

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

print_message() {
    echo -e "${2}${1}${NC}"
}

print_banner() {
    print_message "╔════════════════════════════════════════════════════════════╗" "$CYAN"
    printf "${CYAN}║%-60s║${NC}\n" "$(printf "%*s" $(((60+${#1})/2)) "$1")"
    print_message "╚════════════════════════════════════════════════════════════╝" "$CYAN"
}

clear
print_banner "Hydra-Termux System Diagnostics"
echo ""

print_message "🔍 Running comprehensive system analysis..." "$CYAN"
echo ""

# Collect system information
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

HEALTH_SCORE=100
ISSUES_FOUND=0
WARNINGS_FOUND=0

# Function to log issues
log_issue() {
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    HEALTH_SCORE=$((HEALTH_SCORE - $2))
    print_message "  ❌ $1" "$RED"
}

log_warning() {
    WARNINGS_FOUND=$((WARNINGS_FOUND + 1))
    HEALTH_SCORE=$((HEALTH_SCORE - $2))
    print_message "  ⚠️  $1" "$YELLOW"
}

log_ok() {
    print_message "  ✅ $1" "$GREEN"
}

log_info() {
    print_message "  ℹ️  $1" "$BLUE"
}

# Section 1: Environment Detection
print_message "═══ ENVIRONMENT ANALYSIS ═══" "$MAGENTA"
echo ""

if [ -d "/data/data/com.termux" ]; then
    log_ok "Running on Termux (Android)"
    
    # Check Android version
    if command -v getprop &> /dev/null; then
        android_version=$(getprop ro.build.version.release 2>/dev/null)
        log_info "Android version: $android_version"
    fi
    
    # Check Termux version
    if [ -f "$PREFIX/etc/termux-version" ]; then
        termux_version=$(cat "$PREFIX/etc/termux-version" 2>/dev/null)
        log_info "Termux version: $termux_version"
    fi
    
    # Check available storage
    if command -v df &> /dev/null; then
        available_space=$(df -h "$PREFIX" 2>/dev/null | awk 'NR==2 {print $4}')
        log_info "Available storage: $available_space"
        
        # Parse available space (rough check)
        space_mb=$(df -m "$PREFIX" 2>/dev/null | awk 'NR==2 {print $4}')
        if [ -n "$space_mb" ] && [ "$space_mb" -lt 100 ]; then
            log_warning "Low storage space (< 100MB)" 5
        fi
    fi
    
    # Check battery optimization
    log_info "TIP: Disable battery optimization for Termux in Android Settings"
    
else
    log_ok "Running on Linux/Unix"
    
    # System info
    if command -v uname &> /dev/null; then
        log_info "Kernel: $(uname -s) $(uname -r)"
        log_info "Architecture: $(uname -m)"
    fi
    
    # Check disk space
    if command -v df &> /dev/null; then
        available_space=$(df -h "$HOME" 2>/dev/null | awk 'NR==2 {print $4}')
        log_info "Available storage: $available_space"
    fi
fi

# Check if user has sudo (if not Termux)
if [ ! -d "/data/data/com.termux" ]; then
    if sudo -n true 2>/dev/null; then
        log_info "Sudo access: Available"
    else
        log_warning "Sudo access: Not available (may limit installation options)" 3
    fi
fi

echo ""

# Section 2: Core Dependencies
print_message "═══ CORE DEPENDENCIES ═══" "$MAGENTA"
echo ""

# Check Hydra
if command -v hydra &> /dev/null; then
    hydra_version=$(hydra -h 2>&1 | head -1 | grep -oP 'v[0-9.]+' || echo "unknown")
    log_ok "Hydra: Installed ($hydra_version)"
    
    # Check hydra modules
    hydra_modules=$(hydra -U 2>&1 | grep -c "^  " || echo 0)
    log_info "Hydra modules available: $hydra_modules"
    
    if [ "$hydra_modules" -lt 10 ]; then
        log_warning "Hydra has limited protocol support" 3
    fi
else
    log_issue "Hydra: NOT INSTALLED (CRITICAL)" 30
    log_info "Run: bash scripts/auto_fix.sh"
fi

# Check bash
if command -v bash &> /dev/null; then
    bash_version=$(bash --version | head -1 | grep -oP '[0-9.]+' | head -1)
    log_ok "Bash: $bash_version"
else
    log_issue "Bash: NOT FOUND" 10
fi

# Check git
if command -v git &> /dev/null; then
    git_version=$(git --version | grep -oP '[0-9.]+' | head -1)
    log_ok "Git: $git_version"
else
    log_warning "Git: NOT INSTALLED (updates disabled)" 5
fi

# Check jq
if command -v jq &> /dev/null; then
    jq_version=$(jq --version 2>&1 | grep -oP '[0-9.]+' || echo "unknown")
    log_ok "jq: $jq_version"
else
    log_issue "jq: NOT INSTALLED (results processing broken)" 15
fi

echo ""

# Section 3: Optional Tools
print_message "═══ OPTIONAL TOOLS ═══" "$MAGENTA"
echo ""

# Check nmap
if command -v nmap &> /dev/null; then
    nmap_version=$(nmap --version 2>&1 | head -1 | grep -oP '[0-9.]+' | head -1)
    log_ok "Nmap: $nmap_version"
else
    log_warning "Nmap: Not installed (scanning features limited)" 3
fi

# Check wget
if command -v wget &> /dev/null; then
    log_ok "wget: Installed"
else
    log_warning "wget: Not installed (wordlist downloads affected)" 2
fi

# Check curl
if command -v curl &> /dev/null; then
    log_ok "curl: Installed"
else
    log_warning "curl: Not installed (some features limited)" 2
fi

# Check openssl
if command -v openssl &> /dev/null; then
    openssl_version=$(openssl version 2>&1 | awk '{print $2}')
    log_ok "OpenSSL: $openssl_version"
else
    log_warning "OpenSSL: Not installed (SSL/TLS attacks limited)" 3
fi

echo ""

# Section 4: Project Files
print_message "═══ PROJECT INTEGRITY ═══" "$MAGENTA"
echo ""

# Check main launcher
if [ -f "$PROJECT_ROOT/hydra.sh" ]; then
    log_ok "Main launcher: hydra.sh"
    if [ -x "$PROJECT_ROOT/hydra.sh" ]; then
        log_info "Executable: Yes"
    else
        log_warning "hydra.sh not executable" 2
        log_info "Fix: chmod +x hydra.sh"
    fi
else
    log_issue "Main launcher: MISSING" 10
fi

# Check logger
if [ -f "$SCRIPT_DIR/logger.sh" ]; then
    log_ok "Logger utility: logger.sh"
else
    log_issue "Logger utility: MISSING" 10
fi

# Count attack scripts
attack_scripts=$(find "$SCRIPT_DIR" -name "*_attack.sh" -type f 2>/dev/null | wc -l)
if [ "$attack_scripts" -ge 7 ]; then
    log_ok "Attack scripts: $attack_scripts found"
else
    log_warning "Attack scripts: Only $attack_scripts found (expected 8)" 5
fi

# Check config files
if [ -f "$PROJECT_ROOT/config/hydra.conf" ]; then
    log_ok "Configuration file: Present"
else
    log_warning "Configuration file: Missing" 3
fi

if [ -f "$PROJECT_ROOT/config/optimized_attack_profiles.conf" ]; then
    log_ok "Attack profiles: Present"
else
    log_warning "Attack profiles: Missing (10000% optimization unavailable)" 5
fi

# Check directories
for dir in logs results wordlists; do
    if [ -d "$PROJECT_ROOT/$dir" ]; then
        log_ok "Directory: $dir/"
        
        # Check write permissions
        if [ -w "$PROJECT_ROOT/$dir" ]; then
            log_info "Writable: Yes"
        else
            log_warning "$dir/ not writable" 3
        fi
    else
        log_warning "Directory: $dir/ missing" 2
        log_info "Fix: mkdir -p $PROJECT_ROOT/$dir"
    fi
done

echo ""

# Section 5: Network Connectivity
print_message "═══ NETWORK CONNECTIVITY ═══" "$MAGENTA"
echo ""

# Check internet connectivity
if ping -c 1 8.8.8.8 &> /dev/null; then
    log_ok "Internet: Connected"
else
    log_warning "Internet: Connection test failed" 5
    log_info "Attacks on external targets will fail"
fi

# Check DNS resolution
if host github.com &> /dev/null 2>&1 || nslookup github.com &> /dev/null 2>&1; then
    log_ok "DNS: Working"
else
    log_warning "DNS: Resolution issues detected" 5
fi

# Check if VPN is active (basic check)
if command -v ip &> /dev/null; then
    vpn_interfaces=$(ip link show 2>/dev/null | grep -E "tun|tap|vpn" || true)
    if [ -n "$vpn_interfaces" ]; then
        log_ok "VPN: Detected (good for security)"
    else
        log_warning "VPN: Not detected" 3
        log_info "Recommended: Use VPN for security testing"
    fi
fi

echo ""

# Section 6: Performance Analysis
print_message "═══ PERFORMANCE METRICS ═══" "$MAGENTA"
echo ""

# Check CPU cores
if command -v nproc &> /dev/null; then
    cpu_cores=$(nproc)
    log_info "CPU cores: $cpu_cores"
    
    if [ "$cpu_cores" -ge 4 ]; then
        log_ok "Multi-core CPU: Good for parallel attacks"
    elif [ "$cpu_cores" -ge 2 ]; then
        log_info "Dual-core CPU: Reduce threads for optimal performance"
    else
        log_warning "Single-core CPU: Use low thread count (-T 4)" 3
    fi
fi

# Check memory
if command -v free &> /dev/null; then
    total_mem=$(free -m 2>/dev/null | awk 'NR==2 {print $2}')
    available_mem=$(free -m 2>/dev/null | awk 'NR==2 {print $7}')
    
    if [ -n "$total_mem" ]; then
        log_info "Total RAM: ${total_mem}MB"
        
        if [ -n "$available_mem" ]; then
            log_info "Available RAM: ${available_mem}MB"
            
            if [ "$available_mem" -lt 100 ]; then
                log_warning "Low available memory" 5
                log_info "Close other apps before running attacks"
            fi
        fi
    fi
fi

# Check load average
if command -v uptime &> /dev/null; then
    load_avg=$(uptime | grep -oP 'load average: \K[0-9.]+' | head -1)
    if [ -n "$load_avg" ]; then
        log_info "System load: $load_avg"
    fi
fi

echo ""

# Section 7: Security Checks
print_message "═══ SECURITY ASSESSMENT ═══" "$MAGENTA"
echo ""

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ] || [ "$(id -u)" -eq 0 ]; then
    log_warning "Running as root (not recommended)" 5
    log_info "Consider using a regular user account"
else
    log_ok "User account: Non-root (safe)"
fi

# Check for sensitive files in project
if [ -f "$PROJECT_ROOT/.env" ] || [ -f "$PROJECT_ROOT/credentials.txt" ]; then
    log_warning "Sensitive files detected in project directory" 5
    log_info "Ensure you don't commit credentials to git"
fi

# Check git status (if git repo)
if [ -d "$PROJECT_ROOT/.git" ]; then
    cd "$PROJECT_ROOT"
    
    # Check for uncommitted changes
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
        log_info "Git: Uncommitted changes present"
    fi
    
    # Check if on latest version
    git fetch --quiet 2>/dev/null || true
    LOCAL=$(git rev-parse @ 2>/dev/null)
    REMOTE=$(git rev-parse @{u} 2>/dev/null)
    
    if [ "$LOCAL" = "$REMOTE" ]; then
        log_ok "Git: Up to date"
    elif [ -n "$REMOTE" ]; then
        log_warning "Git: Updates available" 3
        log_info "Run: git pull"
    fi
fi

echo ""

# Section 8: Health Score Summary
print_message "════════════════════════════════════════════════════════════" "$BLUE"
echo ""

# Calculate grade
if [ $HEALTH_SCORE -ge 90 ]; then
    GRADE="A"
    GRADE_COLOR="$GREEN"
    STATUS="EXCELLENT"
elif [ $HEALTH_SCORE -ge 80 ]; then
    GRADE="B"
    GRADE_COLOR="$GREEN"
    STATUS="GOOD"
elif [ $HEALTH_SCORE -ge 70 ]; then
    GRADE="C"
    GRADE_COLOR="$YELLOW"
    STATUS="FAIR"
elif [ $HEALTH_SCORE -ge 50 ]; then
    GRADE="D"
    GRADE_COLOR="$YELLOW"
    STATUS="POOR"
else
    GRADE="F"
    GRADE_COLOR="$RED"
    STATUS="CRITICAL"
fi

print_message "╔════════════════════════════════════════════════════════════╗" "$CYAN"
print_message "║                    HEALTH REPORT                           ║" "$CYAN"
print_message "╠════════════════════════════════════════════════════════════╣" "$CYAN"

# Calculate padding safely to avoid negative values
status_len=${#STATUS}
if [ "$status_len" -gt 20 ]; then
    status_padding=0
else
    status_padding=$((29 - status_len))
fi

printf "${CYAN}║${NC}  System Health Score: ${GRADE_COLOR}%3d/100 (Grade: %s - %s)${NC}%*s${CYAN}║${NC}\n" \
    "$HEALTH_SCORE" "$GRADE" "$STATUS" "$status_padding" ""
printf "${CYAN}║${NC}  Critical Issues:     ${RED}%-2d${NC}%*s${CYAN}║${NC}\n" \
    "$ISSUES_FOUND" 42 ""
printf "${CYAN}║${NC}  Warnings:            ${YELLOW}%-2d${NC}%*s${CYAN}║${NC}\n" \
    "$WARNINGS_FOUND" 42 ""
print_message "╚════════════════════════════════════════════════════════════╝" "$CYAN"
echo ""

# Recommendations
if [ $ISSUES_FOUND -gt 0 ]; then
    print_message "🚨 CRITICAL ACTIONS REQUIRED:" "$RED"
    echo ""
    
    if ! command -v hydra &> /dev/null; then
        print_message "  1. Install Hydra (CRITICAL)" "$RED"
        print_message "     Run: bash scripts/auto_fix.sh" "$GREEN"
        echo ""
    fi
    
    if ! command -v jq &> /dev/null; then
        print_message "  2. Install jq for results processing" "$RED"
        if [ -d "/data/data/com.termux" ]; then
            print_message "     Run: pkg install jq -y" "$GREEN"
        else
            print_message "     Run: sudo apt install jq -y" "$GREEN"
        fi
        echo ""
    fi
fi

if [ $WARNINGS_FOUND -gt 0 ]; then
    print_message "⚠️  RECOMMENDED IMPROVEMENTS:" "$YELLOW"
    echo ""
    print_message "  • Install optional tools for full functionality" "$BLUE"
    print_message "    Run: bash install.sh" "$GREEN"
    echo ""
    
    if [ $WARNINGS_FOUND -ge 5 ]; then
        print_message "  • Run automatic fixer to resolve issues" "$BLUE"
        print_message "    Run: bash scripts/auto_fix.sh" "$GREEN"
        echo ""
    fi
fi

# Next steps
if [ $HEALTH_SCORE -ge 90 ]; then
    print_message "✅ System is healthy! You're ready to use Hydra-Termux" "$GREEN"
    echo ""
    print_message "🚀 Quick start:" "$CYAN"
    print_message "   ./hydra.sh" "$GREEN"
    echo ""
elif [ $HEALTH_SCORE -ge 70 ]; then
    print_message "✅ System is functional with minor issues" "$GREEN"
    echo ""
    print_message "🔧 To improve system health:" "$CYAN"
    print_message "   bash scripts/auto_fix.sh" "$GREEN"
    echo ""
else
    print_message "❌ System requires attention before use" "$RED"
    echo ""
    print_message "🔧 Fix critical issues:" "$CYAN"
    print_message "   bash scripts/auto_fix.sh" "$GREEN"
    echo ""
fi

print_message "════════════════════════════════════════════════════════════" "$BLUE"
echo ""

# Save diagnostic report
REPORT_FILE="$PROJECT_ROOT/logs/diagnostics_$(date +%Y%m%d_%H%M%S).txt"
mkdir -p "$PROJECT_ROOT/logs"

{
    echo "Hydra-Termux System Diagnostics Report"
    echo "Generated: $(date)"
    echo ""
    echo "Health Score: $HEALTH_SCORE/100 (Grade: $GRADE)"
    echo "Critical Issues: $ISSUES_FOUND"
    echo "Warnings: $WARNINGS_FOUND"
    echo ""
    echo "For full details, see terminal output above."
} > "$REPORT_FILE" 2>/dev/null || true

if [ -f "$REPORT_FILE" ]; then
    print_message "📄 Report saved: $REPORT_FILE" "$BLUE"
    echo ""
fi

# Exit with appropriate code
if [ $ISSUES_FOUND -gt 0 ]; then
    exit 1
else
    exit 0
fi
