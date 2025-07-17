const nodemailer = require('nodemailer');
const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');

class NotificationService {
    constructor() {
        this.emailTransporter = null;
        this.telegramBot = null;
        this.discordWebhook = null;
        
        this.initializeServices();
    }

    initializeServices() {
        // E-Mail-Service initialisieren
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
            this.emailTransporter = nodemailer.createTransporter({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
            logger.info('📧 E-Mail-Service initialisiert');
        }

        // Telegram-Bot initialisieren
        if (process.env.TELEGRAM_BOT_TOKEN) {
            this.telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
            logger.info('📱 Telegram-Bot initialisiert');
        }

        // Discord-Webhook initialisieren
        if (process.env.DISCORD_WEBHOOK_URL) {
            this.discordWebhook = process.env.DISCORD_WEBHOOK_URL;
            logger.info('🎮 Discord-Webhook initialisiert');
        }
    }

    async sendNotification(title, message, options = {}) {
        const promises = [];

        // E-Mail senden
        if (this.emailTransporter && process.env.NOTIFICATION_EMAIL) {
            promises.push(this.sendEmail(title, message, options));
        }

        // Telegram-Nachricht senden
        if (this.telegramBot && process.env.TELEGRAM_CHAT_ID) {
            promises.push(this.sendTelegram(title, message, options));
        }

        // Discord-Nachricht senden
        if (this.discordWebhook) {
            promises.push(this.sendDiscord(title, message, options));
        }

        // Alle Benachrichtigungen parallel senden
        const results = await Promise.allSettled(promises);
        
        // Ergebnisse auswerten
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                logger.error(`❌ Benachrichtigung ${index + 1} fehlgeschlagen:`, result.reason);
            } else {
                logger.info(`✅ Benachrichtigung ${index + 1} erfolgreich gesendet`);
            }
        });

        return results;
    }

    async sendEmail(title, message, options = {}) {
        try {
            const mailOptions = {
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: process.env.NOTIFICATION_EMAIL,
                subject: `[Terminüberwachung] ${title}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
                            ${title}
                        </h2>
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                            <p style="font-size: 16px; line-height: 1.5; margin: 0;">
                                ${message.replace(/\\n/g, '<br>')}
                            </p>
                        </div>
                        <div style="font-size: 12px; color: #666; margin-top: 20px;">
                            <p>Gesendet von der Terminüberwachung am ${new Date().toLocaleString('de-DE')}</p>
                        </div>
                    </div>
                `
            };

            const info = await this.emailTransporter.sendMail(mailOptions);
            logger.info(`📧 E-Mail gesendet: ${info.messageId}`);
            return info;

        } catch (error) {
            logger.error('❌ E-Mail-Versand fehlgeschlagen:', error);
            throw error;
        }
    }

    async sendTelegram(title, message, options = {}) {
        try {
            const text = `🔔 *${title}*\\n\\n${message}`;
            
            const result = await this.telegramBot.sendMessage(
                process.env.TELEGRAM_CHAT_ID,
                text,
                {
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true,
                    ...options
                }
            );

            logger.info(`📱 Telegram-Nachricht gesendet: ${result.message_id}`);
            return result;

        } catch (error) {
            logger.error('❌ Telegram-Versand fehlgeschlagen:', error);
            throw error;
        }
    }

    async sendDiscord(title, message, options = {}) {
        try {
            const payload = {
                embeds: [{
                    title: title,
                    description: message,
                    color: 0x007bff,
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: 'Terminüberwachung Raspberry Pi'
                    }
                }]
            };

            const response = await fetch(this.discordWebhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Discord API Error: ${response.status}`);
            }

            logger.info(`🎮 Discord-Nachricht gesendet`);
            return response;

        } catch (error) {
            logger.error('❌ Discord-Versand fehlgeschlagen:', error);
            throw error;
        }
    }

    // Test-Benachrichtigung
    async sendTestNotification() {
        const title = '🧪 Test-Benachrichtigung';
        const message = `Dies ist eine Test-Benachrichtigung der Terminüberwachung.\\n\\nZeitpunkt: ${new Date().toLocaleString('de-DE')}\\nSystem: Raspberry Pi`;
        
        logger.info('📤 Sende Test-Benachrichtigung...');
        return await this.sendNotification(title, message);
    }

    // Status der Services
    getServiceStatus() {
        return {
            email: {
                available: !!this.emailTransporter,
                configured: !!(process.env.SMTP_HOST && process.env.NOTIFICATION_EMAIL)
            },
            telegram: {
                available: !!this.telegramBot,
                configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
            },
            discord: {
                available: !!this.discordWebhook,
                configured: !!process.env.DISCORD_WEBHOOK_URL
            }
        };
    }
}

module.exports = NotificationService;
