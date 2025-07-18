#!/usr/bin/env node

/**
 * Node.js Deploy Script für Raspberry Pi
 * Verwendet node-ssh für SSH-Verbindungen
 */

const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');

const config = {
    host: '192.168.178.73',
    username: 'apexpam',
    password: 'Reyhan2012!',
    remotePath: '/home/apexpam/repos',
    appName: 'raspizulassungsstellewz'
};

async function deploy() {
    const ssh = new NodeSSH();
    
    try {
        console.log('🚀 Starting deployment to Raspberry Pi...');
        
        // Verbinde zu SSH
        console.log('📡 Connecting to SSH...');
        await ssh.connect(config);
        
        // Erstelle Remote-Verzeichnis
        console.log('📁 Creating remote directory...');
        await ssh.execCommand(`mkdir -p ${config.remotePath}`);
        
        // Stoppe existierende App
        console.log('⏹️  Stopping existing app...');
        await ssh.execCommand(`pkill -f 'node.*index.js' || true`);
        
        // Upload Dateien
        console.log('📂 Uploading files...');
        const remotePath = `${config.remotePath}/${config.appName}`;
        
        await ssh.putDirectory(
            process.cwd(),
            remotePath,
            {
                recursive: true,
                concurrency: 10,
                validate: function(itemPath) {
                    const relativePath = path.relative(process.cwd(), itemPath);
                    
                    // Exclude bestimmte Dateien/Ordner
                    return !relativePath.includes('node_modules') &&
                           !relativePath.includes('.git') &&
                           !relativePath.includes('.DS_Store') &&
                           !relativePath.endsWith('.log') &&
                           !relativePath.includes('deploy');
                },
                tick: function(localPath, remotePath, error) {
                    if (error) {
                        console.log(`❌ Failed: ${localPath}`);
                    } else {
                        console.log(`✅ Uploaded: ${path.relative(process.cwd(), localPath)}`);
                    }
                }
            }
        );
        
        // Installiere Dependencies
        console.log('📦 Installing dependencies...');
        
        // Versuche verschiedene Node.js-Pfade
        const nodePaths = [
            '/usr/bin/node',
            '/usr/local/bin/node',
            '/home/apexpam/.nvm/versions/node/*/bin/node',
            'node'
        ];
        
        const npmPaths = [
            '/usr/bin/npm',
            '/usr/local/bin/npm',
            '/home/apexpam/.nvm/versions/node/*/bin/npm',
            'npm'
        ];
        
        // Prüfe Node.js Installation
        console.log('🔍 Checking Node.js installation...');
        const nodeCheck = await ssh.execCommand('which node || echo "NOT_FOUND"');
        
        if (nodeCheck.stdout.includes('NOT_FOUND')) {
            console.log('⚠️  Node.js not found in PATH. Trying alternative paths...');
            
            // Versuche Node.js zu finden
            const findNode = await ssh.execCommand('find /usr -name "node" 2>/dev/null | head -1 || find /home -name "node" 2>/dev/null | head -1 || echo "NOT_FOUND"');
            
            if (findNode.stdout.includes('NOT_FOUND')) {
                console.log('❌ Node.js not installed on Raspberry Pi!');
                console.log('📋 Please install Node.js first:');
                console.log('   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -');
                console.log('   sudo apt-get install -y nodejs');
                console.log('');
                console.log('🎯 Files uploaded successfully to:', remotePath);
                console.log('   You can install dependencies manually after installing Node.js');
                return;
            } else {
                console.log(`✅ Found Node.js at: ${findNode.stdout.trim()}`);
            }
        } else {
            console.log(`✅ Node.js found at: ${nodeCheck.stdout.trim()}`);
        }
        
        // Versuche npm install
        const installResult = await ssh.execCommand(`cd ${remotePath} && npm install --production || echo "NPM_FAILED"`);
        
        if (installResult.stdout.includes('NPM_FAILED') || installResult.stderr.includes('npm: command not found')) {
            console.log('⚠️  npm install failed. Trying alternative...');
            
            // Versuche mit vollständigem Pfad
            const npmResult = await ssh.execCommand(`cd ${remotePath} && /usr/bin/npm install --production 2>/dev/null || /usr/local/bin/npm install --production 2>/dev/null || echo "INSTALL_FAILED"`);
            
            if (npmResult.stdout.includes('INSTALL_FAILED')) {
                console.log('❌ Could not install dependencies automatically');
                console.log('📋 Please install manually:');
                console.log(`   ssh ${config.username}@${config.host}`);
                console.log(`   cd ${remotePath}`);
                console.log('   npm install');
            } else {
                console.log('✅ Dependencies installed successfully');
            }
        } else {
            console.log('✅ Dependencies installed successfully');
            if (installResult.stderr) {
                console.log('Install warnings:', installResult.stderr);
            }
        }
        
        // Setup .env file für Raspberry Pi
        console.log('⚙️  Setting up environment configuration...');
        await ssh.execCommand(`cd ${remotePath} && cp .env.pi .env 2>/dev/null || echo "No .env.pi found, using defaults"`);
        
        // Starte App
        console.log('🚀 Starting application...');
        const startResult = await ssh.execCommand(`cd ${remotePath} && nohup node index.js > app.log 2>&1 &`);
        
        if (startResult.stderr && !startResult.stderr.includes('nohup')) {
            console.log('⚠️  Start warnings:', startResult.stderr);
        }
        
        console.log('');
        console.log('🎉 Deployment completed successfully!');
        console.log(`🌐 App URL: http://${config.host}:8080`);
        console.log(`📁 Remote path: ${remotePath}`);
        console.log('');
        console.log('📋 Useful commands:');
        console.log(`   Check logs: ssh ${config.username}@${config.host} 'tail -f ${remotePath}/app.log'`);
        console.log(`   Stop app:   ssh ${config.username}@${config.host} 'pkill -f "node.*index.js"'`);
        
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        process.exit(1);
    } finally {
        ssh.dispose();
    }
}

// Prüfe Voraussetzungen
if (!fs.existsSync('package.json')) {
    console.error('❌ Error: package.json not found. Please run this script from the project root directory.');
    process.exit(1);
}

// Führe Deployment aus
deploy().catch(console.error);
