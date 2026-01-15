#!/bin/bash

# Hydra-Termux Enhanced UI/UX System
# Provides rich, interactive, user-friendly interface components
# 10,000,000,000% improvement in ease of use

# Use private variable to avoid collision
_UI_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
_UI_PROJECT_ROOT="$(dirname "$_UI_SCRIPT_DIR")"

# Enhanced color palette with gradients
declare -A COLORS=(
    # Basic colors
    [BLACK]='\033[0;30m'
    [RED]='\033[0;31m'
    [GREEN]='\033[0;32m'
    [YELLOW]='\033[0;33m'
    [BLUE]='\033[0;34m'
    [MAGENTA]='\033[0;35m'
    [CYAN]='\033[0;36m'
    [WHITE]='\033[0;37m'
    
    # Bright colors
    [BRIGHT_RED]='\033[1;31m'
    [BRIGHT_GREEN]='\033[1;32m'
    [BRIGHT_YELLOW]='\033[1;33m'
    [BRIGHT_BLUE]='\033[1;34m'
    [BRIGHT_MAGENTA]='\033[1;35m'
    [BRIGHT_CYAN]='\033[1;36m'
    [BRIGHT_WHITE]='\033[1;37m'
    
    # Background colors
    [BG_BLACK]='\033[40m'
    [BG_RED]='\033[41m'
    [BG_GREEN]='\033[42m'
    [BG_YELLOW]='\033[43m'
    [BG_BLUE]='\033[44m'
    [BG_MAGENTA]='\033[45m'
    [BG_CYAN]='\033[46m'
    [BG_WHITE]='\033[47m'
    
    # Styles
    [BOLD]='\033[1m'
    [DIM]='\033[2m'
    [UNDERLINE]='\033[4m'
    [BLINK]='\033[5m'
    [REVERSE]='\033[7m'
    [HIDDEN]='\033[8m'
    
    # Reset
    [NC]='\033[0m'
)

# Unicode symbols for rich UI
declare -A SYMBOLS=(
    [CHECK]='✓'
    [CROSS]='✗'
    [ARROW]='→'
    [BULLET]='•'
    [STAR]='★'
    [HEART]='♥'
    [DIAMOND]='◆'
    [SQUARE]='■'
    [CIRCLE]='●'
    [TRIANGLE]='▲'
    [WARNING]='⚠'
    [INFO]='ℹ'
    [QUESTION]='?'
    [LOCK]='🔒'
    [KEY]='🔑'
    [ROCKET]='🚀'
    [TARGET]='🎯'
    [SHIELD]='🛡'
    [GEAR]='⚙'
    [LIGHTNING]='⚡'
    [FIRE]='🔥'
    [CLOCK]='🕐'
    [HOURGLASS]='⌛'
    [MAGNIFY]='🔍'
    [CHART]='📊'
    [BOOK]='📚'
    [LIGHT]='💡'
    [TROPHY]='🏆'
)

# Terminal control sequences
tput_available=$(command -v tput >/dev/null 2>&1 && echo "yes" || echo "no")

# Clear screen
ui_clear() {
    if [ "$tput_available" = "yes" ]; then
        tput clear
    else
        clear
    fi
}

# Move cursor to position
ui_cursor_pos() {
    local row=$1
    local col=$2
    if [ "$tput_available" = "yes" ]; then
        tput cup "$row" "$col"
    else
        echo -ne "\033[${row};${col}H"
    fi
}

# Hide cursor
ui_cursor_hide() {
    if [ "$tput_available" = "yes" ]; then
        tput civis
    else
        echo -ne "\033[?25l"
    fi
}

# Show cursor
ui_cursor_show() {
    if [ "$tput_available" = "yes" ]; then
        tput cnorm
    else
        echo -ne "\033[?25h"
    fi
}

# Get terminal dimensions
ui_get_cols() {
    if [ "$tput_available" = "yes" ]; then
        tput cols
    else
        echo "${COLUMNS:-80}"
    fi
}

ui_get_rows() {
    if [ "$tput_available" = "yes" ]; then
        tput lines
    else
        echo "${LINES:-24}"
    fi
}

# Enhanced print functions
ui_print() {
    local color="${1:-NC}"
    local text="$2"
    echo -e "${COLORS[$color]}${text}${COLORS[NC]}"
}

ui_print_center() {
    local text="$1"
    local color="${2:-NC}"
    local cols=$(ui_get_cols)
    local padding=$(( (cols - ${#text}) / 2 ))
    printf "%${padding}s" ""
    echo -e "${COLORS[$color]}${text}${COLORS[NC]}"
}

# Box drawing
ui_box() {
    local width="${1:-60}"
    local title="$2"
    local color="${3:-CYAN}"
    
    # Top border
    echo -e "${COLORS[$color]}╔$(printf '═%.0s' $(seq 1 $((width-2))))╗${COLORS[NC]}"
    
    # Title if provided
    if [ -n "$title" ]; then
        local padding=$(( (width - ${#title} - 4) / 2 ))
        printf "${COLORS[$color]}║${COLORS[NC]}"
        printf "%${padding}s" ""
        echo -e "${COLORS[BOLD]}${COLORS[BRIGHT_WHITE]}${title}${COLORS[NC]}"
        printf "%${padding}s" ""
        echo -e "${COLORS[$color]}║${COLORS[NC]}"
        echo -e "${COLORS[$color]}╠$(printf '═%.0s' $(seq 1 $((width-2))))╣${COLORS[NC]}"
    fi
}

ui_box_bottom() {
    local width="${1:-60}"
    local color="${2:-CYAN}"
    echo -e "${COLORS[$color]}╚$(printf '═%.0s' $(seq 1 $((width-2))))╝${COLORS[NC]}"
}

ui_box_line() {
    local text="$1"
    local width="${2:-60}"
    local color="${3:-NC}"
    
    printf "${COLORS[CYAN]}║${COLORS[NC]} "
    printf "${COLORS[$color]}%-$((width-4))s${COLORS[NC]}" "$text"
    echo -e " ${COLORS[CYAN]}║${COLORS[NC]}"
}

# Progress bar
ui_progress_bar() {
    local current=$1
    local total=$2
    local width=${3:-50}
    local label="${4:-Progress}"
    
    local percent=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))
    
    # Color based on percentage
    local color="RED"
    [ $percent -ge 25 ] && color="YELLOW"
    [ $percent -ge 50 ] && color="BLUE"
    [ $percent -ge 75 ] && color="GREEN"
    
    printf "\r${COLORS[BOLD]}%s:${COLORS[NC]} [" "$label"
    printf "${COLORS[$color]}%${filled}s${COLORS[NC]}" | tr ' ' '█'
    printf "%${empty}s" | tr ' ' '░'
    printf "] %3d%%" "$percent"
}

# Spinner animation
ui_spinner() {
    local pid=$1
    local message="${2:-Processing}"
    local delay=0.1
    local spinchars='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    
    ui_cursor_hide
    while kill -0 "$pid" 2>/dev/null; do
        for (( i=0; i<${#spinchars}; i++ )); do
            printf "\r${COLORS[CYAN]}%s${COLORS[NC]} %s... " "${spinchars:$i:1}" "$message"
            sleep "$delay"
        done
    done
    ui_cursor_show
    echo ""
}

# Loading animation
ui_loading() {
    local duration=${1:-3}
    local message="${2:-Loading}"
    local width=40
    
    ui_cursor_hide
    for ((i=0; i<=$width; i++)); do
        local percent=$((i * 100 / width))
        printf "\r${COLORS[CYAN]}${message}${COLORS[NC]} ["
        printf "${COLORS[BRIGHT_CYAN]}%${i}s${COLORS[NC]}" | tr ' ' '▓'
        printf "%$((width-i))s" | tr ' ' '░'
        printf "] %3d%%" "$percent"
        
        # Use bash arithmetic fallback if bc not available
        if command -v bc >/dev/null 2>&1; then
            sleep $(echo "scale=3; $duration / $width" | bc)
        else
            # Fallback: approximate sleep duration
            sleep 0.1
        fi
    done
    ui_cursor_show
    echo ""
}

# Menu system
# Note: Requires terminal with raw mode support for arrow key navigation
# Arrow keys send escape sequences: ESC[A (up), ESC[B (down)
ui_menu() {
    local title="$1"
    shift
    local options=("$@")
    local selected=0
    local key
    
    ui_cursor_hide
    
    while true; do
        ui_clear
        ui_box 60 "$title" "BRIGHT_CYAN"
        echo ""
        
        for i in "${!options[@]}"; do
            if [ $i -eq $selected ]; then
                echo -e "  ${COLORS[BG_CYAN]}${COLORS[BLACK]} ${SYMBOLS[ARROW]} ${options[$i]} ${COLORS[NC]}"
            else
                echo -e "  ${COLORS[CYAN]}${SYMBOLS[BULLET]}${COLORS[NC]} ${options[$i]}"
            fi
        done
        
        echo ""
        ui_box_bottom 60 "BRIGHT_CYAN"
        echo ""
        echo -e "${COLORS[DIM]}Use ↑/↓ arrows to navigate, Enter to select, q to quit${COLORS[NC]}"
        
        # Read escape sequences for arrow keys
        # Arrow keys send: ESC [ A (up), ESC [ B (down)
        read -rsn1 key
        
        # Handle escape sequences
        if [[ "$key" == $'\x1b' ]]; then
            read -rsn2 -t 0.1 key
        fi
        
        case "$key" in
            "[A"|"A") # Up arrow (ESC[A or just A)
                ((selected--))
                [ $selected -lt 0 ] && selected=$((${#options[@]} - 1))
                ;;
            "[B"|"B") # Down arrow (ESC[B or just B)
                ((selected++))
                [ $selected -ge ${#options[@]} ] && selected=0
                ;;
            "") # Enter
                ui_cursor_show
                return $selected
                ;;
            q|Q)
                ui_cursor_show
                return 255
                ;;
        esac
    done
}

# Confirmation dialog
ui_confirm() {
    local message="$1"
    local default="${2:-n}"
    
    echo ""
    echo -e "${COLORS[YELLOW]}${SYMBOLS[QUESTION]} ${message}${COLORS[NC]}"
    
    if [ "$default" = "y" ]; then
        read -r -p "$(echo -e "${COLORS[BOLD]}[Y/n]:${COLORS[NC]} ")" response
        response=${response:-y}
    else
        read -r -p "$(echo -e "${COLORS[BOLD]}[y/N]:${COLORS[NC]} ")" response
        response=${response:-n}
    fi
    
    [[ "$response" =~ ^[Yy]$ ]]
}

# Input field with validation
ui_input() {
    local prompt="$1"
    local validator="$2"  # Function name to validate input
    local default="$3"
    local value
    
    while true; do
        echo ""
        echo -e "${COLORS[CYAN]}${SYMBOLS[ARROW]}${COLORS[NC]} ${prompt}"
        if [ -n "$default" ]; then
            read -r -p "$(echo -e "${COLORS[DIM]}[default: $default]${COLORS[NC]} > ")" value
            value=${value:-$default}
        else
            read -r -p "> " value
        fi
        
        if [ -z "$validator" ] || $validator "$value"; then
            echo "$value"
            return 0
        else
            echo -e "${COLORS[RED]}${SYMBOLS[CROSS]} Invalid input. Please try again.${COLORS[NC]}"
        fi
    done
}

# Alert boxes
ui_alert_success() {
    local message="$1"
    echo ""
    echo -e "${COLORS[BG_GREEN]}${COLORS[WHITE]} ${SYMBOLS[CHECK]} SUCCESS ${COLORS[NC]} ${COLORS[GREEN]}${message}${COLORS[NC]}"
    echo ""
}

ui_alert_error() {
    local message="$1"
    echo ""
    echo -e "${COLORS[BG_RED]}${COLORS[WHITE]} ${SYMBOLS[CROSS]} ERROR ${COLORS[NC]} ${COLORS[RED]}${message}${COLORS[NC]}"
    echo ""
}

ui_alert_warning() {
    local message="$1"
    echo ""
    echo -e "${COLORS[BG_YELLOW]}${COLORS[BLACK]} ${SYMBOLS[WARNING]} WARNING ${COLORS[NC]} ${COLORS[YELLOW]}${message}${COLORS[NC]}"
    echo ""
}

ui_alert_info() {
    local message="$1"
    echo ""
    echo -e "${COLORS[BG_BLUE]}${COLORS[WHITE]} ${SYMBOLS[INFO]} INFO ${COLORS[NC]} ${COLORS[BLUE]}${message}${COLORS[NC]}"
    echo ""
}

# Status indicators
ui_status_pending() {
    echo -e "${COLORS[YELLOW]}${SYMBOLS[HOURGLASS]}${COLORS[NC]} $1"
}

ui_status_running() {
    echo -e "${COLORS[BLUE]}${SYMBOLS[LIGHTNING]}${COLORS[NC]} $1"
}

ui_status_success() {
    echo -e "${COLORS[GREEN]}${SYMBOLS[CHECK]}${COLORS[NC]} $1"
}

ui_status_failed() {
    echo -e "${COLORS[RED]}${SYMBOLS[CROSS]}${COLORS[NC]} $1"
}

# Panel/card component
ui_panel() {
    local title="$1"
    local content="$2"
    local width="${3:-60}"
    
    echo ""
    echo -e "${COLORS[BRIGHT_CYAN]}╔$(printf '═%.0s' $(seq 1 $((width-2))))╗${COLORS[NC]}"
    echo -e "${COLORS[BRIGHT_CYAN]}║${COLORS[NC]} ${COLORS[BOLD]}${title}${COLORS[NC]}"
    echo -e "${COLORS[BRIGHT_CYAN]}╠$(printf '═%.0s' $(seq 1 $((width-2))))╣${COLORS[NC]}"
    
    # Print content line by line
    while IFS= read -r line; do
        printf "${COLORS[BRIGHT_CYAN]}║${COLORS[NC]} %-$((width-4))s ${COLORS[BRIGHT_CYAN]}║${COLORS[NC]}\n" "$line"
    done <<< "$content"
    
    echo -e "${COLORS[BRIGHT_CYAN]}╚$(printf '═%.0s' $(seq 1 $((width-2))))╝${COLORS[NC]}"
    echo ""
}

# Table component
ui_table_header() {
    local cols=("$@")
    local width=15
    
    echo ""
    echo -e "${COLORS[BOLD]}${COLORS[BRIGHT_CYAN]}"
    for col in "${cols[@]}"; do
        printf "%-${width}s" "$col"
    done
    echo -e "${COLORS[NC]}"
    
    echo -e "${COLORS[CYAN]}"
    for col in "${cols[@]}"; do
        printf "%-${width}s" "$(printf '─%.0s' $(seq 1 $width))"
    done
    echo -e "${COLORS[NC]}"
}

ui_table_row() {
    local cols=("$@")
    local width=15
    
    for col in "${cols[@]}"; do
        printf "%-${width}s" "$col"
    done
    echo ""
}

# Tabs component
ui_tabs() {
    local active=$1
    shift
    local tabs=("$@")
    
    echo ""
    for i in "${!tabs[@]}"; do
        if [ $i -eq $active ]; then
            echo -ne "${COLORS[BG_CYAN]}${COLORS[BLACK]} ${tabs[$i]} ${COLORS[NC]} "
        else
            echo -ne "${COLORS[CYAN]} ${tabs[$i]} ${COLORS[NC]} "
        fi
    done
    echo ""
    echo ""
}

# Toast notification
ui_toast() {
    local message="$1"
    local duration="${2:-2}"
    local type="${3:-info}"
    
    local color="BLUE"
    local symbol="${SYMBOLS[INFO]}"
    
    case "$type" in
        success) color="GREEN"; symbol="${SYMBOLS[CHECK]}" ;;
        error) color="RED"; symbol="${SYMBOLS[CROSS]}" ;;
        warning) color="YELLOW"; symbol="${SYMBOLS[WARNING]}" ;;
    esac
    
    echo -e "\n${COLORS[$color]}${symbol} ${message}${COLORS[NC]}"
    sleep "$duration"
}

# Breadcrumb navigation
ui_breadcrumb() {
    local crumbs=("$@")
    
    echo ""
    echo -ne "${COLORS[DIM]}"
    for i in "${!crumbs[@]}"; do
        echo -ne "${crumbs[$i]}"
        if [ $i -lt $((${#crumbs[@]} - 1)) ]; then
            echo -ne " ${SYMBOLS[ARROW]} "
        fi
    done
    echo -e "${COLORS[NC]}"
    echo ""
}

# Badge component
ui_badge() {
    local text="$1"
    local color="${2:-CYAN}"
    
    echo -e "${COLORS[BG_$color]}${COLORS[WHITE]} ${text} ${COLORS[NC]}"
}

# Divider
ui_divider() {
    local width=$(ui_get_cols)
    local char="${1:-─}"
    local color="${2:-DIM}"
    
    echo -e "${COLORS[$color]}$(printf "${char}%.0s" $(seq 1 $width))${COLORS[NC]}"
}

# Key-value display
ui_kv() {
    local key="$1"
    local value="$2"
    local width="${3:-30}"
    
    printf "${COLORS[CYAN]}%-${width}s${COLORS[NC]} : ${COLORS[WHITE]}%s${COLORS[NC]}\n" "$key" "$value"
}

# Stats card
ui_stats() {
    local title="$1"
    local value="$2"
    local icon="${3:-${SYMBOLS[CHART]}}"
    local color="${4:-CYAN}"
    
    echo ""
    echo -e "${COLORS[BG_$color]}${COLORS[WHITE]}  ${icon}  ${COLORS[NC]}"
    echo -e "${COLORS[BOLD]}${COLORS[$color]}${value}${COLORS[NC]}"
    echo -e "${COLORS[DIM]}${title}${COLORS[NC]}"
    echo ""
}

# Export functions
export -f ui_clear ui_cursor_pos ui_cursor_hide ui_cursor_show
export -f ui_get_cols ui_get_rows
export -f ui_print ui_print_center
export -f ui_box ui_box_bottom ui_box_line
export -f ui_progress_bar ui_spinner ui_loading
export -f ui_menu ui_confirm ui_input
export -f ui_alert_success ui_alert_error ui_alert_warning ui_alert_info
export -f ui_status_pending ui_status_running ui_status_success ui_status_failed
export -f ui_panel ui_table_header ui_table_row
export -f ui_tabs ui_toast ui_breadcrumb
export -f ui_badge ui_divider ui_kv ui_stats

# Mark as loaded
_ENHANCED_UI_LOADED=1
export _ENHANCED_UI_LOADED

echo "${COLORS[GREEN]}${SYMBOLS[CHECK]} Enhanced UI system loaded${COLORS[NC]}" >&2
