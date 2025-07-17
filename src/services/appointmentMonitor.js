const puppeteer = require('puppeteer');
const EventEmitter = require('events');
const logger = require('../utils/logger');
const configService = require('./configService');

class AppointmentMonitor extends EventEmitter {
    constructor() {
        super();
        this.browser = null;
        this.page = null;
        this.isMonitoringActive = false;
        this.lastCheckTime = null;
        this.configService = new configService();
        this.targetUrl = this.configService.getWebsiteUrl();
        this.watchedDates = new Set();
        this.foundAppointments = new Set();
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
                    '--window-size=1920,1080'
                ]
            });

            this.page = await this.browser.newPage();
            await this.page.setUserAgent(this.configService.getUserAgent());
            await this.page.setViewport({ width: 1920, height: 1080 });
            
            logger.info('✅ Browser erfolgreich initialisiert');
            return true;
        } catch (error) {
            logger.error('❌ Fehler beim Initialisieren des Browsers:', error);
            this.emit('error', error);
            return false;
        }
    }

    // Debug-Hilfsfunktionen
    async takeScreenshot(name) {
        try {
            if (this.page) {
                const screenshotPath = `debug_${name}_${Date.now()}.png`;
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

            // Seite laden
            logger.info(`🌐 Lade Seite: ${this.targetUrl}`);
            await this.page.goto(this.targetUrl, { 
                waitUntil: 'networkidle0',
                timeout: puppeteerOptions.timeout
            });

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
                await this.page.screenshot({ path: 'debug_no_next_button.png' });
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
                await this.page.waitForSelector('.dx-calendar-caption-button .dx-button-text', {
                    timeout: puppeteerOptions.timeout
                });
                logger.info('📅 Kalender geladen');
            } catch (error) {
                logger.warn('⚠️ Kalender-Hauptselektor nicht gefunden - versuche alternative Selektoren...');
                // Alternative Selektoren versuchen
                const alternativeSelectors = [
                    '.dx-calendar',
                    '.calendar',
                    '[data-calendar]',
                    '.appointment-calendar'
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
                    throw new Error('Kalender konnte nicht geladen werden');
                }
            }

            await this.debugScreenshot('calendar_loaded', 'Kalender geladen');

            // Alle überwachten Termine prüfen
            const results = [];
            for (const dateStr of this.watchedDates) {
                const result = await this.checkSingleDate(dateStr);
                results.push(result);
                
                // Kurze Pause zwischen Checks
                await new Promise(resolve => setTimeout(resolve, puppeteerOptions.waitForNetworkIdle));
            }

            const availableCount = results.filter(r => r.available).length;
            logger.info(`✅ Terminprüfung abgeschlossen: ${availableCount}/${results.length} Termine verfügbar`);

            return results;

        } catch (error) {
            logger.error('❌ Fehler bei der Terminprüfung:', error);
            this.emit('error', error);
            return [];
        } finally {
            this.isMonitoringActive = false;
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
                        textContent: btn.textContent,
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
            
            logger.info(`🔍 Prüfe Termin: ${germanDate}`);

            // Zum gewünschten Monat navigieren
            await this.navigateToMonth(yyyy, mm);

            // Termin-Zelle suchen
            const cell = await this.page.$(`td[data-value="${dateStr}"]`);
            if (!cell) {
                logger.warn(`⚠️ Termin ${germanDate} nicht im Kalender gefunden`);
                return { date: dateStr, available: false, reason: 'Nicht im Kalender gefunden' };
            }

            // Klassen der Zelle analysieren
            const classes = await cell.evaluate(el => el.className);
            const isGreen = classes.includes('bg-success');
            const isEnabled = !classes.includes('disabled-date');

            const result = {
                date: dateStr,
                germanDate,
                available: isGreen && isEnabled,
                classes,
                timestamp: new Date().toISOString()
            };

            if (result.available && !this.foundAppointments.has(dateStr)) {
                this.foundAppointments.add(dateStr);
                
                // Versuche zusätzliche Informationen zu extrahieren
                const appointmentInfo = await this.extractAppointmentInfo(cell);
                
                this.emit('appointmentFound', {
                    ...result,
                    ...appointmentInfo,
                    url: this.targetUrl
                });
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

            while (navigations < maxNavigations) {
                // Aktuellen Monat ermitteln
                const currentMonth = await this.page.evaluate(() => {
                    const caption = document.querySelector('.dx-calendar-caption-button .dx-button-text');
                    if (!caption) return null;
                    
                    const text = caption.textContent.trim();
                    const [monat, jahr] = text.split(' ');
                    
                    const monthMap = {
                        'Januar': '01', 'Februar': '02', 'März': '03', 'April': '04',
                        'Mai': '05', 'Juni': '06', 'Juli': '07', 'August': '08',
                        'September': '09', 'Oktober': '10', 'November': '11', 'Dezember': '12'
                    };
                    
                    return {
                        year: jahr,
                        month: monthMap[monat],
                        text: text
                    };
                });

                if (!currentMonth) {
                    throw new Error('Kann aktuellen Monat nicht ermitteln');
                }

                // Prüfen ob wir bereits am Ziel sind
                if (currentMonth.year === targetYear && currentMonth.month === targetMonth) {
                    logger.info(`✅ Zielmonat ${targetMonth}/${targetYear} erreicht`);
                    return true;
                }

                // Navigationsrichtung bestimmen
                const currentDate = new Date(currentMonth.year, parseInt(currentMonth.month) - 1);
                const targetDate = new Date(targetYear, parseInt(targetMonth) - 1);

                if (currentDate > targetDate) {
                    // Zurück navigieren
                    await this.page.click('.dx-calendar-navigator-previous-month');
                    logger.info(`⬅️ Navigiere zurück von ${currentMonth.text}`);
                } else {
                    // Vorwärts navigieren
                    await this.page.click('.dx-calendar-navigator-next-month');
                    logger.info(`➡️ Navigiere vorwärts von ${currentMonth.text}`);
                }

                // Warten bis Navigation abgeschlossen
                await new Promise(resolve => setTimeout(resolve, 800));
                navigations++;
            }

            throw new Error(`Maximale Navigationen (${maxNavigations}) erreicht`);

        } catch (error) {
            logger.error('❌ Fehler bei der Monatsnavigation:', error);
            throw error;
        }
    }

    async extractAppointmentInfo(cell) {
        try {
            // Versuche zusätzliche Informationen zu extrahieren
            const info = await cell.evaluate(el => {
                const timeElement = el.querySelector('.appointment-time');
                const typeElement = el.querySelector('.appointment-type');
                
                return {
                    time: timeElement ? timeElement.textContent.trim() : 'Nicht angegeben',
                    type: typeElement ? typeElement.textContent.trim() : 'Standard'
                };
            });

            return info;
        } catch (error) {
            logger.warn('⚠️ Konnte keine zusätzlichen Termin-Informationen extrahieren:', error);
            return {
                time: 'Nicht angegeben',
                type: 'Standard'
            };
        }
    }

    // Debug-Funktion für Screenshots
    async debugScreenshot(name, description) {
        try {
            const filename = `debug_${name}_${Date.now()}.png`;
            await this.page.screenshot({ path: filename, fullPage: true });
            logger.info(`📸 Screenshot gespeichert: ${filename} - ${description}`);
            return filename;
        } catch (error) {
            logger.warn(`⚠️ Screenshot konnte nicht erstellt werden: ${error.message}`);
            return null;
        }
    }

    // Debug-Hilfsfunktionen
    async takeScreenshot(name) {
        try {
            if (this.page) {
                const screenshotPath = `debug_${name}_${Date.now()}.png`;
                await this.page.screenshot({ path: screenshotPath, fullPage: true });
                logger.info(`📸 Screenshot gespeichert: ${screenshotPath}`);
                return screenshotPath;
            }
        } catch (error) {
            logger.warn(`⚠️ Fehler beim Erstellen des Screenshots ${name}:`, error);
        }
    }

    // Öffentliche Methoden
    startMonitoring() {
        this.isMonitoringActive = true;
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
    }

    removeWatchedDate(dateStr) {
        this.watchedDates.delete(dateStr);
        this.foundAppointments.delete(dateStr);
        logger.info(`➖ Termin aus Überwachung entfernt: ${dateStr}`);
    }

    getWatchedDates() {
        return Array.from(this.watchedDates);
    }

    getFoundAppointments() {
        return Array.from(this.foundAppointments);
    }

    getLastCheckTime() {
        return this.lastCheckTime;
    }

    isRunning() {
        return this.isMonitoringActive;
    }

    async cleanup() {
        try {
            if (this.page) {
                await this.page.close();
            }
            if (this.browser) {
                await this.browser.close();
            }
            logger.info('🧹 Browser-Ressourcen bereinigt');
        } catch (error) {
            logger.error('❌ Fehler beim Bereinigen der Browser-Ressourcen:', error);
        }
    }
}

module.exports = AppointmentMonitor;
