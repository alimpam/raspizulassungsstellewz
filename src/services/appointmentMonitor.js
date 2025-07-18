const puppeteer = require('puppeteer');
const EventEmitter = require('events');
const logger = require('../utils/logger');
const configService = require('./configService');

class AppointmentMonitor extends EventEmitter {
    constructor() {
        // Singleton pattern - return existing instance if already created
        if (AppointmentMonitor.instance) {
            return AppointmentMonitor.instance;
        }

        super();
        this.browser = null;
        this.page = null;
        this.isMonitoringActive = false;
        this.lastCheckTime = null;
        this.configService = new configService();
        this.targetUrl = this.configService.getWebsiteUrl();
        this.watchedDates = new Set();
        this.monitoringInterval = null;
        this.consecutiveErrors = 0;
        this.lastResults = []; // Store the last appointment check results

        // Store the singleton instance
        AppointmentMonitor.instance = this;
    }

    async initialize() {
        try {
            logger.info('🤖 Initialisiere Puppeteer Browser...');
            
            const puppeteerOptions = this.configService.getPuppeteerOptions();
            
            this.browser = await puppeteer.launch({
                headless: puppeteerOptions.headless,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920,1080',
                    '--lang=de-DE',
                    '--accept-lang=de-DE,de;q=0.9',
                    '--disable-web-security',
                    '--disable-features=TranslateUI',
                    '--disable-ipc-flooding-protection',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-field-trial-config',
                    '--disable-back-forward-cache',
                    '--disable-blink-features=AutomationControlled',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--no-zygote',
                    '--single-process'
                ]
            });

            this.page = await this.browser.newPage();
            
            // Deutsche Sprache und Zeitzone setzen
            await this.page.setExtraHTTPHeaders({
                'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
            });
            
            // Deutsche Zeitzone setzen
            await this.page.emulateTimezone('Europe/Berlin');
            
            await this.page.setUserAgent(this.configService.getUserAgent());
            await this.page.setViewport({ width: 1920, height: 1080 });
            
            logger.info('✅ Browser erfolgreich initialisiert (Sprache: Deutsch)');
            return true;
        } catch (error) {
            logger.error('❌ Fehler beim Initialisieren des Browsers:', error);
            this.emit('error', error);
            return false;
        }
    }

    // Einmalige Initialisierung für kontinuierliche Überwachung
    async initializeForContinuousMonitoring() {
        try {
            logger.info('🤖 Initialisiere Browser für kontinuierliche Überwachung...');
            
            // Browser und Seite initialisieren
            if (!this.browser || !this.page) {
                await this.initialize();
            }

            const puppeteerOptions = this.configService.getPuppeteerOptions();
            const selectedServices = this.configService.getSelectedServices();
            const serviceMapping = this.configService.getServiceMapping();

            // Seite laden - weniger restriktive Wartezeit
            logger.info(`🌐 Lade Seite: ${this.targetUrl}`);
            await this.page.goto(this.targetUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            
            // Warte zusätzlich kurz auf dynamische Inhalte
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Warten auf das Formular
            logger.info('⏳ Warte auf Formular...');
            await this.page.waitForSelector('#form-add-concern-items', {
                timeout: puppeteerOptions.timeout
            });

            // Services auswählen
            await this.selectServices(selectedServices, serviceMapping);

            // Zum nächsten Schritt: Standort auswählen
            logger.info('🔄 Navigiere zur Standort-Auswahl...');
            const nextButton = await this.page.$('.btn-next');
            if (!nextButton) {
                throw new Error('Weiter-Button nicht gefunden');
            }
            
            await nextButton.click();
            
            // Warten auf Navigation
            try {
                await this.page.waitForNavigation({ 
                    waitUntil: 'networkidle0',
                    timeout: puppeteerOptions.timeout
                });
            } catch (navError) {
                logger.warn('⚠️ Navigation-Timeout - versuche alternative Wartestrategie...');
                await this.page.waitForSelector('select', { timeout: 15000 });
            }

            // Standort auswählen
            await this.selectLocation();

            // Warten auf Kalender - Verbesserte Wartestrategie
            logger.info('⏳ Warte auf Kalender...');
            await this.page.waitForFunction(() => {
                // Prüfe zuerst, ob die Kalender-Struktur existiert
                const calendarBody = document.querySelector('.dx-calendar-body');
                if (!calendarBody) {
                    return false;
                }
                
                // Prüfe ob mindestens ein Kalender-Element mit data-value existiert
                const calendarCells = document.querySelectorAll('td[data-value]');
                if (calendarCells.length === 0) {
                    return false;
                }
                
                // Prüfe ob die Kalender-Tabelle sichtbar ist
                const calendarTable = document.querySelector('.dx-calendar-body table');
                if (!calendarTable) {
                    return false;
                }
                
                // Zusätzliche Prüfung: Schaue nach den Kalender-Überschriften
                const selectors = [
                    '.dx-calendar-caption-button .dx-button-text',
                    '.dx-calendar-caption .dx-button-text',
                    '.dx-calendar-navigator-caption .dx-button-text',
                    '.calendar-month-year',
                    '.month-year-display'
                ];
                
                let hasCaption = false;
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                        hasCaption = true;
                        break;
                    }
                }
                
                // Erfolgreich wenn Kalender-Zellen vorhanden sind (auch ohne Caption)
                return calendarCells.length > 0 && (hasCaption || calendarCells.length > 20);
            }, { timeout: puppeteerOptions.timeout });

            logger.info('✅ Browser für kontinuierliche Überwachung initialisiert');
            await this.takeScreenshot('continuous_monitoring_initialized');
            
        } catch (error) {
            logger.error('❌ Fehler bei der Initialisierung für kontinuierliche Überwachung:', error);
            throw error;
        }
    }

    // Debug-Hilfsfunktionen
    async takeScreenshot(name) {
        try {
            if (this.page) {
                const fs = require('fs');
                const path = require('path');
                
                // Sicherstellen, dass der logs Ordner existiert
                const logsDir = path.join(__dirname, '..', 'logs');
                if (!fs.existsSync(logsDir)) {
                    fs.mkdirSync(logsDir, { recursive: true });
                }
                
                const screenshotPath = path.join(logsDir, `debug_${name}_${Date.now()}.png`);
                await this.page.screenshot({ path: screenshotPath, fullPage: true });
                logger.info(`📸 Screenshot gespeichert: ${screenshotPath}`);
                return screenshotPath;
            }
        } catch (error) {
            logger.warn(`⚠️ Fehler beim Erstellen des Screenshots ${name}:`, error);
        }
    }

    async checkAppointments() {
        if (!this.browser || !this.page) {
            await this.initialize();
        }

        try {
            this.isMonitoringActive = true;
            this.lastCheckTime = new Date();
            logger.info('🔍 Starte Terminprüfung...');

            const puppeteerOptions = this.configService.getPuppeteerOptions();
            const selectedServices = this.configService.getSelectedServices();
            const serviceMapping = this.configService.getServiceMapping();

            // Seite laden - weniger restriktive Wartezeit
            logger.info(`🌐 Lade Seite: ${this.targetUrl}`);
            await this.page.goto(this.targetUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            
            // Warte zusätzlich kurz auf dynamische Inhalte
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Screenshot nach dem Laden
            await this.debugScreenshot('initial_load', 'Seite initial geladen');

            // Warten auf das Formular
            logger.info('⏳ Warte auf Formular...');
            await this.page.waitForSelector('#form-add-concern-items', {
                timeout: puppeteerOptions.timeout
            });

            logger.info('📋 Formular geladen');
            await this.debugScreenshot('form_loaded', 'Formular geladen');

            // Services auswählen
            await this.selectServices(selectedServices, serviceMapping);
            await this.debugScreenshot('services_selected', 'Services ausgewählt');

            // Zum nächsten Schritt: Standort auswählen
            logger.info('🔄 Klicke auf Weiter-Button nach Service-Auswahl...');
            
            // Prüfen ob der Weiter-Button existiert
            const nextButton = await this.page.$('.btn-next');
            if (!nextButton) {
                logger.error('❌ Weiter-Button nicht gefunden!');
                // Screenshot für Debugging
                await this.debugScreenshot('no_next_button', 'Weiter-Button nicht gefunden');
                throw new Error('Weiter-Button nicht gefunden');
            }
            
            await nextButton.click();
            
            // Warten auf Navigation mit erweiterten Optionen
            try {
                await this.page.waitForNavigation({ 
                    waitUntil: 'networkidle0',
                    timeout: puppeteerOptions.timeout
                });
            } catch (navError) {
                logger.warn('⚠️ Navigation-Timeout - versuche alternative Wartestrategie...');
                // Alternative: Warten auf Standort-Auswahl Formular
                await this.page.waitForSelector('select', { timeout: 15000 });
                logger.info('✅ Standort-Auswahl-Formular gefunden');
            }

            logger.info('📍 Standort-Auswahl geladen');

            // Standort auswählen
            await this.selectLocation();
            await this.debugScreenshot('location_selected', 'Standort ausgewählt');

            // Warten auf Kalender mit verbesserter Fehlerbehandlung
            logger.info('⏳ Warte auf Kalender...');
            try {
                // Primärer Selector - erweiterte Suche
                await this.page.waitForFunction(() => {
                    const selectors = [
                        '.dx-calendar-caption-button .dx-button-text',
                        '.dx-calendar-caption .dx-button-text',
                        '.dx-calendar-navigator-caption .dx-button-text',
                        '.calendar-month-year',
                        '.month-year-display'
                    ];
                    
                    for (const selector of selectors) {
                        const element = document.querySelector(selector);
                        if (element && element.textContent.trim()) {
                            return true;
                        }
                    }
                    return false;
                }, { timeout: puppeteerOptions.timeout });
                
                logger.info('📅 Kalender geladen');
            } catch (error) {
                logger.warn('⚠️ Kalender-Hauptselektor nicht gefunden - versuche alternative Selektoren...');
                // Alternative Selektoren versuchen
                const alternativeSelectors = [
                    '.dx-calendar',
                    '.calendar',
                    '[data-calendar]',
                    '.appointment-calendar',
                    'table.dx-calendar-table',
                    '.dx-calendar-body'
                ];
                
                let calendarFound = false;
                for (const selector of alternativeSelectors) {
                    try {
                        await this.page.waitForSelector(selector, { timeout: 5000 });
                        logger.info(`📅 Kalender mit alternativem Selektor gefunden: ${selector}`);
                        calendarFound = true;
                        break;
                    } catch (altError) {
                        logger.debug(`Alternativer Selektor ${selector} nicht gefunden`);
                    }
                }
                
                if (!calendarFound) {
                    await this.debugScreenshot('calendar_not_found', 'Kalender nicht gefunden');
                    // Noch ein letzter Versuch: Warte auf beliebige Tabelle
                    try {
                        await this.page.waitForSelector('table, .table', { timeout: 10000 });
                        logger.info('📅 Kalender als Tabelle gefunden');
                    } catch (tableError) {
                        throw new Error('Kalender konnte nicht geladen werden');
                    }
                }
            }

            await this.debugScreenshot('calendar_loaded', 'Kalender geladen');

            // Alle überwachten Termine prüfen
            this.syncWithConfig(); // Synchronisiere vor der Prüfung
            
            const monitoredDates = this.configService.getMonitoredDates();
            logger.info(`📅 Prüfe ${monitoredDates.length} überwachte Termine...`);
            
            const results = [];
            for (const dateStr of monitoredDates) {
                const result = await this.checkSingleDate(dateStr);
                results.push(result);
                
                // Kurze Pause zwischen Checks
                await new Promise(resolve => setTimeout(resolve, puppeteerOptions.waitForNetworkIdle || 1000));
            }

            const availableCount = results.filter(r => r.available).length;
            logger.info(`✅ Terminprüfung abgeschlossen: ${availableCount}/${results.length} Termine verfügbar`);

            // Store the results for later retrieval
            this.lastResults = results;

            return results;

        } catch (error) {
            logger.error('❌ Fehler bei der Terminprüfung:', error);
            this.emit('error', error);
            return [];
        } finally {
            this.isMonitoringActive = false;
        }
    }

    // Nur Terminprüfung durchführen (ohne Neuinitialisierung)
    async checkDatesOnly() {
        try {
            logger.info('📅 Prüfe nur Termine (ohne Neuinitialisierung)...');
            
            // Synchronisiere überwachte Termine vor der Prüfung
            this.syncWithConfig();
            
            const monitoredDates = this.configService.getMonitoredDates();
            if (monitoredDates.length === 0) {
                logger.warn('⚠️ Keine Termine zu überwachen');
                return [];
            }

            logger.info(`🔍 Prüfe ${monitoredDates.length} überwachte Termine: ${monitoredDates.join(', ')}`);
            
            // Stelle sicher, dass wir in der Kalenderansicht sind
            await this.ensureCalendarView();
            
            // Optional: Seite refreshen alle paar Checks (wie im Tampermonkey-Script)
            if (this.checkCount && this.checkCount % 3 === 0) {
                logger.info('🔄 Refreshe Seite für bessere Stabilität...');
                await this.page.reload({ waitUntil: 'networkidle0' });
                await this.page.waitForFunction(() => {
                    const selectors = [
                        '.dx-calendar-caption-button .dx-button-text',
                        '.dx-calendar-caption .dx-button-text',
                        '.dx-calendar-navigator-caption .dx-button-text',
                        '.calendar-month-year',
                        '.month-year-display'
                    ];
                    
                    for (const selector of selectors) {
                        const element = document.querySelector(selector);
                        if (element && element.textContent.trim()) {
                            return true;
                        }
                    }
                    return false;
                }, { timeout: 30000 });
            }
            
            // Sortiere Termine nach Datum für effiziente Navigation
            const sortedDates = monitoredDates.sort();
            logger.info(`📋 Sortierte Termine: ${sortedDates.join(', ')}`);
            
            const results = [];
            
            for (let i = 0; i < sortedDates.length; i++) {
                const dateStr = sortedDates[i];
                logger.info(`🔍 Prüfe Termin ${i + 1}/${sortedDates.length}: ${dateStr}`);
                
                const result = await this.checkSingleDate(dateStr);
                results.push(result);
                
                logger.info(`✅ Ergebnis für ${dateStr}: ${result.available ? 'VERFÜGBAR' : 'nicht verfügbar'}`);
                
                // Längere Pause zwischen Terminprüfungen für bessere Stabilität
                if (i < sortedDates.length - 1) {
                    logger.info('⏳ Warte 2 Sekunden vor nächster Terminprüfung...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            this.checkCount = (this.checkCount || 0) + 1;
            this.lastCheckTime = new Date();
            
            // Store the results for later retrieval
            this.lastResults = results;
            
            const availableCount = results.filter(r => r.available).length;
            const availableDates = results.filter(r => r.available).map(r => r.date);
            
            logger.info(`✅ Terminprüfung abgeschlossen: ${availableCount}/${results.length} Termine verfügbar`);
            
            if (availableDates.length > 0) {
                logger.info(`🎯 Verfügbare Termine: ${availableDates.join(', ')}`);
            }

            return results;
            
        } catch (error) {
            logger.error('❌ Fehler bei der Terminprüfung:', error);
            throw error;
        }
    }

    async selectServices(selectedServices, serviceMapping) {
        try {
            logger.info('🛠️ Wähle Services aus:', selectedServices);

            // Alle Services durchgehen
            for (const [serviceKey, isSelected] of Object.entries(selectedServices)) {
                if (isSelected && serviceMapping[serviceKey]) {
                    const service = serviceMapping[serviceKey];
                    const inputSelector = `#${service.id}`;
                    const plusButtonSelector = `button[data-field="${service.id}"][data-type="plus"]`;

                    logger.info(`➕ Aktiviere Service: ${service.name}`);

                    // Plus-Button klicken um Service zu aktivieren
                    await this.page.click(plusButtonSelector);
                    await new Promise(resolve => setTimeout(resolve, 500));

                    // Prüfen ob erfolgreich aktiviert
                    const currentValue = await this.page.$eval(inputSelector, el => el.value);
                    if (currentValue === '1') {
                        logger.info(`✅ Service ${service.name} aktiviert`);
                    } else {
                        logger.warn(`⚠️ Service ${service.name} konnte nicht aktiviert werden`);
                    }
                }
            }

        } catch (error) {
            logger.error('❌ Fehler beim Auswählen der Services:', error);
            throw error;
        }
    }

    async selectLocation() {
        try {
            logger.info('🏢 Wähle Standort aus...');

            // Warten auf das Select-Element
            await this.page.waitForSelector('select', {
                timeout: 10000
            });

            // Konfigurierte Standort-Auswahl laden
            const selectedLocation = this.configService.getSelectedLocation();
            const locationValue = selectedLocation.value;

            // Prüfen ob das Select-Element existiert
            const selectExists = await this.page.$('select');
            if (!selectExists) {
                throw new Error('Standort-Auswahl nicht gefunden');
            }

            // Verfügbare Optionen anzeigen
            const options = await this.page.$$eval('select option', options => 
                options.map(option => ({
                    value: option.value,
                    text: option.textContent.trim()
                }))
            );

            logger.info('📍 Verfügbare Standorte:', options);

            // Prüfen ob der konfigurierte Standort verfügbar ist
            const isLocationAvailable = options.some(option => option.value === locationValue);
            if (!isLocationAvailable) {
                logger.warn(`⚠️ Konfigurierter Standort ${locationValue} nicht verfügbar`);
                logger.info('🔄 Verwende ersten verfügbaren Standort');
                if (options.length > 0) {
                    await this.page.select('select', options[0].value);
                    logger.info(`✅ Standort "${options[0].text}" ausgewählt`);
                }
            } else {
                // Standort auswählen
                await this.page.select('select', locationValue);
                logger.info(`✅ Standort "${selectedLocation.name}" ausgewählt`);
            }

            // Kurz warten nach der Auswahl
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Screenshot nach Standort-Auswahl
            await this.takeScreenshot('after_location_selection');

            // Auf den spezifischen "Weiter zur Datumsauswahl"-Button klicken
            logger.info('➡️ Suche nach "Weiter zur Datumsauswahl" Button...');
            
            const submitButton = await this.page.$('#submitButton');
            if (submitButton) {
                logger.info('✅ Submit-Button gefunden, klicke darauf...');
                await submitButton.click();
                logger.info('⏳ Warte auf Navigation zur Datumsauswahl...');
                await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
                logger.info('✅ Navigation zur Datumsauswahl erfolgreich!');
            } else {
                logger.error('❌ Submit-Button (#submitButton) nicht gefunden!');
                
                // Fallback: Suche nach alternativen Buttons
                const alternativeButtons = await this.page.$$eval('input[type="submit"], button[type="submit"]', buttons => 
                    buttons.map(btn => ({
                        id: btn.id,
                        value: btn.value,
                        text: btn.textContent,
                        className: btn.className
                    }))
                );
                logger.info('🔍 Verfügbare Submit-Buttons:', alternativeButtons);
                
                // Versuche mit dem ersten verfügbaren Submit-Button
                const firstSubmitButton = await this.page.$('input[type="submit"], button[type="submit"]');
                if (firstSubmitButton) {
                    logger.info('🔄 Versuche mit erstem verfügbaren Submit-Button...');
                    await firstSubmitButton.click();
                    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
                } else {
                    throw new Error('Kein Submit-Button gefunden!');
                }
            }

            // Screenshot nach Button-Klick
            await this.takeScreenshot('after_submit_button_click');

        } catch (error) {
            logger.error('❌ Fehler bei der Standort-Auswahl:', error);
            throw error;
        }
    }

    async checkSingleDate(dateStr) {
        try {
            const [yyyy, mm, dd] = dateStr.split('/');
            const germanDate = `${dd}.${mm}.${yyyy}`;
            
            logger.info(`🔍 Prüfe Termin: ${germanDate} (${dateStr})`);
            
            // Debug: Aktueller Monat vor Navigation
            const currentMonthBefore = await this.page.evaluate(() => {
                const caption = document.querySelector('.dx-calendar-caption-button .dx-button-text');
                return caption ? caption.textContent.trim() : 'Unbekannt';
            });
            logger.info(`📅 Aktueller Monat vor Navigation: ${currentMonthBefore}`);

            // Zum gewünschten Monat navigieren
            await this.navigateToMonth(yyyy, mm);
            
            // Debug: Aktueller Monat nach Navigation
            const currentMonthAfter = await this.page.evaluate(() => {
                const caption = document.querySelector('.dx-calendar-caption-button .dx-button-text');
                return caption ? caption.textContent.trim() : 'Unbekannt';
            });
            logger.info(`📅 Aktueller Monat nach Navigation: ${currentMonthAfter}`);

            // Warten bis der Kalender vollständig geladen ist
            logger.info('⏳ Warte auf vollständigen Kalender...');
            await this.page.waitForFunction(() => {
                // Prüfe zuerst, ob die Kalender-Struktur existiert
                const calendarBody = document.querySelector('.dx-calendar-body');
                if (!calendarBody) {
                    return false;
                }
                
                // Prüfe ob mindestens ein Kalender-Element mit data-value existiert
                const calendarCells = document.querySelectorAll('td[data-value]');
                if (calendarCells.length === 0) {
                    return false;
                }
                
                // Prüfe ob die Kalender-Tabelle vollständig sichtbar ist
                const calendarTable = document.querySelector('.dx-calendar-body table tbody');
                if (!calendarTable) {
                    return false;
                }
                
                // Prüfe ob genügend Zellen vorhanden sind (mindestens 20 für einen Monat)
                return calendarCells.length >= 20;
            }, { timeout: 15000 });
            
            logger.info('✅ Kalender vollständig geladen');
            
            // Zusätzliche kurze Wartezeit für Stabilität
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Termin-Zelle suchen - robustere Implementierung wie im Tampermonkey-Script
            const cell = await this.page.$(`td[data-value="${dateStr}"]`);
            if (!cell) {
                logger.warn(`⚠️ Termin ${germanDate} nicht im Kalender gefunden`);
                return { date: dateStr, available: false, reason: 'Nicht im Kalender gefunden' };
            }

            logger.info(`✅ Termin-Zelle für ${germanDate} gefunden`);

            // Detaillierte Analyse der Zelle wie im Tampermonkey-Script
            const cellInfo = await cell.evaluate(el => {
                const classes = el.className;
                const computedStyle = window.getComputedStyle(el);
                const backgroundColor = computedStyle.backgroundColor;
                const color = computedStyle.color;
                
                // Verschiedene Verfügbarkeitsindikatoren prüfen
                const isGreen = classes.includes('bg-success') || 
                               backgroundColor.includes('rgb(40, 167, 69)') ||
                               backgroundColor.includes('green');
                
                const isDisabled = classes.includes('disabled-date') ||
                                 classes.includes('dx-calendar-cell-disabled') ||
                                 classes.includes('dx-state-disabled') ||
                                 el.disabled;
                
                const isOtherMonth = classes.includes('dx-calendar-other-month') ||
                                   classes.includes('dx-calendar-other-view');
                
                const isSelectable = classes.includes('dx-calendar-cell') &&
                                   !classes.includes('dx-calendar-empty-cell');
                
                // Prüfe auf spezielle Termin-Indikatoren
                const hasAppointmentIndicator = classes.includes('appointment-available') ||
                                              classes.includes('available') ||
                                              classes.includes('bookable') ||
                                              el.querySelector('.appointment-indicator');
                
                // Prüfe Textinhalt auf Terminhinweise
                const textContent = el.textContent.trim();
                const hasTimeText = textContent.includes(':') || 
                                  textContent.match(/\d{1,2}:\d{2}/) ||
                                  textContent.includes('Termin');
                
                // Clickability prüfen
                const isClickable = !el.disabled && 
                                  computedStyle.pointerEvents !== 'none' &&
                                  !isDisabled;

                return {
                    classes,
                    backgroundColor,
                    color,
                    isGreen,
                    isDisabled,
                    isOtherMonth,
                    isSelectable,
                    hasAppointmentIndicator,
                    hasTimeText,
                    isClickable,
                    textContent,
                    style: el.style.cssText,
                    computedStyle: {
                        backgroundColor,
                        color,
                        pointerEvents: computedStyle.pointerEvents
                    }
                };
            });

            // Vereinfachte Verfügbarkeitsprüfung basierend auf disabled-date Klasse
            // Ein Termin ist verfügbar wenn:
            // 1. Er hat NICHT die Klasse 'disabled-date'
            // 2. Er ist nicht aus einem anderen Monat
            const isAvailable = !cellInfo.classes.includes('disabled-date') &&
                              !cellInfo.isOtherMonth;

            const result = {
                date: dateStr,
                germanDate,
                available: isAvailable,
                classes: cellInfo.classes,
                details: cellInfo,
                timestamp: new Date().toISOString()
            };

            // Detailliertes Logging für Debugging
            logger.info(`🔍 Termin-Details für ${germanDate}:`, {
                available: isAvailable,
                hasDisabledDate: cellInfo.classes.includes('disabled-date'),
                isOtherMonth: cellInfo.isOtherMonth,
                classes: cellInfo.classes,
                textContent: cellInfo.textContent,
                backgroundColor: cellInfo.backgroundColor
            });

            // Debug-Screenshot für die Terminprüfung
            await this.createScreenshot(`appointment_check_${dateStr.replace(/\//g, '_')}`, `Terminprüfung für ${germanDate}`);

            if (result.available) {
                this.emit('appointmentFound', {
                    ...result,
                    url: this.targetUrl
                });
                
                logger.info(`🎉 Verfügbarer Termin gefunden: ${germanDate}`);
            } else {
                logger.info(`❌ Termin ${germanDate} nicht verfügbar - Details: ${cellInfo.classes}`);
            }

            logger.info(`📊 ${germanDate} - Verfügbar: ${result.available ? '✅' : '❌'}`);
            return result;

        } catch (error) {
            logger.error(`❌ Fehler beim Prüfen von ${dateStr}:`, error);
            return { date: dateStr, available: false, error: error.message };
        }
    }

    async navigateToMonth(targetYear, targetMonth) {
        try {
            const maxNavigations = 24; // Maximal 2 Jahre navigieren
            let navigations = 0;
            
            logger.info(`🎯 Navigiere zu Monat: ${targetMonth}/${targetYear}`);

            while (navigations < maxNavigations) {
                // Erweiterte Suche nach Kalender-Elementen
                const currentMonth = await this.page.evaluate(() => {
                    // Verschiedene Selektoren für den Kalender-Header versuchen
                    const selectors = [
                        '.dx-calendar-caption-button .dx-button-text',
                        '.dx-calendar-caption .dx-button-text',
                        '.dx-calendar-navigator-caption .dx-button-text',
                        '.calendar-month-year',
                        '.month-year-display'
                    ];
                    
                    let caption = null;
                    for (const selector of selectors) {
                        caption = document.querySelector(selector);
                        if (caption) break;
                    }
                    
                    if (!caption) {
                        // Fallback: Suche nach Text-Pattern in allen Elementen
                        const allElements = document.querySelectorAll('*');
                        for (const el of allElements) {
                            const text = el.textContent?.trim() || '';
                            if (text.match(/^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}$/)) {
                                caption = el;
                                break;
                            }
                        }
                    }
                    
                    if (!caption) return null;
                    
                    const text = caption.textContent.trim(); // z.B. "August 2025"
                    const parts = text.split(' ');
                    
                    if (parts.length !== 2) {
                        // Versuche alternative Formate
                        const altMatch = text.match(/(\w+)\s*(\d{4})/);
                        if (altMatch) {
                            parts[0] = altMatch[1];
                            parts[1] = altMatch[2];
                        } else {
                            return null;
                        }
                    }
                    
                    const [monat, jahr] = parts;
                    
                    const monthMap = {
                        'Januar': '01', 'Februar': '02', 'März': '03', 'April': '04',
                        'Mai': '05', 'Juni': '06', 'Juli': '07', 'August': '08',
                        'September': '09', 'Oktober': '10', 'November': '11', 'Dezember': '12'
                    };
                    
                    return {
                        year: jahr,
                        month: monthMap[monat] || monat,
                        text: text
                    };
                });

                if (!currentMonth) {
                    logger.error('❌ Kann aktuellen Monat nicht ermitteln');
                    // Debug: Verfügbare Elemente loggen
                    await this.page.evaluate(() => {
                        const elements = document.querySelectorAll('.dx-calendar *, .calendar *');
                        console.log('Verfügbare Kalender-Elemente:', Array.from(elements).map(el => ({
                            tag: el.tagName,
                            class: el.className,
                            text: el.textContent?.trim()
                        })));
                    });
                    throw new Error('Kann aktuellen Monat nicht ermitteln');
                }

                const aktJahr = parseInt(currentMonth.year);
                const aktMonat = parseInt(currentMonth.month);
                const zielJ = parseInt(targetYear);
                const zielM = parseInt(targetMonth);

                logger.info(`🗓️ Navigation: Aktuell ${aktMonat}/${aktJahr}, Ziel ${zielM}/${zielJ}`);

                // Prüfen ob wir bereits am Ziel sind
                if (aktJahr === zielJ && aktMonat === zielM) {
                    logger.info(`✅ Bereits im Zielmonat ${targetMonth}/${targetYear}`);
                    return true;
                }

                // Navigationsrichtung bestimmen und Button suchen
                let navigationButton = null;
                
                if (aktJahr > zielJ || (aktJahr === zielJ && aktMonat > zielM)) {
                    // Zurück navigieren
                    logger.info(`⬅️ Navigiere einen Monat zurück von ${currentMonth.text}`);
                    
                    // Verschiedene Selektoren für den Zurück-Button versuchen
                    const prevSelectors = [
                        '.dx-calendar-navigator-previous-month',
                        '.dx-calendar-navigator-previous',
                        '.dx-calendar-prev-button',
                        '.calendar-prev',
                        '.prev-month',
                        'button[aria-label*="previous"]',
                        'button[aria-label*="vorherig"]'
                    ];
                    
                    for (const selector of prevSelectors) {
                        navigationButton = await this.page.$(selector);
                        if (navigationButton) {
                            logger.info(`✅ Zurück-Button gefunden: ${selector}`);
                            break;
                        }
                    }
                    
                } else if (aktJahr < zielJ || (aktJahr === zielJ && aktMonat < zielM)) {
                    // Vorwärts navigieren
                    logger.info(`➡️ Navigiere einen Monat vor von ${currentMonth.text}`);
                    
                    // Verschiedene Selektoren für den Vor-Button versuchen
                    const nextSelectors = [
                        '.dx-calendar-navigator-next-month',
                        '.dx-calendar-navigator-next',
                        '.dx-calendar-next-button',
                        '.calendar-next',
                        '.next-month',
                        'button[aria-label*="next"]',
                        'button[aria-label*="nächst"]'
                    ];
                    
                    for (const selector of nextSelectors) {
                        navigationButton = await this.page.$(selector);
                        if (navigationButton) {
                            logger.info(`✅ Vor-Button gefunden: ${selector}`);
                            break;
                        }
                    }
                }

                if (!navigationButton) {
                    logger.error('❌ Navigations-Button nicht gefunden');
                    // Debug: Verfügbare Buttons loggen
                    await this.page.evaluate(() => {
                        const buttons = document.querySelectorAll('button, .btn, [role="button"]');
                        console.log('Verfügbare Buttons:', Array.from(buttons).map(btn => ({
                            tag: btn.tagName,
                            class: btn.className,
                            text: btn.textContent?.trim(),
                            ariaLabel: btn.getAttribute('aria-label')
                        })));
                    });
                    throw new Error('Navigations-Button nicht gefunden');
                }

                // Button klicken
                await navigationButton.click();

                // Warten bis Navigation abgeschlossen - erweiterte Wartezeit
                await new Promise(resolve => setTimeout(resolve, 1200));
                
                // Warten bis der neue Monat geladen ist - mit mehreren Versuchen
                let monthUpdated = false;
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        await this.page.waitForFunction(() => {
                            const caption = document.querySelector('.dx-calendar-caption-button .dx-button-text') ||
                                           document.querySelector('.dx-calendar-caption .dx-button-text');
                            return caption && caption.textContent.trim() !== '';
                        }, { timeout: 3000 });
                        
                        monthUpdated = true;
                        break;
                    } catch (waitError) {
                        logger.warn(`⚠️ Warte-Versuch ${attempt + 1}/3 für Monats-Update fehlgeschlagen`);
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
                
                if (!monthUpdated) {
                    logger.warn('⚠️ Monat-Update nicht bestätigt, versuche trotzdem weiter');
                }
                
                navigations++;
                
                // Debug: Screenshot nach Navigation
                await this.createScreenshot(`navigation_step_${navigations}_${targetMonth}_${targetYear}`, `Navigation Schritt ${navigations} zu ${targetMonth}/${targetYear}`);
            }

            throw new Error(`Maximale Navigationen (${maxNavigations}) erreicht für Monat ${targetMonth}/${targetYear}`);

        } catch (error) {
            logger.error(`❌ Fehler bei der Monatsnavigation zu ${targetMonth}/${targetYear}:`, error);
            throw error;
        }
    }

    // Debug-Funktion für Screenshots
    async createScreenshot(name, description) {
        try {
            if (this.page) {
                const fs = require('fs');
                const path = require('path');
                
                // Sicherstellen, dass der logs Ordner existiert
                const logsDir = path.join(__dirname, '..', 'logs');
                if (!fs.existsSync(logsDir)) {
                    fs.mkdirSync(logsDir, { recursive: true });
                }
                
                const screenshotPath = path.join(logsDir, `debug_${name}_${Date.now()}.png`);
                await this.page.screenshot({ path: screenshotPath, fullPage: true });
                logger.info(`📸 Screenshot gespeichert: ${screenshotPath} - ${description}`);
                return screenshotPath;
            }
        } catch (error) {
            logger.warn(`⚠️ Fehler beim Erstellen des Screenshots ${name}:`, error);
        }
    }

    async debugScreenshot(name, description) {
        try {
            const fs = require('fs');
            const path = require('path');
            
            // Sicherstellen, dass der logs Ordner existiert
            const logsDir = path.join(__dirname, '..', 'logs');
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }
            
            const filename = path.join(logsDir, `debug_${name}_${Date.now()}.png`);
            await this.page.screenshot({ path: filename, fullPage: true });
            logger.info(`📸 Screenshot gespeichert: ${filename} - ${description}`);
            return filename;
        } catch (error) {
            logger.warn(`⚠️ Screenshot konnte nicht erstellt werden: ${error.message}`);
            return null;
        }
    }

    // Öffentliche Methoden
    startMonitoring() {
        this.isMonitoringActive = true;
        // Synchronisation mit Config beim Start
        this.syncWithConfig();
        logger.info('🚀 Monitoring gestartet');
    }

    stopMonitoring() {
        this.isMonitoringActive = false;
        logger.info('⏹️ Monitoring gestoppt');
    }

    updateTargetUrl(newUrl) {
        this.targetUrl = newUrl;
        logger.info(`🔄 Ziel-URL aktualisiert: ${newUrl}`);
    }

    getTargetUrl() {
        return this.targetUrl;
    }

    addWatchedDate(dateStr) {
        this.watchedDates.add(dateStr);
        logger.info(`➕ Termin zur Überwachung hinzugefügt: ${dateStr}`);
        // Synchronisation nach hinzufügen
        this.syncWithConfig();
    }

    removeWatchedDate(dateStr) {
        this.watchedDates.delete(dateStr);
        logger.info(`➖ Termin aus Überwachung entfernt: ${dateStr}`);
    }

    // Synchronisation mit configService
    syncWithConfig() {
        // Konfiguration neu laden
        this.configService.loadConfig();
        const configDates = this.configService.getMonitoredDates();
        
        logger.info(`🔄 Synchronisation - Config hat ${configDates.length} Termine: ${JSON.stringify(configDates)}`);
        logger.info(`🔄 Synchronisation - Monitor hat ${this.watchedDates.size} Termine: ${JSON.stringify(Array.from(this.watchedDates))}`);
        
        // Aktualisiere watchedDates basierend auf configService
        this.watchedDates.clear();
        configDates.forEach(date => {
            this.watchedDates.add(date);
        });
        
        logger.info(`🔄 Synchronisation abgeschlossen: ${this.watchedDates.size} überwachte Termine`);
    }

    getWatchedDates() {
        return Array.from(this.watchedDates);
    }

    // Get the last appointment check results
    getLastResults() {
        return this.lastResults || [];
    }

    getLastCheckTime() {
        return this.lastCheckTime;
    }

    isRunning() {
        return !!this.monitoringInterval;
    }

    async cleanup() {
        try {
            // Stoppe zuerst das kontinuierliche Monitoring
            this.stopContinuousMonitoring();
            
            // Bereinige Browser-Ressourcen
            await this.cleanupBrowser();
            
            logger.info('🧹 Vollständige Bereinigung abgeschlossen');
        } catch (error) {
            logger.error('❌ Fehler beim Bereinigen:', error);
        }
    }

    // Kontinuierliche Überwachung starten
    async startContinuousMonitoring(intervalMinutes = 5, intervalSeconds = 0) {
        if (this.monitoringInterval) {
            logger.warn('⚠️ Kontinuierliche Überwachung läuft bereits');
            return;
        }

        // Speichere die Intervall-Parameter für spätere Verwendung
        this.monitoringIntervalMinutes = intervalMinutes;
        this.monitoringIntervalSeconds = intervalSeconds;

        const totalSeconds = intervalMinutes * 60 + intervalSeconds;
        const intervalMs = totalSeconds * 1000;
        
        const timeString = `${intervalMinutes}:${intervalSeconds.toString().padStart(2, '0')}`;
        logger.info(`🔄 Starte kontinuierliche Überwachung (alle ${timeString} Min)`);

        // Status sofort auf "initializing" setzen für sofortiges UI-Feedback
        this.monitoringInterval = 'initializing';
        this.isMonitoringActive = true;
        
        try {
            // Synchronisation mit Config beim Start
            this.syncWithConfig();
            
            // Einmalige Initialisierung - Browser starten und zur Terminseite navigieren
            await this.initializeForContinuousMonitoring();
            
            // Nach der Initialisierung den Status auf "active" setzen
            logger.info('✅ Browser-Initialisierung abgeschlossen, starte regelmäßige Überwachung');
            
            // Sofortige erste Prüfung
            await this.checkDatesOnly();

            // Regelmäßige Prüfungen planen - nur die Terminprüfung, nicht die komplette Initialisierung
            this.monitoringInterval = setInterval(async () => {
                try {
                    logger.info('🔍 Regelmäßige Terminprüfung...');
                    
                    // Robuste Browser-Prüfung und Wiederherstellung
                    await this.ensureBrowserIsActive();
                    
                    // Nur die Terminprüfung durchführen
                    await this.checkDatesOnly();
                    
                    // Erfolgreiche Prüfung - Fehler-Counter zurücksetzen
                    this.consecutiveErrors = 0;
                    
                } catch (error) {
                    this.consecutiveErrors = (this.consecutiveErrors || 0) + 1;
                    logger.error(`❌ Fehler bei regelmäßiger Terminprüfung (${this.consecutiveErrors}/3):`, error);
                    
                    // Bei wiederholten Fehlern die Überwachung pausieren
                    if (this.consecutiveErrors >= 3) {
                        logger.warn('⚠️ Zu viele aufeinanderfolgende Fehler, pausiere Überwachung');
                        this.stopContinuousMonitoring();
                        
                        // Nach 30 Minuten wieder versuchen
                        setTimeout(() => {
                            logger.info('🔄 Versuche Überwachung nach Fehlerpause neu zu starten...');
                            this.consecutiveErrors = 0;
                            this.startContinuousMonitoring(this.monitoringIntervalMinutes, this.monitoringIntervalSeconds);
                        }, 30 * 60 * 1000);
                    }
                }
            }, intervalMs);
            
        } catch (error) {
            // Bei Fehler Status zurücksetzen
            this.monitoringInterval = null;
            this.isMonitoringActive = false;
            logger.error('❌ Fehler beim Starten der kontinuierlichen Überwachung:', error);
            throw error;
        }
    }

    // Kontinuierliche Überwachung stoppen
    stopContinuousMonitoring() {
        if (this.monitoringInterval) {
            if (this.monitoringInterval !== 'initializing') {
                clearInterval(this.monitoringInterval);
            }
            this.monitoringInterval = null;
            this.isMonitoringActive = false;
            
            // Lösche die gespeicherten Intervall-Parameter
            this.monitoringIntervalMinutes = undefined;
            this.monitoringIntervalSeconds = undefined;
            
            logger.info('🛑 Kontinuierliche Überwachung gestoppt');
            
            // Browser laufen lassen für mögliche sofortige Terminprüfungen
            // Wird erst beim cleanup() geschlossen
        }
    }

    // Status der Überwachung
    getMonitoringStatus() {
        // Synchronisiere überwachte Termine vor Statusabfrage
        this.syncWithConfig();
        
        const isInitializing = this.monitoringInterval === 'initializing';
        const isActive = !!this.monitoringInterval && this.monitoringInterval !== null;
        
        // Erweiterte Browser-Status-Prüfung
        let browserActive = false;
        try {
            browserActive = !!(this.browser && this.page && !this.page.isClosed());
        } catch (error) {
            browserActive = false;
        }
        
        return {
            isActive: isActive,
            isInitializing: isInitializing,
            isCurrentlyChecking: this.isMonitoringActive,
            lastCheckTime: this.lastCheckTime,
            consecutiveErrors: this.consecutiveErrors || 0,
            checkCount: this.checkCount || 0,
            browserActive: browserActive,
            targetUrl: this.targetUrl,
            intervalMinutes: this.monitoringIntervalMinutes,
            intervalSeconds: this.monitoringIntervalSeconds
        };
    }

    // Sofortige Terminprüfung (nutzt persistente Browser-Session falls verfügbar)
    async checkAppointmentsImmediate() {
        try {
            logger.info('🔍 Sofortige Terminprüfung...');
            
            // Prüfe ob kontinuierliche Überwachung läuft und Browser initialisiert ist
            if (this.monitoringInterval && this.monitoringInterval !== 'initializing') {
                logger.info('💡 Nutze persistente Browser-Session für sofortige Prüfung');
                
                // Stelle sicher, dass Browser aktiv ist
                await this.ensureBrowserIsActive();
                
                return await this.checkDatesOnly();
            } else {
                logger.info('🔄 Fallback zur kompletten Terminprüfung (keine persistente Session)');
                return await this.checkAppointments();
            }
            
        } catch (error) {
            logger.error('❌ Fehler bei sofortiger Terminprüfung:', error);
            throw error;
        }
   }

    // Robuste Browser-Wiederherstellung
    async ensureBrowserIsActive() {
        try {
            // Prüfe ob Browser und Page existieren
            if (!this.browser || !this.page) {
                logger.info('🔄 Browser oder Page nicht vorhanden, initialisiere neu...');
                await this.initialize();
                return;
            }

            // Prüfe ob Browser noch läuft
            if (this.browser.isConnected && this.browser.isConnected()) {
                // Browser läuft, prüfe Page
                try {
                    if (this.page.isClosed()) {
                        logger.info('🔄 Page ist geschlossen, erstelle neue Page...');
                        this.page = await this.browser.newPage();
                        await this.page.setUserAgent(this.configService.getUserAgent());
                        await this.page.setViewport({ width: 1920, height: 1080 });
                        await this.page.setExtraHTTPHeaders({
                            'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
                        });
                        await this.page.emulateTimezone('Europe/Berlin');
                    } else {
                        // Page ist aktiv, teste mit einfacher Evaluation
                        await this.page.evaluate(() => document.title);
                        logger.debug('✅ Browser und Page sind aktiv');
                    }
                } catch (pageError) {
                    logger.warn('⚠️ Page-Test fehlgeschlagen, erstelle neue Page:', pageError);
                    try {
                        this.page = await this.browser.newPage();
                        await this.page.setUserAgent(this.configService.getUserAgent());
                        await this.page.setViewport({ width: 1920, height: 1080 });
                        await this.page.setExtraHTTPHeaders({
                            'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
                        });
                        await this.page.emulateTimezone('Europe/Berlin');
                    } catch (newPageError) {
                        logger.error('❌ Konnte keine neue Page erstellen:', newPageError);
                        throw newPageError;
                    }
                }
            } else {
                throw new Error('Browser nicht mehr verbunden');
            }
        } catch (error) {
            logger.warn('⚠️ Browser-Verbindung verloren, initialisiere komplett neu:', error);
            await this.cleanup();
            await this.initialize();
        }
    }

    // Hilfsfunktion um sicherzustellen, dass wir in der Kalenderansicht sind
    async ensureCalendarView() {
        try {
            logger.info('🔄 Stelle sicher, dass wir in der Kalenderansicht sind...');
            
            // Prüfe ob wir bereits in der Kalenderansicht sind
            const isInCalendar = await this.page.evaluate(() => {
                const selectors = [
                    '.dx-calendar-caption-button .dx-button-text',
                    '.dx-calendar-caption .dx-button-text',
                    'td[data-value]'
                ];
                
                for (const selector of selectors) {
                    if (document.querySelector(selector)) {
                        return true;
                    }
                }
                return false;
            });
            
            if (isInCalendar) {
                logger.info('✅ Bereits in der Kalenderansicht');
                return;
            }
            
            // Wenn nicht in Kalenderansicht, versuche zur Kalenderseite zu navigieren
            logger.info('🔄 Nicht in Kalenderansicht - navigiere zurück...');
            
            // Versuche verschiedene Methoden zur Kalender-Navigation
            const currentUrl = this.page.url();
            logger.info(`📍 Aktuelle URL: ${currentUrl}`);
            
            // Methode 1: Zurück-Button suchen
            const backButton = await this.page.$('a[href*="calendar"], .btn-back, .back-button, a[title*="zurück"], a[title*="Zurück"], .breadcrumb a');
            if (backButton) {
                logger.info('🔄 Verwende Zurück-Button');
                await backButton.click();
                await this.page.waitForFunction(() => {
                    return document.querySelector('.dx-calendar-caption-button .dx-button-text') ||
                           document.querySelector('td[data-value]');
                }, { timeout: 10000 });
                return;
            }
            
            // Methode 2: Browser-Navigation
            logger.info('🔄 Verwende Browser-Navigation');
            await this.page.goBack();
            await this.page.waitForFunction(() => {
                return document.querySelector('.dx-calendar-caption-button .dx-button-text') ||
                       document.querySelector('td[data-value]');
            }, { timeout: 10000 });
            
        } catch (error) {
            logger.error('❌ Fehler beim Sicherstellen der Kalenderansicht:', error);
            // Letzter Fallback: Komplett neu initialisieren
            logger.info('🔄 Letzter Fallback: Seite neu laden...');
            await this.page.reload({ waitUntil: 'networkidle0' });
            await this.page.waitForFunction(() => {
                return document.querySelector('.dx-calendar-caption-button .dx-button-text') ||
                       document.querySelector('td[data-value]');
            }, { timeout: 15000 });
        }
    }

    // Browser-Cleanup
    async cleanupBrowser() {
        try {
            logger.info('🧹 Bereinige Browser-Ressourcen...');
            
            if (this.page) {
                try {
                    if (!this.page.isClosed()) {
                        await this.page.close();
                    }
                } catch (error) {
                    logger.warn('⚠️ Fehler beim Schließen der Page:', error.message);
                }
                this.page = null;
            }

            if (this.browser) {
                try {
                    await this.browser.close();
                } catch (error) {
                    logger.warn('⚠️ Fehler beim Schließen des Browsers:', error.message);
                }
                this.browser = null;
            }

            logger.info('✅ Browser-Ressourcen bereinigt');
        } catch (error) {
            logger.error('❌ Fehler beim Bereinigen der Browser-Ressourcen:', error);
            // Forciere Null-Setzen
            this.page = null;
            this.browser = null;
        }
    }

    // Prüfe Browser-Status
    isBrowserActive() {
        try {
            return !!(this.browser && this.page && !this.page.isClosed() && this.browser.isConnected());
        } catch (error) {
            return false;
        }
    }

    // Static method to get singleton instance
    static getInstance() {
        if (!AppointmentMonitor.instance) {
            new AppointmentMonitor();
        }
        return AppointmentMonitor.instance;
    }

    // Static method to clear singleton instance (useful for testing)
    static clearInstance() {
        AppointmentMonitor.instance = null;
    }
}

// Static property to hold the singleton instance
AppointmentMonitor.instance = null;

module.exports = AppointmentMonitor;
