/**
 * Main Application Module
 * Coordinates all modules and handles global app logic
 */

class App {
    constructor() {
        this.isInitialized = false;
        this.systemData = {};
        this.refreshInterval = null;
    }

    /**
     * Initialize the application
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('🚀 Initializing Terminüberwachung App...');
        
        try {
            // Initialize audio system first (uses sound.js)
            await audioManager.initialize();
            
            // Update sound status in UI
            uiManager.updateSoundStatus();
            
            // Initialize data loading (this will call loadAllData internally)
            dataManager.initialize();
            
            // Setup global event handlers
            this.setupEventHandlers();
            
            // Setup form validation
            this.setupFormValidation();
            
            // Start refresh intervals
            this.startRefreshIntervals();
            
            this.isInitialized = true;
            console.log('✅ App initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            uiManager.showAlert('Fehler beim Initialisieren der Anwendung', 'error');
        }
    }

    /**
     * Start refresh intervals
     */
    startRefreshIntervals() {
        // Auto-refresh status every 5 seconds for better real-time updates
        setInterval(() => this.loadSystemStatus(), 5000);
        
        // Refresh dates every 10 seconds
        setInterval(() => dataManager.loadDates(), 10000);
    }

    /**
     * Setup global event handlers
     */
    setupEventHandlers() {
        // Handle form submissions
        this.setupFormHandlers();
        
        // Handle keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Handle page visibility changes
        this.setupVisibilityHandler();
    }

    /**
     * Setup form handlers
     */
    setupFormHandlers() {
        // Date form
        const addDateForm = document.getElementById('addDateForm');
        if (addDateForm) {
            addDateForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddDate();
            });
        }
        
        // Interval form
        const intervalForm = document.getElementById('intervalForm');
        if (intervalForm) {
            intervalForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleIntervalUpdate();
            });
        }
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + T: Test notification
            if ((e.ctrlKey || e.metaKey) && e.key === 't') {
                e.preventDefault();
                this.testNotification();
            }
            
            // Ctrl/Cmd + M: Toggle monitoring
            if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
                e.preventDefault();
                this.toggleMonitoring();
            }
        });
    }

    /**
     * Setup page visibility handler
     */
    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // Page became visible - refresh data
                console.log('Page became visible - refreshing data');
                dataManager.loadAllData();
            }
        });
    }

    /**
     * Setup form validation
     */
    setupFormValidation() {
        // Date input validation
        const dateInput = document.getElementById('dateInput');
        if (dateInput) {
            dateInput.addEventListener('input', this.validateDateInput.bind(this));
        }
        
        // Interval input validation
        const intervalInput = document.getElementById('intervalInput');
        if (intervalInput) {
            intervalInput.addEventListener('input', this.validateIntervalInput.bind(this));
        }
    }

    /**
     * Validate date input
     */
    validateDateInput(event) {
        const input = event.target;
        const value = input.value;
        
        // Basic date format validation (DD.MM.YYYY)
        const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
        
        if (value && !dateRegex.test(value)) {
            input.setCustomValidity('Bitte verwenden Sie das Format DD.MM.YYYY');
        } else {
            input.setCustomValidity('');
        }
    }

    /**
     * Validate interval input
     */
    validateIntervalInput(event) {
        const input = event.target;
        const value = input.value;
        
        // Interval format validation (M:SS or MM:SS)
        const intervalRegex = /^\d{1,2}:\d{2}$/;
        
        if (value && !intervalRegex.test(value)) {
            input.setCustomValidity('Bitte verwenden Sie das Format M:SS oder MM:SS');
        } else {
            input.setCustomValidity('');
        }
    }

    /**
     * Handle add date form submission
     */
    async handleAddDate() {
        const dateInput = document.getElementById('dateInput');
        if (!dateInput || !dateInput.value) return;
        
        try {
            // Convert date format to API format
            const inputDate = dateInput.value.trim();
            const apiDate = this.convertGermanDateToApiFormat(inputDate);
            
            await dataManager.addDate(apiDate);
            
            // Clear input
            dateInput.value = '';
            
        } catch (error) {
            console.error('Error adding date:', error);
        }
    }

    /**
     * Handle interval update
     */
    async handleIntervalUpdate() {
        const intervalInput = document.getElementById('intervalInput');
        if (!intervalInput || !intervalInput.value) return;
        
        try {
            const [minutes, seconds] = intervalInput.value.split(':').map(Number);
            
            if (isNaN(minutes) || isNaN(seconds)) {
                uiManager.showAlert('Ungültiges Intervall-Format', 'error');
                return;
            }
            
            // Update monitoring with new interval
            await dataManager.startMonitoring(minutes, seconds);
            
        } catch (error) {
            console.error('Error updating interval:', error);
        }
    }

    /**
     * Convert German date format to API format
     */
    /**
     * Convert date input to API format (YYYY/MM/DD)
     * Handles both ISO format (YYYY-MM-DD) and German format (DD.MM.YYYY)
     */
    convertGermanDateToApiFormat(inputDate) {
        // Handle different input formats
        if (inputDate.includes('-')) {
            // ISO format (YYYY-MM-DD) from HTML date input
            const [year, month, day] = inputDate.split('-');
            return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
        } else if (inputDate.includes('.')) {
            // German format (DD.MM.YYYY)
            const germanDateRegex = /^\d{1,2}\.\d{1,2}\.\d{4}$/;
            if (!germanDateRegex.test(inputDate)) {
                throw new Error('Ungültiges Datumsformat. Erwartet: DD.MM.YYYY oder verwenden Sie den Kalender');
            }
            
            const [day, month, year] = inputDate.split('.');
            
            // Validate date components
            const dayNum = parseInt(day, 10);
            const monthNum = parseInt(month, 10);
            const yearNum = parseInt(year, 10);
            
            if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900 || yearNum > 2100) {
                throw new Error('Ungültiges Datum');
            }
            
            return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
        } else {
            throw new Error('Ungültiges Datumsformat. Verwenden Sie den Kalender oder DD.MM.YYYY Format');
        }
    }

    /**
     * Refresh all data
     */
    async refreshAllData() {
        console.log('Refreshing all data...');
        // Removed the notification - silent refresh is better for UX
        await dataManager.loadAllData();
    }

    /**
     * Test notification
     */
    async testNotification() {
        console.log('Testing notification...');
        await dataManager.testNotification();
        audioManager.testNotificationSound();
    }

    /**
     * Toggle monitoring
     */
    async toggleMonitoring() {
        try {
            const monitoring = uiManager.systemData?.detailedMonitoring || uiManager.systemData?.monitoring;
            
            if (monitoring?.isActive) {
                await dataManager.stopMonitoring();
            } else {
                // Use default interval if none specified
                const intervalInput = document.getElementById('intervalInput');
                const intervalValue = intervalInput?.value || '5:00';
                const [minutes, seconds] = intervalValue.split(':').map(Number);
                
                await dataManager.startMonitoring(minutes || 5, seconds || 0);
            }
        } catch (error) {
            console.error('Error toggling monitoring:', error);
        }
    }

    /**
     * Check appointments immediately
     */
    async checkAppointments() {
        await dataManager.checkAppointments();
    }

    /**
     * Remove date
     */
    async removeDate(dateStr) {
        if (confirm(`Möchten Sie den Termin ${dataManager.formatGermanDate(dateStr)} wirklich entfernen?`)) {
            await dataManager.removeDate(dateStr);
        }
    }

    /**
     * Update service selection
     */
    async updateService(serviceKey, enabled) {
        try {
            // This would need to be implemented in the API and data manager
            console.log(`Service ${serviceKey}: ${enabled ? 'enabled' : 'disabled'}`);
            // TODO: Implement service update API call
        } catch (error) {
            console.error('Error updating service:', error);
        }
    }

    /**
     * Update location
     */
    async updateLocation() {
        try {
            const locationSelect = document.getElementById('locationSelect');
            if (!locationSelect) return;
            
            const selectedValue = locationSelect.value;
            const selectedText = locationSelect.options[locationSelect.selectedIndex].text;
            
            // TODO: Implement location update API call
            console.log(`Location updated: ${selectedText} (${selectedValue})`);
            
        } catch (error) {
            console.error('Error updating location:', error);
        }
    }

    /**
     * Test appointment event
     */
    testAppointmentEvent() {
        appointmentEventManager.testAppointmentEvent();
    }

    /**
     * Debug all endpoints
     */
    async debugAllEndpoints() {
        console.log('🔍 Testing all API endpoints...');
        const results = await apiClient.debugAllEndpoints();
        console.log('Debug results:', results);
        
        const successCount = Object.values(results).filter(r => r.success).length;
        const totalCount = Object.keys(results).length;
        
        uiManager.showAlert(
            `Debug abgeschlossen: ${successCount}/${totalCount} Endpoints erfolgreich`,
            successCount === totalCount ? 'success' : 'warning'
        );
    }

    /**
     * Load system status
     */
    async loadSystemStatus() {
        console.log('loadSystemStatus() called');
        try {
            const response = await fetch('/api/status');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.systemData = await response.json();
            
            // Load detailed monitoring status
            const monitoringResponse = await fetch('/api/monitoring/status');
            if (monitoringResponse.ok) {
                const monitoringData = await monitoringResponse.json();
                this.systemData.detailedMonitoring = monitoringData;
            }
            
            this.updateStatusUI();
            
            // Update UI manager with system data
            uiManager.systemData = this.systemData;
            uiManager.updateMonitoringStatus();
        } catch (error) {
            console.error('Error loading system status:', error);
            uiManager.showAlert('Fehler beim Laden des System-Status', 'danger');
        }
    }

    /**
     * Update status UI
     */
    updateStatusUI() {
        if (!this.systemData) {
            console.error('systemData is undefined!');
            return;
        }
        
        // Monitoring status
        const monitoringStatus = document.getElementById('monitoringStatus');
        const monitoringText = document.getElementById('monitoringText');
        
        if (monitoringStatus && monitoringText) {
            const monitoring = this.systemData.detailedMonitoring || this.systemData.monitoring;
            
            if (monitoring && monitoring.isActive) {
                if (monitoring.isInitializing) {
                    monitoringStatus.className = 'status-dot status-warning';
                    monitoringText.innerHTML = `Monitoring wird initialisiert...<br>
                        <small>Browser wird gestartet und Seite geladen</small>`;
                } else {
                    monitoringStatus.className = 'status-dot status-active';
                    
                    const checkingText = monitoring.isCurrentlyChecking ? ' (prüft gerade...)' : '';
                    const lastCheck = monitoring.lastCheckTime ? 
                        new Date(monitoring.lastCheckTime).toLocaleTimeString('de-DE', { hour12: false }) : 'Noch kein Check';
                    
                    let intervalText = '';
                    if (monitoring.intervalMinutes !== undefined && monitoring.intervalSeconds !== undefined) {
                        intervalText = ` - Intervall: ${monitoring.intervalMinutes}:${monitoring.intervalSeconds.toString().padStart(2, '0')} Min`;
                    }
                    
                    monitoringText.innerHTML = `Kontinuierliche Überwachung aktiv${intervalText}${checkingText}<br>
                        <small>Letzter Check: ${lastCheck}</small>`;
                }
            } else {
                monitoringStatus.className = 'status-dot status-inactive';
                monitoringText.textContent = 'Monitoring inaktiv';
            }
        }

        // System status
        const systemStatus = document.getElementById('systemStatus');
        const systemText = document.getElementById('systemText');
        
        if (systemStatus && systemText && this.systemData.system) {
            systemStatus.className = 'status-dot status-active';
            const uptime = Math.floor(this.systemData.system.uptime / 3600);
            const memoryUsage = Math.round(this.systemData.system.memory.heapUsed / 1024 / 1024);
            systemText.innerHTML = `Uptime: ${uptime}h<br><small>Memory: ${memoryUsage}MB</small>`;
        }

        // Toggle button text
        const toggleText = document.getElementById('toggleText');
        const toggleButton = document.querySelector('button[onclick="toggleMonitoring()"]');
        
        if (toggleText) {
            const monitoring = this.systemData.detailedMonitoring || this.systemData.monitoring;
            const isActive = monitoring?.isActive;
            
            if (isActive) {
                toggleText.textContent = 'Monitoring stoppen';
                if (toggleButton) toggleButton.disabled = false;
            } else {
                toggleText.textContent = 'Monitoring starten';
                if (toggleButton) toggleButton.disabled = false;
            }
        }

        // Interval input field
        const intervalInput = document.getElementById('intervalInput');
        if (intervalInput && this.systemData.detailedMonitoring) {
            const monitoring = this.systemData.detailedMonitoring;
            if (monitoring.intervalMinutes !== undefined && monitoring.intervalSeconds !== undefined) {
                const timeString = `${monitoring.intervalMinutes}:${monitoring.intervalSeconds.toString().padStart(2, '0')}`;
                intervalInput.value = timeString;
            }
        }

        // Target URL
        const targetUrl = document.getElementById('targetUrl');
        if (targetUrl) {
            if (this.systemData.monitoring?.targetUrl) {
                targetUrl.textContent = this.systemData.monitoring.targetUrl;
            } else {
                targetUrl.textContent = 'Nicht verfügbar';
            }
        }

        // Sound notification status
        const soundNotificationStatus = document.getElementById('soundNotificationStatus');
        if (soundNotificationStatus) {
            const audioStatus = audioManager.getStatus();
            
            switch (audioStatus.status) {
                case 'ready':
                    const duration = audioStatus.duration ? audioStatus.duration.toFixed(2) : 'unbekannt';
                    const channels = audioStatus.channels || 'unbekannt';
                    soundNotificationStatus.innerHTML = `<span style="color: #28a745;">✅ Konfiguriert und bereit (Web Audio API)</span><br>
                        <small>Duration: ${duration}s, Channels: ${channels}</small>`;
                    break;
                case 'fallback':
                    const message = audioStatus.message || 'Unbekannter Grund';
                    soundNotificationStatus.innerHTML = `<span style="color: #ffc107;">⚠️ Fallback Beep aktiv</span><br>
                        <small>Custom Sound nicht verfügbar - ${message}</small>`;
                    break;
                default:
                    soundNotificationStatus.innerHTML = `<span style="color: #dc3545;">❌ Nicht verfügbar</span><br>
                        <small>Audio System nicht initialisiert</small>`;
            }
        }

        // Statistics
        this.updateStatistics();
    }

    /**
     * Update statistics
     */
    updateStatistics() {
        const watchedCountEl = document.getElementById('watchedCount');
        const availableCountEl = document.getElementById('availableCount');
        const lastCheckEl = document.getElementById('lastCheck');
        
        if (watchedCountEl) {
            const watchedCount = (dataManager.datesData && dataManager.datesData.length) || 0;
            watchedCountEl.textContent = watchedCount;
        }
        
        if (availableCountEl) {
            const datesData = dataManager.datesData || [];
            const availableCount = datesData.filter(d => d.isAvailable).length;
            availableCountEl.textContent = availableCount;
        }
        
        if (lastCheckEl) {
            const lastCheck = this.systemData.detailedMonitoring?.lastCheckTime || 
                            this.systemData.monitoring?.lastCheck;
            if (lastCheck) {
                const lastCheckTime = new Date(lastCheck);
                lastCheckEl.textContent = lastCheckTime.toLocaleTimeString('de-DE', { hour12: false });
            } else {
                lastCheckEl.textContent = '--';
            }
        }
    }

    /**
     * Load notification status
     */
    async loadNotificationStatus() {
        try {
            const response = await fetch('/api/notifications/status');
            const status = await response.json();
            
            const container = document.getElementById('notificationStatus');
            container.innerHTML = '';
            
            Object.entries(status).forEach(([service, info]) => {
                const item = document.createElement('div');
                item.className = 'notification-item';
                
                const statusDot = info.configured ? 'status-active' : 'status-inactive';
                const statusText = info.configured ? 'Konfiguriert' : 'Nicht konfiguriert';
                
                item.innerHTML = `
                    <span>${service.charAt(0).toUpperCase() + service.slice(1)}</span>
                    <span class="status-indicator">
                        <div class="status-dot ${statusDot}"></div>
                        ${statusText}
                    </span>
                `;
                
                container.appendChild(item);
            });
            
            // Telegram-Status separat laden
            await this.loadTelegramStatus();
        } catch (error) {
            console.error('Error loading notification status:', error);
        }
    }

    /**
     * Load Telegram status and settings
     */
    async loadTelegramStatus() {
        try {
            const response = await fetch('/api/notifications/telegram');
            const telegramConfig = await response.json();
            
            const statusElement = document.getElementById('telegramStatusText');
            const enabledCheckbox = document.getElementById('telegramEnabled');
            const detailsElement = document.getElementById('telegramDetails');
            const testButton = document.getElementById('telegramTestBtn');
            
            // Update enabled state
            enabledCheckbox.checked = telegramConfig.enabled;
            
            // Update status display
            if (telegramConfig.botConfigured) {
                if (telegramConfig.enabled) {
                    statusElement.innerHTML = `<span style="color: #28a745;">✅ Telegram-Bot aktiv</span>`;
                    testButton.disabled = false;
                } else {
                    statusElement.innerHTML = `<span style="color: #ffc107;">⚠️ Bot konfiguriert, aber deaktiviert</span>`;
                    testButton.disabled = true;
                }
                
                detailsElement.innerHTML = `
                    <div>🤖 Bot: @FreierZulassungsTerminBot</div>
                    <div>💬 Chat-ID: ${telegramConfig.currentChatId}</div>
                    <div style="margin-top: 5px; font-size: 0.8em;">
                        Nur deine Chat-ID (${telegramConfig.currentChatId}) erhält Benachrichtigungen.
                    </div>
                `;
            } else {
                statusElement.innerHTML = `<span style="color: #dc3545;">❌ Bot nicht konfiguriert</span>`;
                testButton.disabled = true;
                detailsElement.innerHTML = `
                    <div style="color: #dc3545;">
                        Bot Token oder Chat-ID fehlt in der .env Datei
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading Telegram status:', error);
            document.getElementById('telegramStatusText').innerHTML = 
                `<span style="color: #dc3545;">❌ Fehler beim Laden</span>`;
        }
    }

    /**
     * Update Telegram settings
     */
    async updateTelegramSettings() {
        const enabledCheckbox = document.getElementById('telegramEnabled');
        const enabled = enabledCheckbox.checked;
        
        try {
            const response = await fetch('/api/notifications/telegram', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    enabled: enabled,
                    onlyVerifiedChat: true
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                uiManager.showAlert(
                    `Telegram-Benachrichtigungen ${enabled ? 'aktiviert' : 'deaktiviert'}`, 
                    'success'
                );
                // Reload status to update UI
                await this.loadTelegramStatus();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error updating Telegram settings:', error);
            uiManager.showAlert('Fehler beim Aktualisieren der Telegram-Einstellungen', 'danger');
            // Revert checkbox state
            enabledCheckbox.checked = !enabled;
        }
    }

    /**
     * Test Telegram notification
     */
    async testTelegramNotification() {
        try {
            const response = await fetch('/api/notifications/telegram/test', {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                uiManager.showAlert('Test-Telegram-Nachricht gesendet! 📱', 'success');
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error testing Telegram notification:', error);
            uiManager.showAlert('Fehler beim Senden der Test-Nachricht', 'danger');
        }
    }

    /**
     * Show Telegram setup modal
     */
    showTelegramSetup() {
        document.getElementById('telegramSetupModal').style.display = 'block';
    }

    /**
     * Hide Telegram setup modal
     */
    hideTelegramSetup() {
        document.getElementById('telegramSetupModal').style.display = 'none';
    }

    /**
     * Load location data
     */
    async loadLocation() {
        try {
            const response = await fetch('/api/location');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const locationData = await response.json();
            
            this.updateLocationUI(locationData);
        } catch (error) {
            console.error('Error loading location data:', error);
            uiManager.showAlert('Fehler beim Laden der Standort-Auswahl', 'danger');
            
            // Fallback
            document.getElementById('locationSelect').innerHTML = '<option value="">Nicht verfügbar</option>';
            document.getElementById('currentLocation').textContent = 'Nicht verfügbar';
        }
    }

    /**
     * Update location UI
     */
    updateLocationUI(locationData) {
        const locationSelect = document.getElementById('locationSelect');
        const currentLocation = document.getElementById('currentLocation');
        
        if (!locationSelect || !currentLocation) {
            console.error('Location UI elements not found!');
            return;
        }
        
        if (!locationData || !locationData.available || !locationData.selected) {
            console.error('Invalid locationData:', locationData);
            locationSelect.innerHTML = '<option value="">Fehler beim Laden</option>';
            currentLocation.textContent = 'Fehler beim Laden';
            return;
        }
        
        // Update select options
        locationSelect.innerHTML = '';
        locationData.available.forEach(location => {
            const option = document.createElement('option');
            option.value = location.value;
            option.textContent = location.name;
            option.selected = location.value === locationData.selected.value;
            locationSelect.appendChild(option);
        });
        
        // Update current location display
        currentLocation.textContent = locationData.selected.name || 'Nicht ausgewählt';
    }

    /**
     * Load services data
     */
    async loadServices() {
        try {
            const response = await fetch('/api/services');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const services = await response.json();
            
            this.updateServiceUI(services);
        } catch (error) {
            console.error('Error loading services:', error);
            uiManager.showAlert('Fehler beim Laden der Service-Auswahl', 'danger');
        }
    }

    /**
     * Update service UI
     */
    updateServiceUI(services) {
        if (!services || !Array.isArray(services)) {
            console.error('Invalid services data:', services);
            return;
        }
        
        services.forEach(service => {
            const checkbox = document.getElementById(`service-${service.key}`);
            if (checkbox) {
                checkbox.checked = service.selected;
            } else {
                console.warn(`Checkbox for service ${service.key} not found`);
            }
        });
    }

    /**
     * Toggle monitoring
     */
    async toggleMonitoring() {
        // Prevent double-clicks by disabling the button
        const toggleButton = document.querySelector('button[onclick="toggleMonitoring()"]');
        const toggleText = document.getElementById('toggleText');
        
        if (toggleButton && toggleButton.disabled) {
            return; // Already processing
        }
        
        if (toggleButton) {
            toggleButton.disabled = true;
            if (toggleText) toggleText.textContent = 'Verarbeitung...';
        }
        
        try {
            // Get current status first
            const statusResponse = await fetch('/api/monitoring/status');
            const statusData = await statusResponse.json();
            
            const isRunning = statusData.isActive;
            const endpoint = isRunning ? '/api/monitoring/stop' : '/api/monitoring/start';
        
            let requestBody = {};
            if (!isRunning) {
                // Read interval from input field when starting
                const intervalInput = document.getElementById('intervalInput');
                const intervalValue = intervalInput.value || '5:00';
                
                // Validate MM:SS format
                const timeRegex = /^(\d{1,2}):([0-5]\d)$/;
                const match = intervalValue.match(timeRegex);
                
                if (!match) {
                    uiManager.showAlert('Ungültiges Intervall-Format. Bitte verwenden Sie MM:SS (z.B. 5:00)', 'danger');
                    if (toggleButton) toggleButton.disabled = false;
                    if (toggleText) toggleText.textContent = 'Monitoring starten';
                    return;
                }
                
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                
                // Validate values
                if (minutes < 0 || minutes > 60 || seconds < 0 || seconds > 59) {
                    uiManager.showAlert('Intervall muss zwischen 0:01 und 60:00 liegen', 'danger');
                    if (toggleButton) toggleButton.disabled = false;
                    if (toggleText) toggleText.textContent = 'Monitoring starten';
                    return;
                }
                
                const totalSeconds = minutes * 60 + seconds;
                
                if (totalSeconds < 1) {
                    uiManager.showAlert('Intervall muss mindestens 1 Sekunde betragen', 'danger');
                    if (toggleButton) toggleButton.disabled = false;
                    if (toggleText) toggleText.textContent = 'Monitoring starten';
                    return;
                }
                
                if (totalSeconds > 3600) { // 60 minutes
                    uiManager.showAlert('Intervall darf nicht mehr als 60 Minuten betragen', 'danger');
                    if (toggleButton) toggleButton.disabled = false;
                    if (toggleText) toggleText.textContent = 'Monitoring starten';
                    return;
                }
                
                requestBody.intervalMinutes = minutes;
                requestBody.intervalSeconds = seconds;
            }
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                uiManager.showAlert(result.message, 'success');
                
                // Immediate updates after monitoring actions
                await this.loadSystemStatus();
                await dataManager.loadDates();
                
                // Additional updates with delay for better synchronization
                setTimeout(async () => {
                    await this.loadSystemStatus();
                    await dataManager.loadDates();
                }, 1000);
                
                // When starting: additional updates after 3 and 5 seconds
                if (!isRunning) {
                    setTimeout(() => this.loadSystemStatus(), 3000);
                    setTimeout(() => this.loadSystemStatus(), 5000);
                }
            } else {
                uiManager.showAlert(result.error || 'Fehler beim Steuern des Monitorings', 'danger');
            }
        } catch (error) {
            console.error('Error toggling monitoring:', error);
            uiManager.showAlert('Fehler beim Steuern des Monitorings', 'danger');
        } finally {
            // Re-enable button and update text
            if (toggleButton) {
                toggleButton.disabled = false;
            }
            // Status and text will be updated by loadSystemStatus()
            await this.loadSystemStatus();
        }
    }

    /**
     * Update target URL
     */
    async updateTargetUrl() {
        const newUrl = prompt('Neue Ziel-URL eingeben:', this.systemData.monitoring?.targetUrl || '');
        
        if (!newUrl || newUrl.trim() === '') {
            return;
        }
        
        if (!newUrl.startsWith('https://termine-kfz.lahn-dill-kreis.de/')) {
            uiManager.showAlert('URL muss mit https://termine-kfz.lahn-dill-kreis.de/ beginnen', 'danger');
            return;
        }
        
        try {
            const response = await fetch('/api/url', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: newUrl.trim() })
            });
            
            const result = await response.json();
            
            if (result.success) {
                uiManager.showAlert('Ziel-URL erfolgreich aktualisiert', 'success');
                this.loadSystemStatus();
            } else {
                uiManager.showAlert(result.message, 'danger');
            }
        } catch (error) {
            console.error('Error updating target URL:', error);
            uiManager.showAlert('Fehler beim Aktualisieren der URL', 'danger');
        }
    }

    /**
     * Update services
     */
    /**
     * Update services
     */
    async updateServices() {
        // Check if monitoring is active
        const monitoring = this.systemData?.detailedMonitoring || this.systemData?.monitoring;
        if (monitoring && monitoring.isActive) {
            uiManager.showAlert('Service-Auswahl ist gesperrt während das Monitoring läuft', 'warning');
            this.loadServices(); // Reset checkboxes to previous state
            return;
        }
        
        const services = {
            neuzulassung: document.getElementById('service-neuzulassung').checked,
            umschreibung: document.getElementById('service-umschreibung').checked,
            ausfuhr: document.getElementById('service-ausfuhr').checked
        };

        // Check if at least one service is selected
        if (!Object.values(services).some(v => v)) {
            uiManager.showAlert('Mindestens ein Service muss ausgewählt werden', 'warning');
            this.loadServices(); // Reset checkboxes
            return;
        }

        try {
            const response = await fetch('/api/services', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ services })
            });

            const result = await response.json();

            if (result.success) {
                uiManager.showAlert('Service-Auswahl aktualisiert', 'success');
            } else {
                uiManager.showAlert(result.message, 'danger');
                this.loadServices(); // Reset checkboxes
            }
        } catch (error) {
            console.error('Error updating services:', error);
            uiManager.showAlert('Fehler beim Aktualisieren der Service-Auswahl', 'danger');
            this.loadServices(); // Reset checkboxes
        }
    }

    /**
     * Update location
     */
    async updateLocation() {
        // Check if monitoring is active
        const monitoring = this.systemData?.detailedMonitoring || this.systemData?.monitoring;
        if (monitoring && monitoring.isActive) {
            uiManager.showAlert('Standort-Auswahl ist gesperrt während das Monitoring läuft', 'warning');
            this.loadLocation(); // Reset select to previous state
            return;
        }
        
        const locationSelect = document.getElementById('locationSelect');
        const selectedValue = locationSelect.value;
        const selectedText = locationSelect.options[locationSelect.selectedIndex].text;
        
        if (!selectedValue) {
            return;
        }
        
        const location = {
            value: selectedValue,
            name: selectedText
        };
        
        try {
            const response = await fetch('/api/location', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ location })
            });
            
            const result = await response.json();
            
            if (result.success) {
                uiManager.showAlert('Standort erfolgreich aktualisiert', 'success');
                this.loadLocation(); // Update display
            } else {
                uiManager.showAlert(result.message, 'danger');
            }
        } catch (error) {
            console.error('Error updating location:', error);
            uiManager.showAlert('Fehler beim Aktualisieren des Standorts', 'danger');
        }
    }
}

// Global app instance
const app = new App();

// Global function exports for HTML onclick handlers
window.addDate = () => {
    const dateInput = document.getElementById('dateInput');
    if (dateInput && dateInput.value) {
        try {
            // Convert German date format to API format
            const inputDate = dateInput.value.trim();
            const apiDate = app.convertGermanDateToApiFormat(inputDate);
            dataManager.addDate(apiDate);
            dateInput.value = ''; // Clear input after adding
        } catch (error) {
            console.error('Error converting date format:', error);
            uiManager.showAlert(error.message || 'Ungültiges Datumsformat', 'error');
        }
    } else {
        uiManager.showAlert('Bitte wählen Sie ein Datum aus', 'warning');
    }
};

// Global function exports
window.removeDate = (dateStr) => dataManager.removeDate(dateStr);
window.checkNow = () => dataManager.checkAppointments();
window.toggleMonitoring = () => app.toggleMonitoring();
window.updateTargetUrl = () => app.updateTargetUrl();
window.testNotification = () => dataManager.testNotification();
window.updateServices = () => app.updateServices();
window.updateLocation = () => app.updateLocation();
window.testNotificationSound = () => audioManager.testNotificationSound();
window.testAppointmentEvent = () => appointmentEventManager.testAppointmentEvent();
window.playNotificationSequence = () => audioManager.playNotificationSequence();
window.createFallbackBeep = () => audioManager.createFallbackBeep();
window.debugAllEndpoints = () => app.debugAllEndpoints();

// Telegram function exports
window.updateTelegramSettings = () => app.updateTelegramSettings();
window.testTelegramNotification = () => app.testTelegramNotification();
window.showTelegramSetup = () => app.showTelegramSetup();
window.hideTelegramSetup = () => app.hideTelegramSetup();

// Universal date picker function for all platforms
window.openDatePicker = () => {
    const dateInput = document.getElementById('dateInput');
    if (!dateInput) return;
    
    // Detect platform
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
    const isDesktop = !isMobile;
    
    try {
        // For mobile devices: focus triggers native picker
        if (isMobile) {
            dateInput.focus();
            dateInput.click();
            return;
        }
        
        // For desktop: try modern showPicker() API first
        if (isDesktop && dateInput.showPicker && typeof dateInput.showPicker === 'function') {
            dateInput.showPicker();
            return;
        }
        
        // Fallback for all platforms: focus and click
        dateInput.focus();
        dateInput.click();
        
        // Additional fallback for Mac: trigger change event
        if (isMac) {
            setTimeout(() => {
                dateInput.focus();
                dateInput.dispatchEvent(new Event('click', { bubbles: true }));
            }, 100);
        }
        
    } catch (error) {
        console.log('Date picker error (fallback to focus):', error);
        dateInput.focus();
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded - initializing app...');
    app.initialize();
    
    // Initialize mobile-specific enhancements
    initializeMobileEnhancements();
});

// Initialize app on window load as fallback
window.addEventListener('load', () => {
    if (!app.isInitialized) {
        console.log('Window loaded - initializing app as fallback...');
        app.initialize();
        initializeMobileEnhancements();
    }
});

// Simplified mobile enhancements - no custom date picker needed
function initializeMobileEnhancements() {
    const dateInput = document.getElementById('dateInput');
    
    if (!dateInput) return;
    
    // Set today's date as initial value
    const today = new Date();
    const todayString = today.getFullYear() + '-' + 
                       String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(today.getDate()).padStart(2, '0');
    dateInput.value = todayString;
    
    // Mobile detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (isMobile || isTouchDevice) {
        console.log('Mobile device detected - applying basic mobile enhancements');
        
        // Add mobile-specific attributes
        dateInput.setAttribute('autocomplete', 'off');
        
        // Add mobile-friendly class to body
        document.body.classList.add('mobile-optimized');
        
        // Optimize all buttons for touch
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(btn => {
            btn.style.minHeight = '48px';
            btn.style.touchAction = 'manipulation';
        });
    }
    
    // iOS Audio activation setup
    setupIOSAudioActivation();
}

/**
 * Setup iOS Audio Activation UI
 */
function setupIOSAudioActivation() {
    // Detect iOS devices
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    const iosAudioElement = document.getElementById('iosAudioActivation');
    
    if (isIOSDevice && iosAudioElement) {
        iosAudioElement.style.display = 'block';
        console.log('📱 iOS-Gerät erkannt - zeige Audio-Aktivierungsbutton');
        
        // Update status
        updateIOSAudioStatus('Bereit zur Aktivierung');
    }
}

/**
 * Activate iOS Audio
 */
async function activateIOSAudio() {
    const statusElement = document.getElementById('iosAudioStatus');
    const buttonElement = document.getElementById('iosAudioBtn');
    
    try {
        buttonElement.disabled = true;
        buttonElement.textContent = '🔄 Aktiviere...';
        updateIOSAudioStatus('Audio wird aktiviert...');
        
        console.log('🔧 Starte iOS Audio-Aktivierung...');
        
        // Direkte Audio-Aktivierung ohne Audio-Manager
        let audioContext;
        let success = false;
        
        try {
            // Versuche AudioContext zu erstellen
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('✅ AudioContext erstellt:', audioContext.state);
            
            // Resume context falls suspended
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
                console.log('✅ AudioContext resumed:', audioContext.state);
            }
            
            // Spiele stillen Ton ab um Audio zu entsperren
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Sehr leiser, kurzer Ton
            gainNode.gain.value = 0.001;
            oscillator.frequency.value = 440;
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.01);
            
            console.log('✅ Stiller Ton abgespielt - Audio entsperrt');
            success = true;
            
            // Initialisiere Audio-Manager falls vorhanden
            if (window.audioManager) {
                console.log('🔧 Aktualisiere Audio-Manager...');
                window.audioManager.audioUnlocked = true;
                window.audioManager.fallbackAudioContext = audioContext;
                console.log('✅ Audio-Manager aktualisiert');
            }
            
        } catch (audioError) {
            console.warn('⚠️ AudioContext Warnung (aber Audio könnte trotzdem funktionieren):', audioError);
            // Setze success trotzdem auf true, da Audio oft trotz kleiner Fehler funktioniert
            success = true;
        }
        
        // Immer als Erfolg behandeln, da Audio auf iOS oft trotz Warnungen funktioniert
        buttonElement.textContent = '✅ Aktiviert';
        buttonElement.style.background = '#28a745';
        buttonElement.style.color = 'white';
        updateIOSAudioStatus('Audio-Benachrichtigungen sind aktiv');
        
        console.log('🎉 iOS Audio-Aktivierung abgeschlossen');
        
        // Spiele Test-Beep ab (auch bei Fehlern versuchen)
        setTimeout(() => {
            try {
                let testContext = audioContext;
                if (!testContext) {
                    testContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                
                const testOscillator = testContext.createOscillator();
                const testGain = testContext.createGain();
                
                testOscillator.connect(testGain);
                testGain.connect(testContext.destination);
                
                testOscillator.frequency.setValueAtTime(800, testContext.currentTime);
                testGain.gain.setValueAtTime(0.3, testContext.currentTime);
                testGain.gain.exponentialRampToValueAtTime(0.01, testContext.currentTime + 0.3);
                
                testOscillator.start(testContext.currentTime);
                testOscillator.stop(testContext.currentTime + 0.3);
                
                console.log('🔔 Test-Beep abgespielt');
                updateIOSAudioStatus('Audio-Benachrichtigungen aktiv - Test-Sound abgespielt');
            } catch (beepError) {
                console.warn('⚠️ Test-Beep Warnung:', beepError);
                updateIOSAudioStatus('Audio-Benachrichtigungen aktiv (Test-Sound übersprungen)');
            }
        }, 500);
        
        // Verstecke Panel nach Erfolg
        setTimeout(() => {
            const panel = document.getElementById('iosAudioActivation');
            if (panel) {
                panel.style.display = 'none';
            }
        }, 4000);
        
    } catch (error) {
        console.error('❌ Kritischer Fehler bei iOS Audio-Aktivierung:', error);
        
        // Auch hier optimistisch sein - oft funktioniert Audio trotzdem
        buttonElement.textContent = '⚠️ Aktiviert (mit Warnungen)';
        buttonElement.style.background = '#ffc107';
        buttonElement.style.color = '#212529';
        updateIOSAudioStatus(`Audio aktiv, aber mit Warnungen: ${error.message}`);
        
        // Test-Sound trotzdem versuchen
        setTimeout(() => {
            try {
                const testContext = new (window.AudioContext || window.webkitAudioContext)();
                const testOscillator = testContext.createOscillator();
                const testGain = testContext.createGain();
                
                testOscillator.connect(testGain);
                testGain.connect(testContext.destination);
                
                testOscillator.frequency.setValueAtTime(800, testContext.currentTime);
                testGain.gain.setValueAtTime(0.2, testContext.currentTime);
                testGain.gain.exponentialRampToValueAtTime(0.01, testContext.currentTime + 0.3);
                
                testOscillator.start(testContext.currentTime);
                testOscillator.stop(testContext.currentTime + 0.3);
                
                console.log('🔔 Test-Beep (Fallback) abgespielt');
                updateIOSAudioStatus('Audio funktioniert trotz Warnungen');
                
                // Button auf Erfolg setzen
                buttonElement.textContent = '✅ Funktioniert';
                buttonElement.style.background = '#28a745';
                buttonElement.style.color = 'white';
                
            } catch (fallbackError) {
                console.error('❌ Auch Fallback-Audio fehlgeschlagen:', fallbackError);
                buttonElement.textContent = '❌ Fehler';
                buttonElement.style.background = '#dc3545';
                updateIOSAudioStatus('Audio-Aktivierung fehlgeschlagen');
                
                // Reset button nach Delay
                setTimeout(() => {
                    buttonElement.disabled = false;
                    buttonElement.textContent = '🔊 Erneut versuchen';
                    buttonElement.style.background = '#ffc107';
                    buttonElement.style.color = '#212529';
                    updateIOSAudioStatus('Bereit zur Aktivierung');
                }, 3000);
            }
        }, 500);
    }
}

/**
 * Update iOS Audio Status
 */
function updateIOSAudioStatus(message) {
    const statusElement = document.getElementById('iosAudioStatus');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

/**
 * Test Audio Function - kann manuell aufgerufen werden
 */
function testAudio() {
    console.log('🔊 Teste Audio-Wiedergabe...');
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('AudioContext State:', audioContext.state);
        
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                playTestBeep(audioContext);
            });
        } else {
            playTestBeep(audioContext);
        }
        
    } catch (error) {
        console.error('❌ Audio-Test fehlgeschlagen:', error);
        alert('Audio-Test fehlgeschlagen: ' + error.message);
    }
}

/**
 * Play Test Beep
 */
function playTestBeep(audioContext) {
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        
        console.log('🔔 Test-Beep abgespielt');
    } catch (error) {
        console.error('❌ Test-Beep Fehler:', error);
    }
}
