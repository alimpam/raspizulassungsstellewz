const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');
const ConfigService = require('./configService');

class NotificationService {
    constructor() {
        this.telegramBot = null;
        this.configService = new ConfigService();
        
        this.initializeServices();
    }

    initializeServices() {
        // Telegram-Bot initialisieren (nur wenn konfiguriert)
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
            this.telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
            logger.info('📱 Telegram-Bot initialisiert');
        } else {
            logger.warn('⚠️ Telegram nicht konfiguriert - BOT_TOKEN oder CHAT_ID fehlt');
        }
    }

    async sendNotification(title, message, options = {}) {
        // Prüfe ob Telegram-Benachrichtigungen in der Konfiguration aktiviert sind
        const config = this.configService.getConfig();
        
        if (!config.notifications || !config.notifications.telegram || !config.notifications.telegram.enabled) {
            logger.info('📱 Telegram-Benachrichtigungen sind deaktiviert');
            return { telegram: { status: 'disabled', reason: 'Telegram notifications disabled in config' } };
        }

        // Telegram-Nachricht senden (nur wenn Bot verfügbar und konfiguriert)
        if (this.telegramBot && process.env.TELEGRAM_CHAT_ID) {
            try {
                const result = await this.sendTelegram(title, message, options);
                logger.info('✅ Telegram-Benachrichtigung erfolgreich gesendet');
                return { telegram: { status: 'success', messageId: result.message_id } };
            } catch (error) {
                logger.error('❌ Telegram-Benachrichtigung fehlgeschlagen:', error);
                return { telegram: { status: 'error', error: error.message } };
            }
        } else {
            logger.warn('⚠️ Telegram nicht verfügbar - Bot oder Chat-ID nicht konfiguriert');
            return { telegram: { status: 'not_configured', reason: 'Bot token or chat ID missing' } };
        }
    }

    async sendTelegram(title, message, options = {}) {
        try {
            // Sicherheitsprüfung: Nur an die konfigurierte Chat-ID senden
            const allowedChatId = process.env.TELEGRAM_CHAT_ID;
            
            const text = `🔔 *${title}*\n\n${message}`;
            
            const result = await this.telegramBot.sendMessage(
                allowedChatId, // Nur an die konfigurierte Chat-ID
                text,
                {
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true,
                    ...options
                }
            );

            logger.info(`📱 Telegram-Nachricht gesendet an Chat ${allowedChatId}: ${result.message_id}`);
            return result;

        } catch (error) {
            logger.error('❌ Telegram-Versand fehlgeschlagen:', error);
            throw error;
        }
    }

    // Test-Benachrichtigung
    async sendTestNotification() {
        const title = '🧪 Test-Benachrichtigung';
        const message = `Dies ist eine Test-Benachrichtigung der Terminüberwachung.\n\nZeitpunkt: ${new Date().toLocaleString('de-DE')}\nSystem: Raspberry Pi`;
        
        logger.info('📤 Sende Test-Benachrichtigung...');
        return await this.sendNotification(title, message);
    }

    // Status der Services
    getServiceStatus() {
        const config = this.configService.getConfig();
        
        return {
            telegram: {
                available: !!this.telegramBot,
                configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
                enabled: config.notifications?.telegram?.enabled || false,
                chatId: process.env.TELEGRAM_CHAT_ID || null
            }
        };
    }
}

module.exports = NotificationService;
