#!/bin/bash

# Puppeteer ARM64 Fix für Raspberry Pi
# Installiert Chromium für ARM64 und konfiguriert Puppeteer korrekt

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

echo "🔧 Fixing Puppeteer for ARM64 Raspberry Pi..."

# Fix Puppeteer auf dem Pi
$SSH_CMD $USER@$HOST "
    echo '🧹 Cleaning up existing Puppeteer Chrome...'
    rm -rf ~/.cache/puppeteer
    
    echo '📦 Installing Chromium for ARM64...'
    sudo apt update
    sudo apt install -y chromium-browser chromium-codecs-ffmpeg
    
    echo '🔍 Finding Chromium path...'
    CHROMIUM_PATH=\$(which chromium-browser || which chromium || echo '/usr/bin/chromium-browser')
    echo \"Chromium found at: \$CHROMIUM_PATH\"
    
    echo '⚙️ Creating Puppeteer environment config...'
    cd $REMOTE_PATH/$APP_NAME
    
    # Erstelle .puppeteerrc.cjs für ARM64 Konfiguration
    cat > .puppeteerrc.cjs << 'EOF'
const {join} = require('path');

/**
 * @type {import(\"puppeteer\").Configuration}
 */
module.exports = {
  // Use system Chromium instead of downloading
  skipDownload: true,
  executablePath: '/usr/bin/chromium-browser',
};
EOF

    echo '📋 Created .puppeteerrc.cjs:'
    cat .puppeteerrc.cjs
    
    echo '🧪 Testing Chromium...'
    \$CHROMIUM_PATH --version || echo '⚠️ Chromium version check failed'
    
    echo '🔄 Restarting app with new Puppeteer config...'
    pkill -f 'node.*index.js' || true
    cp .env.pi .env
    nohup node index.js > app.log 2>&1 &
    
    echo '✅ Puppeteer ARM64 fix completed!'
    echo '📋 Chromium path: '\$CHROMIUM_PATH
"

echo ""
echo "🎉 Puppeteer ARM64 fix completed!"
echo "🤖 Chromium wird jetzt direkt vom System verwendet"
echo "🔧 .puppeteerrc.cjs wurde erstellt für ARM64 Kompatibilität"
echo ""
echo "🧪 Test the monitoring now:"
echo "   curl -X POST http://$HOST:8080/api/monitoring/start -H 'Content-Type: application/json' -d '{}'"
