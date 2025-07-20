#!/usr/bin/env node
/**
 * Telegram Bot Test Script
 * Testet die Telegram-Integration unabhängig von der Hauptanwendung
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

console.log('🤖 Telegram Bot Test');
console.log('===================');
console.log();

// Validierung
if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN nicht in .env definiert');
    process.exit(1);
}

if (!CHAT_ID) {
    console.error('❌ TELEGRAM_CHAT_ID nicht in .env definiert');
    process.exit(1);
}

console.log(`🔑 Bot Token: ${BOT_TOKEN.substring(0, 10)}...`);
console.log(`💬 Chat ID: ${CHAT_ID}`);
console.log();

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

async function testBot() {
    try {
        // 1. Bot-Info abrufen
        console.log('📋 1. Bot-Informationen abrufen...');
        const botInfo = await bot.getMe();
        console.log(`✅ Bot gefunden: ${botInfo.first_name} (@${botInfo.username})`);
        console.log(`   ID: ${botInfo.id}`);
        console.log(`   Kann Gruppen beitreten: ${botInfo.can_join_groups ? 'Ja' : 'Nein'}`);
        console.log();

        // 2. Einfache Nachricht senden
        console.log('📤 2. Sende einfache Nachricht...');
        const simpleMessage = await bot.sendMessage(
            CHAT_ID,
            '🧪 Test-Nachricht #1: Einfacher Text'
        );
        console.log(`✅ Nachricht gesendet (ID: ${simpleMessage.message_id})`);
        console.log();

        // 3. Formatierte Nachricht senden
        console.log('📤 3. Sende formatierte Nachricht...');
        const formattedMessage = await bot.sendMessage(
            CHAT_ID,
            `🎉 *Test-Nachricht #2*

📅 *Datum:* ${new Date().toLocaleDateString('de-DE')}
⏰ *Zeit:* ${new Date().toLocaleTimeString('de-DE')}
💻 *System:* Terminüberwachung Raspberry Pi

✅ _Telegram-Integration funktioniert!_`,
            { parse_mode: 'Markdown' }
        );
        console.log(`✅ Formatierte Nachricht gesendet (ID: ${formattedMessage.message_id})`);
        console.log();

        // 4. Nachricht mit Buttons senden
        console.log('📤 4. Sende Nachricht mit Buttons...');
        const buttonsMessage = await bot.sendMessage(
            CHAT_ID,
            '🎛️ Test-Nachricht #3: Interactive Buttons',
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ Alles OK', callback_data: 'status_ok' },
                            { text: '🔄 Status prüfen', callback_data: 'check_status' }
                        ],
                        [
                            { text: '⚙️ Einstellungen', callback_data: 'settings' }
                        ]
                    ]
                }
            }
        );
        console.log(`✅ Button-Nachricht gesendet (ID: ${buttonsMessage.message_id})`);
        console.log();

        // 5. Chat-Informationen abrufen
        console.log('💬 5. Chat-Informationen abrufen...');
        try {
            const chatInfo = await bot.getChat(CHAT_ID);
            console.log(`✅ Chat-Typ: ${chatInfo.type}`);
            if (chatInfo.title) {
                console.log(`   Titel: ${chatInfo.title}`);
            }
            if (chatInfo.first_name) {
                console.log(`   Name: ${chatInfo.first_name} ${chatInfo.last_name || ''}`);
            }
            if (chatInfo.username) {
                console.log(`   Username: @${chatInfo.username}`);
            }
        } catch (error) {
            console.log(`⚠️ Chat-Info nicht verfügbar: ${error.message}`);
        }
        console.log();

        // 6. Test einer realistischen Termin-Benachrichtigung
        console.log('📤 6. Sende realistische Termin-Benachrichtigung...');
        const appointmentMessage = await bot.sendMessage(
            CHAT_ID,
            `🚗 *Neuer Termin verfügbar!*

📍 *Standort:* Lahn-Dill-Kreis KFZ-Zulassung
📅 *Datum:* ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE')}
⏰ *Zeit:* 10:30 Uhr
📋 *Typ:* Fahrzeug-Zulassung

🔗 [Direkt zum Termin](https://lahn-dill-kreis.de)

⚡ _Schnell sein - Termine sind begehrt!_`,
            { 
                parse_mode: 'Markdown',
                disable_web_page_preview: false
            }
        );
        console.log(`✅ Termin-Benachrichtigung gesendet (ID: ${appointmentMessage.message_id})`);
        console.log();

        console.log('🎉 Alle Tests erfolgreich abgeschlossen!');
        console.log();
        console.log('💡 Tipp: Prüfe dein Telegram für die Test-Nachrichten.');

    } catch (error) {
        console.error('❌ Test fehlgeschlagen:', error.message);
        
        if (error.code === 'ETELEGRAM') {
            console.error('🔍 Telegram API Fehler:', error.response?.body);
        }
        
        process.exit(1);
    }
}

// Test starten
testBot().then(() => {
    console.log('✅ Test abgeschlossen');
    process.exit(0);
}).catch((error) => {
    console.error('💥 Unerwarteter Fehler:', error);
    process.exit(1);
});

// Graceful Shutdown
process.on('SIGINT', () => {
    console.log('\\n🛑 Test abgebrochen');
    process.exit(0);
});
