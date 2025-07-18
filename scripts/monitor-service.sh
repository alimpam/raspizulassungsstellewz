#!/bin/bash

# Service Monitoring Script
# Überwacht den Status der App auf dem Raspberry Pi

# Lade Konfiguration aus .env.deploy
if [ -f .env.deploy ]; then
    export $(grep -v '^#' .env.deploy | xargs)
    HOST=$PI_HOST
    USER=$PI_USER
    PASSWORD=$PI_PASSWORD
    APP_NAME=$APP_NAME
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

# Funktionen für verschiedene Aktionen
show_status() {
    echo "📊 Service Status:"
    $SSH_CMD $USER@$HOST "sudo systemctl status $APP_NAME --no-pager"
}

show_logs() {
    echo "📋 Recent Logs (last 20 lines):"
    $SSH_CMD $USER@$HOST "sudo journalctl -u $APP_NAME -n 20 --no-pager"
}

follow_logs() {
    echo "📋 Following logs (Ctrl+C to stop):"
    $SSH_CMD $USER@$HOST "sudo journalctl -u $APP_NAME -f"
}

restart_service() {
    echo "🔄 Restarting service..."
    $SSH_CMD $USER@$HOST "sudo systemctl restart $APP_NAME"
    echo "✅ Service restarted"
    show_status
}

stop_service() {
    echo "⏹️ Stopping service..."
    $SSH_CMD $USER@$HOST "sudo systemctl stop $APP_NAME"
    echo "✅ Service stopped"
}

start_service() {
    echo "▶️ Starting service..."
    $SSH_CMD $USER@$HOST "sudo systemctl start $APP_NAME"
    echo "✅ Service started"
    show_status
}

test_monitoring() {
    echo "🧪 Testing monitoring endpoint..."
    curl -X POST http://$HOST:8080/api/monitoring/start \
         -H 'Content-Type: application/json' \
         -d '{}' \
         --max-time 10 \
         --silent \
         --show-error
    echo ""
}

show_system_info() {
    echo "🖥️ System Information:"
    $SSH_CMD $USER@$HOST "
        echo 'Uptime:' && uptime
        echo 'Memory:' && free -h
        echo 'Disk Space:' && df -h | grep -E '(Filesystem|/dev/root)'
        echo 'CPU Temperature:' && vcgencmd measure_temp 2>/dev/null || echo 'N/A'
    "
}

# Hauptmenü
case "${1:-}" in
    "status"|"s")
        show_status
        ;;
    "logs"|"l")
        show_logs
        ;;
    "follow"|"f")
        follow_logs
        ;;
    "restart"|"r")
        restart_service
        ;;
    "stop")
        stop_service
        ;;
    "start")
        start_service
        ;;
    "test"|"t")
        test_monitoring
        ;;
    "info"|"i")
        show_system_info
        ;;
    "help"|"h"|*)
        echo "🔧 $APP_NAME Service Monitor"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  status, s    - Show service status"
        echo "  logs, l      - Show recent logs"
        echo "  follow, f    - Follow logs in real-time"
        echo "  restart, r   - Restart the service"
        echo "  start        - Start the service"
        echo "  stop         - Stop the service"
        echo "  test, t      - Test monitoring endpoint"
        echo "  info, i      - Show system information"
        echo "  help, h      - Show this help"
        echo ""
        echo "Examples:"
        echo "  $0 status    # Quick status check"
        echo "  $0 follow    # Watch logs live"
        echo "  $0 restart   # Restart if issues"
        ;;
esac
