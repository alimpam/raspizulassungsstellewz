const puppeteer = require('puppeteer');
const EventEmitter = require('events');
const logger = require('../utils/logger');

class AppointmentMonitor extends EventEmitter {
    constructor() {
        super();
        this.browser = null;
        this.page = null;
        this.isRunning = false;
        this.lastCheckTime = null;
        this.targetUrl = 'https://termine-kfz.lahn-dill-kreis.de/';
        this.watchedDates = new Set();
        this.foundAppointments = new Set();
    }

    async initialize() {
        try {
            logger.info('🤖 Initialisiere Puppeteer Browser...');
            
            this.browser = await puppeteer.launch({
                headless: true,
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
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            await this.page.setViewport({ width: 1920, height: 1080 });
            
            logger.info('✅ Browser erfolgreich initialisiert');
            return true;
        } catch (error) {
            logger.error('❌ Fehler beim Initialisieren des Browsers:', error);
            this.emit('error', error);
            return false;
        }
    }

    async checkAppointments() {
        if (!this.browser || !this.page) {
            await this.initialize();
        }

        try {
            this.lastCheckTime = new Date();
            logger.info('🔍 Starte Terminprüfung...');

            // Seite laden
            await this.page.goto(this.targetUrl, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // Warten auf Kalender
            await this.page.waitForSelector('.dx-calendar-caption-button .dx-button-text', {
                timeout: 10000
            });

            logger.info('📅 Kalender geladen');

            // Alle überwachten Termine prüfen
            const results = [];
            for (const dateStr of this.watchedDates) {
                const result = await this.checkSingleDate(dateStr);
                results.push(result);
                
                // Kurze Pause zwischen Checks
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const availableCount = results.filter(r => r.available).length;
            logger.info(`✅ Terminprüfung abgeschlossen: ${availableCount}/${results.length} Termine verfügbar`);

            return results;

        } catch (error) {
            logger.error('❌ Fehler bei der Terminprüfung:', error);
            this.emit('error', error);
            return [];
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
                await this.page.waitForTimeout(800);
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

    // Öffentliche Methoden
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
        return this.isRunning;
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
