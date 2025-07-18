#!/bin/bash

# DDNS Connectivity Diagnostic Script
# Prüft alle Aspekte der externen Konnektivität

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

DDNS_DOMAIN="alimspi.ddns.net"
EXTERNAL_PORT="8080"

echo "🔍 DDNS Connectivity Diagnostic"
echo "=============================="
echo ""

echo "1. 🌐 DNS Resolution:"
echo "   Domain: $DDNS_DOMAIN"
nslookup $DDNS_DOMAIN
echo ""

echo "2. 🔌 Port Testing from Outside:"
echo "   Testing if port $EXTERNAL_PORT is reachable from external..."
# Test port connectivity using online service
curl -s "https://www.yougetsignal.com/tools/open-ports/" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "remoteAddress=$DDNS_DOMAIN&portNumber=$EXTERNAL_PORT" \
  --max-time 10 | grep -o "Port.*is.*" || echo "   Could not test port externally"
echo ""

echo "3. 📡 Current Public IP vs DDNS IP:"
echo "   Your current public IP:"
curl -s ifconfig.me || echo "   Could not get public IP"
echo ""
echo "   DDNS resolves to:"
nslookup $DDNS_DOMAIN | grep "Address:" | tail -1 | cut -d' ' -f2
echo ""

echo "4. 🔧 Raspberry Pi Network Status:"
$SSH_CMD $USER@$HOST "
    echo '   Local IP addresses:'
    hostname -I
    echo ''
    echo '   App listening status:'
    sudo netstat -tlnp | grep :8080
    echo ''
    echo '   Firewall status:'
    sudo ufw status | grep 8080
    echo ''
    echo '   Test local access:'
    curl -s http://localhost:8080/ | head -n 3 | grep -o '<title>.*</title>' || echo '   Local access failed'
"
echo ""

echo "5. 🏠 Fritz!Box Port Forwarding Check:"
echo "   According to your screenshot, you have:"
echo "   - Protocol: TCP"
echo "   - External IP: 93.237.19.141"
echo "   - External Port: 8080"
echo "   - Internal IP: should be $HOST"
echo "   - Internal Port: 8080"
echo ""
echo "   ⚠️  Please verify in Fritz!Box that:"
echo "   - Port forwarding rule is ENABLED"
echo "   - Internal IP matches: $HOST"
echo "   - Both external and internal ports are 8080"
echo ""

echo "6. 🧪 Network Test Recommendations:"
echo ""
echo "   a) Test from OUTSIDE your home network:"
echo "      - Use mobile data (not WiFi)"
echo "      - Visit: http://$DDNS_DOMAIN:$EXTERNAL_PORT"
echo ""
echo "   b) Test port manually:"
echo "      telnet $DDNS_DOMAIN $EXTERNAL_PORT"
echo ""
echo "   c) Alternative test URLs:"
echo "      - http://$DDNS_DOMAIN:$EXTERNAL_PORT/api"
echo "      - http://93.237.19.141:$EXTERNAL_PORT"
echo ""

echo "7. 🔧 Common Issues & Solutions:"
echo ""
echo "   If external access doesn't work:"
echo ""
echo "   A) Fritz!Box Issues:"
echo "      - Port forwarding might be disabled"
echo "      - Wrong internal IP (should be $HOST)"
echo "      - IPv6 instead of IPv4 (check both)"
echo ""
echo "   B) ISP Issues:"
echo "      - Some ISPs block port 8080"
echo "      - Try alternative port like 8081 or 80"
echo ""
echo "   C) Dynamic IP Issues:"
echo "      - DDNS might not be updated"
echo "      - Check Fritz!Box DDNS status"
echo ""

echo "8. 📋 Quick Fix Commands:"
echo ""
echo "   If you need to change the port to 80:"
echo "   ./scripts/setup-external-access-port80.sh"
echo ""
echo "   Re-run external access setup:"
echo "   ./scripts/setup-external-access.sh"
echo ""

echo "✅ Diagnostic complete!"
echo ""
echo "🎯 Next Steps:"
echo "1. Test from mobile network (not home WiFi)"
echo "2. Check Fritz!Box port forwarding is enabled"
echo "3. Verify internal IP in Fritz!Box matches $HOST"
echo "4. If still issues, try port 80 or 8081"
