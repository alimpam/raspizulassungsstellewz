#!/bin/bash

# Auto-Start Setup für Raspberry Pi
# Installiert systemd Service für automatischen Start und Neustart bei Crashes

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

echo "🚀 Setting up auto-start for $APP_NAME on Raspberry Pi..."

# Setup systemd service auf dem Pi
$SSH_CMD $USER@$HOST "
    echo '📝 Creating systemd service file...'
    
    # Erstelle systemd service file
    sudo tee /etc/systemd/system/$APP_NAME.service > /dev/null << EOF
[Unit]
Description=$APP_NAME - Appointment Monitoring Service
Documentation=https://github.com/yourusername/$APP_NAME
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$REMOTE_PATH/$APP_NAME
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
ExecStartPre=/bin/bash -c 'cd $REMOTE_PATH/$APP_NAME && cp .env.pi .env'
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
KillMode=mixed
KillSignal=SIGINT
TimeoutStopSec=20
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$APP_NAME

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$REMOTE_PATH/$APP_NAME
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF

    echo '🔧 Configuring systemd service...'
    
    # Stoppe eventuell laufende Instanz
    pkill -f 'node.*index.js' || true
    
    # Reload systemd und enable service
    sudo systemctl daemon-reload
    sudo systemctl enable $APP_NAME.service
    
    echo '🎯 Starting service...'
    sudo systemctl start $APP_NAME.service
    
    echo '📊 Service status:'
    sudo systemctl status $APP_NAME.service --no-pager
    
    echo ''
    echo '📋 Service management commands:'
    echo '   sudo systemctl status $APP_NAME     # Status anzeigen'
    echo '   sudo systemctl start $APP_NAME      # Service starten'
    echo '   sudo systemctl stop $APP_NAME       # Service stoppen'
    echo '   sudo systemctl restart $APP_NAME    # Service neustarten'
    echo '   sudo journalctl -u $APP_NAME -f     # Live logs anzeigen'
    echo '   sudo journalctl -u $APP_NAME --since today  # Logs von heute'
"

echo ""
echo "✅ Auto-start setup completed!"
echo "🔄 Die App startet jetzt automatisch:"
echo "   • Bei System-Neustarts"
echo "   • Bei App-Crashes (nach 10 Sekunden)"
echo "   • Mit systemd Service Management"
echo ""
echo "🧪 Test the service:"
echo "   $SSH_CMD $USER@$HOST 'sudo systemctl status $APP_NAME'"
echo ""
echo "📋 View logs:"
echo "   $SSH_CMD $USER@$HOST 'sudo journalctl -u $APP_NAME -f'"
