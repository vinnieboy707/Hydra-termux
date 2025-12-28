# 🐍 Hydra-Termux

A powerful Hydra brute-force tool optimized for Termux on Android devices.

## ✨ Features

- Easy installation process
- Optimized for Termux environment
- Automated package management
- Simple command-line interface

## 📋 Prerequisites

Before you begin, ensure you have:

- ✅ [Termux](https://f-droid.org/en/packages/com.termux/) installed on your Android device
- ✅ Stable internet connection
- ✅ Storage permissions granted to Termux

## 🚀 Quick Installation

Just run these two commands:

```bash
# Clone the repository
git clone https://github.com/vinnieboy707/Hydra-termux.git
cd Hydra-termux

# Run the automated installer
bash install.sh
```

That's it! The installer will handle everything automatically.

## 📦 Manual Installation

If you prefer to install manually:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vinnieboy707/Hydra-termux.git
   ```

2. **Navigate to the project directory:**
   ```bash
   cd Hydra-termux
   ```

3. **Update Termux packages:**
   ```bash
   pkg update && pkg upgrade -y
   ```

4. **Install required packages:**
   ```bash
   pkg install $(cat need.txt) -y
   ```

5. **Make the script executable:**
   ```bash
   chmod +x hydra.sh
   ```

## 🎯 Usage

After installation, simply run:

```bash
./hydra.sh
```

Follow the on-screen prompts to use Hydra.

## 🔧 Troubleshooting

### "Permission denied" error
```bash
chmod +x hydra.sh install.sh
```

### "Package not found" error
```bash
pkg update
pkg upgrade
```

### Script won't run
Make sure you're in the correct directory:
```bash
cd Hydra-termux
ls -la
```

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest new features
- Submit pull requests

## 📄 License

This project is open source. Please use responsibly and only on systems you have permission to test.

## ⚠️ Disclaimer

This tool is for educational and authorized testing purposes only. Unauthorized access to computer systems is illegal. The developers assume no liability for misuse.

## 🙏 Credits

Based on the original work from [cyrushar/Hydra-Termux](https://github.com/cyrushar/Hydra-Termux)

## 📞 Support

If you encounter any issues, please open an issue on GitHub.

---

**Made with ❤️ for the Termux community**