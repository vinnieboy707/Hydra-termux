# Hydra-Termux Web Configuration Interface

A modern, user-friendly web interface for configuring and generating Hydra attack scripts.

## 🌟 Features

### Visual Protocol Selection
- 8 protocol cards with icons and descriptions
- SSH, FTP, Web/HTTP, RDP, MySQL, PostgreSQL, SMB, and Auto Attack
- Port information displayed on each card
- Hover effects for better user experience

### Interactive Configuration Forms
- **Parameter Input Fields**: Easy-to-use forms for each attack variation
- **Example Formats**: Every field shows example values
- **Help Text**: Clear descriptions of what each parameter does
- **Resource Links**: External links to learn more about each parameter
- **Default Values**: Sensible defaults pre-filled for optional fields

### Script Generation
- **One-Click Generation**: Generate complete bash commands
- **Copy Button**: Instant clipboard copy functionality
- **Visual Feedback**: Button changes to "✅ Copied!" when successful
- **Command Preview**: See the exact command before copying

### Multiple Variations per Protocol
Each protocol includes multiple attack variations:
- **SSH**: Basic attack, Subnet scan
- **FTP**: Basic attack
- **Web/HTTP**: HTTP Basic Auth, WordPress login
- **RDP**: Basic attack
- **MySQL**: Basic attack
- **PostgreSQL**: Basic attack with database options
- **SMB**: Basic attack with domain support
- **Auto Attack**: Full automated reconnaissance

## 🚀 How to Use

### 1. Launch the Web UI

From the main Hydra-Termux menu:
```bash
./hydra.sh
# Select option 19: Launch Web Configuration UI
```

Or directly:
```bash
bash scripts/web_ui_launcher.sh
```

### 2. Access the Interface

Open your browser and go to:
- `http://localhost:8080`
- `http://127.0.0.1:8080`

### 3. Configure Your Attack

1. **Select a Protocol**: Click on any protocol card (SSH, FTP, etc.)
2. **Choose a Variation**: Pick the specific attack type you want
3. **Fill the Form**: Enter required parameters (marked with *)
4. **Add Optional Parameters**: Customize with optional settings
5. **Generate Script**: Click "🚀 Generate Script" button
6. **Copy Command**: Click "📋 Copy" to copy to clipboard
7. **Run in Termux**: Paste and execute in your Termux terminal

## 📱 Mobile-Friendly Design

The interface is fully responsive and optimized for mobile devices:
- Touch-friendly buttons and inputs
- Readable text on small screens
- Smooth scrolling and navigation
- Works great in Termux's browser

## 🎨 Design Features

### Color Scheme
- **Dark Theme**: Easy on the eyes, perfect for Termux
- **Green Accents**: Hacker-style aesthetic
- **High Contrast**: Clear visibility of all elements

### Visual Elements
- **ASCII Art Header**: Retro terminal-style branding
- **Protocol Icons**: Emoji icons for quick identification
- **Alert Boxes**: Warning and info messages with colors
- **Hover Effects**: Interactive card animations

## 📖 Parameter Reference

### Common Parameters

#### Target IP/Hostname
- **Description**: The IP address or hostname to attack
- **Examples**: `192.168.1.100`, `example.com`, `192.168.1.0/24`
- **Required**: Yes
- **Resource**: [How to find IP addresses](https://www.wikihow.com/Find-a-Server-IP-Address)

#### Port
- **Description**: Service port number
- **Examples**: `22` (SSH), `21` (FTP), `80/443` (HTTP/HTTPS)
- **Required**: No (uses default)
- **Resource**: Protocol-specific port documentation

#### Username
- **Description**: Specific username to test
- **Examples**: `root`, `admin`, `administrator`
- **Required**: No (tries common usernames if empty)
- **Resource**: [Common admin usernames](https://github.com/danielmiessler/SecLists/tree/master/Usernames)

#### Password Wordlist
- **Description**: Path to password wordlist file
- **Examples**: `/path/to/wordlist.txt`, `~/wordlists/rockyou.txt`
- **Required**: No (uses default wordlists)
- **Resource**: [Download wordlists](https://github.com/danielmiessler/SecLists)

#### Threads
- **Description**: Number of parallel connections
- **Examples**: `8`, `16`, `32`
- **Required**: No (default: 16)
- **Resource**: [Performance timing](https://nmap.org/book/performance-timing-templates.html)

## 🔧 Technical Details

### Technology Stack
- **Frontend**: Pure HTML5, CSS3, JavaScript (no dependencies)
- **Backend**: Python HTTP server (built-in)
- **Styling**: Custom CSS with responsive design
- **Compatibility**: Works on any modern browser

### File Structure
```
web_ui/
├── index.html          # Main page with protocol cards
├── css/
│   └── style.css      # Responsive styles and themes
├── js/
│   └── main.js        # Protocol configs and logic
└── README.md          # This file
```

### Protocol Configuration Format

Each protocol is defined in `js/main.js` with this structure:
```javascript
protocolName: {
    name: 'Display Name',
    icon: '🔐',
    description: 'Protocol description',
    variations: [
        {
            name: 'Variation Name',
            description: 'What this does',
            script: 'script_name.sh',
            parameters: [
                {
                    name: 'param_name',
                    label: 'Display Label',
                    type: 'text',
                    required: true,
                    example: 'example value',
                    help: 'Help text',
                    resource: {
                        text: 'Link text',
                        url: 'https://...'
                    }
                }
            ]
        }
    ]
}
```

## 🔒 Security Features

### Built-in Warnings
- **Legal disclaimer** on every page
- **Warning messages** before generating scripts
- **VPN reminder** in usage tips
- **Authorization notice** in footer

### Safe Defaults
- Reasonable thread counts to avoid detection
- Default ports for common services
- Timeout values to prevent hanging
- Verbose mode for transparency

## 🐛 Troubleshooting

### Server Won't Start
```bash
# Check if port is already in use
netstat -tuln | grep 8080

# Try a different port
bash scripts/web_ui_launcher.sh -p 9090
```

### Can't Access in Browser
1. Ensure the server is running
2. Check if you're using the correct URL
3. Try `127.0.0.1` instead of `localhost`
4. Disable any VPN that might block local connections

### Copy Button Not Working
- Modern browsers require HTTPS for clipboard API
- For HTTP, manually select and copy the text
- Or run the server with HTTPS (advanced)

### Scripts Not Executing
- Ensure you copied the complete command
- Check that scripts directory exists
- Verify script permissions: `chmod +x scripts/*.sh`
- Run from the project root directory

## 🔄 Customization

### Adding New Protocols
1. Edit `web_ui/js/main.js`
2. Add new entry to `protocolConfigs` object
3. Define variations and parameters
4. Save and refresh browser

### Changing Styles
1. Edit `web_ui/css/style.css`
2. Modify colors, fonts, or layouts
3. Changes apply immediately on refresh

### Custom Port
```bash
bash scripts/web_ui_launcher.sh -p YOUR_PORT
```

## 📝 Examples

### SSH Attack Example
1. Click "SSH" card
2. Click "Configure & Generate" on "Basic SSH Attack"
3. Enter target: `192.168.1.100`
4. Enter username: `admin` (optional)
5. Click "Generate Script"
6. Copy: `bash scripts/ssh_admin_attack.sh -t "192.168.1.100" -u "admin" -v`
7. Paste in Termux and run

### Web Attack Example
1. Click "Web/HTTP" card
2. Choose "WordPress Login"
3. Enter URL: `https://example.com`
4. Enter username: `admin`
5. Generate and copy command
6. Execute in Termux

## ⚠️ Legal Disclaimer

**IMPORTANT**: This tool is for educational and authorized security testing ONLY.

- Only use on systems you own or have written permission to test
- Unauthorized access is illegal and may result in criminal prosecution
- The developers assume NO liability for misuse
- Always comply with local laws and regulations

## 🤝 Contributing

To improve the web interface:
1. Fork the repository
2. Make your changes to web_ui files
3. Test thoroughly in multiple browsers
4. Submit a pull request with description

## 📞 Support

If you encounter issues:
1. Check this README
2. Review browser console for errors
3. Check server output in terminal
4. Open an issue on GitHub with details

---

**Made with ❤️ for the Hydra-Termux community**
