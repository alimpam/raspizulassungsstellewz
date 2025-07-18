/**
 * API Communication Module
 * Handles all backend API communication
 */

class APIClient {
    constructor() {
        this.baseURL = '';
    }

    /**
     * Generic fetch wrapper with error handling
     */
    async request(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Request failed for ${url}:`, error);
            throw error;
        }
    }

    // System & Monitoring
    async getSystemStatus() {
        return this.request('/api/status');
    }

    async getMonitoringStatus() {
        return this.request('/api/monitoring/status');
    }

    async startMonitoring(intervalMinutes = 5, intervalSeconds = 0) {
        return this.request('/api/monitoring/start', {
            method: 'POST',
            body: JSON.stringify({ intervalMinutes, intervalSeconds })
        });
    }

    async stopMonitoring() {
        return this.request('/api/monitoring/stop', {
            method: 'POST'
        });
    }

    async checkAppointments() {
        return this.request('/api/check', {
            method: 'POST'
        });
    }

    // Dates Management
    async getDates() {
        return this.request('/api/dates');
    }

    async addDate(dateStr) {
        return this.request('/api/dates', {
            method: 'POST',
            body: JSON.stringify({ date: dateStr })
        });
    }

    async removeDate(dateStr) {
        const [year, month, day] = dateStr.split('/');
        return this.request(`/api/dates/${year}/${month}/${day}`, {
            method: 'DELETE'
        });
    }

    // Configuration
    async getLocation() {
        return this.request('/api/location');
    }

    async updateLocation(locationData) {
        return this.request('/api/location', {
            method: 'PUT',
            body: JSON.stringify(locationData)
        });
    }

    async getServices() {
        return this.request('/api/services');
    }

    async updateServices(servicesData) {
        return this.request('/api/services', {
            method: 'PUT',
            body: JSON.stringify(servicesData)
        });
    }

    // Notifications
    async getNotificationStatus() {
        return this.request('/api/notifications/status');
    }

    async testNotification() {
        return this.request('/api/test-notification', {
            method: 'POST'
        });
    }

    // Debug endpoints
    async debugAllEndpoints() {
        const endpoints = [
            '/api/status',
            '/api/monitoring/status',
            '/api/dates',
            '/api/location',
            '/api/services',
            '/api/notifications/status'
        ];

        const results = {};
        
        for (const endpoint of endpoints) {
            try {
                const result = await this.request(endpoint);
                results[endpoint] = { success: true, data: result };
                console.log(`✅ ${endpoint}:`, result);
            } catch (error) {
                results[endpoint] = { success: false, error: error.message };
                console.error(`❌ ${endpoint}:`, error);
            }
        }
        
        return results;
    }
}

// Export singleton instance
const apiClient = new APIClient();
