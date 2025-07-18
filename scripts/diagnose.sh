#!/bin/bash

# Diagnose Script für Raspberry Pi

# Lade Konfiguration
if [ -f ".env.deploy" ]; then
    export $(grep -v '^#' .env.deploy | xargs)
    HOST="$PI_HOST"
    USER="$PI_USER"
    REMOTE_PATH="$PI_PATH/$APP_NAME"
    
    # Setup SSH command
    if command -v sshpass &> /dev/null; then
        SSH_CMD="sshpass -p $PI_PASSWORD ssh"
    else
        SSH_CMD="ssh"
    fi
else
    echo "❌ .env.deploy not found. Using defaults..."
    HOST="192.168.178.73"
    USER="apexpam"
    REMOTE_PATH="/home/apexpam/repos/raspizulassungsstellewz"
    SSH_CMD="ssh"
fi

echo "🔍 Raspberry Pi Diagnose..."
echo "=========================="

# Prüfe SSH-Verbindung
echo "📡 Testing SSH connection..."
if $SSH_CMD -o ConnectTimeout=5 $USER@$HOST "echo 'SSH OK'" 2>/dev/null; then
    echo "✅ SSH connection successful"
else
    echo "❌ SSH connection failed"
    exit 1
fi

# Prüfe App-Prozess
echo ""
echo "🔍 Checking app process..."
APP_PID=$($SSH_CMD $USER@$HOST "pgrep -f 'node.*index.js'" 2>/dev/null)
if [ -n "$APP_PID" ]; then
    echo "✅ App is running (PID: $APP_PID)"
else
    echo "❌ App is not running"
fi

# Prüfe Port 8080
echo ""
echo "🌐 Checking port 8080..."
if $SSH_CMD $USER@$HOST "netstat -tuln | grep :8080" 2>/dev/null; then
    echo "✅ Port 8080 is listening"
else
    echo "❌ Port 8080 is not listening"
fi

# Prüfe Logs
echo ""
echo "📋 Recent logs (last 10 lines):"
echo "--------------------------------"
$SSH_CMD $USER@$HOST "tail -10 $REMOTE_PATH/app.log 2>/dev/null || echo 'No logs found'"

# Teste HTTP-Verbindung
echo ""
echo "🌐 Testing HTTP connection..."
if curl -s --connect-timeout 5 http://$HOST:8080 > /dev/null; then
    echo "✅ HTTP connection successful"
    echo "🎉 App is accessible at: http://$HOST:8080"
else
    echo "❌ HTTP connection failed"
    echo "💡 Try restarting the app:"
    echo "   ssh $USER@$HOST 'cd $REMOTE_PATH && node index.js'"
fi

echo ""
echo "🔧 Useful commands:"
echo "   View logs:    ssh $USER@$HOST 'tail -f $REMOTE_PATH/app.log'"
echo "   Stop app:     ssh $USER@$HOST 'pkill -f \"node.*index.js\"'"
echo "   Start app:    ssh $USER@$HOST 'cd $REMOTE_PATH && nohup node index.js > app.log 2>&1 &'"
echo "   Connect SSH:  ssh $USER@$HOST"
