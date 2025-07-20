# 🤖 Telegram Bot Integration

## Überblick

Die Telegram-Integration ermöglicht es, Benachrichtigungen über verfügbare Termine direkt an dein Telegram-Chat zu senden. Dies ist besonders praktisch für mobile Benachrichtigungen.

## Setup-Prozess

### 1. Bot erstellen mit BotFather

```bash
# Automatisches Setup-Script starten
./scripts/setup-telegram.sh
```

**Oder manuell:**

1. Telegram öffnen und `@BotFather` suchen
2. `/newbot` schreiben
3. Bot-Namen eingeben (z.B. "Terminüberwachung Bot")
4. Bot-Username eingeben (muss auf `_bot` enden)
5. **Bot Token** kopieren und aufbewahren

### 2. Chat-ID herausfinden

#### Für Einzelpersonen:
1. Deinem Bot eine Nachricht schreiben
2. Updates abrufen:
   ```bash
   curl "https://api.telegram.org/bot<BOT_TOKEN>/getUpdates"
   ```
3. Chat-ID aus der JSON-Antwort kopieren

#### Für Gruppen:
1. Bot zur Gruppe hinzufügen
2. In der Gruppe `@dein_bot_name hallo` schreiben
3. Updates abrufen (siehe oben)
4. Chat-ID ist negativ (z.B. `-123456789`)

### 3. Konfiguration

`.env` Datei bearbeiten:
```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

### 4. Test

```bash
# Telegram-Integration testen
node scripts/test-telegram.js
```

## Features

### Nachrichtentypen

1. **Einfache Textnachrichten**
   ```javascript
   await bot.sendMessage(chatId, "Einfacher Text");
   ```

2. **Formatierte Nachrichten**
   ```javascript
   await bot.sendMessage(chatId, "*Fett* _Kursiv_ `Code`", { 
       parse_mode: 'Markdown' 
   });
   ```

3. **Interactive Buttons**
   ```javascript
   await bot.sendMessage(chatId, "Nachricht", {
       reply_markup: {
           inline_keyboard: [
               [{ text: "Button", callback_data: "action" }]
           ]
       }
   });
   ```

### Termin-Benachrichtigungen

```javascript
// Beispiel einer Termin-Benachrichtigung
const message = `🚗 *Neuer Termin verfügbar!*

📍 *Standort:* Lahn-Dill-Kreis KFZ-Zulassung
📅 *Datum:* 15.12.2024
⏰ *Zeit:* 10:30 Uhr
📋 *Typ:* Fahrzeug-Zulassung

🔗 [Direkt zum Termin](https://lahn-dill-kreis.de)

⚡ _Schnell sein - Termine sind begehrt!_`;

await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
```

## Integration in den Monitor

### NotificationService

Der `NotificationService` unterstützt automatisch Telegram:

```javascript
const notificationService = new NotificationService();

// Termin-Benachrichtigung senden
await notificationService.sendNotification(
    'Neuer Termin verfügbar!',
    'Ein Termin für morgen ist verfügbar.'
);
```

### Monitor-Integration

In `appointmentMonitor.js` wird bei gefundenen Terminen automatisch benachrichtigt:

```javascript
// Wenn neue Termine gefunden werden
if (appointments.length > 0) {
    const message = `📅 ${appointments.length} neue Termine gefunden!\n\n` +
        appointments.map(apt => `• ${apt.date} um ${apt.time}`).join('\n');
    
    await this.notificationService.sendNotification(
        '🚗 Neue KFZ-Termine verfügbar',
        message
    );
}
```

## Erweiterte Features

### Bot-Commands

Du kannst den Bot erweitern um Commands zu unterstützen:

```javascript
// In einer erweiterten Version
bot.onText(/\/status/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Monitoring läuft...');
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Verfügbare Commands:\n/status - Status prüfen\n/help - Diese Hilfe');
});
```

### Callback-Handler

Für interactive Buttons:

```javascript
bot.on('callback_query', (callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    
    switch(action) {
        case 'check_status':
            bot.sendMessage(msg.chat.id, 'Status: Alles läuft optimal!');
            break;
        case 'settings':
            bot.sendMessage(msg.chat.id, 'Einstellungen über Web-Interface verfügbar.');
            break;
    }
});
```

## Deployment auf Raspberry Pi

### 1. Dateien übertragen

```bash
# Von deinem lokalen Rechner
rsync -avz --exclude node_modules ./ pi@alimspi.ddns.net:~/terminueberwachung/
```

### 2. Dependencies installieren

```bash
# Auf dem Pi
cd ~/terminueberwachung
npm install node-telegram-bot-api
```

### 3. Service neustarten

```bash
sudo systemctl restart terminueberwachung
```

## Troubleshooting

### Häufige Probleme

1. **Bot antwortet nicht**
   - Bot Token prüfen
   - Chat-ID überprüfen
   - Mit `test-telegram.js` testen

2. **Formatierung funktioniert nicht**
   - `parse_mode: 'Markdown'` verwenden
   - Sonderzeichen escapen: `*`, `_`, `` ` ``

3. **Buttons funktionieren nicht**
   - `inline_keyboard` statt `keyboard` verwenden
   - Callback-Handler implementieren

### Debug-Tipps

```bash
# Bot-Informationen abrufen
curl "https://api.telegram.org/bot<TOKEN>/getMe"

# Aktuelle Updates anzeigen
curl "https://api.telegram.org/bot<TOKEN>/getUpdates"

# Test-Nachricht senden
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
     -d "chat_id=<CHAT_ID>&text=Test"
```

## Sicherheit

### Best Practices

1. **Token sicher speichern**
   - Nie in Git committen
   - Nur in `.env` Datei
   - Umgebungsvariablen verwenden

2. **Chat-ID validieren**
   - Nur bekannte Chat-IDs erlauben
   - Gruppenberechtigungen prüfen

3. **Rate Limiting**
   - Telegram API hat Limits
   - Nicht zu viele Nachrichten auf einmal

### Token-Verwaltung

```bash
# Token regenerieren bei Kompromittierung
# 1. Zu @BotFather gehen
# 2. /token schreiben
# 3. Bot auswählen
# 4. Neuen Token generieren
# 5. .env aktualisieren
```

## API-Limits

- **Nachrichten**: 30 pro Sekunde
- **Gruppen**: 20 pro Minute  
- **Dateigröße**: 50 MB maximum
- **Nachrichtenlänge**: 4096 Zeichen

## Nützliche Links

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [BotFather](https://t.me/BotFather)
- [Markdown Guide](https://core.telegram.org/bots/api#markdown-style)
- [Inline Keyboards](https://core.telegram.org/bots/2-0-intro)
