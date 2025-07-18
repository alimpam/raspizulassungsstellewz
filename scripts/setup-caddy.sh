#!/bin/bash

# Caddy HTTPS Reverse Proxy Setup für Raspberry Pi
# Stellt die App über HTTPS zur Verfügung

set -e

# Lade Konfiguration aus .env.deploy
if [ -f .env.deploy ]; then
    echo "📋 Lade Konfiguration aus .env.deploy..."
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

# Prüfe ob sshpass verfügbar ist
if command -v sshpass &> /dev/null; then
    export SSHPASS=$PASSWORD
    SSH_CMD="sshpass -e ssh"
    SCP_CMD="sshpass -e scp"
    echo "🔐 Verwende sshpass für automatische Authentifizierung"
else
    SSH_CMD="ssh"
    SCP_CMD="scp"
    echo "⚠️  sshpass nicht installiert - manuelle Passwort-Eingabe erforderlich"
fi

echo "🚀 Setting up Caddy HTTPS Reverse Proxy..."

# Erstelle Caddyfile lokal
cat > Caddyfile << EOF
# Caddy Konfiguration für Terminüberwachung
# HTTPS Reverse Proxy für Node.js App

{
    # Global options
    auto_https off
    local_certs
}

# HTTPS Server für lokale Entwicklung
https://$HOST:443 {
    # Selbstsigniertes Zertifikat für lokale IP
    tls internal
    
    # Reverse Proxy zur Node.js App
    reverse_proxy localhost:8080
    
    # Logs
    log {
        output file /var/log/caddy/access.log
        format json
    }
    
    # Zusätzliche Header für bessere Sicherheit
    header {
        # Security headers
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        
        # CORS headers für API
        Access-Control-Allow-Origin "*"
        Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
        Access-Control-Allow-Headers "Content-Type, Authorization"
    }
    
    # Handle preflight requests
    @options method OPTIONS
    respond @options 204
}

# HTTP redirect to HTTPS
http://$HOST:80 {
    redir https://$HOST:443{uri}
}
EOF

echo "📄 Caddyfile erstellt:"
cat Caddyfile

# Kopiere Caddyfile zum Pi
echo "📂 Kopiere Caddyfile zum Raspberry Pi..."
$SCP_CMD Caddyfile $USER@$HOST:$REMOTE_PATH/$APP_NAME/

# Installiere und konfiguriere Caddy auf dem Pi
echo "📦 Installiere Caddy auf Raspberry Pi..."
$SSH_CMD $USER@$HOST "
    echo '🔧 Installiere Caddy...'
    
    # Caddy Repository hinzufügen
    sudo apt update
    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    
    # Caddy installieren
    sudo apt update
    sudo apt install -y caddy
    
    echo '⚙️ Konfiguriere Caddy...'
    
    # Stoppe Caddy Service
    sudo systemctl stop caddy
    
    # Erstelle Log-Verzeichnis
    sudo mkdir -p /var/log/caddy
    sudo chown caddy:caddy /var/log/caddy
    
    # Kopiere Caddyfile
    sudo cp $REMOTE_PATH/$APP_NAME/Caddyfile /etc/caddy/Caddyfile
    sudo chown root:root /etc/caddy/Caddyfile
    sudo chmod 644 /etc/caddy/Caddyfile
    
    # Teste Caddyfile Syntax
    sudo caddy validate --config /etc/caddy/Caddyfile
    
    echo '🚀 Starte Services...'
    
    # Stelle sicher, dass die Node.js App läuft
    cd $REMOTE_PATH/$APP_NAME
    pkill -f 'node.*index.js' || true
    cp .env.pi .env
    nohup node index.js > app.log 2>&1 &
    sleep 2
    
    # Starte Caddy
    sudo systemctl enable caddy
    sudo systemctl start caddy
    
    # Status prüfen
    sleep 3
    sudo systemctl status caddy --no-pager -l
    
    echo '✅ Caddy HTTPS Setup abgeschlossen!'
    echo '🔐 HTTPS URL: https://$HOST'
    echo '🔓 HTTP Redirect: http://$HOST -> https://$HOST'
    echo '📋 Node.js App läuft auf: http://localhost:8080'
"

# Cleanup lokale Dateien
rm -f Caddyfile

echo ""
echo "🎉 Caddy HTTPS Setup completed successfully!"
echo ""
echo "🔐 HTTPS URL: https://$HOST"
echo "🔓 HTTP URL:  http://$HOST (redirects to HTTPS)"
echo "📋 Node.js:   http://$HOST:8080 (direct access)"
echo ""
echo "📋 Nützliche Befehle:"
echo "   Caddy Status:   $SSH_CMD $USER@$HOST 'sudo systemctl status caddy'"
echo "   Caddy Logs:     $SSH_CMD $USER@$HOST 'sudo journalctl -u caddy -f'"
echo "   Caddy Reload:   $SSH_CMD $USER@$HOST 'sudo systemctl reload caddy'"
echo "   Caddy Stop:     $SSH_CMD $USER@$HOST 'sudo systemctl stop caddy'"
echo ""
echo "⚠️  Hinweis: Da es sich um ein selbstsigniertes Zertifikat handelt,"
echo "    wird der Browser eine Sicherheitswarnung anzeigen."
echo "    Klicke auf 'Erweitert' -> 'Fortfahren zu $HOST (unsicher)'"
