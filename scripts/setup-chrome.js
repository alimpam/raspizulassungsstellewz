#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔧 Setup Chrome für die aktuelle Architektur...');

// Architektur und Platform ermitteln
const platform = os.platform();
const arch = os.arch();

console.log(`📋 Erkannte Platform: ${platform}`);
console.log(`📋 Erkannte Architektur: ${arch}`);

// Bestimme die richtige Chrome-Installation basierend auf der Architektur
function setupChrome() {
    try {
        if (platform === 'linux' && arch === 'arm64') {
            console.log('🔧 Raspberry Pi (ARM64) erkannt - installiere Chromium...');
            
            // Puppeteer Chrome deinstallieren falls vorhanden
            try {
                console.log('🗑️ Entferne eventuell vorhandene x64 Chrome-Installation...');
                const homeDir = os.homedir();
                const puppeteerCacheDir = path.join(homeDir, '.cache', 'puppeteer');
                if (fs.existsSync(puppeteerCacheDir)) {
                    execSync(`rm -rf "${puppeteerCacheDir}"`, { stdio: 'inherit' });
                    console.log('✅ Puppeteer Cache gelöscht');
                }
            } catch (error) {
                console.log('⚠️ Kein Puppeteer Cache gefunden (das ist OK)');
            }
            
            // System Chromium installieren
            console.log('📦 Installiere System-Chromium...');
            try {
                execSync('sudo apt-get update', { stdio: 'inherit' });
                execSync('sudo apt-get install -y chromium-browser', { stdio: 'inherit' });
                console.log('✅ Chromium erfolgreich installiert');
            } catch (error) {
                console.log('⚠️ Chromium Installation fehlgeschlagen, versuche alternative Installation...');
                try {
                    execSync('sudo apt-get install -y chromium', { stdio: 'inherit' });
                    console.log('✅ Chromium (alternative) erfolgreich installiert');
                } catch (altError) {
                    console.error('❌ Chromium Installation fehlgeschlagen:', altError.message);
                }
            }
            
            // Prüfe ob Chromium verfügbar ist
            try {
                const chromiumPath = execSync('which chromium-browser || which chromium', { encoding: 'utf8' }).trim();
                console.log(`✅ Chromium gefunden: ${chromiumPath}`);
                
                // Erstelle ein Config-File mit dem Chromium-Pfad
                const configDir = path.join(__dirname, '..', 'config');
                if (!fs.existsSync(configDir)) {
                    fs.mkdirSync(configDir, { recursive: true });
                }
                
                const chromeConfig = {
                    chromePath: chromiumPath,
                    platform: 'linux_arm64',
                    useSystemChrome: true
                };
                
                fs.writeFileSync(
                    path.join(configDir, 'chrome-config.json'),
                    JSON.stringify(chromeConfig, null, 2)
                );
                
                console.log('✅ Chrome-Konfiguration für ARM64 erstellt');
                
            } catch (error) {
                console.error('❌ Chromium nicht gefunden nach Installation:', error.message);
            }
            
        } else if (platform === 'darwin' || (platform === 'linux' && arch === 'x64')) {
            console.log('🔧 Mac/x64 System erkannt - verwende Standard Puppeteer Chrome...');
            
            // Standard Puppeteer Chrome verwenden
            const chromeConfig = {
                chromePath: null, // Puppeteer default
                platform: platform === 'darwin' ? 'mac' : 'linux_x64',
                useSystemChrome: false
            };
            
            const configDir = path.join(__dirname, '..', 'config');
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            
            fs.writeFileSync(
                path.join(configDir, 'chrome-config.json'),
                JSON.stringify(chromeConfig, null, 2)
            );
            
            console.log('✅ Chrome-Konfiguration für x64/Mac erstellt');
            
        } else {
            console.log(`⚠️ Unbekannte Platform/Architektur: ${platform}/${arch}`);
            console.log('📝 Verwende Standard-Konfiguration...');
            
            const chromeConfig = {
                chromePath: null,
                platform: 'unknown',
                useSystemChrome: false
            };
            
            const configDir = path.join(__dirname, '..', 'config');
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            
            fs.writeFileSync(
                path.join(configDir, 'chrome-config.json'),
                JSON.stringify(chromeConfig, null, 2)
            );
        }
        
        console.log('🎉 Chrome-Setup abgeschlossen!');
        
    } catch (error) {
        console.error('❌ Fehler beim Chrome-Setup:', error.message);
        console.log('🔄 Erstelle Fallback-Konfiguration...');
        
        // Fallback-Konfiguration erstellen
        const chromeConfig = {
            chromePath: null,
            platform: 'fallback',
            useSystemChrome: platform === 'linux' && arch === 'arm64',
            error: error.message
        };
        
        const configDir = path.join(__dirname, '..', 'config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        fs.writeFileSync(
            path.join(configDir, 'chrome-config.json'),
            JSON.stringify(chromeConfig, null, 2)
        );
        
        console.log('⚠️ Fallback-Konfiguration erstellt');
    }
}

// Führe Setup aus
setupChrome();
