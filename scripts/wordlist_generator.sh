#!/bin/bash

# Wordlist Generator
# Create custom password wordlists

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

# Function to display help
show_help() {
    print_banner "Wordlist Generator"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -c, --combine     Combine multiple wordlists"
    echo "  -i, --input       Input wordlist files (comma-separated)"
    echo "  -o, --output      Output wordlist file"
    echo "  -d, --dedupe      Remove duplicates"
    echo "  -s, --sort        Sort by password strength"
    echo "  -m, --min-length  Minimum password length"
    echo "  -M, --max-length  Maximum password length"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --combine --input file1.txt,file2.txt --output combined.txt"
    echo "  $0 --dedupe --input passwords.txt --output unique.txt"
    echo "  $0 --sort --min-length 8 --input passwords.txt --output sorted.txt"
    echo ""
}

# Function to combine wordlists
combine_wordlists() {
    local input_files="$1"
    local output_file="$2"
    
    print_header "Combining Wordlists"
    
    IFS=',' read -ra FILES <<< "$input_files"
    
    local total_lines=0
    
    for file in "${FILES[@]}"; do
        if [ ! -f "$file" ]; then
            log_warning "File not found: $file"
            continue
        fi
        
        local lines=$(wc -l < "$file")
        log_info "Adding $file ($lines lines)"
        cat "$file" >> "$output_file"
        total_lines=$((total_lines + lines))
    done
    
    if [ -f "$output_file" ]; then
        local final_lines=$(wc -l < "$output_file")
        log_success "Combined $total_lines lines into $output_file"
    else
        log_error "Failed to combine wordlists"
        return 1
    fi
}

# Function to remove duplicates
remove_duplicates() {
    local input_file="$1"
    local output_file="$2"
    
    print_header "Removing Duplicates"
    
    if [ ! -f "$input_file" ]; then
        log_error "Input file not found: $input_file"
        return 1
    fi
    
    local before=$(wc -l < "$input_file")
    log_info "Original: $before lines"
    
    sort -u "$input_file" > "$output_file"
    
    local after=$(wc -l < "$output_file")
    local removed=$((before - after))
    
    log_success "Removed $removed duplicate(s)"
    log_success "Result: $after unique lines"
}

# Function to filter by length
filter_by_length() {
    local input_file="$1"
    local output_file="$2"
    local min_length="$3"
    local max_length="$4"
    
    print_header "Filtering by Length"
    
    if [ ! -f "$input_file" ]; then
        log_error "Input file not found: $input_file"
        return 1
    fi
    
    log_info "Min length: ${min_length:-0}"
    log_info "Max length: ${max_length:-unlimited}"
    
    local before=$(wc -l < "$input_file")
    
    awk -v min="${min_length:-0}" -v max="${max_length:-999}" \
        'length($0) >= min && length($0) <= max' "$input_file" > "$output_file"
    
    local after=$(wc -l < "$output_file")
    local filtered=$((before - after))
    
    log_success "Filtered $filtered line(s)"
    log_success "Result: $after lines"
}

# Function to sort by password strength
sort_by_strength() {
    local input_file="$1"
    local output_file="$2"
    
    print_header "Sorting by Password Strength"
    
    if [ ! -f "$input_file" ]; then
        log_error "Input file not found: $input_file"
        return 1
    fi
    
    # Simple strength calculation: longer + more character types = stronger
    awk '{
        score = length($0) * 10
        if ($0 ~ /[a-z]/) score += 5
        if ($0 ~ /[A-Z]/) score += 10
        if ($0 ~ /[0-9]/) score += 10
        if ($0 ~ /[^a-zA-Z0-9]/) score += 15
        print score, $0
    }' "$input_file" | sort -rn | cut -d' ' -f2- > "$output_file"
    
    log_success "Sorted by strength: $output_file"
}

# Function to generate custom patterns
generate_patterns() {
    local base_word="$1"
    local output_file="$2"
    
    print_header "Generating Password Patterns"
    
    log_info "Base word: $base_word"
    
    # Common patterns
    local current_year=$(date +%Y)
    local next_year=$((current_year + 1))
    
    echo "$base_word" >> "$output_file"
    echo "${base_word}123" >> "$output_file"
    echo "${base_word}@123" >> "$output_file"
    echo "${base_word}!" >> "$output_file"
    echo "${base_word}${current_year}" >> "$output_file"
    echo "${base_word}${next_year}" >> "$output_file"
    echo "123${base_word}" >> "$output_file"
    
    # Capitalization variants
    echo "${base_word^}" >> "$output_file"  # First letter uppercase
    echo "${base_word^^}" >> "$output_file" # All uppercase
    
    # Leet speak
    local leet="${base_word//a/4}"
    leet="${leet//e/3}"
    leet="${leet//i/1}"
    leet="${leet//o/0}"
    leet="${leet//s/5}"
    echo "$leet" >> "$output_file"
    
    log_success "Generated patterns for: $base_word"
}

# Parse command line arguments
COMBINE=false
INPUT_FILES=""
OUTPUT_FILE=""
DEDUPE=false
SORT_STRENGTH=false
MIN_LENGTH=""
MAX_LENGTH=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--combine)
            COMBINE=true
            shift
            ;;
        -i|--input)
            INPUT_FILES="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -d|--dedupe)
            DEDUPE=true
            shift
            ;;
        -s|--sort)
            SORT_STRENGTH=true
            shift
            ;;
        -m|--min-length)
            MIN_LENGTH="$2"
            shift 2
            ;;
        -M|--max-length)
            MAX_LENGTH="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
print_banner "Wordlist Generator"
echo ""

if [ -z "$OUTPUT_FILE" ]; then
    log_error "Output file is required (--output)"
    show_help
    exit 1
fi

if [ "$COMBINE" = "true" ]; then
    if [ -z "$INPUT_FILES" ]; then
        log_error "Input files required for combine (--input)"
        exit 1
    fi
    combine_wordlists "$INPUT_FILES" "$OUTPUT_FILE"
fi

if [ "$DEDUPE" = "true" ]; then
    if [ -z "$INPUT_FILES" ]; then
        log_error "Input file required for dedupe (--input)"
        exit 1
    fi
    remove_duplicates "$INPUT_FILES" "$OUTPUT_FILE"
fi

if [ -n "$MIN_LENGTH" ] || [ -n "$MAX_LENGTH" ]; then
    if [ -z "$INPUT_FILES" ]; then
        log_error "Input file required for filtering (--input)"
        exit 1
    fi
    filter_by_length "$INPUT_FILES" "$OUTPUT_FILE" "$MIN_LENGTH" "$MAX_LENGTH"
fi

if [ "$SORT_STRENGTH" = "true" ]; then
    if [ -z "$INPUT_FILES" ]; then
        log_error "Input file required for sorting (--input)"
        exit 1
    fi
    sort_by_strength "$INPUT_FILES" "$OUTPUT_FILE"
fi

if [ ! "$COMBINE" = "true" ] && [ ! "$DEDUPE" = "true" ] && \
   [ -z "$MIN_LENGTH" ] && [ -z "$MAX_LENGTH" ] && [ ! "$SORT_STRENGTH" = "true" ]; then
    show_help
fi
