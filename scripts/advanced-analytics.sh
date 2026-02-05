#!/bin/bash

# Advanced Analytics and Intelligence System
# Provides insights, recommendations, and automated analysis

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  $1"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
}

print_insight() {
    echo -e "${CYAN}💡${NC} $1"
}

print_metric() {
    echo -e "${GREEN}📊${NC} $1"
}

# Analyze attack success rates
analyze_attack_success() {
    print_header "Attack Success Rate Analysis"
    
    local results_dir="$PROJECT_ROOT/results"
    if [ ! -d "$results_dir" ]; then
        echo "No results directory found"
        return
    fi
    
    local total_attacks
    local successful_attacks
    total_attacks=$(find "$results_dir" -name "*.txt" 2>/dev/null | wc -l)
    successful_attacks=$(grep -r "Valid credentials" "$results_dir" 2>/dev/null | wc -l)
    
    if [ "$total_attacks" -gt 0 ]; then
        local success_rate=$((successful_attacks * 100 / total_attacks))
        print_metric "Total Attacks: $total_attacks"
        print_metric "Successful: $successful_attacks"
        print_metric "Success Rate: ${success_rate}%"
        
        if [ "$success_rate" -lt 10 ]; then
            print_insight "Low success rate. Consider:"
            echo "  • Using more comprehensive wordlists"
            echo "  • Targeting more vulnerable systems"
            echo "  • Adjusting attack parameters"
        elif [ "$success_rate" -gt 50 ]; then
            print_insight "High success rate indicates effective targeting"
        fi
    else
        echo "No attack data available for analysis"
    fi
}

# Analyze most successful protocols
analyze_protocols() {
    print_header "Protocol Success Analysis"
    
    local results_dir="$PROJECT_ROOT/results"
    
    if [ ! -d "$results_dir" ]; then
        echo "No results directory found"
        return
    fi
    
    declare -A protocol_counts
    
    # Count successes by protocol
    for protocol in ssh ftp mysql web rdp smb; do
        local count
        count=$(grep -r "$protocol" "$results_dir" 2>/dev/null | wc -l)
        if [ "$count" -gt 0 ]; then
            protocol_counts[$protocol]=$count
        fi
    done
    
    # Display sorted results
    if [ ${#protocol_counts[@]} -gt 0 ]; then
        echo "Most successful protocols:"
        for protocol in "${!protocol_counts[@]}"; do
            printf "  %-10s: %d successful attempts\n" "$protocol" "${protocol_counts[$protocol]}"
        done | sort -k3 -rn
        
        print_insight "Focus on high-success protocols for better results"
    else
        echo "No protocol data available"
    fi
}

# Performance metrics
analyze_performance() {
    print_header "Performance Metrics"
    
    # Average attack duration
    if [ -f "$PROJECT_ROOT/logs/attack_timing.log" ]; then
        local avg_duration
        avg_duration=$(awk '{sum+=$1; count++} END {print sum/count}' "$PROJECT_ROOT/logs/attack_timing.log" 2>/dev/null || echo "0")
        print_metric "Average Attack Duration: ${avg_duration} seconds"
    fi
    
    # System resource usage
    print_metric "Current CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')"
    print_metric "Current Memory: $(free -h | awk 'NR==2{print $3"/"$2}')"
    
    # Docker container performance
    if command -v docker &> /dev/null; then
        local containers
        containers=$(docker ps -q | wc -l)
        print_metric "Active Containers: $containers"
        
        # Container resource usage
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | head -10
    fi
}

# Wordlist effectiveness
analyze_wordlists() {
    print_header "Wordlist Effectiveness Analysis"
    
    local wordlist_dir="$PROJECT_ROOT/wordlists"
    
    if [ ! -d "$wordlist_dir" ]; then
        echo "No wordlist directory found"
        return
    fi
    
    echo "Available wordlists:"
    for wordlist in "$wordlist_dir"/*.txt; do
        if [ -f "$wordlist" ]; then
            local name
            local size
            name=$(basename "$wordlist")
            size=$(wc -l < "$wordlist")
            printf "  %-30s: %'d entries\n" "$name" "$size"
        fi
    done
    
    print_insight "Larger wordlists increase coverage but take longer"
    print_insight "Use targeted wordlists for specific scenarios"
}

# Security recommendations
generate_recommendations() {
    print_header "AI-Powered Recommendations"
    
    local recommendations=()
    
    # Check if optimizations are enabled
    if [ ! -f "$PROJECT_ROOT/.optimizations_applied" ]; then
        recommendations+=("Run 'bash scripts/optimize-performance.sh' for 10x speed boost")
    fi
    
    # Check wordlist coverage
    if [ ! -d "$PROJECT_ROOT/wordlists" ] || [ $(find "$PROJECT_ROOT/wordlists" -name "*.txt" | wc -l) -lt 3 ]; then
        recommendations+=("Download more wordlists with 'bash scripts/download_wordlists.sh'")
    fi
    
    # Check auto-healing
    if ! pgrep -f "auto-heal.sh" > /dev/null; then
        recommendations+=("Enable auto-healing with 'bash scripts/auto-heal.sh &'")
    fi
    
    # Check monitoring
    if ! docker ps | grep -q prometheus; then
        recommendations+=("Enable monitoring for better insights")
    fi
    
    # Display recommendations
    if [ ${#recommendations[@]} -gt 0 ]; then
        echo -e "${YELLOW}🎯 Top Recommendations:${NC}"
        for i in "${!recommendations[@]}"; do
            echo "  $((i+1)). ${recommendations[$i]}"
        done
    else
        echo -e "${GREEN}✅ System is fully optimized!${NC}"
    fi
}

# Trend analysis
analyze_trends() {
    print_header "Historical Trends"
    
    local logs_dir="$PROJECT_ROOT/logs"
    
    if [ ! -d "$logs_dir" ]; then
        echo "No logs directory found"
        return
    fi
    
    # Attacks over time
    echo "Attack frequency (last 7 days):"
    for i in {6..0}; do
        local date
        local count
        date=$(date -d "$i days ago" +%Y-%m-%d 2>/dev/null || date -v-"${i}"d +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)
        count=$(grep -hc "$date" "$logs_dir"/*.log 2>/dev/null || echo 0)
        printf "  %s: " "$date"
        printf '█%.0s' $(seq 1 $((count / 10)))
        echo " ($count)"
    done
    
    print_insight "Monitor trends to identify patterns and optimize timing"
}

# Generate comprehensive report
generate_comprehensive_report() {
    local report_file
    report_file="$PROJECT_ROOT/reports/analytics-report-$(date +%Y%m%d-%H%M%S).md"
    mkdir -p "$PROJECT_ROOT/reports"
    
    cat > "$report_file" << EOF
# Hydra-Termux Analytics Report

**Generated:** $(date)

## Executive Summary

This report provides comprehensive analytics and insights for optimizing
penetration testing activities.

## Attack Success Metrics

$(analyze_attack_success 2>/dev/null | tail -n +2)

## Protocol Analysis

$(analyze_protocols 2>/dev/null | tail -n +2)

## Performance Metrics

$(analyze_performance 2>/dev/null | tail -n +2)

## Recommendations

$(generate_recommendations 2>/dev/null | tail -n +2)

## Conclusion

Review these insights regularly to improve effectiveness and efficiency.

---
*Report generated by Hydra-Termux Advanced Analytics System*
EOF
    
    echo "Comprehensive report saved to: $report_file"
}

# Real-time dashboard
show_dashboard() {
    while true; do
        clear
        echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${BLUE}║${NC}          HYDRA-TERMUX REAL-TIME DASHBOARD                    ${BLUE}║${NC}"
        echo -e "${BLUE}║${NC}          $(date +"%Y-%m-%d %H:%M:%S")                               ${BLUE}║${NC}"
        echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
        
        echo ""
        echo -e "${CYAN}System Status:${NC}"
        echo "  CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}') | Memory: $(free | awk 'NR==2{printf "%.1f%%", $3/$2*100}')"
        echo "  Containers: $(docker ps -q 2>/dev/null | wc -l) running"
        
        echo ""
        echo -e "${CYAN}Recent Activity:${NC}"
        tail -5 "$PROJECT_ROOT/logs"/*.log 2>/dev/null | grep -v "^$" | tail -5 || echo "  No recent activity"
        
        echo ""
        echo -e "${CYAN}Quick Stats:${NC}"
        echo "  Attacks today: $(grep -hc "$(date +%Y-%m-%d)" "$PROJECT_ROOT/logs"/*.log 2>/dev/null || echo 0)"
        echo "  Success rate: $(grep -rc "Valid credentials" "$PROJECT_ROOT/results" 2>/dev/null || echo 0) successful"
        
        echo ""
        echo "Press Ctrl+C to exit | Refreshes every 5 seconds"
        sleep 5
    done
}

# Main menu
main() {
    case "${1:-}" in
        --success)
            analyze_attack_success
            ;;
        --protocols)
            analyze_protocols
            ;;
        --performance)
            analyze_performance
            ;;
        --wordlists)
            analyze_wordlists
            ;;
        --recommendations)
            generate_recommendations
            ;;
        --trends)
            analyze_trends
            ;;
        --report)
            generate_comprehensive_report
            ;;
        --dashboard)
            show_dashboard
            ;;
        *)
            echo ""
            echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
            echo -e "${BLUE}  HYDRA-TERMUX ADVANCED ANALYTICS${NC}"
            echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
            echo ""
            
            analyze_attack_success
            analyze_protocols
            analyze_performance
            generate_recommendations
            
            echo ""
            echo "For more analysis:"
            echo "  --success          Attack success analysis"
            echo "  --protocols        Protocol effectiveness"
            echo "  --performance      Performance metrics"
            echo "  --wordlists        Wordlist analysis"
            echo "  --recommendations  AI recommendations"
            echo "  --trends           Historical trends"
            echo "  --report           Generate full report"
            echo "  --dashboard        Real-time dashboard"
            echo ""
            ;;
    esac
}

main "$@"
