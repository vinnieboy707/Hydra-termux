#!/bin/bash

# VPN Connectivity Check Utility
# Verifies VPN connection before running attacks

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if VPN is connected
check_vpn_connection() {
    local verbose="${1:-false}"
    
    echo -e "${BLUE}[*] Checking VPN connection...${NC}"
    
    # Method 1: Check for common VPN interfaces
    local vpn_interfaces=("tun0" "tun1" "ppp0" "tap0" "wg0" "ipsec0")
    local vpn_found=false
    
    for interface in "${vpn_interfaces[@]}"; do
        if ip link show "$interface" &>/dev/null 2>&1 || ifconfig "$interface" &>/dev/null 2>&1; then
            echo -e "${GREEN}[✓] VPN interface found: $interface${NC}"
            vpn_found=true
            
            if [ "$verbose" = "true" ]; then
                echo -e "${BLUE}[*] Interface details:${NC}"
                ip addr show "$interface" 2>/dev/null || ifconfig "$interface" 2>/dev/null
            fi
            break
        fi
    done
    
    # Method 2: Check for VPN processes
    if [ "$vpn_found" = "false" ]; then
        local vpn_processes=("openvpn" "vpnc" "wireguard" "strongswan" "ipsec")
        for process in "${vpn_processes[@]}"; do
            if pgrep -x "$process" >/dev/null 2>&1; then
                echo -e "${GREEN}[✓] VPN process found: $process${NC}"
                vpn_found=true
                break
            fi
        done
    fi
    
    # Method 3: Check routing table for VPN gateway
    if [ "$vpn_found" = "false" ]; then
        if ip route show 2>/dev/null | grep -E "(tun|tap|ppp|wg)" >/dev/null; then
            echo -e "${GREEN}[✓] VPN route detected${NC}"
            vpn_found=true
        fi
    fi
    
    # Final result
    if [ "$vpn_found" = "true" ]; then
        echo -e "${GREEN}[✓] VPN connection verified${NC}"
        
        # Get public IP
        if command -v curl &>/dev/null; then
            local public_ip

            public_ip=$(curl -s --connect-timeout 5 https://api.ipify.org 2>/dev/null)
            if [ -n "$public_ip" ]; then
                echo -e "${BLUE}[*] Current public IP: $public_ip${NC}"
            fi
        fi
        
        return 0
    else
        echo -e "${RED}[✗] No VPN connection detected${NC}"
        return 1
    fi
}

# Function to enforce VPN requirement
require_vpn() {
    local force="${1:-false}"
    
    if ! check_vpn_connection "false"; then
        echo ""
        echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║               ⚠️  VPN NOT DETECTED  ⚠️                      ║${NC}"
        echo -e "${YELLOW}╠════════════════════════════════════════════════════════════╣${NC}"
        echo -e "${YELLOW}║  It is STRONGLY recommended to use a VPN when running     ║${NC}"
        echo -e "${YELLOW}║  penetration testing tools to protect your identity.      ║${NC}"
        echo -e "${YELLOW}║                                                            ║${NC}"
        echo -e "${YELLOW}║  Common VPN solutions for Termux:                          ║${NC}"
        echo -e "${YELLOW}║    • OpenVPN (openvpn package)                             ║${NC}"
        echo -e "${YELLOW}║    • WireGuard (wireguard-tools package)                   ║${NC}"
        echo -e "${YELLOW}║    • Third-party VPN apps (NordVPN, ExpressVPN, etc.)      ║${NC}"
        echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        
        if [ "$force" = "true" ]; then
            echo -e "${RED}[!] VPN is required. Exiting...${NC}"
            exit 1
        else
            echo -e "${YELLOW}[?] Continue without VPN? This is NOT recommended! (y/N)${NC}"
            read -r response
            if [[ ! "$response" =~ ^[Yy]$ ]]; then
                echo -e "${BLUE}[*] Exiting. Please connect to VPN and try again.${NC}"
                exit 0
            fi
            echo -e "${YELLOW}[!] Proceeding without VPN protection...${NC}"
            echo ""
        fi
    fi
}

# Function to check if running as root (optional warning)
check_root() {
    if [ "$(id -u)" -eq 0 ]; then
        echo -e "${YELLOW}[!] Warning: Running as root. This may not be necessary.${NC}"
    fi
}

# Function to test VPN leak
test_vpn_leak() {
    echo -e "${BLUE}[*] Testing for DNS leaks...${NC}"
    
    if ! command -v dig &>/dev/null && ! command -v nslookup &>/dev/null; then
        echo -e "${YELLOW}[!] DNS tools not available. Skipping DNS leak test.${NC}"
        return 0
    fi
    
    # Get DNS servers
    local dns_servers

    dns_servers=$(cat /etc/resolv.conf 2>/dev/null | grep nameserver | awk '{print $2}')
    
    if [ -n "$dns_servers" ]; then
        echo -e "${BLUE}[*] Current DNS servers:${NC}"
        echo "$dns_servers" | while read -r dns; do
            echo "    - $dns"
        done
        
        # Check if using private DNS (good for VPN)
        if echo "$dns_servers" | grep -E "^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)" >/dev/null; then
            echo -e "${GREEN}[✓] Using private DNS (VPN-provided)${NC}"
        else
            echo -e "${YELLOW}[!] Using public DNS - potential DNS leak${NC}"
        fi
    fi
    
    return 0
}

# Main function for standalone execution
main() {
    local force_vpn=false
    local verbose=false
    local leak_test=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force|-f)
                force_vpn=true
                shift
                ;;
            --verbose|-v)
                verbose=true
                shift
                ;;
            --leak-test|-l)
                leak_test=true
                shift
                ;;
            --help|-h)
                echo "VPN Check Utility"
                echo ""
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  -f, --force       Force VPN requirement (exit if no VPN)"
                echo "  -v, --verbose     Show detailed VPN information"
                echo "  -l, --leak-test   Test for DNS leaks"
                echo "  -h, --help        Show this help message"
                echo ""
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run checks
    check_root
    
    if [ "$verbose" = "true" ]; then
        check_vpn_connection "true"
    else
        require_vpn "$force_vpn"
    fi
    
    if [ "$leak_test" = "true" ]; then
        echo ""
        test_vpn_leak
    fi
}

# If script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
