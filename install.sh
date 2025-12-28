#!/bin/bash

# Hydra-Termux Automated Installation Script
# This script automates the installation process

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    echo -e "${2}${1}${NC}"
}

# Function to check if a command was successful
check_status() {
    if [ $? -eq 0 ]; then
        print_message "✅ $1 successful" "$GREEN"
    else
        print_message "❌ $1 failed" "$RED"
        exit 1
    fi
}

# Banner
clear
print_message "╔════════════════════════════════════════╗" "$BLUE"
print_message "║    Hydra-Termux Installation Script   ║" "$BLUE"
print_message "╚══════════════════════════��═════════════╝" "$BLUE"
echo ""

# Update package lists
print_message "📦 Updating package lists..." "$YELLOW"
pkg update -y > /dev/null 2>&1
check_status "Package update"

# Check if need.txt exists
if [ ! -f "need.txt" ]; then
    print_message "⚠️  need.txt not found. Creating default package list..." "$YELLOW"
    cat > need.txt << EOF
hydra
git
wget
curl
openssl
EOF
    print_message "✅ Created need.txt with default packages" "$GREEN"
fi

# Install required packages
print_message "📥 Installing required packages..." "$YELLOW"
while IFS= read -r package || [ -n "$package" ]; do
    # Skip empty lines and comments
    [[ -z "$package" || "$package" =~ ^[[:space:]]*# ]] && continue
    
    print_message "   Installing: $package" "$BLUE"
    pkg install "$package" -y > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        print_message "   ✓ $package installed" "$GREEN"
    else
        print_message "   ⚠ Warning: $package installation may have issues" "$YELLOW"
    fi
done < need.txt

# Make hydra.sh executable
if [ -f "hydra.sh" ]; then
    print_message "🔧 Making hydra.sh executable..." "$YELLOW"
    chmod +x hydra.sh
    check_status "Setting permissions"
else
    print_message "⚠️  Warning: hydra.sh not found in current directory" "$YELLOW"
    print_message "   Make sure you're in the correct directory" "$YELLOW"
fi

# Make install.sh itself executable
chmod +x install.sh 2>/dev/null

# Final message
echo ""
print_message "╔════════════════════════════════════════╗" "$GREEN"
print_message "║  Installation Complete Successfully!   ║" "$GREEN"
print_message "╚════════════════════════════════════════╝" "$GREEN"
echo ""
print_message "🚀 To start Hydra-Termux, run:" "$BLUE"
print_message "   ./hydra.sh" "$GREEN"
echo ""
print_message "📖 For help and documentation, check README.md" "$BLUE"
echo ""