#!/bin/bash

# AI Assistant System for Hydra-Termux
# Provides contextual help, hints, and guidance throughout user journey

# Get script directory (use local variable to avoid collision with parent scripts)
_AI_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$_AI_SCRIPT_DIR")"

# Source logger
source "$_AI_SCRIPT_DIR/logger.sh"

# Assistant state file
STATE_FILE="$PROJECT_ROOT/.assistant_state"
USER_HISTORY="$PROJECT_ROOT/.user_history"

# Initialize assistant state
init_assistant() {
    touch "$STATE_FILE"
    touch "$USER_HISTORY"
}

# Get user progress level
get_user_level() {
    if [ ! -f "$USER_HISTORY" ]; then
        echo "beginner"
        return
    fi
    
    local total_actions
    total_actions=$(wc -l < "$USER_HISTORY" 2>/dev/null || echo "0")
    
    if [ "$total_actions" -lt 5 ]; then
        echo "beginner"
    elif [ "$total_actions" -lt 20 ]; then
        echo "intermediate"
    else
        echo "advanced"
    fi
}

# Log user action
log_action() {
    local action="$1"
    echo "$(date +%Y-%m-%d_%H:%M:%S)|$action" >> "$USER_HISTORY"
}

# Get contextual hint based on current action
get_contextual_hint() {
    local context="$1"
    local user_level
    user_level=$(get_user_level)
    
    case "$context" in
        "main_menu")
            case "$user_level" in
                "beginner")
                    cat << EOF
💡 AI Assistant: Welcome! I'm here to help you every step of the way.

🎯 Getting Started Tips:
  • First time? Run option 20 to install dependencies
  • Need wordlists? Use option 9 before attacking
  • Not sure where to start? Try option 11 to scan a target

❓ Confused? Type 'help' or select option 18 for detailed guidance.
EOF
                    ;;
                "intermediate")
                    cat << EOF
💡 AI Assistant: Ready for your next task!

⚡ Quick Tips:
  • Check logs (option 14) to review past activities
  • View reports (option 15) for detailed analysis
  • Use ALHacking tools (20-37) for expanded capabilities
EOF
                    ;;
                "advanced")
                    cat << EOF
💡 AI Assistant: Welcome back, expert user!

🚀 Advanced Options:
  • Multi-protocol attacks: Option 8
  • Custom wordlists: Option 10
  • Export results: Option 16
EOF
                    ;;
            esac
            ;;
            
        "target_entry")
            cat << EOF
💡 Target Entry Tips:
  • IP Address: 192.168.1.100
  • Hostname: example.com
  • URL: https://example.com
  • Range: 192.168.1.0/24 (for scanners)

⚠️  Always ensure you have authorization!
EOF
            ;;
            
        "wordlist_needed")
            cat << EOF
💡 Wordlist Guidance:
  • Default wordlists in ~/wordlists/
  • Download more: Return to menu → Option 9
  • Generate custom: Option 10
  • Pro tip: Combine multiple wordlists for better results
EOF
            ;;
            
        "attack_started")
            cat << EOF
💡 Attack in Progress:
  • Be patient - this may take time
  • Press Ctrl+C to stop if needed
  • Results save automatically
  • Check option 12 after completion

⏰ Average time: 5-30 minutes depending on wordlist size
EOF
            ;;
            
        "attack_completed")
            cat << EOF
💡 Next Steps:
  • View results: Option 12
  • Check detailed reports: Option 15
  • Export data: Option 16
  • Try another attack or scan different target

📊 Results are saved in logs/ and reports/ directories
EOF
            ;;
            
        "alhacking_first_use")
            cat << EOF
💡 ALHacking Tools - First Time Setup:
  1. Run option 20 first (Requirements & Update)
  2. Each tool downloads automatically on first use
  3. Tools saved in Tools/ directory
  4. No manual configuration needed

🎓 New to these tools? Try option 36 for video tutorial!
EOF
            ;;
            
        "error_occurred")
            cat << EOF
❌ Error Detected - Troubleshooting Guide:

Common Fixes:
  1. Check dependencies: Run option 20
  2. Check internet connection
  3. Verify target is reachable
  4. Check permissions: chmod +x scripts/*.sh
  5. Review logs: Option 14

Still stuck? Check docs/TROUBLESHOOTING.md
EOF
            ;;
            
        "scan_results")
            cat << EOF
💡 Scan Results Analysis:
  • Open ports = potential attack vectors
  • Note the services running on each port
  • Use appropriate attack for each service:
    - Port 21 → FTP (Option 2)
    - Port 22 → SSH (Option 1)
    - Port 80/443 → Web (Option 3)
    - Port 3389 → RDP (Option 4)
    - Port 3306 → MySQL (Option 5)

🎯 Plan your attack based on discovered services!
EOF
            ;;
            
        "report_generated")
            cat << EOF
💡 Report Generated Successfully!

📄 Your report includes:
  • Attack summary and timeline
  • Discovered credentials
  • Service information
  • Recommendations

🔍 View reports: Option 15
💾 Export data: Option 16
📧 Share findings with team (if authorized)
EOF
            ;;
            
        "no_results")
            cat << EOF
💡 No Results Found - What to Try:

Improve Your Success Rate:
  1. Use different wordlists (Option 9)
  2. Generate targeted wordlist (Option 10)
  3. Verify target is vulnerable
  4. Try different attack type
  5. Check if service is actually running

🎲 Brute force isn't always successful - this is normal!
EOF
            ;;
    esac
}

# Show workflow guidance based on user goal
show_workflow_guide() {
    local goal="$1"
    
    clear
    print_banner "🎯 AI Assistant: Workflow Guide"
    echo ""
    
    case "$goal" in
        "first_attack")
            cat << EOF
📋 Complete Workflow: Your First Attack

Step 1: Preparation (5-10 minutes)
  ✓ Install dependencies → Option 20
  ✓ Download wordlists → Option 9
  ✓ Understand legal requirements

Step 2: Reconnaissance (2-5 minutes)
  ✓ Scan target → Option 11
  ✓ Note open ports and services
  ✓ Identify attack surface

Step 3: Attack Selection (1 minute)
  ✓ Choose attack based on scan results:
    • SSH (Port 22) → Option 1
    • FTP (Port 21) → Option 2
    • Web (Port 80/443) → Option 3
    • Database → Options 5-6
    • Other services → Options 4,7,8

Step 4: Execute Attack (10-30 minutes)
  ✓ Enter target information
  ✓ Wait for completion
  ✓ Monitor progress

Step 5: Analysis (5 minutes)
  ✓ View results → Option 12
  ✓ Read report → Option 15
  ✓ Document findings

Step 6: Next Steps
  ✓ Try different service
  ✓ Export results → Option 16
  ✓ Update tools → Option 17

⏱️  Total Time: ~30-60 minutes for complete cycle
EOF
            ;;
            
        "information_gathering")
            cat << EOF
📋 Complete Workflow: Information Gathering

Step 1: Network Discovery
  ✓ Port scanning → Option 11
  ✓ Service detection
  ✓ OS fingerprinting

Step 2: Web Reconnaissance
  ✓ Subdomain enumeration → Option 23
  ✓ Directory bruteforce (Library tools)
  ✓ Technology detection → Option 29

Step 3: Advanced Recon
  ✓ Google dorking → Option 27
  ✓ IP information → Option 26
  ✓ DNS analysis → Option 29

Step 4: Vulnerability Assessment
  ✓ SSL analysis (Library)
  ✓ Header analysis (Library)
  ✓ Known vulnerabilities

Step 5: Documentation
  ✓ Export findings → Option 16
  ✓ Generate reports → Option 15
  ✓ Plan next phase

🎯 This is a non-invasive reconnaissance workflow!
EOF
            ;;
            
        "social_engineering")
            cat << EOF
📋 Complete Workflow: Social Engineering Testing

⚠️  AUTHORIZATION REQUIRED - Legal testing only!

Step 1: Preparation
  ✓ Get written authorization
  ✓ Define scope and rules
  ✓ Setup infrastructure

Step 2: Template Selection
  ✓ Choose appropriate template
    • Instagram → Phishing Tool
    • Facebook → Phishing Tool
    • Generic → WebCam Hack
  ✓ Customize if needed

Step 3: Campaign Setup
  ✓ Launch tool → Options 21-22
  ✓ Note the URL
  ✓ Test with yourself first

Step 4: Execution
  ✓ Send to authorized targets only
  ✓ Monitor captures
  ✓ Document responses

Step 5: Analysis & Reporting
  ✓ Calculate success rate
  ✓ Identify vulnerable users
  ✓ Provide security training

Step 6: Mitigation
  ✓ Recommend 2FA
  ✓ Security awareness training
  ✓ Email filtering
EOF
            ;;
            
        "full_assessment")
            cat << EOF
📋 Complete Workflow: Full Security Assessment

Phase 1: Planning (Day 1)
  ✓ Define scope
  ✓ Get authorization
  ✓ Setup environment
  ✓ Install all tools → Option 20

Phase 2: Reconnaissance (Day 1-2)
  ✓ Network scanning → Option 11
  ✓ Service enumeration
  ✓ Information gathering → Options 23,26,27,29
  ✓ Document findings

Phase 3: Vulnerability Assessment (Day 2-3)
  ✓ Identify weak points
  ✓ Prioritize targets
  ✓ Plan attacks

Phase 4: Exploitation (Day 3-5)
  ✓ Attack weak services → Options 1-8
  ✓ Test multiple vectors
  ✓ Document successes
  ✓ Maintain access (if authorized)

Phase 5: Post-Exploitation (Day 5-6)
  ✓ Privilege escalation
  ✓ Lateral movement
  ✓ Data collection

Phase 6: Reporting (Day 6-7)
  ✓ Generate reports → Option 15
  ✓ Export all data → Option 16
  ✓ Create presentation
  ✓ Provide recommendations

Phase 7: Remediation Support (Day 7+)
  ✓ Help fix vulnerabilities
  ✓ Implement security controls
  ✓ Re-test after fixes

⏱️  Timeline: 1-2 weeks typical
EOF
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
}

# Suggest next action based on history
suggest_next_action() {
    local last_action=""
    if [ -f "$USER_HISTORY" ]; then
        last_action=$(tail -1 "$USER_HISTORY" 2>/dev/null | cut -d'|' -f2)
    fi
    
    case "$last_action" in
        "scan_completed")
            cat << EOF
💡 Smart Suggestion: Based on your scan results...
  → Review the open ports
  → Select matching attack option (1-8)
  → Example: Port 22 open? Try Option 1 (SSH Attack)
EOF
            ;;
        "attack_completed")
            cat << EOF
💡 Smart Suggestion: Your attack completed!
  → Check results: Option 12
  → View detailed report: Option 15
  → Try another service on same target
  → Or scan a different target: Option 11
EOF
            ;;
        "wordlist_downloaded")
            cat << EOF
💡 Smart Suggestion: Wordlists ready!
  → Scan a target first: Option 11
  → Then launch an attack: Options 1-8
  → Start with SSH (Option 1) - most common
EOF
            ;;
        "dependencies_installed")
            cat << EOF
💡 Smart Suggestion: Setup complete!
  → Download wordlists next: Option 9
  → Or try ALHacking tools: Options 20-37
  → Explore with IP Info: Option 26 (safe to start)
EOF
            ;;
        *)
            cat << EOF
💡 Smart Suggestion: Not sure what to do?
  → View workflow guides: Type 'workflow' 
  → Get help: Option 18
  → Watch tutorial: Option 36
  → Start with scanning: Option 11
EOF
            ;;
    esac
}

# Interactive help system
interactive_help() {
    local topic="$1"
    
    clear
    print_banner "🤖 AI Interactive Help"
    echo ""
    
    if [ -z "$topic" ]; then
        cat << EOF
What do you need help with? Enter a number:

1) Getting started from scratch
2) Understanding the menu options
3) Performing my first attack
4) Information gathering techniques
5) ALHacking tools usage
6) Troubleshooting errors
7) Understanding results
8) Best practices & safety
9) Workflow recommendations
0) Back to main menu

EOF
        read -p "Enter choice: " choice
        
        case "$choice" in
            1) show_workflow_guide "first_attack" ;;
            2) explain_menu_options ;;
            3) show_workflow_guide "first_attack" ;;
            4) show_workflow_guide "information_gathering" ;;
            5) show_alhacking_help ;;
            6) show_troubleshooting ;;
            7) explain_results ;;
            8) show_best_practices ;;
            9) show_workflow_menu ;;
            0) return ;;
        esac
    fi
}

# Show workflow menu
show_workflow_menu() {
    clear
    print_banner "🎯 Workflow Guide Menu"
    echo ""
    
    cat << EOF
Select your goal:

1) First Attack - Complete beginner workflow
2) Information Gathering - Recon only
3) Social Engineering Test - Phishing workflows
4) Full Security Assessment - Complete methodology
5) Quick Scan & Attack - Fast workflow
0) Back

EOF
    read -p "Enter choice: " choice
    
    case "$choice" in
        1) show_workflow_guide "first_attack" ;;
        2) show_workflow_guide "information_gathering" ;;
        3) show_workflow_guide "social_engineering" ;;
        4) show_workflow_guide "full_assessment" ;;
        5) show_workflow_guide "quick_attack" ;;
    esac
}

# Explain menu options in detail
explain_menu_options() {
    clear
    print_banner "📖 Menu Options Explained"
    echo ""
    
    cat << EOF
Attack Scripts (1-8):
  1-7: Single service attacks (SSH, FTP, Web, RDP, MySQL, PostgreSQL, SMB)
  8: Automatic - tries multiple protocols

Utilities (9-12):
  9: Download pre-made wordlists
  10: Create custom wordlists with your own rules
  11: Scan target for open ports (do this first!)
  12: View past attack results

Management (13-17):
  13: View configuration settings
  14: Check logs for debugging
  15: View detailed attack reports
  16: Export results to file
  17: Update Hydra-Termux

ALHacking Tools (20-37):
  Phishing: 21-22 (zphisher, CamPhish)
  Recon: 23,26,27,29,31 (Subdomain, IP, Dorks, Site info)
  Attacks: 24-25,32-34 (Bomber, DDoS, Social media)
  Utils: 20,35-37 (Setup, IP changer, Help)

EOF
    read -p "Press Enter to continue..."
}

# Show ALHacking help
show_alhacking_help() {
    clear
    print_banner "🔧 ALHacking Tools Guide"
    echo ""
    
    cat << EOF
Quick Start for ALHacking:
  1. Run Option 20 FIRST (installs dependencies)
  2. Each tool auto-downloads when you use it
  3. Tools are saved in Tools/ directory

Safe Tools to Start With:
  ✓ Option 26: IP Info (just information lookup)
  ✓ Option 23: Subscan (subdomain finder)
  ✓ Option 27: dorks-eye (Google searching)
  ✓ Option 29: RED_HAWK (website scanner)

Tools Requiring Care:
  ⚠️  Option 24-25: Bomber/DDoS (use VPN!)
  ⚠️  Option 21-22: Phishing (authorization needed)
  ⚠️  Option 32-33: Social media (own accounts only)

First Time Recommended Flow:
  1. Option 20 → Install dependencies
  2. Option 26 → Try IP Info (safe)
  3. Option 29 → Try RED_HAWK (safe)
  4. Option 36 → Watch video tutorial
  5. Then try other tools

EOF
    read -p "Press Enter to continue..."
}

# Show troubleshooting guide
show_troubleshooting() {
    clear
    print_banner "🔧 Troubleshooting Assistant"
    echo ""
    
    cat << EOF
Common Issues & Solutions:

1. "Command not found" or "Script not found"
   Fix: chmod +x scripts/*.sh
   Then: Run option 20 to install dependencies

2. "Permission denied"
   Fix: chmod +x <script-name>.sh
   Or: Use bash script-name.sh instead

3. "Connection refused" / "Cannot connect"
   Fix: Verify target is reachable (ping target-ip)
   Check: Firewall isn't blocking
   Try: Different port or service

4. "No results found"
   Normal! Not all attacks succeed
   Try: Different wordlist (Option 9)
   Try: Custom wordlist (Option 10)
   Check: Service is actually vulnerable

5. Python/PHP errors
   Fix: Run option 20 (Requirements & Update)
   Check: Python 3 installed
   Try: pip3 install -r requirements.txt

6. Out of space
   Fix: Option 37 (uninstall ALHacking tools)
   Clean: pkg clean or apt-get clean
   Check: df -h to see space

7. Tool won't download
   Check: Internet connection
   Try: Again after a few minutes
   Manual: cd Tools && git clone <repo-url>

Need more help? Check docs/TROUBLESHOOTING.md

EOF
    read -p "Press Enter to continue..."
}

# Explain results
explain_results() {
    clear
    print_banner "📊 Understanding Results"
    echo ""
    
    cat << EOF
Where to Find Results:

1. Immediate Output
   • Shown on screen during attack
   • Shows found credentials in real-time

2. Results Viewer (Option 12)
   • All past attack results
   • Organized by date and target
   • Quick summary view

3. Attack Reports (Option 15)
   • Detailed analysis
   • Markdown format
   • Located in reports/ directory
   • Includes recommendations

4. Log Files (Option 14)
   • Complete execution logs
   • Debug information
   • Located in logs/ directory

5. Exported Data (Option 16)
   • CSV, JSON, or TXT format
   • For further analysis
   • Easy to share

Understanding Attack Results:
  ✓ Success = Valid credentials found
  ✗ Failure = No valid credentials
  ~ Partial = Some info gathered

Reading Scan Results:
  • Open ports = Services available
  • Service version = Software running
  • OS detection = Operating system

EOF
    read -p "Press Enter to continue..."
}

# Show best practices
show_best_practices() {
    clear
    print_banner "🛡️ Best Practices & Safety"
    echo ""
    
    cat << EOF
Essential Rules:

1. Legal Authorization
   ✓ Get written permission
   ✓ Define scope clearly
   ✓ Stay within boundaries
   ✗ Never attack without authorization

2. Use Protection
   ✓ VPN for all activities
   ✓ Tor for anonymous tools (Option 35)
   ✓ Never use home/work IP
   ✓ Consider legal implications

3. Ethical Conduct
   ✓ Report vulnerabilities
   ✓ Give time to patch
   ✓ Don't exploit for harm
   ✓ Respect privacy

4. Good Practices
   ✓ Document everything
   ✓ Keep detailed logs
   ✓ Maintain professionalism
   ✓ Continuous learning

5. After Testing
   ✓ Generate reports (Option 15)
   ✓ Provide recommendations
   ✓ Help with remediation
   ✓ Follow up

Remember: With great power comes great responsibility!

EOF
    read -p "Press Enter to continue..."
}

# Progress tracker
show_progress() {
    local total_actions
    total_actions=$(wc -l < "$USER_HISTORY" 2>/dev/null || echo "0")
    local level
    level=$(get_user_level)
    
    clear
    print_banner "📈 Your Progress"
    echo ""
    
    cat << EOF
Experience Level: $(echo $level | tr '[:lower:]' '[:upper:]')
Total Actions: $total_actions

Milestones:
$([ $total_actions -ge 1 ] && echo "  ✓ First action" || echo "  ☐ First action")
$([ $total_actions -ge 5 ] && echo "  ✓ Beginner (5 actions)" || echo "  ☐ Beginner (5 actions)")
$([ $total_actions -ge 10 ] && echo "  ✓ Learning (10 actions)" || echo "  ☐ Learning (10 actions)")
$([ $total_actions -ge 20 ] && echo "  ✓ Intermediate (20 actions)" || echo "  ☐ Intermediate (20 actions)")
$([ $total_actions -ge 50 ] && echo "  ✓ Advanced (50 actions)" || echo "  ☐ Advanced (50 actions)")
$([ $total_actions -ge 100 ] && echo "  ✓ Expert (100 actions)" || echo "  ☐ Expert (100 actions)")

Keep going! Each action makes you better! 🚀

EOF
    read -p "Press Enter to continue..."
}

# Export functions for use in other scripts
export -f get_contextual_hint
export -f log_action
export -f suggest_next_action
export -f interactive_help
export -f show_workflow_guide

# If run directly, show interactive help
if [ "${BASH_SOURCE[0]}" -ef "$0" ]; then
    init_assistant
    interactive_help
fi
