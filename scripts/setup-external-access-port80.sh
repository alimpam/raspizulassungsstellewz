#!/bin/bash

# External Access Setup für Port 80
# Alternative zu Port 8080 falls ISP blockiert

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

DDNS_DOMAIN="alimspi.ddns.net"
NEW_PORT="80"

echo "🌍 Setting up external access on PORT 80..."
echo "🔗 Domain: $DDNS_DOMAIN"
echo "🔌 New Port: $NEW_PORT"

$SSH_CMD $USER@$HOST "
    echo '🔧 Configuring app for port 80...'
    cd /home/$USER/repos/$APP_NAME
    
    # Update .env.pi for port 80
    sed 's/PORT=8080/PORT=80/' .env.pi > .env.pi.new
    mv .env.pi.new .env.pi
    
    echo '📋 Updated configuration:'
    grep PORT .env.pi
    
    echo ''
    echo '🔄 Restarting app service...'
    sudo systemctl restart $APP_NAME
    
    echo '⏳ Waiting for app to start...'
    sleep 5
    
    echo '📊 Service status:'
    sudo systemctl status $APP_NAME --no-pager | grep Active
    
    echo ''
    echo '🔍 Checking if app is listening on port 80:'
    sudo netstat -tlnp | grep :80
    
    echo ''
    echo '🔐 Updating firewall for port 80:'
    sudo ufw allow 80/tcp
    sudo ufw status | grep 80
"

echo ""
echo "✅ Port 80 setup completed!"
echo ""
echo "🔧 IMPORTANT: Update your Fritz!Box port forwarding:"
echo "   1. Change external port from 8080 to 80"
echo "   2. Keep internal port as 80"
echo "   3. Save and apply changes"
echo ""
echo "🌍 New external URLs:"
echo "   • Web Interface: http://$DDNS_DOMAIN"
echo "   • API: http://$DDNS_DOMAIN/api"
echo "   • Direct IP: http://93.237.19.141"
echo ""
echo "🧪 Test commands:"
echo "   curl http://$DDNS_DOMAIN/"
echo "   curl http://93.237.19.141/"
