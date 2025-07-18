/**
 * Data Management Module
 * Handles data loading, caching, and synchronization
 */

class DataManager {
    constructor() {
        this.updateInterval = null;
        this.isLoading = false;
        this.datesData = [];
    }

    /**
     * Initialize data loading and auto-refresh
     */
    initialize() {
        console.log('DataManager: Initializing...');
        
        // Initial load
        this.loadAllData();
        
        // Setup auto-refresh intervals
        this.setupAutoRefresh();
    }

    /**
     * Setup automatic refresh intervals
     */
    setupAutoRefresh() {
        // Main status refresh - every 5 seconds
        setInterval(() => this.loadSystemStatus(), 5000);
        
        // Dates refresh - every 10 seconds
        setInterval(() => this.loadDates(), 10000);
        
        // Other data - every 30 seconds
        setInterval(() => {
            this.loadNotificationStatus();
            this.loadLocation();
            this.loadServices();
        }, 30000);
    }

    /**
     * Load all data on initialization
     */
    async loadAllData() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        try {
            console.log('DataManager: Loading all data...');
            
            // Load dates first to initialize datesData
            await this.loadDates();
            
            // Load other data in parallel
            await Promise.all([
                this.loadSystemStatus(),
                this.loadNotificationStatus(),
                this.loadLocation(),
                this.loadServices()
            ]);
            
            console.log('DataManager: All data loaded successfully');
        } catch (error) {
            console.error('DataManager: Failed to load initial data:', error);
            uiManager.showAlert('Fehler beim Laden der Daten. Bitte Seite neu laden.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Load system status
     */
    async loadSystemStatus() {
        try {
            const [systemData, monitoringData] = await Promise.all([
                apiClient.getSystemStatus(),
                apiClient.getMonitoringStatus()
            ]);
            
            // Merge monitoring data into system data
            uiManager.systemData = {
                ...systemData,
                detailedMonitoring: monitoringData
            };
            
            uiManager.updateStatusUI();
        } catch (error) {
            console.error('Failed to load system status:', error);
        }
    }

    /**
     * Load dates data
     */
    async loadDates() {
        try {
            const dates = await apiClient.getDates();
            
            // Process dates and detect changes
            const processedDates = this.processDatesData(dates);
            
            // Store processed dates for statistics
            this.datesData = processedDates;
            
            // Update UI
            uiManager.updateDatesDisplay(processedDates);
            
            // Detect appointment changes for events
            appointmentEventManager.detectAppointmentChanges(processedDates);
            
            console.log('Dates loaded:', processedDates.length);
        } catch (error) {
            console.error('Failed to load dates:', error);
            uiManager.showAlert('Fehler beim Laden der Termine', 'error');
        }
    }

    /**
     * Process dates data
     */
    processDatesData(dates) {
        if (!Array.isArray(dates)) {
            console.warn('Dates data is not an array:', dates);
            return [];
        }
        
        return dates.map(date => ({
            ...date,
            germanDate: this.formatGermanDate(date.date),
            isAvailable: date.isAvailable || false,
            hasBeenChecked: date.hasBeenChecked || false
        }));
    }

    /**
     * Format date to German format
     */
    formatGermanDate(dateStr) {
        if (!dateStr) return '';
        
        try {
            const [year, month, day] = dateStr.split('/');
            return `${day}.${month}.${year}`;
        } catch (error) {
            console.warn('Failed to format date:', dateStr);
            return dateStr;
        }
    }

    /**
     * Load notification status
     */
    async loadNotificationStatus() {
        try {
            const notifications = await apiClient.getNotificationStatus();
            uiManager.updateNotificationDisplay(notifications);
        } catch (error) {
            console.error('Failed to load notification status:', error);
        }
    }

    /**
     * Load location data
     */
    async loadLocation() {
        try {
            const locationData = await apiClient.getLocation();
            uiManager.updateLocationDisplay(locationData);
        } catch (error) {
            console.error('Failed to load location:', error);
        }
    }

    /**
     * Load services data
     */
    async loadServices() {
        try {
            const services = await apiClient.getServices();
            uiManager.updateServicesDisplay(services);
        } catch (error) {
            console.error('Failed to load services:', error);
        }
    }

    /**
     * Add new date
     */
    async addDate(dateStr) {
        try {
            const result = await apiClient.addDate(dateStr);
            
            if (result.success) {
                uiManager.showAlert(`Termin ${this.formatGermanDate(dateStr)} hinzugefügt`, 'success');
                // Reload dates to update UI
                await this.loadDates();
            } else {
                uiManager.showAlert(result.message || 'Fehler beim Hinzufügen des Termins', 'error');
            }
            
            return result;
        } catch (error) {
            console.error('Failed to add date:', error);
            uiManager.showAlert('Fehler beim Hinzufügen des Termins', 'error');
            throw error;
        }
    }

    /**
     * Remove date
     */
    async removeDate(dateStr) {
        try {
            const result = await apiClient.removeDate(dateStr);
            
            if (result.success) {
                uiManager.showAlert(`Termin ${this.formatGermanDate(dateStr)} entfernt`, 'success');
                // Reload dates to update UI
                await this.loadDates();
            } else {
                uiManager.showAlert(result.message || 'Fehler beim Entfernen des Termins', 'error');
            }
            
            return result;
        } catch (error) {
            console.error('Failed to remove date:', error);
            uiManager.showAlert('Fehler beim Entfernen des Termins', 'error');
            throw error;
        }
    }

    /**
     * Start monitoring
     */
    async startMonitoring(intervalMinutes, intervalSeconds) {
        try {
            const result = await apiClient.startMonitoring(intervalMinutes, intervalSeconds);
            
            if (result.success) {
                uiManager.showAlert('Monitoring gestartet', 'success');
                // Immediate status update
                await this.loadSystemStatus();
            } else {
                uiManager.showAlert(result.message || 'Fehler beim Starten des Monitoring', 'error');
            }
            
            return result;
        } catch (error) {
            console.error('Failed to start monitoring:', error);
            uiManager.showAlert('Fehler beim Starten des Monitoring', 'error');
            throw error;
        }
    }

    /**
     * Stop monitoring
     */
    async stopMonitoring() {
        try {
            const result = await apiClient.stopMonitoring();
            
            if (result.success) {
                uiManager.showAlert('Monitoring gestoppt', 'success');
                // Immediate status update
                await this.loadSystemStatus();
            } else {
                uiManager.showAlert(result.message || 'Fehler beim Stoppen des Monitoring', 'error');
            }
            
            return result;
        } catch (error) {
            console.error('Failed to stop monitoring:', error);
            uiManager.showAlert('Fehler beim Stoppen des Monitoring', 'error');
            throw error;
        }
    }

    /**
     * Check appointments immediately
     */
    async checkAppointments() {
        // Update button to show checking status
        this.updateCheckButton(true);
        
        try {
            const result = await apiClient.checkAppointments();
            
            if (result.success) {
                // Reload dates to show updated results
                await this.loadDates();
                await this.loadSystemStatus();
            } else {
                uiManager.showAlert(result.message || 'Fehler bei der Terminprüfung', 'error');
            }
            
            return result;
        } catch (error) {
            console.error('Failed to check appointments:', error);
            uiManager.showAlert('Fehler bei der Terminprüfung', 'error');
            throw error;
        } finally {
            // Reset button to normal state
            this.updateCheckButton(false);
        }
    }

    /**
     * Update check button status
     */
    updateCheckButton(isChecking) {
        const btn = document.getElementById('checkNowBtn');
        const icon = document.getElementById('checkStatusIcon');
        const text = document.getElementById('checkBtnText');
        
        if (btn && icon && text) {
            if (isChecking) {
                btn.disabled = true;
                btn.className = 'btn btn-warning';
                icon.textContent = '⏳';
                text.textContent = 'Prüfung läuft...';
            } else {
                btn.disabled = false;
                btn.className = 'btn btn-success';
                icon.textContent = '🔍';
                text.textContent = 'Jetzt prüfen';
            }
        }
    }

    /**
     * Test notification
     */
    async testNotification() {
        try {
            const result = await apiClient.testNotification();
            
            if (result.success) {
                uiManager.showAlert('Test-Benachrichtigung gesendet', 'success');
            } else {
                uiManager.showAlert(result.message || 'Fehler beim Senden der Test-Benachrichtigung', 'error');
            }
            
            return result;
        } catch (error) {
            console.error('Failed to test notification:', error);
            uiManager.showAlert('Fehler beim Senden der Test-Benachrichtigung', 'error');
            throw error;
        }
    }
}

// Export singleton instance
const dataManager = new DataManager();
