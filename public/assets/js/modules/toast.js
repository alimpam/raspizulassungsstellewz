/**
 * Toast Notification System
 * Replaces the old alert system with modern toast notifications
 */

class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = new Map();
        this.autoCloseDelay = 5000; // 5 seconds
        this.init();
    }

    init() {
        // Create or get toast container
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toastContainer';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    /**
     * Show a toast notification
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     * @param {string} type - Toast type (success, error, warning, info)
     * @param {number} duration - Auto-close duration (0 = no auto-close)
     */
    show(title, message, type = 'info', duration = null) {
        const toastId = Date.now() + Math.random();
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('data-toast-id', toastId);
        
        // Get appropriate icon for type
        const icon = this.getIcon(type);
        
        toast.innerHTML = `
            <div class="toast-header">
                <div class="toast-title">
                    <span class="toast-icon">${icon}</span>
                    <span>${title}</span>
                </div>
                <button class="toast-close" onclick="toastManager.close('${toastId}')">&times;</button>
            </div>
            ${message ? `<div class="toast-body">${message}</div>` : ''}
        `;

        // Add to container
        this.container.appendChild(toast);
        this.toasts.set(toastId, toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto-close if duration is specified
        const autoCloseDuration = duration !== null ? duration : this.autoCloseDelay;
        if (autoCloseDuration > 0) {
            setTimeout(() => {
                this.close(toastId);
            }, autoCloseDuration);
        }

        return toastId;
    }

    /**
     * Close a specific toast
     */
    close(toastId) {
        const toast = this.toasts.get(toastId);
        if (toast) {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                this.toasts.delete(toastId);
            }, 300); // Wait for animation
        }
    }

    /**
     * Close all toasts
     */
    closeAll() {
        this.toasts.forEach((toast, id) => {
            this.close(id);
        });
    }

    /**
     * Get icon for toast type
     */
    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    /**
     * Convenience methods
     */
    success(title, message, duration) {
        return this.show(title, message, 'success', duration);
    }

    error(title, message, duration) {
        return this.show(title, message, 'error', duration);
    }

    warning(title, message, duration) {
        return this.show(title, message, 'warning', duration);
    }

    info(title, message, duration) {
        return this.show(title, message, 'info', duration);
    }
}

// Create global instance
const toastManager = new ToastManager();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToastManager;
}
