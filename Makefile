# Makefile für Raspberry Pi Deployment

.PHONY: deploy deploy-simple deploy-node logs status stop restart help

# Standard deployment mit sshpass
deploy:
	@echo "🚀 Starting full deployment..."
	./deploy.sh

# Einfaches deployment (fragt nach Passwort)
deploy-simple:
	@echo "🚀 Starting simple deployment..."
	./deploy-simple.sh

# Node.js deployment
deploy-node:
	@echo "🚀 Starting Node.js deployment..."
	node deploy.js

# Logs anzeigen
logs:
	@echo "📋 Showing app logs..."
	ssh apexpam@192.168.178.73 'tail -f /home/apexpam/repos/raspizulassungsstellewz/app.log'

# App Status prüfen
status:
	@echo "📊 Checking app status..."
	ssh apexpam@192.168.178.73 'pgrep -f "node.*index.js" && echo "✅ App is running" || echo "❌ App is not running"'

# App stoppen
stop:
	@echo "⏹️  Stopping app..."
	ssh apexpam@192.168.178.73 'pkill -f "node.*index.js" && echo "✅ App stopped" || echo "❌ App was not running"'

# App neu starten
restart:
	@echo "🔄 Restarting app..."
	ssh apexpam@192.168.178.73 'cd /home/apexpam/repos/raspizulassungsstellewz && pkill -f "node.*index.js" || true && nohup npm start > app.log 2>&1 & && echo "✅ App restarted"'

# Hilfe anzeigen
help:
	@echo "🚀 Raspberry Pi Deployment Commands:"
	@echo ""
	@echo "   make deploy        - Full deployment mit sshpass"
	@echo "   make deploy-simple - Simple deployment (fragt nach Passwort)"
	@echo "   make deploy-node   - Node.js deployment script"
	@echo "   make logs          - App logs anzeigen"
	@echo "   make status        - App status prüfen"
	@echo "   make stop          - App stoppen"
	@echo "   make restart       - App neu starten"
	@echo "   make help          - Diese Hilfe anzeigen"
	@echo ""
	@echo "🌐 App URL: http://192.168.178.73:3000"
