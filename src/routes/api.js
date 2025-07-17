const express = require('express');
const router = express.Router();
const AppointmentMonitor = require('../services/appointmentMonitor');
const NotificationService = require('../services/notificationService');
const ConfigService = require('../services/configService');

// Services initialisieren
const monitor = new AppointmentMonitor();
const notificationService = new NotificationService();
const configService = new ConfigService();

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
            'GET /api/dates': 'Überwachte Termine anzeigen',
            'POST /api/dates': 'Neuen Termin hinzufügen',
            'DELETE /api/dates/:date': 'Termin entfernen',
            'POST /api/check': 'Sofortige Terminprüfung',
            'POST /api/test-notification': 'Test-Benachrichtigung senden',
            'GET /api/notifications/status': 'Status der Benachrichtigungsdienste'
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
            watchedDates: monitor.getWatchedDates(),
            foundAppointments: monitor.getFoundAppointments()
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

// Überwachte Termine
router.get('/dates', (req, res) => {
    const watchedDates = configService.getWatchedDates();
    const foundAppointments = monitor.getFoundAppointments();
    
    const dates = watchedDates.map(dateStr => {
        const [yyyy, mm, dd] = dateStr.split('/');
        return {
            date: dateStr,
            germanDate: `${dd}.${mm}.${yyyy}`,
            isAvailable: foundAppointments.includes(dateStr)
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

router.delete('/dates/:date', (req, res) => {
    try {
        const { date } = req.params;
        
        // Aus beiden Services entfernen
        const configRemoved = configService.removeWatchedDate(date);
        monitor.removeWatchedDate(date);
        
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
        const results = await monitor.checkAppointments();
        
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

module.exports = router;
