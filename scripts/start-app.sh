#!/bin/bash
# Startup script für Terminüberwachung App mit automatischem Neustart

APP_DIR="/home/apexpam/repos/raspizulassungsstellewz"
APP_USER="apexpam"
LOG_FILE="$APP_DIR/src/logs/startup.log"

# Funktion für Logging
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [STARTUP] $1" | tee -a "$LOG_FILE"
}

# Wechsle in App-Verzeichnis
cd "$APP_DIR" || {
    log "FEHLER: Kann nicht in $APP_DIR wechseln"
    exit 1
}

log "Starte Terminüberwachung App..."
log "Working Directory: $(pwd)"
log "User: $(whoami)"
log "Node Version: $(node --version)"

# Endlos-Schleife für automatischen Neustart
while true; do
    log "App wird gestartet..."
    
    # Starte Node.js App
    node index.js
    
    # Exit-Code prüfen
    EXIT_CODE=$?
    log "App beendet mit Exit-Code: $EXIT_CODE"
    
    if [ $EXIT_CODE -eq 0 ]; then
        log "App wurde ordnungsgemäß beendet (Exit-Code 0)"
        break
    else
        log "App ist abgestürzt! Neustart in 10 Sekunden..."
        sleep 10
    fi
done

log "Startup-Script beendet"
