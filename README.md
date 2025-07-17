# Raspberry Pi Terminüberwachung

Ein **Node.js-basiertes System** zur automatischen Überwachung von KFZ-Zulassungsterminen beim Lahn-Dill-Kreis mit headless Browser-Automatisierung und Multi-Channel-Benachrichtigungen.

## 🚀 Features

- **🤖 Headless Browser-Automation** mit Puppeteer
- **📧 Multi-Channel-Benachrichtigungen** (E-Mail, Telegram, Discord)
- **🌐 Web-Interface** für Konfiguration und Monitoring
- **📊 Real-time Dashboard** mit Live-Status
- **🔧 Raspberry Pi optimiert** (ARM64-kompatibel)
- **⏰ Flexible Terminplanung** mit Cron-Jobs
- **📝 Umfassendes Logging** mit Winston
- **🔒 Sichere Konfiguration** über Umgebungsvariablen

## 🛠️ Installation

### Voraussetzungen

- **Node.js** (v16 oder höher)
- **npm** oder **yarn**
- **Raspberry Pi** mit Raspbian/Ubuntu (optional)

### 1. Repository klonen

```bash
git clone <repository-url>
cd raspizulassungstermine
```

### 2. Abhängigkeiten installieren

```bash
npm install
```

### 3. Umgebungsvariablen konfigurieren

Erstellen Sie eine `.env`-Datei im Projektverzeichnis:

```env
# Server-Konfiguration
PORT=3000
LOG_LEVEL=info

# E-Mail-Benachrichtigungen
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
NOTIFICATION_EMAIL=recipient@example.com

# Telegram-Benachrichtigungen
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id

# Discord-Benachrichtigungen
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### 4. Anwendung starten

```bash
npm start
```

## 📱 Verwendung

### Web-Interface

Öffnen Sie `http://localhost:3000` in Ihrem Browser:

- **Dashboard**: Übersicht über alle überwachten Termine
- **Terminverwaltung**: Neue Termine hinzufügen/entfernen
- **Monitoring-Status**: Live-Status der Überwachung
- **Benachrichtigungen**: Konfiguration und Test

### API-Endpunkte

- `GET /api/status` - System-Status
- `GET /api/dates` - Überwachte Termine
- `POST /api/dates` - Neuen Termin hinzufügen
- `DELETE /api/dates/:date` - Termin entfernen
- `POST /api/check` - Sofortige Terminprüfung
- `POST /api/test-notification` - Test-Benachrichtigung

### Konfiguration

Die Anwendung kann über das Web-Interface oder die API konfiguriert werden:

```javascript
{
  "checkInterval": "*/10 * * * *", // Alle 10 Minuten
  "autoStart": true,
  "notifications": {
    "email": true,
    "telegram": true,
    "discord": true
  },
  "watchedDates": ["2025/01/15", "2025/01/16"]
}
```

## 🔧 Raspberry Pi Setup

### Systemd-Service erstellen

```bash
sudo nano /etc/systemd/system/terminueberwachung.service
```

```ini
[Unit]
Description=Terminüberwachung KFZ-Zulassung
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/raspizulassungstermine
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10

# Umgebungsvariablen
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### Service aktivieren

```bash
sudo systemctl daemon-reload
sudo systemctl enable terminueberwachung
sudo systemctl start terminueberwachung
```

### Status prüfen

```bash
sudo systemctl status terminueberwachung
```

## 📧 Benachrichtigungen einrichten

### E-Mail (Gmail)

1. **App-Passwort erstellen**: Google-Konto → Sicherheit → App-Passwörter
2. **Umgebungsvariablen setzen**:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

### Telegram

1. **Bot erstellen**: [@BotFather](https://t.me/BotFather) → `/newbot`
2. **Chat-ID ermitteln**: [@userinfobot](https://t.me/userinfobot)
3. **Token setzen**:
   ```env
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
   TELEGRAM_CHAT_ID=123456789
   ```

### Discord

1. **Webhook erstellen**: Server → Kanal → Integrationen → Webhooks
2. **URL setzen**:
   ```env
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
   ```

## 🔍 Monitoring und Debugging

### Logs anzeigen

```bash
# Alle Logs
tail -f logs/app.log

# Nur Fehler
tail -f logs/error.log

# Systemd-Logs
journalctl -u terminueberwachung -f
```

### Debugging-Modus

```bash
LOG_LEVEL=debug npm start
```

### Puppeteer-Debugging

Für Debugging mit sichtbarem Browser:

```javascript
// In appointmentMonitor.js
this.browser = await puppeteer.launch({
    headless: false, // Browser sichtbar machen
    devtools: true   // Developer Tools öffnen
});
```

## 🔒 Sicherheitshinweise

- **Niemals** Credentials in den Code schreiben
- **Immer** Umgebungsvariablen verwenden
- **Regelmäßig** Updates installieren
- **Firewall** für Port 3000 konfigurieren
- **HTTPS** für Produktionsumgebung

## 📊 Leistungsoptimierung

### Raspberry Pi

- **Swap-Speicher** erhöhen für Puppeteer
- **GPU-Speicher** reduzieren: `gpu_mem=16`
- **Cron-Intervalle** anpassen je nach Bedarf

### Memory-Management

```javascript
// In appointmentMonitor.js
const puppeteerOptions = {
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--memory-pressure-off'
    ]
};
```

## 🆘 Troubleshooting

### Häufige Probleme

1. **Puppeteer startet nicht**:
   ```bash
   sudo apt-get install -y chromium-browser
   ```

2. **Speichermangel**:
   ```bash
   sudo dphys-swapfile swapoff
   sudo nano /etc/dphys-swapfile # CONF_SWAPSIZE=1024
   sudo dphys-swapfile setup
   sudo dphys-swapfile swapon
   ```

3. **Benachrichtigungen funktionieren nicht**:
   - Umgebungsvariablen prüfen
   - Test-Benachrichtigung senden
   - Logs analysieren

### Support

- **Logs prüfen**: `logs/app.log` und `logs/error.log`
- **API-Status**: `http://localhost:3000/api/status`
- **Health-Check**: `http://localhost:3000/health`

## 🔄 Updates

```bash
git pull origin main
npm install
sudo systemctl restart terminueberwachung
```

## 📄 Lizenz

MIT License - Siehe `LICENSE`-Datei für Details.

## 👥 Mitwirkende

- **Entwicklung**: Ihr Name
- **Testing**: Community
- **Raspberry Pi Optimierung**: Pi-Community

---

**Raspberry Pi Terminüberwachung** - Automatisierte Terminsuche für KFZ-Zulassung Lahn-Dill-Kreis
