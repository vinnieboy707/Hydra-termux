# Contributing to Hydra-Termux

Thank you for your interest in contributing to Hydra-Termux Ultimate Edition! We welcome contributions from the community.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:
- A clear title and description
- Steps to reproduce the issue
- Expected vs actual behavior
- Your environment (Termux version, Android version, etc.)
- Any relevant logs or screenshots

### Suggesting Features

We welcome feature suggestions! Please:
- Check if the feature has already been requested
- Clearly describe the feature and its benefits
- Explain how it would work
- Consider whether it fits the project's scope

### Contributing Code

1. **Fork the repository**
   ```bash
   git clone https://github.com/vinnieboy707/Hydra-termux.git
   cd Hydra-termux
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the existing code style
   - Add comments for complex logic
   - Test your changes thoroughly

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add: Brief description of your changes"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request**
   - Provide a clear description of your changes
   - Reference any related issues
   - Ensure all tests pass

## Code Guidelines

### Bash Scripts

- Use `#!/bin/bash` shebang
- Follow consistent indentation (4 spaces)
- Add comments for complex operations
- Use meaningful variable names
- Include error handling
- Add help messages (`--help` flag)

### Script Structure

All attack scripts should include:
```bash
#!/bin/bash

# Script description

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

# Configuration variables

# Functions
show_help() { ... }
validate_input() { ... }
run_attack() { ... }

# Argument parsing

# Main execution
```

### Testing

- Test on actual Termux environment
- Verify all options work correctly
- Check error handling
- Ensure scripts are portable

### Documentation

- Update README.md if adding features
- Add examples to docs/EXAMPLES.md
- Update docs/USAGE.md for new options
- Document any new dependencies

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Accept constructive criticism
- Focus on what's best for the project
- Show empathy towards others

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Publishing others' private information
- Any illegal activities

## Legal Compliance

**IMPORTANT**: All contributions must comply with:

1. **Ethical Use**: Features must be for legitimate security testing
2. **No Malicious Code**: No backdoors, malware, or harmful features
3. **Legal Compliance**: Must not encourage illegal activities
4. **Documentation**: Must include appropriate warnings and disclaimers

## Questions?

If you have questions about contributing, feel free to:
- Open an issue for discussion
- Contact the maintainers

## Recognition

Contributors will be recognized in:
- The project README.md
- Release notes for significant contributions

Thank you for helping make Hydra-Termux better!
