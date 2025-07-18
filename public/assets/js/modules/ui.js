/**
 * UI Management Module
 * Handles all UI updates and interactions
 */

class UIManager {
    constructor() {
        this.systemData = null;
        this.datesData = [];
        this.lastTotalAvailableAppointments = 0;
        this.lastNotificationTime = 0;
        this.NOTIFICATION_DEBOUNCE_MS = 5000; // 5 seconds
        
        // Load saved state
        this.loadSavedState();
    }

    /**
     * Load saved state from localStorage
     */
    loadSavedState() {
        try {
            const savedCount = localStorage.getItem('lastAvailableCount');
            if (savedCount) {
                this.lastTotalAvailableAppointments = parseInt(savedCount, 10);
            }
        } catch (error) {
            console.warn('Failed to load saved state:', error);
        }
    }

    /**
     * Show alert message (now using Toast system)
     */
    /**
     * Show alert message (now using Toast system)
     */
    showAlert(message, type = 'info') {
        // Use toast system instead of inline alerts
        const titleMap = {
            'success': 'Erfolg',
            'error': 'Fehler',
            'warning': 'Warnung',
            'info': 'Information'
        };
        
        const title = titleMap[type] || titleMap.info;
        toastManager.show(title, message, type);
    }

    /**
     * Update system status UI
     */
    updateStatusUI() {
        console.log('updateStatusUI() aufgerufen mit systemData:', this.systemData);
        
        if (!this.systemData) {
            console.error('systemData ist undefined!');
            return;
        }
        
        this.updateMonitoringStatus();
        this.updateSystemStatus();
        this.updateToggleButton();
        this.updateIntervalInput();
        this.updateTargetUrl();
        this.updateStatistics();
        this.updateSoundStatus();
    }

    /**
     * Update monitoring status
     */
    updateMonitoringStatus() {
        const statusCard = document.getElementById('monitoringStatusCard');
        const statusIcon = document.getElementById('monitoringStatusIcon');
        const statusText = document.getElementById('monitoringText');
        const statusDetails = document.getElementById('monitoringDetails');
        
        if (statusCard && statusIcon && statusText && statusDetails) {
            const monitoring = this.systemData.detailedMonitoring || this.systemData.monitoring;
            
            if (monitoring && monitoring.isActive) {
                if (monitoring.isInitializing) {
                    statusCard.className = 'status-indicator initializing';
                    statusIcon.textContent = '🔄';
                    statusText.textContent = 'Monitoring wird initialisiert...';
                    statusDetails.textContent = 'Browser wird gestartet und Seite geladen';
                } else if (monitoring.isCurrentlyChecking) {
                    statusCard.className = 'status-indicator checking';
                    statusIcon.textContent = '🔍';
                    statusText.textContent = 'Terminprüfung läuft...';
                    statusDetails.textContent = 'Termine werden aktuell überprüft';
                } else {
                    statusCard.className = 'status-indicator active';
                    statusIcon.textContent = '✅';
                    statusText.textContent = 'Kontinuierliche Überwachung aktiv';
                    
                    const lastCheck = monitoring.lastCheckTime ? 
                        new Date(monitoring.lastCheckTime).toLocaleTimeString('de-DE', { hour12: false }) : 'Noch kein Check';
                    
                    let intervalText = '';
                    if (monitoring.intervalMinutes !== undefined && monitoring.intervalSeconds !== undefined) {
                        intervalText = ` • Intervall: ${monitoring.intervalMinutes}:${monitoring.intervalSeconds.toString().padStart(2, '0')} Min`;
                    }
                    
                    statusDetails.textContent = `Letzter Check: ${lastCheck}${intervalText}`;
                }
            } else {
                statusCard.className = 'status-indicator idle';
                statusIcon.textContent = '⚪';
                statusText.textContent = 'Monitoring inaktiv';
                statusDetails.textContent = 'Klicken Sie auf "Monitoring starten" um zu beginnen';
            }
        }
    }

    /**
     * Update system status
     */
    updateSystemStatus() {
        const systemStatus = document.getElementById('systemStatus');
        const systemText = document.getElementById('systemText');
        
        if (systemStatus && systemText && this.systemData.system) {
            systemStatus.className = 'status-dot status-active';
            const uptime = Math.floor(this.systemData.system.uptime / 3600);
            const memoryUsage = Math.round(this.systemData.system.memory.heapUsed / 1024 / 1024);
            systemText.innerHTML = `Uptime: ${uptime}h<br><small>Memory: ${memoryUsage}MB</small>`;
        }
    }

    /**
     * Update toggle button
     */
    updateToggleButton() {
        const toggleText = document.getElementById('toggleText');
        if (toggleText) {
            const monitoring = this.systemData.detailedMonitoring || this.systemData.monitoring;
            const isActive = monitoring?.isActive;
            const isInitializing = monitoring?.isInitializing;
            
            if (isActive && isInitializing) {
                toggleText.textContent = 'Monitoring starten (läuft...)';
            } else if (isActive) {
                toggleText.textContent = 'Monitoring stoppen';
            } else {
                toggleText.textContent = 'Monitoring starten';
            }
        }
    }

    /**
     * Update interval input
     */
    updateIntervalInput() {
        const intervalInput = document.getElementById('intervalInput');
        if (intervalInput && this.systemData.detailedMonitoring) {
            const monitoring = this.systemData.detailedMonitoring;
            if (monitoring.intervalMinutes !== undefined && monitoring.intervalSeconds !== undefined) {
                const timeString = `${monitoring.intervalMinutes}:${monitoring.intervalSeconds.toString().padStart(2, '0')}`;
                intervalInput.value = timeString;
            }
        }
    }

    /**
     * Update target URL
     */
    updateTargetUrl() {
        const targetUrl = document.getElementById('targetUrl');
        if (targetUrl) {
            if (this.systemData.monitoring?.targetUrl) {
                targetUrl.textContent = this.systemData.monitoring.targetUrl;
            } else {
                targetUrl.textContent = 'Nicht verfügbar';
            }
        }
    }

    /**
     * Update statistics
     */
    updateStatistics() {
        const watchedCountEl = document.getElementById('watchedCount');
        const availableCountEl = document.getElementById('availableCount');
        const lastCheckEl = document.getElementById('lastCheck');
        
        if (watchedCountEl) {
            const watchedCount = this.datesData.length;
            watchedCountEl.textContent = watchedCount;
        }
        
        if (availableCountEl) {
            const availableCount = this.datesData.filter(d => d.isAvailable).length;
            availableCountEl.textContent = availableCount;
            
            // Check for new appointments and play notification sound
            this.checkForNewAppointments(availableCount);
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
     * Update sound notification status
     */
    updateSoundStatus() {
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
    }

    /**
     * Check for new appointments and trigger notifications
     */
    checkForNewAppointments(availableCount) {
        const now = Date.now();
        const isRealIncrease = availableCount > this.lastTotalAvailableAppointments;
        const enoughTimeHasPassed = (now - this.lastNotificationTime) > this.NOTIFICATION_DEBOUNCE_MS;
        
        if (isRealIncrease && availableCount > 0 && enoughTimeHasPassed) {
            console.log(`New appointments found! Previous: ${this.lastTotalAvailableAppointments}, Current: ${availableCount}`);
            audioManager.playNotificationSequence();
            
            this.showAlert(`🎉 Neue Termine verfügbar! ${availableCount} Termine gefunden`, 'success');
            this.lastNotificationTime = now;
        }
        
        // Save current count if changed
        if (availableCount !== this.lastTotalAvailableAppointments) {
            this.lastTotalAvailableAppointments = availableCount;
            localStorage.setItem('lastAvailableCount', availableCount.toString());
        }
    }

    /**
     * Update dates display
     */
    updateDatesDisplay(dates) {
        this.datesData = dates;
        
        const dateList = document.getElementById('dateList');
        if (!dateList) return;

        if (!dates || dates.length === 0) {
            dateList.innerHTML = '<div class="date-item">Keine Termine überwacht</div>';
            return;
        }

        dateList.innerHTML = dates.map(date => {
            let availabilityClass = '';
            let availabilityText;
            
            if (date.isAvailable) {
                availabilityClass = 'date-available';
                availabilityText = `✅ Verfügbar${date.lastCheckResult?.timestamp ? ' (' + new Date(date.lastCheckResult.timestamp).toLocaleTimeString('de-DE', { hour12: false }) + ')' : ''}`;
            } else if (date.lastCheckResult?.timestamp) {
                // Termin wurde geprüft und ist nicht verfügbar
                availabilityText = `❌ Nicht verfügbar (${new Date(date.lastCheckResult.timestamp).toLocaleTimeString('de-DE', { hour12: false })})`;
            } else {
                // Termin wurde noch nicht geprüft
                availabilityClass = 'date-pending';
                availabilityText = `⏳ Noch nicht geprüft`;
            }
            
            return `
                <div class="date-item ${availabilityClass}">
                    <div>
                        <strong>${date.germanDate || date.date}</strong><br>
                        <small>${availabilityText}</small>
                    </div>
                    <button class="btn btn-danger" onclick="removeDate('${date.date}')">
                        Entfernen
                    </button>
                </div>
            `;
        }).join('');
    }

    /**
     * Update location display
     */
    updateLocationDisplay(locationData) {
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
     * Update services display
     */
    updateServicesDisplay(services) {
        if (!Array.isArray(services)) {
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
     * Update notification status display
     */
    updateNotificationDisplay(notifications) {
        const notificationStatus = document.getElementById('notificationStatus');
        if (!notificationStatus || !notifications) return;
        
        notificationStatus.innerHTML = Object.entries(notifications).map(([service, info]) => {
            const statusDot = info.configured ? 'status-active' : 'status-inactive';
            const statusText = info.configured ? 'Konfiguriert' : 'Nicht konfiguriert';
            
            return `
                <div class="notification-item">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="status-dot ${statusDot}"></span>
                        <span style="text-transform: capitalize;">${service}</span>
                    </div>
                    <span style="font-size: 0.9em; color: #666;">${statusText}</span>
                </div>
            `;
        }).join('');
    }
}

// Export singleton instance
const uiManager = new UIManager();
