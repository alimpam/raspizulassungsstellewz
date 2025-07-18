#!/bin/bash

# Deploy Script für Raspberry Pi Terminüberwachung
# Kopiert die App per SCP auf den Raspberry Pi

set -e  # Exit on any error

# Lade Konfiguration aus .env.deploy
if [ -f .env.deploy ]; then
    echo "📋 Lade Konfiguration aus .env.deploy..."
    export $(grep -v '^#' .env.deploy | xargs)
    REMOTE_HOST=$PI_HOST
    REMOTE_USER=$PI_USER
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

LOCAL_PATH="$(pwd)"

echo "🚀 Deploying Terminüberwachung App to Raspberry Pi..."
echo "📍 Target: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/${APP_NAME}"

# Prüfe ob wir im richtigen Verzeichnis sind
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Erstelle ein temporäres Verzeichnis für den Upload
TEMP_DIR=$(mktemp -d)
echo "📦 Creating deployment package..."

# Kopiere Dateien (ohne node_modules und andere unnötige Dateien)
rsync -av --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.DS_Store' \
    --exclude '*.log' \
    --exclude 'deploy.sh' \
    --exclude 'README.md' \
    "${LOCAL_PATH}/" "${TEMP_DIR}/"

echo "📡 Connecting to Raspberry Pi..."

# Erstelle das Zielverzeichnis falls es nicht existiert
$SSH_CMD "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p ${REMOTE_PATH}"

# Stoppe die App falls sie läuft
echo "⏹️  Stopping existing app (if running)..."
$SSH_CMD "${REMOTE_USER}@${REMOTE_HOST}" "
    cd ${REMOTE_PATH}/${APP_NAME} 2>/dev/null && pkill -f 'node.*index.js' 2>/dev/null || true
" || true

# Kopiere die Dateien
echo "📂 Copying files to Raspberry Pi..."
$SCP_CMD -r "${TEMP_DIR}/" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/${APP_NAME}"

# Installiere Dependencies und starte die App
echo "📦 Installing dependencies and starting app..."
$SSH_CMD "${REMOTE_USER}@${REMOTE_HOST}" "
    cd ${REMOTE_PATH}/${APP_NAME}
    
    echo '🔧 Installing Node.js dependencies...'
    npm install --production
    
    echo '⚙️ Setting up environment...'
    cp .env.pi .env
    
    echo '🚀 Starting the application...'
    nohup npm start > app.log 2>&1 &
    
    echo '✅ App deployed and started!'
    echo '📍 The app should be available at: http://${REMOTE_HOST}:8080'
    echo '📋 Log file: ${REMOTE_PATH}/${APP_NAME}/app.log'
"

# Cleanup
rm -rf "${TEMP_DIR}"

echo ""
echo "🎉 Deployment completed successfully!"
echo "🌐 App URL: http://${REMOTE_HOST}:8080"
echo "📁 Remote path: ${REMOTE_PATH}/${APP_NAME}"
echo ""
echo "📋 Useful commands:"
echo "   Check logs: $SSH_CMD ${REMOTE_USER}@${REMOTE_HOST} 'tail -f ${REMOTE_PATH}/${APP_NAME}/app.log'"
echo "   Stop app:   $SSH_CMD ${REMOTE_USER}@${REMOTE_HOST} 'pkill -f \"node.*index.js\"'"
echo "   Restart:    $SSH_CMD ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_PATH}/${APP_NAME} && npm start'"
