#!/bin/bash
# Installations- und Setup-Script für den systemd Service

APP_DIR="/home/apexpam/repos/raspizulassungsstellewz"
SERVICE_NAME="terminueberwachung"
SERVICE_FILE="$APP_DIR/scripts/$SERVICE_NAME.service"

echo "🚀 Installiere Terminüberwachung Service..."

# Prüfe ob als root ausgeführt
if [ "$EUID" -ne 0 ]; then
    echo "❌ Dieses Script muss als root ausgeführt werden"
    echo "Führe aus: sudo bash $APP_DIR/scripts/install-service.sh"
    exit 1
fi

# Prüfe ob Service-Datei existiert
if [ ! -f "$SERVICE_FILE" ]; then
    echo "❌ Service-Datei nicht gefunden: $SERVICE_FILE"
    exit 1
fi

# Erstelle Log-Verzeichnis
mkdir -p "$APP_DIR/src/logs"
chown apexpam:apexpam "$APP_DIR/src/logs"

# Mache Start-Script ausführbar
chmod +x "$APP_DIR/scripts/start-app.sh"
chown apexpam:apexpam "$APP_DIR/scripts/start-app.sh"

# Kopiere Service-Datei nach systemd
echo "📋 Kopiere Service-Datei..."
cp "$SERVICE_FILE" /etc/systemd/system/

# Lade systemd neu
echo "🔄 Lade systemd Konfiguration neu..."
systemctl daemon-reload

# Aktiviere Service für Autostart
echo "🔧 Aktiviere Service für Autostart..."
systemctl enable $SERVICE_NAME

# Starte Service
echo "▶️ Starte Service..."
systemctl start $SERVICE_NAME

# Status anzeigen
echo ""
echo "✅ Installation abgeschlossen!"
echo ""
echo "Service-Status:"
systemctl status $SERVICE_NAME --no-pager -l

echo ""
echo "📝 Verfügbare Befehle:"
echo "  Status:    sudo systemctl status $SERVICE_NAME"
echo "  Stoppen:   sudo systemctl stop $SERVICE_NAME"
echo "  Starten:   sudo systemctl start $SERVICE_NAME"
echo "  Neustart:  sudo systemctl restart $SERVICE_NAME"
echo "  Logs:      sudo journalctl -u $SERVICE_NAME -f"
echo "  App Logs:  tail -f $APP_DIR/src/logs/app.log"
