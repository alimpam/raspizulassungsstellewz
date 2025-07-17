const winston = require('winston');
const path = require('path');

// Log-Konfiguration
const logConfig = {
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ level, message, timestamp, stack }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
        })
    ),
    transports: [
        // Konsole
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        // Datei für alle Logs
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/app.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        }),
        // Separate Datei für Fehler
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/error.log'),
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5,
            tailable: true
        })
    ]
};

const logger = winston.createLogger(logConfig);

module.exports = logger;
