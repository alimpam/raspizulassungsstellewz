#!/bin/bash

# HTTP-Setup für Raspberry Pi (ohne HTTPS-Komplikationen)
# Richtet die App so ein, dass sie über http://192.168.178.73 erreichbar ist

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

echo "🌐 Setting up HTTP access for $APP_NAME..."

$SSH_CMD $USER@$HOST "
    echo '🛑 Stopping conflicting services...'
    sudo systemctl stop caddy 2>/dev/null || true
    sudo systemctl disable caddy 2>/dev/null || true
    
    echo '🔧 Configuring app for HTTP access...'
    cd /home/$USER/repos/$APP_NAME
    
    # Ensure .env.pi exists with correct config
    cat > .env.pi << 'EOF'
# Raspberry Pi Konfiguration für Terminüberwachung

# Server-Konfiguration
PORT=8080
HOST=0.0.0.0
LOG_LEVEL=info
NODE_ENV=development

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

    echo '🔄 Restarting app service...'
    sudo systemctl restart $APP_NAME
    
    echo '⏳ Waiting for app to start...'
    sleep 5
    
    echo '📊 Service status:'
    sudo systemctl status $APP_NAME --no-pager
    
    echo ''
    echo '🧪 Testing app locally:'
    curl -s http://localhost:8080/ | head -n 5
    
    echo ''
    echo '🔍 Port status:'
    sudo netstat -tlnp | grep 8080
"

echo ""
echo "✅ HTTP setup completed!"
echo ""
echo "🌐 Your monitoring system is now available at:"
echo "   http://$HOST:8080"
echo ""
echo "📋 Direct access URLs:"
echo "   • Web Interface: http://$HOST:8080"
echo "   • API Documentation: http://$HOST:8080/api"
echo "   • Start Monitoring: curl -X POST http://$HOST:8080/api/monitoring/start"
echo ""
echo "💡 Troubleshooting:"
echo "   • If the frontend shows errors, hard refresh (Ctrl+F5)"
echo "   • Clear browser cache for this site"
echo "   • Make sure to use HTTP (not HTTPS) URLs"
echo ""
echo "🧪 Test the monitoring:"
echo "   curl -X POST http://$HOST:8080/api/monitoring/start -H 'Content-Type: application/json' -d '{}'"
