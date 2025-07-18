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
     * Show alert message
     */
    showAlert(message, type = 'info') {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());

        // Create new alert
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;

        // Insert at top of content
        const content = document.querySelector('.content');
        if (content) {
            content.insertBefore(alert, content.firstChild);

            // Auto remove after 5 seconds
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.remove();
                }
            }, 5000);
        }
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
                        new Date(monitoring.lastCheckTime).toLocaleTimeString() : 'Noch kein Check';
                    
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
                lastCheckEl.textContent = lastCheckTime.toLocaleTimeString('de-DE');
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
                    soundNotificationStatus.innerHTML = `<span style="color: #28a745;">✅ Konfiguriert und bereit (Web Audio API)</span><br>
                        <small>Duration: ${audioStatus.duration.toFixed(2)}s, Channels: ${audioStatus.channels}</small>`;
                    break;
                case 'fallback':
                    soundNotificationStatus.innerHTML = `<span style="color: #ffc107;">⚠️ Fallback Beep aktiv</span><br>
                        <small>Custom Sound nicht verfügbar - ${audioStatus.message}</small>`;
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
            const availabilityClass = date.isAvailable ? 'date-available' : '';
            const availabilityText = date.isAvailable ? 
                `✅ Verfügbar${date.lastCheckResult?.timestamp ? ' (' + new Date(date.lastCheckResult.timestamp).toLocaleTimeString() + ')' : ''}` :
                `❌ Nicht verfügbar${date.lastCheckResult?.timestamp ? ' (' + new Date(date.lastCheckResult.timestamp).toLocaleTimeString() + ')' : ''}`;
            
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
        
        if (locationSelect && locationData.locations) {
            locationSelect.innerHTML = locationData.locations.map(location => 
                `<option value="${location.value}" ${location.value === locationData.selected?.value ? 'selected' : ''}>
                    ${location.name}
                </option>`
            ).join('');
        }
        
        if (currentLocation && locationData.selected) {
            currentLocation.textContent = locationData.selected.name;
        }
    }

    /**
     * Update services display
     */
    updateServicesDisplay(services) {
        if (!services.serviceMapping || !services.selectedServices) return;
        
        const servicesContainer = document.getElementById('servicesContainer');
        if (!servicesContainer) return;
        
        servicesContainer.innerHTML = Object.entries(services.serviceMapping).map(([key, service]) => {
            const isSelected = services.selectedServices[key];
            return `
                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} 
                           onchange="updateService('${key}', this.checked)">
                    <span>${service.name}</span>
                </label>
            `;
        }).join('');
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
