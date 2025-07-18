#!/bin/bash

# Komplettes Deployment auf Raspberry Pi
# Kopiert den GESAMTEN Ordner 1:1 auf den Pi

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

# SSH Setup mit einfachen Anführungszeichen
export SSHPASS="$PASSWORD"

echo "🚀 Komplettes Deployment auf Raspberry Pi..."
echo "📍 Target: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/${APP_NAME}"

# Prüfe ob wir im richtigen Verzeichnis sind
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root directory."
    exit 1
fi

echo "⏹️  Stoppe Service falls er läuft..."
sshpass -e ssh $REMOTE_USER@$REMOTE_HOST 'sudo systemctl stop raspizulassungsstellewz' || true
sshpass -e ssh $REMOTE_USER@$REMOTE_HOST 'pkill -f "node.*index.js"' || true

echo "🗑️  Lösche KOMPLETTES altes Verzeichnis..."
sshpass -e ssh $REMOTE_USER@$REMOTE_HOST "
    if [ -d '${REMOTE_PATH}/${APP_NAME}' ]; then
        echo '🔥 Lösche: ${REMOTE_PATH}/${APP_NAME}'
        rm -rf '${REMOTE_PATH}/${APP_NAME}'
        echo '✅ Verzeichnis gelöscht'
    else
        echo '📁 Verzeichnis existiert noch nicht'
    fi
"

echo "📁 Erstelle NEUES Zielverzeichnis..."
sshpass -e ssh $REMOTE_USER@$REMOTE_HOST "mkdir -p ${REMOTE_PATH}"

echo "🧹 Säubere eventuell übrig gebliebene Prozesse..."
sshpass -e ssh $REMOTE_USER@$REMOTE_HOST 'sudo fuser -k 8080/tcp' || true

echo "📦 Kopiere KOMPLETTEN Ordner..."
# Verwende rsync für vollständige Synchronisation
rsync -avz --progress --delete \
    --exclude '.git/' \
    --exclude '.DS_Store' \
    --exclude 'node_modules/' \
    --exclude '*.log' \
    ./ $REMOTE_USER@$REMOTE_HOST:${REMOTE_PATH}/${APP_NAME}/

echo "📦 Installiere Dependencies..."
sshpass -e ssh $REMOTE_USER@$REMOTE_HOST "
    cd ${REMOTE_PATH}/${APP_NAME}
    
    echo '🔧 Installing Node.js dependencies...'
    npm install --production
    
    echo '⚙️  Setting up environment...'
    if [ -f .env.pi ]; then
        cp .env.pi .env
        echo '✅ .env.pi copied to .env'
    else
        echo '⚠️  .env.pi not found, creating basic .env'
        echo 'PORT=8080' > .env
        echo 'HOST=0.0.0.0' >> .env
        echo 'NODE_ENV=production' >> .env
    fi
    
    echo '🚀 Starting the application...'
    nohup npm start > app.log 2>&1 &
    
    echo '⏳ Waiting for app to start...'
    sleep 3
    
    echo '✅ App deployed and started!'
"

echo ""
echo "🎉 Komplettes Deployment erfolgreich abgeschlossen!"
echo "🌐 App URL: http://${REMOTE_HOST}:8080"
echo "📁 Remote path: ${REMOTE_PATH}/${APP_NAME}"
echo ""
echo "🧪 Test der App:"
echo "   curl http://${REMOTE_HOST}:8080/"
echo ""
echo "📋 Nützliche Befehle:"
echo "   Logs anzeigen: sshpass -e ssh ${REMOTE_USER}@${REMOTE_HOST} 'tail -f ${REMOTE_PATH}/${APP_NAME}/app.log'"
echo "   App stoppen:   sshpass -e ssh ${REMOTE_USER}@${REMOTE_HOST} 'pkill -f \"node.*index.js\"'"
echo "   Service-Status: sshpass -e ssh ${REMOTE_USER}@${REMOTE_HOST} 'sudo systemctl status raspizulassungsstellewz'"
echo ""
echo "🔄 Restart Service (falls eingerichtet):"
echo "   sshpass -e ssh ${REMOTE_USER}@${REMOTE_HOST} 'sudo systemctl restart raspizulassungsstellewz'"
