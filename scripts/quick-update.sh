#!/bin/bash

# Quick Update Script - aktualisiert nur den Code ohne Dependencies

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

echo "🔄 Quick update for Raspberry Pi..."

# Stoppe App
echo "⏹️  Stopping application..."
$SSH_CMD $USER@$HOST "pkill -f 'node.*index.js' || true"

# Update nur die wichtigsten Dateien
echo "📂 Updating core files..."
$SCP_CMD src/app.js $USER@$HOST:$REMOTE_PATH/$APP_NAME/src/
$SCP_CMD .env.pi $USER@$HOST:$REMOTE_PATH/$APP_NAME/

# Setup environment und starte
echo "🚀 Restarting application..."
$SSH_CMD $USER@$HOST "
    cd $REMOTE_PATH/$APP_NAME
    cp .env.pi .env
    nohup node index.js > app.log 2>&1 &
    echo '✅ App restarted!'
"

echo "🎉 Quick update completed!"
echo "🌐 URL: http://$HOST:8080"
echo "🌐 URL: http://$HOST:8080"
