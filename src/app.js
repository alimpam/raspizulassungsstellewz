const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

const logger = require('./utils/logger');
const AppointmentMonitor = require('./services/appointmentMonitor');
const NotificationService = require('./services/notificationService');
const ConfigService = require('./services/configService');

class TerminApp {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.monitor = new AppointmentMonitor();
        this.notificationService = new NotificationService();
        this.configService = new ConfigService();
        this.cronJob = null;
        
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeMonitoring();
    }

    initializeMiddleware() {
        // Sicherheit und Logging
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // Statische Dateien
        this.app.use(express.static(path.join(__dirname, '../public')));
    }

    initializeRoutes() {
        // API-Routen
        this.app.use('/api', require('./routes/api'));
        
        // Hauptseite
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        // Gesundheitscheck
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                monitoring: this.monitor.isRunning(),
                lastCheck: this.monitor.getLastCheckTime()
            });
        });

        // 404 Handler
        this.app.use((req, res) => {
            res.status(404).json({ error: 'Endpoint nicht gefunden' });
        });
    }

    initializeMonitoring() {
        // Terminüberwachung Event-Handler
        this.monitor.on('appointmentFound', (appointment) => {
            logger.info(`✅ Verfügbarer Termin gefunden: ${appointment.date} - ${appointment.time}`);
            this.notificationService.sendNotification(
                '🎉 Termin verfügbar!',
                `Ein Termin ist verfügbar: ${appointment.date} um ${appointment.time}\\n\\nLink: ${appointment.url}`
            );
        });

        this.monitor.on('error', (error) => {
            logger.error('❌ Fehler beim Terminmonitoring:', error);
            this.notificationService.sendNotification(
                '⚠️ Monitoring-Fehler',
                `Fehler beim Terminmonitoring: ${error.message}`
            );
        });

        this.monitor.on('statusChange', (status) => {
            logger.info(`🔄 Monitoring-Status geändert: ${status}`);
        });
    }

    startMonitoring() {
        const config = this.configService.getConfig();
        
        if (this.cronJob) {
            this.cronJob.stop();
        }

        // Cron-Job für automatische Prüfung
        this.cronJob = cron.schedule(config.checkInterval, async () => {
            try {
                await this.monitor.checkAppointments();
            } catch (error) {
                logger.error('❌ Fehler beim geplanten Termincheck:', error);
            }
        }, {
            scheduled: false
        });

        this.cronJob.start();
        logger.info(`🔄 Terminmonitoring gestartet (Interval: ${config.checkInterval})`);
    }

    stopMonitoring() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }
        logger.info('⏹️ Terminmonitoring gestoppt');
    }

    start() {
        this.app.listen(this.port, () => {
            logger.info(`🚀 Server läuft auf Port ${this.port}`);
            logger.info(`📱 Web-Interface: http://localhost:${this.port}`);
            logger.info(`🔍 API-Dokumentation: http://localhost:${this.port}/api`);
            
            // Monitoring automatisch starten, wenn konfiguriert
            const config = this.configService.getConfig();
            if (config.autoStart) {
                this.startMonitoring();
            }
        });

        // Graceful Shutdown
        process.on('SIGTERM', () => {
            logger.info('🔄 Beende Anwendung...');
            this.stopMonitoring();
            process.exit(0);
        });

        process.on('SIGINT', () => {
            logger.info('🔄 Beende Anwendung...');
            this.stopMonitoring();
            process.exit(0);
        });
    }
}

module.exports = TerminApp;
