#!/bin/bash

# External Access Setup für DDNS
# Konfiguriert die App für externen Zugriff über alimspi.ddns.net

# Lade Konfiguration aus .env.deploy
if [ -f .env.deploy ]; then
    export $(grep -v '^#' .env.deploy | xargs)
    HOST=$PI_HOST
    USER=$PI_USER
    PASSWORD=$PI_PASSWORD
    APP_NAME=$APP_NAME
else
    echo "❌ .env.deploy nicht gefunden!"
    exit 1
fi

# SSH Command Setup
if command -v sshpass &> /dev/null; then
    export SSHPASS=$PASSWORD
    SSH_CMD="sshpass -e ssh"
else
    SSH_CMD="ssh"
fi

# DDNS Configuration
DDNS_DOMAIN="alimspi.ddns.net"
EXTERNAL_PORT="8080"

echo "🌍 Setting up external access via DDNS..."
echo "🔗 Domain: $DDNS_DOMAIN"
echo "🔌 Port: $EXTERNAL_PORT"

$SSH_CMD $USER@$HOST "
    echo '🔧 Configuring app for external access...'
    cd /home/$USER/repos/$APP_NAME
    
    # Update .env.pi for external access
    cat > .env.pi << 'EOF'
# Raspberry Pi Konfiguration für Terminüberwachung - External Access

# Server-Konfiguration
PORT=8080
HOST=0.0.0.0
LOG_LEVEL=info
NODE_ENV=development

# External Access Configuration
EXTERNAL_DOMAIN=$DDNS_DOMAIN
EXTERNAL_PORT=$EXTERNAL_PORT

# CORS Configuration for external access
CORS_ORIGINS=http://$DDNS_DOMAIN:$EXTERNAL_PORT,http://localhost:8080,http://192.168.178.73:8080

# E-Mail-Benachrichtigungen (optional)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
# SMTP_FROM=your-email@gmail.com
# NOTIFICATION_EMAIL=recipient@example.com

# Telegram-Benachrichtigungen (optional)
# TELEGRAM_BOT_TOKEN=your-bot-token
# TELEGRAM_CHAT_ID=your-chat-id

# Discord-Benachrichtigungen (optional)
# DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url
EOF

    echo '📋 Updated .env.pi:'
    cat .env.pi
    
    echo ''
    echo '🔄 Restarting app service...'
    sudo systemctl restart $APP_NAME
    
    echo '⏳ Waiting for app to start...'
    sleep 5
    
    echo '📊 Service status:'
    sudo systemctl status $APP_NAME --no-pager
    
    echo ''
    echo '🔍 Checking if app is listening on all interfaces:'
    sudo netstat -tlnp | grep :8080
    
    echo ''
    echo '🧪 Testing local access:'
    curl -s http://localhost:8080/ | head -n 3 || echo 'Local test failed'
    
    echo ''
    echo '🔐 Checking firewall status:'
    sudo ufw status || echo 'UFW not installed/configured'
    
    echo ''
    echo '📡 Current public IP (for verification):'
    curl -s ifconfig.me || echo 'Could not get public IP'
"

echo ""
echo "✅ External access setup completed!"
echo ""
echo "🌍 Your monitoring system is now accessible from anywhere at:"
echo "   🔗 External URL: http://$DDNS_DOMAIN:$EXTERNAL_PORT"
echo "   🏠 Internal URL: http://$HOST:8080"
echo ""
echo "📋 Access URLs:"
echo "   • Web Interface: http://$DDNS_DOMAIN:$EXTERNAL_PORT"
echo "   • API Documentation: http://$DDNS_DOMAIN:$EXTERNAL_PORT/api"
echo "   • Start Monitoring: curl -X POST http://$DDNS_DOMAIN:$EXTERNAL_PORT/api/monitoring/start"
echo ""
echo "🔒 Security Recommendations:"
echo "   • Consider setting up basic authentication"
echo "   • Monitor access logs regularly"
echo "   • Use HTTPS with Let's Encrypt in the future"
echo ""
echo "🧪 Test external access:"
echo "   curl http://$DDNS_DOMAIN:$EXTERNAL_PORT/"
echo ""
echo "🛠️ Troubleshooting:"
echo "   • Verify Fritz!Box port forwarding is active"
echo "   • Check if DDNS is resolving: nslookup $DDNS_DOMAIN"
echo "   • Ensure Pi firewall allows port 8080"
echo "   • Test from mobile network (not your home WiFi)"
