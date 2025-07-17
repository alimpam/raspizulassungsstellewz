const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class ConfigService {
    constructor() {
        this.configPath = path.join(__dirname, '../../config/settings.json');
        this.defaultConfig = {
            checkInterval: '*/10 * * * *', // Alle 10 Minuten
            autoStart: true,
            notifications: {
                email: true,
                telegram: true,
                discord: true
            },
            watchedDates: [],
            puppeteerOptions: {
                headless: true,
                timeout: 30000,
                waitForNetworkIdle: 2000
            },
            website: {
                url: 'https://termine-kfz.lahn-dill-kreis.de/',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };
        
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const fileContent = fs.readFileSync(this.configPath, 'utf8');
                const config = JSON.parse(fileContent);
                
                // Merge mit Default-Konfiguration
                const mergedConfig = { ...this.defaultConfig, ...config };
                logger.info('⚙️ Konfiguration geladen');
                return mergedConfig;
            } else {
                logger.info('⚙️ Erstelle Standard-Konfiguration');
                this.saveConfig(this.defaultConfig);
                return this.defaultConfig;
            }
        } catch (error) {
            logger.error('❌ Fehler beim Laden der Konfiguration:', error);
            return this.defaultConfig;
        }
    }

    saveConfig(config = this.config) {
        try {
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
            this.config = config;
            logger.info('💾 Konfiguration gespeichert');
            return true;
        } catch (error) {
            logger.error('❌ Fehler beim Speichern der Konfiguration:', error);
            return false;
        }
    }

    getConfig() {
        return this.config;
    }

    updateConfig(updates) {
        try {
            this.config = { ...this.config, ...updates };
            this.saveConfig();
            logger.info('🔄 Konfiguration aktualisiert');
            return true;
        } catch (error) {
            logger.error('❌ Fehler beim Aktualisieren der Konfiguration:', error);
            return false;
        }
    }

    // Spezifische Konfigurationsmethoden
    addWatchedDate(dateStr) {
        if (!this.config.watchedDates.includes(dateStr)) {
            this.config.watchedDates.push(dateStr);
            this.saveConfig();
            logger.info(`➕ Datum zur Überwachung hinzugefügt: ${dateStr}`);
            return true;
        }
        return false;
    }

    removeWatchedDate(dateStr) {
        const index = this.config.watchedDates.indexOf(dateStr);
        if (index > -1) {
            this.config.watchedDates.splice(index, 1);
            this.saveConfig();
            logger.info(`➖ Datum aus Überwachung entfernt: ${dateStr}`);
            return true;
        }
        return false;
    }

    getWatchedDates() {
        return this.config.watchedDates;
    }

    setCheckInterval(interval) {
        this.config.checkInterval = interval;
        this.saveConfig();
        logger.info(`🕐 Prüfintervall aktualisiert: ${interval}`);
    }

    toggleAutoStart() {
        this.config.autoStart = !this.config.autoStart;
        this.saveConfig();
        logger.info(`🔄 Auto-Start ${this.config.autoStart ? 'aktiviert' : 'deaktiviert'}`);
        return this.config.autoStart;
    }

    updateNotificationSettings(notifications) {
        this.config.notifications = { ...this.config.notifications, ...notifications };
        this.saveConfig();
        logger.info('📢 Benachrichtigungseinstellungen aktualisiert');
    }

    // Validierung
    validateConfig() {
        const errors = [];

        // Cron-Ausdruck validieren
        if (!this.isValidCronExpression(this.config.checkInterval)) {
            errors.push('Ungültiger Cron-Ausdruck für checkInterval');
        }

        // Überwachte Daten validieren
        this.config.watchedDates.forEach(date => {
            if (!this.isValidDateString(date)) {
                errors.push(`Ungültiges Datumsformat: ${date}`);
            }
        });

        return errors;
    }

    isValidCronExpression(expression) {
        // Einfache Cron-Validierung (5 Felder: Minute Stunde Tag Monat Wochentag)
        const parts = expression.split(' ');
        if (parts.length !== 5) return false;
        
        // Grundlegende Validierung
        const cronRegex = /^[0-9*,/-]+$/;
        return parts.every(part => cronRegex.test(part));
    }

    isValidDateString(dateStr) {
        // Format: YYYY/MM/DD
        const dateRegex = /^\d{4}\/\d{2}\/\d{2}$/;
        return dateRegex.test(dateStr);
    }

    // Backup und Restore
    createBackup() {
        try {
            const backupPath = path.join(path.dirname(this.configPath), `settings_backup_${Date.now()}.json`);
            fs.copyFileSync(this.configPath, backupPath);
            logger.info(`💾 Backup erstellt: ${backupPath}`);
            return backupPath;
        } catch (error) {
            logger.error('❌ Fehler beim Erstellen des Backups:', error);
            return null;
        }
    }

    restoreBackup(backupPath) {
        try {
            if (fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, this.configPath);
                this.config = this.loadConfig();
                logger.info(`🔄 Backup wiederhergestellt: ${backupPath}`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error('❌ Fehler beim Wiederherstellen des Backups:', error);
            return false;
        }
    }

    // Konfiguration exportieren/importieren
    exportConfig() {
        return {
            config: this.config,
            exported: new Date().toISOString(),
            version: '1.0.0'
        };
    }

    importConfig(exportedData) {
        try {
            if (exportedData.config) {
                this.config = { ...this.defaultConfig, ...exportedData.config };
                this.saveConfig();
                logger.info('📥 Konfiguration importiert');
                return true;
            }
            return false;
        } catch (error) {
            logger.error('❌ Fehler beim Importieren der Konfiguration:', error);
            return false;
        }
    }
}

module.exports = ConfigService;
