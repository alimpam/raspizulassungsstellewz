const express = require('express');
const router = express.Router();
const AppointmentMonitor = require('../services/appointmentMonitor');
const NotificationService = require('../services/notificationService');
const ConfigService = require('../services/configService');

// Services initialisieren - use singleton for AppointmentMonitor
const monitor = AppointmentMonitor.getInstance();
const notificationService = new NotificationService();
const configService = ConfigService.getInstance();

// API-Dokumentation
router.get('/', (req, res) => {
    res.json({
        name: 'Terminüberwachung API',
        version: '1.0.0',
        description: 'API für die Überwachung von KFZ-Zulassungsterminen',
        endpoints: {
            'GET /api/status': 'System-Status anzeigen',
            'GET /api/config': 'Konfiguration anzeigen',
            'PUT /api/config': 'Konfiguration aktualisieren',
            'GET /api/debug': 'Debug-Einstellungen anzeigen',
            'PUT /api/debug': 'Debug-Einstellungen aktualisieren',
            'GET /api/services': 'Verfügbare Dienste anzeigen',
            'PUT /api/services': 'Ausgewählte Dienste aktualisieren',
            'GET /api/location': 'Standort-Auswahl anzeigen',
            'PUT /api/location': 'Standort aktualisieren',
            'PUT /api/url': 'Ziel-URL aktualisieren',
            'POST /api/monitoring/start': 'Kontinuierliche Überwachung starten',
            'POST /api/monitoring/stop': 'Kontinuierliche Überwachung stoppen',
            'GET /api/monitoring/status': 'Detaillierter Monitoring-Status',
            'GET /api/dates': 'Überwachte Termine anzeigen',
            'POST /api/dates': 'Neuen Termin hinzufügen',
            'DELETE /api/dates/:year/:month/:day': 'Termin entfernen',
            'POST /api/check': 'Sofortige Terminprüfung',
            'POST /api/test-notification': 'Test-Benachrichtigung senden',
            'GET /api/notifications/status': 'Status der Benachrichtigungsdienste',
            'GET /api/notifications/telegram': 'Telegram-Einstellungen anzeigen',
            'PUT /api/notifications/telegram': 'Telegram-Einstellungen aktualisieren',
            'POST /api/notifications/telegram/test': 'Test-Telegram-Nachricht senden'
        }
    });
});

// System-Status
router.get('/status', (req, res) => {
    res.json({
        system: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
        },
        monitoring: {
            isRunning: monitor.isRunning(),
            lastCheck: monitor.getLastCheckTime(),
            targetUrl: monitor.getTargetUrl(),
            selectedServices: configService.getSelectedServices(),
            selectedLocation: configService.getSelectedLocation(),
            watchedDates: monitor.getWatchedDates()
        },
        notifications: notificationService.getServiceStatus(),
        config: configService.getConfig()
    });
});

// Konfiguration
router.get('/config', (req, res) => {
    res.json(configService.getConfig());
});

router.put('/config', (req, res) => {
    try {
        const success = configService.updateConfig(req.body);
        if (success) {
            res.json({ success: true, message: 'Konfiguration aktualisiert' });
        } else {
            res.status(500).json({ success: false, message: 'Fehler beim Aktualisieren der Konfiguration' });
        }
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Service-Auswahl
router.get('/services', (req, res) => {
    const selectedServices = configService.getSelectedServices();
    const serviceMapping = configService.getServiceMapping();
    
    const services = Object.entries(serviceMapping).map(([key, service]) => ({
        key,
        ...service,
        selected: selectedServices[key] || false
    }));
    
    res.json(services);
});

router.put('/services', (req, res) => {
    try {
        const { services } = req.body;
        
        // Validierung
        if (!services || typeof services !== 'object') {
            return res.status(400).json({ 
                success: false, 
                message: 'Ungültige Service-Daten' 
            });
        }
        
        // Nur gültige Services akzeptieren
        const validServices = ['neuzulassung', 'umschreibung', 'ausfuhr'];
        const filteredServices = {};
        
        for (const [key, value] of Object.entries(services)) {
            if (validServices.includes(key) && typeof value === 'boolean') {
                filteredServices[key] = value;
            }
        }
        
        // Mindestens ein Service muss ausgewählt sein
        if (!Object.values(filteredServices).some(v => v)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Mindestens ein Service muss ausgewählt werden' 
            });
        }
        
        configService.updateSelectedServices(filteredServices);
        
        res.json({ 
            success: true, 
            message: 'Service-Auswahl aktualisiert',
            services: filteredServices
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Location-Auswahl
router.get('/location', (req, res) => {
    const selectedLocation = configService.getSelectedLocation();
    const locationMapping = configService.getLocationMapping();
    
    res.json({
        selected: selectedLocation,
        available: Object.values(locationMapping)
    });
});

router.put('/location', (req, res) => {
    try {
        const { location } = req.body;
        
        // Validierung
        if (!location || !location.value || !location.name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Ungültige Standort-Daten (value und name erforderlich)' 
            });
        }
        
        // Prüfen ob Standort verfügbar ist
        const locationMapping = configService.getLocationMapping();
        if (!locationMapping[location.value]) {
            return res.status(400).json({ 
                success: false, 
                message: 'Standort nicht verfügbar' 
            });
        }
        
        configService.updateSelectedLocation(location);
        
        res.json({ 
            success: true, 
            message: `Standort aktualisiert: ${location.name}`,
            location: location
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// URL-Konfiguration
router.put('/url', (req, res) => {
    try {
        const { url } = req.body;
        
        // Validierung
        if (!url || !url.startsWith('https://termine-kfz.lahn-dill-kreis.de/')) {
            return res.status(400).json({ 
                success: false, 
                message: 'Ungültige URL. Muss mit https://termine-kfz.lahn-dill-kreis.de/ beginnen' 
            });
        }
        
        // URL in Konfiguration und Monitor aktualisieren
        configService.updateConfig({ website: { ...configService.getConfig().website, url } });
        monitor.updateTargetUrl(url);
        
        res.json({ 
            success: true, 
            message: `Ziel-URL aktualisiert: ${url}` 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Monitoring-Steuerung
router.post('/monitoring/start', async (req, res) => {
    try {
        const { intervalMinutes = 5, intervalSeconds = 0 } = req.body;
        
        console.log('Monitoring-Start angefordert:', { intervalMinutes, intervalSeconds });
        
        // Validierung
        if (intervalMinutes < 0 || intervalMinutes > 60 || intervalSeconds < 0 || intervalSeconds > 59) {
            return res.status(400).json({ 
                success: false, 
                message: 'Ungültiges Intervall' 
            });
        }
        
        const totalSeconds = intervalMinutes * 60 + intervalSeconds;
        if (totalSeconds < 1) {
            return res.status(400).json({ 
                success: false, 
                message: 'Intervall muss mindestens 1 Sekunde betragen' 
            });
        }
        
        if (totalSeconds > 3600) {
            return res.status(400).json({ 
                success: false, 
                message: 'Intervall darf nicht mehr als 60 Minuten betragen' 
            });
        }
        
        // Prüfe ob bereits läuft
        if (monitor.isRunning()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Monitoring läuft bereits' 
            });
        }
        
        // Starte kontinuierliche Überwachung
        await monitor.startContinuousMonitoring(intervalMinutes, intervalSeconds);
        
        res.json({ 
            success: true, 
            message: `Monitoring gestartet (${intervalMinutes}:${intervalSeconds.toString().padStart(2, '0')} Min)` 
        });
    } catch (error) {
        console.error('Fehler beim Starten des Monitorings:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

router.post('/monitoring/stop', async (req, res) => {
    try {
        console.log('Monitoring-Stop angefordert');
        
        if (!monitor.isRunning()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Monitoring läuft nicht' 
            });
        }
        
        monitor.stopContinuousMonitoring();
        
        res.json({ 
            success: true, 
            message: 'Monitoring gestoppt' 
        });
    } catch (error) {
        console.error('Fehler beim Stoppen des Monitorings:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Überwachte Termine
router.get('/dates', (req, res) => {
    const monitoredDates = configService.getMonitoredDates();
    const monitoringStatus = monitor.getMonitoringStatus();
    const lastResults = monitor.getLastResults();
    
    const dates = monitoredDates.map(dateStr => {
        const [yyyy, mm, dd] = dateStr.split('/');
        
        // Prüfe ob bereits geprüft wurde (wenn lastCheckTime existiert)
        const hasBeenChecked = !!(monitoringStatus.lastCheckTime);
        
        // Finde das entsprechende Ergebnis aus der letzten Prüfung
        const result = lastResults.find(r => r.date === dateStr);
        const isAvailable = result ? result.available : false;
        
        return {
            date: dateStr,
            germanDate: `${dd}.${mm}.${yyyy}`,
            isAvailable: isAvailable,
            hasBeenChecked: hasBeenChecked,
            timestamp: monitoringStatus.lastCheckTime,
            lastCheckResult: result || null
        };
    });
    
    res.json(dates);
});

router.post('/dates', (req, res) => {
    try {
        const { date } = req.body;
        
        // Validierung
        if (!date || !configService.isValidDateString(date)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Ungültiges Datumsformat. Erwartet: YYYY/MM/DD' 
            });
        }
        
        // Zu beiden Services hinzufügen
        const configAdded = configService.addWatchedDate(date);
        monitor.addWatchedDate(date);
        
        // Synchronisation sicherstellen
        monitor.syncWithConfig();
        
        if (configAdded) {
            res.json({ 
                success: true, 
                message: `Termin ${date} zur Überwachung hinzugefügt` 
            });
        } else {
            res.status(409).json({ 
                success: false, 
                message: 'Termin wird bereits überwacht' 
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/dates/:year/:month/:day', (req, res) => {
    try {
        const { year, month, day } = req.params;
        const date = `${year}/${month}/${day}`;
        
        // Validierung
        if (!configService.isValidDateString(date)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Ungültiges Datumsformat' 
            });
        }
        
        // Aus beiden Services entfernen
        const configRemoved = configService.removeWatchedDate(date);
        monitor.removeWatchedDate(date);
        
        // Synchronisation sicherstellen
        monitor.syncWithConfig();
        
        if (configRemoved) {
            res.json({ 
                success: true, 
                message: `Termin ${date} aus Überwachung entfernt` 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Termin nicht gefunden' 
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Sofortige Terminprüfung
router.post('/check', async (req, res) => {
    try {
        const results = await monitor.checkAppointmentsImmediate();
        
        res.json({
            success: true,
            message: 'Terminprüfung abgeschlossen',
            results: results,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Test-Benachrichtigung
router.post('/test-notification', async (req, res) => {
    try {
        const results = await notificationService.sendTestNotification();
        
        res.json({
            success: true,
            message: 'Test-Benachrichtigung gesendet',
            results: results
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Benachrichtigungsstatus
router.get('/notifications/status', (req, res) => {
    res.json(notificationService.getServiceStatus());
});

// Telegram-Einstellungen
router.get('/notifications/telegram', (req, res) => {
    const config = configService.getConfig();
    const telegramConfig = config.notifications?.telegram || {
        enabled: false,
        onlyVerifiedChat: true,
        allowedChatId: null
    };
    
    res.json({
        ...telegramConfig,
        botConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        currentChatId: process.env.TELEGRAM_CHAT_ID || null
    });
});

router.put('/notifications/telegram', (req, res) => {
    try {
        const { enabled, onlyVerifiedChat } = req.body;
        
        // Hole aktuelle Konfiguration
        const config = configService.getConfig();
        
        // Aktualisiere Telegram-Einstellungen
        config.notifications = config.notifications || {};
        config.notifications.telegram = {
            enabled: enabled === true,
            onlyVerifiedChat: onlyVerifiedChat !== false, // Standard: true
            allowedChatId: process.env.TELEGRAM_CHAT_ID || null
        };
        
        // Speichere Konfiguration
        const success = configService.updateConfig(config);
        
        if (success) {
            res.json({ 
                success: true, 
                message: 'Telegram-Einstellungen aktualisiert',
                config: config.notifications.telegram
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Fehler beim Speichern der Telegram-Einstellungen' 
            });
        }
    } catch (error) {
        res.status(400).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Test-Telegram-Nachricht
router.post('/notifications/telegram/test', async (req, res) => {
    try {
        const config = configService.getConfig();
        
        // Prüfe ob Telegram aktiviert ist
        if (!config.notifications?.telegram?.enabled) {
            return res.status(400).json({
                success: false,
                message: 'Telegram-Benachrichtigungen sind deaktiviert'
            });
        }
        
        const result = await notificationService.sendTestNotification();
        
        res.json({
            success: true,
            message: 'Test-Telegram-Nachricht gesendet',
            result: result
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Erweiterte Terminsuche
router.get('/search/:year/:month', async (req, res) => {
    try {
        const { year, month } = req.params;
        
        // Validierung
        if (!year || !month || year.length !== 4 || month.length !== 2) {
            return res.status(400).json({ 
                success: false, 
                message: 'Ungültiges Jahr oder Monat (Format: YYYY/MM)' 
            });
        }
        
        // Hier könnte man eine erweiterte Suche implementieren
        // Für jetzt erstmal Placeholder
        res.json({
            success: true,
            message: 'Terminsuche noch nicht implementiert',
            year: year,
            month: month
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Backup und Restore
router.post('/config/backup', (req, res) => {
    try {
        const backupPath = configService.createBackup();
        if (backupPath) {
            res.json({ 
                success: true, 
                message: 'Backup erstellt',
                backupPath: backupPath 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Fehler beim Erstellen des Backups' 
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/config/export', (req, res) => {
    try {
        const exportData = configService.exportConfig();
        res.json({
            success: true,
            data: exportData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/config/import', (req, res) => {
    try {
        const success = configService.importConfig(req.body);
        if (success) {
            res.json({ 
                success: true, 
                message: 'Konfiguration importiert' 
            });
        } else {
            res.status(400).json({ 
                success: false, 
                message: 'Ungültige Konfigurationsdaten' 
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Kontinuierliche Überwachung starten
router.post('/monitoring/start', async (req, res) => {
    try {
        const { intervalMinutes = 5, intervalSeconds = 0 } = req.body;
        
        console.log('Monitoring-Start angefordert:', { intervalMinutes, intervalSeconds });
        
        // Validierung
        if (intervalMinutes < 0 || intervalMinutes > 60 || intervalSeconds < 0 || intervalSeconds > 59) {
            return res.status(400).json({ 
                success: false, 
                message: 'Ungültiges Intervall' 
            });
        }
        
        const totalSeconds = intervalMinutes * 60 + intervalSeconds;
        if (totalSeconds < 1) {
            return res.status(400).json({ 
                success: false, 
                message: 'Intervall muss mindestens 1 Sekunde betragen' 
            });
        }
        
        if (totalSeconds > 3600) {
            return res.status(400).json({ 
                success: false, 
                message: 'Intervall darf nicht mehr als 60 Minuten betragen' 
            });
        }
        
        // Prüfe ob bereits läuft
        if (monitor.isRunning()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Monitoring läuft bereits' 
            });
        }
        
        // Starte kontinuierliche Überwachung
        await monitor.startContinuousMonitoring(intervalMinutes, intervalSeconds);
        
        res.json({ 
            success: true, 
            message: `Monitoring gestartet (${intervalMinutes}:${intervalSeconds.toString().padStart(2, '0')} Min)` 
        });
    } catch (error) {
        console.error('Fehler beim Starten des Monitorings:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

router.post('/monitoring/stop', async (req, res) => {
    try {
        console.log('Monitoring-Stop angefordert');
        
        if (!monitor.isRunning()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Monitoring läuft nicht' 
            });
        }
        
        monitor.stopContinuousMonitoring();
        
        res.json({ 
            success: true, 
            message: 'Monitoring gestoppt' 
        });
    } catch (error) {
        console.error('Fehler beim Stoppen des Monitorings:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Detaillierter Monitoring-Status
router.get('/monitoring/status', (req, res) => {
    try {
        const status = monitor.getMonitoringStatus();
        const monitoredDates = configService.getMonitoredDates();
        const selectedLocation = configService.getSelectedLocation();
        const selectedServices = configService.getSelectedServices();
        
        res.json({
            ...status,
            configuration: {
                monitoredDates,
                selectedLocation,
                selectedServices,
                totalMonitoredDates: monitoredDates.length,
                hasValidConfig: !!(selectedLocation && selectedServices && monitoredDates.length > 0)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Debug-Konfiguration anzeigen
router.get('/debug', (req, res) => {
    try {
        const debugConfig = configService.getDebugConfig();
        res.json({
            debug: debugConfig,
            status: {
                loggingEnabled: configService.isLoggingEnabled(),
                screenshotsEnabled: configService.isScreenshotsEnabled(),
                detailedLoggingEnabled: configService.isDetailedLoggingEnabled(),
                logLevel: configService.getLogLevel()
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Debug-Konfiguration aktualisieren
router.put('/debug', (req, res) => {
    try {
        const { enableLogging, enableScreenshots, enableDetailedLogs, logLevel } = req.body;
        
        const debugSettings = {};
        if (typeof enableLogging === 'boolean') debugSettings.enableLogging = enableLogging;
        if (typeof enableScreenshots === 'boolean') debugSettings.enableScreenshots = enableScreenshots;
        if (typeof enableDetailedLogs === 'boolean') debugSettings.enableDetailedLogs = enableDetailedLogs;
        if (logLevel && ['error', 'warn', 'info', 'debug'].includes(logLevel)) {
            debugSettings.logLevel = logLevel;
        }
        
        const success = configService.updateDebugConfig(debugSettings);
        
        if (success) {
            res.json({
                message: 'Debug-Konfiguration aktualisiert',
                debug: configService.getDebugConfig()
            });
        } else {
            res.status(500).json({ error: 'Fehler beim Aktualisieren der Debug-Konfiguration' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Debug-Route für Konfiguration
router.get('/debug/config', (req, res) => {
    try {
        const config = {
            monitoredDates: configService.getMonitoredDates(),
            watchedDates: configService.getWatchedDates(),
            monitoringStatus: monitor.getMonitoringStatus(),
            rawConfig: configService.getConfig()
        };
        
        console.log('DEBUG Config:', config);
        res.json(config);
    } catch (error) {
        console.error('DEBUG Config Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
