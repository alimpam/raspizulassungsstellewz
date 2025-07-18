/**
 * Appointment Event Management Module
 * Handles appointment availability change events and logging
 */

class AppointmentEventManager {
    constructor() {
        this.previousAppointments = new Map();
        this.eventHistory = [];
        this.maxHistorySize = 50;
    }

    /**
     * Detect appointment changes and create events
     */
    detectAppointmentChanges(newDates) {
        if (!Array.isArray(newDates)) return;
        
        const currentAppointments = new Map();
        const events = [];
        
        // Process current appointments
        newDates.forEach(date => {
            currentAppointments.set(date.date, {
                isAvailable: date.isAvailable,
                germanDate: date.germanDate || date.date,
                lastCheck: date.lastCheckResult?.timestamp
            });
        });
        
        // Compare with previous state
        currentAppointments.forEach((current, dateStr) => {
            const previous = this.previousAppointments.get(dateStr);
            
            if (previous) {
                // Check for availability changes
                if (!previous.isAvailable && current.isAvailable) {
                    events.push({
                        type: 'available',
                        date: dateStr,
                        germanDate: current.germanDate,
                        message: `Termin ${current.germanDate} ist jetzt verfügbar!`,
                        timestamp: new Date().toISOString()
                    });
                } else if (previous.isAvailable && !current.isAvailable) {
                    events.push({
                        type: 'unavailable',
                        date: dateStr,
                        germanDate: current.germanDate,
                        message: `Termin ${current.germanDate} ist nicht mehr verfügbar`,
                        timestamp: new Date().toISOString()
                    });
                }
            } else if (current.isAvailable) {
                // New appointment that is available
                events.push({
                    type: 'new_available',
                    date: dateStr,
                    germanDate: current.germanDate,
                    message: `Neuer verfügbarer Termin: ${current.germanDate}`,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Add events to history
        events.forEach(event => this.addEvent(event));
        
        // Update previous state
        this.previousAppointments = new Map(currentAppointments);
        
        // Update display
        this.updateEventsDisplay();
        
        return events;
    }

    /**
     * Add event to history
     */
    addEvent(event) {
        this.eventHistory.unshift(event);
        
        // Limit history size
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory = this.eventHistory.slice(0, this.maxHistorySize);
        }
        
        console.log('New appointment event:', event);
    }

    /**
     * Update events display in UI
     */
    updateEventsDisplay() {
        const container = document.getElementById('appointmentEvents');
        if (!container) return;
        
        if (this.eventHistory.length === 0) {
            container.innerHTML = `
                <div class="appointment-event-item">
                    <i>Noch keine Termine verfügbar geworden...</i>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.eventHistory.map(event => {
            const timestamp = new Date(event.timestamp).toLocaleString('de-DE');
            const icon = this.getEventIcon(event.type);
            
            return `
                <div class="appointment-event-item event-${event.type}">
                    <span>${icon}</span>
                    <div>
                        <strong>${event.message}</strong><br>
                        <small>${timestamp}</small>
                    </div>
                </div>
            `;
        }).join('');
        
        // Auto-scroll to top for new events
        container.scrollTop = 0;
    }

    /**
     * Get icon for event type
     */
    getEventIcon(type) {
        switch (type) {
            case 'available':
            case 'new_available':
                return '🎉';
            case 'unavailable':
                return '❌';
            case 'added':
                return '➕';
            case 'removed':
                return '➖';
            default:
                return 'ℹ️';
        }
    }

    /**
     * Add manual event (for testing)
     */
    addManualEvent(message, type = 'info') {
        const event = {
            type: type,
            message: message,
            timestamp: new Date().toISOString()
        };
        
        this.addEvent(event);
        this.updateEventsDisplay();
    }

    /**
     * Test appointment event
     */
    testAppointmentEvent() {
        const testEvents = [
            {
                type: 'available',
                message: 'Test: Termin 15.08.2025 ist jetzt verfügbar!',
                timestamp: new Date().toISOString()
            },
            {
                type: 'new_available',
                message: 'Test: Neuer verfügbarer Termin: 20.08.2025',
                timestamp: new Date(Date.now() - 60000).toISOString()
            },
            {
                type: 'unavailable',
                message: 'Test: Termin 10.08.2025 ist nicht mehr verfügbar',
                timestamp: new Date(Date.now() - 120000).toISOString()
            }
        ];
        
        testEvents.forEach(event => this.addEvent(event));
        this.updateEventsDisplay();
        
        console.log('Test events added to appointment event history');
    }

    /**
     * Clear event history
     */
    clearEvents() {
        this.eventHistory = [];
        this.updateEventsDisplay();
        console.log('Appointment event history cleared');
    }

    /**
     * Get event history
     */
    getEventHistory() {
        return [...this.eventHistory];
    }

    /**
     * Export events as JSON
     */
    exportEvents() {
        const data = {
            exportDate: new Date().toISOString(),
            events: this.eventHistory
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `appointment-events-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
}

// Export singleton instance
const appointmentEventManager = new AppointmentEventManager();
