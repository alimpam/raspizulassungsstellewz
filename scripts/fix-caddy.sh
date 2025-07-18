#!/bin/bash

# Caddy Fix und vereinfachte Konfiguration
# Behebt Permission-Probleme und startet Caddy neu

# Lade Konfiguration aus .env.deploy
if [ -f .env.deploy ]; then
    export $(grep -v '^#' .env.deploy | xargs)
    HOST=$PI_HOST
    USER=$PI_USER
    PASSWORD=$PI_PASSWORD
    REMOTE_PATH=$PI_PATH
    APP_NAME=$APP_NAME
else
    echo "❌ .env.deploy nicht gefunden!"
    exit 1
fi

# SSH Command Setup
if command -v sshpass &> /dev/null; then
    export SSHPASS=$PASSWORD
    SSH_CMD="sshpass -e ssh"
    SCP_CMD="sshpass -e scp"
else
    SSH_CMD="ssh"
    SCP_CMD="scp"
fi

echo "🔧 Fixing Caddy configuration..."

# Erstelle vereinfachte Caddyfile ohne Log-Probleme
cat > Caddyfile << EOF
# Caddy Konfiguration für Terminüberwachung (vereinfacht)
{
    auto_https off
    local_certs
}

# HTTPS Server für lokale Entwicklung
https://$HOST:443 {
    tls internal
    reverse_proxy localhost:8080
    
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        Access-Control-Allow-Origin "*"
        Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
        Access-Control-Allow-Headers "Content-Type, Authorization"
    }
    
    @options method OPTIONS
    respond @options 204
}

# HTTP redirect to HTTPS
http://$HOST:80 {
    redir https://$HOST:443{uri}
}
EOF

echo "📂 Kopiere neue Caddyfile..."
$SCP_CMD Caddyfile $USER@$HOST:$REMOTE_PATH/$APP_NAME/

echo "🔧 Fixe Caddy Setup auf dem Pi..."
$SSH_CMD $USER@$HOST "
    # Stoppe Caddy
    sudo systemctl stop caddy
    
    # Fixe Log-Verzeichnis Permissions
    sudo mkdir -p /var/log/caddy
    sudo chown -R caddy:caddy /var/log/caddy
    sudo chmod 755 /var/log/caddy
    
    # Installiere neue Caddyfile
    sudo cp $REMOTE_PATH/$APP_NAME/Caddyfile /etc/caddy/Caddyfile
    sudo chown root:root /etc/caddy/Caddyfile
    sudo chmod 644 /etc/caddy/Caddyfile
    
    # Teste die Konfiguration
    echo '🧪 Teste Caddyfile...'
    sudo caddy validate --config /etc/caddy/Caddyfile
    
    # Starte Node.js App
    echo '🚀 Starte Node.js App...'
    cd $REMOTE_PATH/$APP_NAME
    pkill -f 'node.*index.js' || true
    cp .env.pi .env
    nohup node index.js > app.log 2>&1 &
    sleep 2
    
    # Starte Caddy
    echo '▶️ Starte Caddy...'
    sudo systemctl start caddy
    sleep 3
    
    # Status prüfen
    echo '📊 Status:'
    sudo systemctl status caddy --no-pager -l
"

# Cleanup
rm -f Caddyfile

echo ""
echo "🎉 Caddy Fix completed!"
echo "🔐 HTTPS URL: https://$HOST"
echo "🔓 HTTP URL:  http://$HOST (redirects to HTTPS)"
