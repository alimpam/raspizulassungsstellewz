#!/bin/bash

# Service Management Script
# Erweiterte Verwaltung des systemd Services

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

enable_service() {
    echo "✅ Enabling auto-start..."
    $SSH_CMD $USER@$HOST "sudo systemctl enable $APP_NAME.service"
    echo "Service wird jetzt automatisch beim Boot gestartet"
}

disable_service() {
    echo "❌ Disabling auto-start..."
    $SSH_CMD $USER@$HOST "sudo systemctl disable $APP_NAME.service"
    echo "Service startet nicht mehr automatisch beim Boot"
}

remove_service() {
    echo "🗑️ Removing service completely..."
    $SSH_CMD $USER@$HOST "
        sudo systemctl stop $APP_NAME.service
        sudo systemctl disable $APP_NAME.service
        sudo rm -f /etc/systemd/system/$APP_NAME.service
        sudo systemctl daemon-reload
    "
    echo "Service komplett entfernt"
}

show_service_config() {
    echo "📋 Service Configuration:"
    $SSH_CMD $USER@$HOST "cat /etc/systemd/system/$APP_NAME.service"
}

edit_service_config() {
    echo "✏️ Opening service config for editing..."
    echo "Run this command on the Pi to edit:"
    echo "sudo nano /etc/systemd/system/$APP_NAME.service"
    echo ""
    echo "After editing, reload with:"
    echo "sudo systemctl daemon-reload"
    echo "sudo systemctl restart $APP_NAME"
}

show_service_dependencies() {
    echo "🔗 Service Dependencies:"
    $SSH_CMD $USER@$HOST "
        echo 'Dependencies required by $APP_NAME:'
        systemctl list-dependencies $APP_NAME.service
        echo ''
        echo 'Services that depend on $APP_NAME:'
        systemctl list-dependencies --reverse $APP_NAME.service
    "
}

analyze_failures() {
    echo "🔍 Analyzing service failures..."
    $SSH_CMD $USER@$HOST "
        echo 'Service status:'
        systemctl is-active $APP_NAME.service
        echo ''
        echo 'Last failures:'
        systemctl status $APP_NAME.service --no-pager
        echo ''
        echo 'Error logs from last 24 hours:'
        journalctl -u $APP_NAME.service --since '24 hours ago' --priority=err --no-pager
    "
}

performance_stats() {
    echo "📈 Performance Statistics:"
    $SSH_CMD $USER@$HOST "
        echo 'Service uptime and restarts:'
        systemctl show $APP_NAME.service --property=ActiveEnterTimestamp,NRestarts,ExecMainStartTimestamp
        echo ''
        echo 'Memory usage:'
        systemctl status $APP_NAME.service --no-pager | grep -E '(Memory|Tasks)'
        echo ''
        echo 'Recent restart history:'
        journalctl -u $APP_NAME.service --since '7 days ago' | grep -E '(Started|Stopped|Failed)' | tail -10
    "
}

backup_logs() {
    local backup_dir="logs_backup_$(date +%Y%m%d_%H%M%S)"
    echo "💾 Backing up logs to $backup_dir..."
    mkdir -p "$backup_dir"
    
    $SSH_CMD $USER@$HOST "journalctl -u $APP_NAME.service --since '30 days ago' --no-pager" > "$backup_dir/systemd_logs.txt"
    echo "Logs saved to $backup_dir/systemd_logs.txt"
}

# Hauptmenü
case "${1:-}" in
    "enable")
        enable_service
        ;;
    "disable")
        disable_service
        ;;
    "remove")
        echo "⚠️ This will completely remove the service. Continue? (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            remove_service
        else
            echo "Cancelled"
        fi
        ;;
    "config")
        show_service_config
        ;;
    "edit")
        edit_service_config
        ;;
    "deps")
        show_service_dependencies
        ;;
    "analyze")
        analyze_failures
        ;;
    "stats")
        performance_stats
        ;;
    "backup")
        backup_logs
        ;;
    *)
        echo "🔧 $APP_NAME Service Management"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Service Control:"
        echo "  enable       - Enable auto-start at boot"
        echo "  disable      - Disable auto-start at boot"
        echo "  remove       - Remove service completely"
        echo ""
        echo "Configuration:"
        echo "  config       - Show service configuration"
        echo "  edit         - Instructions to edit service config"
        echo "  deps         - Show service dependencies"
        echo ""
        echo "Diagnostics:"
        echo "  analyze      - Analyze service failures"
        echo "  stats        - Show performance statistics"
        echo "  backup       - Backup service logs"
        echo ""
        echo "For basic monitoring use: ./monitor-service.sh"
        ;;
esac
