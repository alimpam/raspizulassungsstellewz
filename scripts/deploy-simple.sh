#!/bin/bash

# Deploy Script mit automatischer Passwort-Eingabe
# Lädt Konfiguration aus .env.deploy

set -e

# Lade Konfiguration aus .env.deploy
if [ -f ".env.deploy" ]; then
    export $(grep -v '^#' .env.deploy | xargs)
    echo "✅ Configuration loaded from .env.deploy"
else
    echo "❌ .env.deploy file not found!"
    echo "Please create .env.deploy with:"
    echo "PI_HOST=192.168.178.73"
    echo "PI_USER=apexpam"
    echo "PI_PASSWORD=your_password"
    echo "PI_PATH=/home/apexpam/repos"
    echo "APP_NAME=raspizulassungsstellewz"
    exit 1
fi

# Verwende Variablen aus .env.deploy
REMOTE_HOST="$PI_HOST"
REMOTE_USER="$PI_USER"
REMOTE_PATH="$PI_PATH"
APP_NAME="$APP_NAME"

echo "🚀 Deploying App to Raspberry Pi..."
echo "📡 Target: $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/$APP_NAME"

# Prüfe Voraussetzungen
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run from project root."
    exit 1
fi

# Prüfe ob sshpass verfügbar ist
if ! command -v sshpass &> /dev/null; then
    echo "⚠️  sshpass not found. Install with: brew install sshpass"
    echo "💡 Falling back to interactive mode..."
    SSH_PREFIX=""
    RSYNC_PREFIX=""
else
    echo "✅ Using sshpass for automatic authentication"
    SSH_PREFIX="sshpass -p '$PI_PASSWORD'"
    RSYNC_PREFIX="sshpass -p '$PI_PASSWORD'"
fi

# Erstelle Zielverzeichnis
echo "📁 Creating remote directory..."
$SSH_PREFIX ssh "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p ${REMOTE_PATH}"

# Stoppe App falls läuft
echo "⏹️  Stopping existing app..."
$SSH_PREFIX ssh "${REMOTE_USER}@${REMOTE_HOST}" "pkill -f 'node.*index.js' || true"

# Kopiere Dateien (ohne node_modules)
echo "📂 Copying files..."
$RSYNC_PREFIX rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.DS_Store' \
    --exclude '*.log' \
    --exclude 'deploy*.sh' \
    ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/${APP_NAME}/"

# Installiere und starte
echo "🔧 Installing dependencies and starting..."
$SSH_PREFIX ssh "${REMOTE_USER}@${REMOTE_HOST}" "
    cd ${REMOTE_PATH}/${APP_NAME}
    npm install --production
    cp .env.pi .env 2>/dev/null || echo 'Using default environment'
    nohup node index.js > app.log 2>&1 &
    echo '✅ App started!'
"

echo "🎉 Deploy completed!"
echo "🌐 URL: http://192.168.178.73:8080"
