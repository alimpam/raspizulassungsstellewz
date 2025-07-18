/**
 * Audio Notification Module
 * Handles sound notifications and audio management
 */

class AudioNotificationManager {
    constructor() {
        this.notificationAudio = null;
        this.fallbackAudioContext = null;
        this.isInitialized = false;
        this.isIOSDevice = false;
        this.audioUnlocked = false;
        this.pendingNotifications = [];
        
        // Sound notification configuration - using the sound from sound.js
        this.NOTIFICATION_SOUND_BASE64 = (typeof sound !== 'undefined') ? sound : null;
        
        // Detect iOS devices
        this.detectIOSDevice();
    }

    /**
     * Detect if running on iOS device
     */
    detectIOSDevice() {
        this.isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        if (this.isIOSDevice) {
            console.log('📱 iOS-Gerät erkannt - Audio benötigt Benutzerinteraktion');
            this.setupIOSAudioUnlock();
        }
    }

    /**
     * Setup iOS audio unlock mechanism
     */
    setupIOSAudioUnlock() {
        // Add event listeners for user interaction
        const unlockEvents = ['touchstart', 'touchend', 'mousedown', 'click'];
        
        const unlockAudio = () => {
            if (this.audioUnlocked) return;
            
            this.unlockIOSAudio().then(() => {
                // Remove event listeners after successful unlock
                unlockEvents.forEach(event => {
                    document.removeEventListener(event, unlockAudio, true);
                });
            });
        };
        
        unlockEvents.forEach(event => {
            document.addEventListener(event, unlockAudio, true);
        });
    }

    /**
     * Unlock iOS audio restrictions
     */
    async unlockIOSAudio() {
        try {
            if (!this.fallbackAudioContext) {
                this.fallbackAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Resume context if suspended
            if (this.fallbackAudioContext.state === 'suspended') {
                await this.fallbackAudioContext.resume();
            }
            
            // Play a silent sound to unlock audio
            const oscillator = this.fallbackAudioContext.createOscillator();
            const gainNode = this.fallbackAudioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.fallbackAudioContext.destination);
            
            gainNode.gain.value = 0; // Silent
            oscillator.frequency.value = 440;
            
            oscillator.start();
            oscillator.stop(this.fallbackAudioContext.currentTime + 0.01);
            
            this.audioUnlocked = true;
            console.log('🔓 iOS Audio entsperrt');
            
            // Play any pending notifications
            while (this.pendingNotifications.length > 0) {
                const notification = this.pendingNotifications.shift();
                this.playNotificationSound();
            }
            
            // Show success message for iOS users
            if (window.showToast) {
                window.showToast('🔊 Audio-Benachrichtigungen aktiviert', 'success');
            }
            
            return true;
        } catch (error) {
            console.error('Fehler beim Entsperren des iOS Audio:', error);
            return false;
        }
    }

    /**
     * Initialize audio system
     */
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            await this.initSoundNotification();
            this.isInitialized = true;
            console.log('🔊 Audio system initialized');
        } catch (error) {
            console.warn('Audio initialization failed, using fallback:', error);
            this.createFallbackBeep();
        }
    }

    /**
     * Create fallback beep sound using Web Audio API
     */
    createFallbackBeep() {
        try {
            this.fallbackAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('🔔 Fallback beep system ready');
        } catch (error) {
            console.error('Failed to create fallback audio context:', error);
        }
    }

    /**
     * Initialize sound notification using Web Audio API (CSP-friendly)
     */
    async initSoundNotification() {
        if (!this.NOTIFICATION_SOUND_BASE64 || this.NOTIFICATION_SOUND_BASE64.trim() === '') {
            throw new Error('No notification sound configured');
        }

        try {
            // Create audio context
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Convert base64 to ArrayBuffer
            const base64Data = this.NOTIFICATION_SOUND_BASE64.replace(/^data:audio\/[^;]+;base64,/, '');
            const binaryData = atob(base64Data);
            const arrayBuffer = new ArrayBuffer(binaryData.length);
            const uint8Array = new Uint8Array(arrayBuffer);
            
            for (let i = 0; i < binaryData.length; i++) {
                uint8Array[i] = binaryData.charCodeAt(i);
            }
            
            // Decode audio data
            this.notificationAudio = await audioContext.decodeAudioData(arrayBuffer);
            this.fallbackAudioContext = audioContext;
            
            console.log('🎵 Notification sound loaded successfully');
        } catch (error) {
            console.error('Failed to initialize sound notification:', error);
            throw error;
        }
    }

    /**
     * Play notification sound using Web Audio API
     */
    playNotificationSound() {
        // iOS-spezifische Behandlung
        if (this.isIOSDevice && !this.audioUnlocked) {
            console.log('📱 iOS Audio noch nicht entsperrt - füge zu wartenden Benachrichtigungen hinzu');
            this.pendingNotifications.push('notification');
            
            // Zeige Hinweis für iOS-Benutzer
            if (window.showToast) {
                window.showToast('📱 Tippen Sie irgendwo, um Audio-Benachrichtigungen zu aktivieren', 'info');
            }
            return;
        }

        if (!this.fallbackAudioContext) {
            console.warn('Audio context not available');
            return;
        }

        try {
            // Resume context if suspended (wichtig für iOS)
            if (this.fallbackAudioContext.state === 'suspended') {
                this.fallbackAudioContext.resume().then(() => {
                    this.doPlayNotificationSound();
                }).catch(error => {
                    console.error('Fehler beim Fortsetzen des Audio-Kontexts:', error);
                    this.playFallbackBeep();
                });
            } else {
                this.doPlayNotificationSound();
            }
        } catch (error) {
            console.error('Error playing notification sound:', error);
            this.playFallbackBeep();
        }
    }

    /**
     * Actually play the notification sound
     */
    doPlayNotificationSound() {
        try {
            if (this.notificationAudio && this.notificationAudio instanceof AudioBuffer) {
                // Play the loaded sound
                const source = this.fallbackAudioContext.createBufferSource();
                source.buffer = this.notificationAudio;
                source.connect(this.fallbackAudioContext.destination);
                source.start(0);
                console.log('🎵 Playing notification sound');
            } else {
                // Fallback to beep
                this.playFallbackBeep();
            }
        } catch (error) {
            console.error('Error in doPlayNotificationSound:', error);
            this.playFallbackBeep();
        }
    }

    /**
     * Play fallback beep sound
     */
    playFallbackBeep() {
        // iOS-spezifische Behandlung
        if (this.isIOSDevice && !this.audioUnlocked) {
            console.log('📱 iOS Audio noch nicht entsperrt - füge Beep zu wartenden Benachrichtigungen hinzu');
            this.pendingNotifications.push('beep');
            return;
        }

        if (!this.fallbackAudioContext) {
            console.warn('No audio context available for fallback beep');
            return;
        }

        try {
            // Resume context if suspended
            if (this.fallbackAudioContext.state === 'suspended') {
                this.fallbackAudioContext.resume().then(() => {
                    this.doPlayFallbackBeep();
                }).catch(error => {
                    console.error('Fehler beim Fortsetzen des Audio-Kontexts für Beep:', error);
                });
            } else {
                this.doPlayFallbackBeep();
            }
        } catch (error) {
            console.error('Error playing fallback beep:', error);
        }
    }

    /**
     * Actually play the beep sound
     */
    doPlayFallbackBeep() {
        try {
            const oscillator = this.fallbackAudioContext.createOscillator();
            const gainNode = this.fallbackAudioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.fallbackAudioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, this.fallbackAudioContext.currentTime);
            gainNode.gain.setValueAtTime(0.3, this.fallbackAudioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.fallbackAudioContext.currentTime + 0.5);
            
            oscillator.start(this.fallbackAudioContext.currentTime);
            oscillator.stop(this.fallbackAudioContext.currentTime + 0.5);
            
            console.log('🔔 Playing fallback beep');
        } catch (error) {
            console.error('Error playing fallback beep:', error);
        }
    }

    /**
     * Play notification sequence: first beep, then sound
     */
    async playNotificationSequence() {
        console.log('🎵 Playing notification sequence');
        
        // Play beep first
        this.playFallbackBeep();
        
        // Wait a bit, then play the custom sound
        setTimeout(() => {
            this.playNotificationSound();
        }, 600);
    }

    /**
     * Test sound function (for user testing)
     */
    testNotificationSound() {
        console.log('🔊 Testing notification sound...');
        
        if (!this.isInitialized) {
            console.log('Audio not initialized, initializing now...');
            this.initialize().then(() => {
                this.playNotificationSound();
            });
        } else {
            this.playNotificationSound();
        }
    }

    /**
     * Get audio system status
     */
    getStatus() {
        if (this.notificationAudio && this.notificationAudio instanceof AudioBuffer) {
            return {
                status: 'ready',
                type: 'custom',
                duration: this.notificationAudio.duration,
                channels: this.notificationAudio.numberOfChannels
            };
        } else if (this.fallbackAudioContext) {
            return {
                status: 'fallback',
                type: 'beep',
                message: 'Using fallback beep sound'
            };
        } else {
            return {
                status: 'unavailable',
                type: 'none',
                message: 'No audio system available'
            };
        }
    }
}

// Export singleton instance
const audioManager = new AudioNotificationManager();
