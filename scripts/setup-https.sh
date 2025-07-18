#!/bin/bash

# HTTPS Setup für Raspberry Pi
# Konfiguriert Caddy für sichere HTTPS-Verbindungen

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

echo "🔐 Setting up HTTPS with Caddy for $APP_NAME..."

$SSH_CMD $USER@$HOST "
    echo '🛑 Stopping services for configuration...'
    sudo systemctl stop caddy
    
    echo '📝 Creating production Caddy configuration...'
    sudo tee /etc/caddy/Caddyfile > /dev/null << 'EOF'
# Production Caddy Configuration
{
    auto_https off
    local_certs
}

# HTTPS Server with self-signed certificates
https://$HOST:443 {
    tls internal
    reverse_proxy localhost:8080 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }
    
    # Security headers
    header {
        Strict-Transport-Security \"max-age=31536000; includeSubDomains\"
        X-Content-Type-Options \"nosniff\"
        X-Frame-Options \"DENY\"
        X-XSS-Protection \"1; mode=block\"
        Referrer-Policy \"strict-origin-when-cross-origin\"
        Access-Control-Allow-Origin \"*\"
        Access-Control-Allow-Methods \"GET, POST, PUT, DELETE, OPTIONS\"
        Access-Control-Allow-Headers \"Content-Type, Authorization\"
    }
    
    # Handle CORS preflight requests
    @options method OPTIONS
    respond @options 204
    
    # Enable response compression
    encode gzip
    
    # Custom error pages
    handle_errors {
        @502 expression {http.error.status_code} == 502
        respond @502 \"<h1>Service Temporarily Unavailable</h1><p>The monitoring service is currently processing. Please try again in a moment.</p>\" 502 {
            Content-Type \"text/html; charset=utf-8\"
        }
    }
}

# HTTP Server - redirect to HTTPS
http://$HOST:80 {
    redir https://$HOST:443{uri} permanent
}

# Fallback for localhost access (HTTP only for internal use)
http://localhost:80 {
    reverse_proxy localhost:8080
}
EOF

    echo '📋 Caddyfile configuration:'
    cat /etc/caddy/Caddyfile
    
    echo ''
    echo '🧪 Testing Caddyfile syntax...'
    sudo caddy validate --config /etc/caddy/Caddyfile
    
    if [ \$? -eq 0 ]; then
        echo '✅ Configuration valid!'
        
        echo '🚀 Starting Caddy with new configuration...'
        sudo systemctl start caddy
        
        echo '⏳ Waiting for services to start...'
        sleep 3
        
        echo '📊 Service status:'
        sudo systemctl status caddy --no-pager -l
        sudo systemctl status $APP_NAME --no-pager
        
        echo ''
        echo '🔍 Port check:'
        sudo netstat -tlnp | grep -E ':(80|443|8080)'
        
    else
        echo '❌ Configuration invalid! Caddy not started.'
        exit 1
    fi
"

echo ""
echo "✅ HTTPS setup completed!"
echo "🔐 Your monitoring system is now available at:"
echo "   • HTTPS: https://$HOST (secure, recommended)"
echo "   • HTTP:  http://$HOST (redirects to HTTPS)"
echo ""
echo "⚠️ Note: Self-signed certificate will show security warning"
echo "   Accept the certificate in your browser for first visit"
echo ""
echo "🧪 Test the setup:"
echo "   curl -k https://$HOST/"
echo "   curl -k -X POST https://$HOST/api/monitoring/start -H 'Content-Type: application/json' -d '{}'"
