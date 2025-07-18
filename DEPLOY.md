# 🚀 Deploy Scripts für Raspberry Pi

Diese Deploy-Scripts kopieren die Terminüberwachung-App automatisch auf Ihren Raspberry Pi.

## 📋 Voraussetzungen

### Für macOS/Linux:
- SSH-Client (bereits installiert)
- `sshpass` für automatische Passwort-Eingabe (optional)
- `rsync` (bereits installiert)

### Für Windows:
- PuTTY Tools (PSCP, PLINK) - [Download hier](https://www.putty.org/)
- Oder Windows Subsystem for Linux (WSL)

### Für Node.js Script:
```bash
npm install node-ssh
```

## 🎯 Verfügbare Deploy-Scripts

### 1. `deploy.sh` - Vollständiges Bash-Script (empfohlen)
**Für:** macOS/Linux mit sshpass
```bash
# Installiere sshpass (einmalig)
# macOS: brew install sshpass
# Ubuntu: sudo apt-get install sshpass

# Deploy ausführen
./deploy.sh
```

### 2. `deploy-simple.sh` - Einfaches Bash-Script
**Für:** macOS/Linux ohne sshpass (fragt nach Passwort)
```bash
./deploy-simple.sh
```

### 3. `deploy.bat` - Windows Batch-Script
**Für:** Windows mit PuTTY Tools
```cmd
deploy.bat
```

### 4. `deploy.js` - Node.js Script
**Für:** Alle Plattformen mit Node.js
```bash
npm install node-ssh
node deploy.js
```

## ⚙️ Konfiguration

Die Scripts sind für folgende Konfiguration eingestellt:
- **IP:** 192.168.178.73
- **User:** apexpam
- **Zielordner:** /home/apexpam/repos/raspizulassungsstellewz

Bei Bedarf können Sie diese Werte in den Scripts anpassen.

## 📂 Was wird kopiert?

Das Script kopiert alle Dateien außer:
- `node_modules/` (wird auf dem Pi neu installiert)
- `.git/` (Git-Verlauf)
- `*.log` (Log-Dateien)
- Deploy-Scripts
- `.DS_Store` (macOS-Dateien)

## 🔄 Deployment-Prozess

1. **Verbindung:** SSH-Verbindung zum Raspberry Pi
2. **Stoppen:** Beendet laufende App-Instanz
3. **Upload:** Kopiert Dateien via SCP/RSYNC
4. **Install:** Führt `npm install --production` aus
5. **Start:** Startet die App mit `npm start`

## 📋 Nach dem Deployment

### App erreichen:
```
http://192.168.178.73:3000
```

### Logs anzeigen:
```bash
ssh apexpam@192.168.178.73 'tail -f /home/apexpam/repos/raspizulassungsstellewz/app.log'
```

### App stoppen:
```bash
ssh apexpam@192.168.178.73 'pkill -f "node.*index.js"'
```

### App neu starten:
```bash
ssh apexpam@192.168.178.73 'cd /home/apexpam/repos/raspizulassungsstellewz && npm start'
```

## 🔧 Troubleshooting

### SSH-Verbindung fehlgeschlagen:
- Prüfen Sie IP, Username und Passwort
- Stellen Sie sicher, dass SSH auf dem Pi aktiviert ist
- Firewall-Einstellungen prüfen

### Deployment hängt:
- Raspberry Pi Internetverbindung prüfen
- Ausreichend Speicherplatz vorhanden?
- Node.js auf dem Pi installiert?

### App startet nicht:
- Logs prüfen: `tail -f /home/apexpam/repos/raspizulassungsstellewz/app.log`
- Port 3000 bereits belegt?
- Dependencies korrekt installiert?

## 🛠️ Anpassungen

Um die Scripts für andere Konfigurationen anzupassen, bearbeiten Sie die Variablen am Anfang jeder Datei:

```bash
REMOTE_HOST="YOUR_PI_IP"
REMOTE_USER="YOUR_USERNAME"
REMOTE_PATH="/path/to/your/apps"
```
