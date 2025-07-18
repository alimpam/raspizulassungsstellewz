#!/bin/bash

# Caddy Management Script
# Einfache Verwaltung von Caddy auf dem Raspberry Pi

# Lade Konfiguration aus .env.deploy
if [ -f .env.deploy ]; then
    export $(grep -v '^#' .env.deploy | xargs)
    HOST=$PI_HOST
    USER=$PI_USER
    PASSWORD=$PI_PASSWORD
else
    echo "❌ .env.deploy nicht gefunden!"
    exit 1
fi

# SSH Command Setup
if command -v sshpass &> /dev/null; then
    export SSHPASS=$PASSWORD
    SSH_CMD="sshpass -e ssh"
else
    SSH_CMD="ssh"
fi

# Funktion für Befehle
show_help() {
    echo "🔧 Caddy Management Script"
    echo ""
    echo "Verwendung: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  status    - Zeige Caddy Status"
    echo "  logs      - Zeige Caddy Logs (live)"
    echo "  restart   - Restart Caddy Service"
    echo "  stop      - Stoppe Caddy Service"
    echo "  start     - Starte Caddy Service"
    echo "  reload    - Reload Caddy Config"
    echo "  test      - Teste HTTPS Verbindung"
    echo "  remove    - Entferne Caddy komplett"
    echo ""
    echo "🔐 HTTPS URL: https://$HOST"
}

case "$1" in
    status)
        echo "📊 Caddy Status:"
        $SSH_CMD $USER@$HOST "sudo systemctl status caddy --no-pager -l"
        ;;
    logs)
        echo "📋 Caddy Logs (Ctrl+C zum Beenden):"
        $SSH_CMD $USER@$HOST "sudo journalctl -u caddy -f"
        ;;
    restart)
        echo "🔄 Restarting Caddy..."
        $SSH_CMD $USER@$HOST "sudo systemctl restart caddy && sleep 2 && sudo systemctl status caddy --no-pager"
        ;;
    stop)
        echo "⏹️ Stopping Caddy..."
        $SSH_CMD $USER@$HOST "sudo systemctl stop caddy"
        ;;
    start)
        echo "▶️ Starting Caddy..."
        $SSH_CMD $USER@$HOST "sudo systemctl start caddy && sleep 2 && sudo systemctl status caddy --no-pager"
        ;;
    reload)
        echo "🔄 Reloading Caddy Config..."
        $SSH_CMD $USER@$HOST "sudo systemctl reload caddy"
        ;;
    test)
        echo "🧪 Testing HTTPS Connection..."
        echo "Testing HTTP -> HTTPS redirect:"
        curl -I "http://$HOST" 2>/dev/null | head -3
        echo ""
        echo "Testing HTTPS (ignoring cert):"
        curl -I -k "https://$HOST" 2>/dev/null | head -3
        ;;
    remove)
        echo "⚠️  Removing Caddy completely..."
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            $SSH_CMD $USER@$HOST "
                sudo systemctl stop caddy
                sudo systemctl disable caddy
                sudo apt remove -y caddy
                sudo rm -f /etc/caddy/Caddyfile
                sudo rm -rf /var/log/caddy
                echo '✅ Caddy removed!'
            "
        fi
        ;;
    ""|help)
        show_help
        ;;
    *)
        echo "❌ Unknown command: $1"
        show_help
        exit 1
        ;;
esac
