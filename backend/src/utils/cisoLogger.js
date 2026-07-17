/**
 * DMS On-Premise - CISO Logger Modülü
 * CISO eylemlerini veritabanından tamamen bağımsız şekilde dosya sisteminde loglar.
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// CISO İşlemleri için Logger
const cisoLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'ciso_audit.log') })
  ]
});

// E-posta Doğrulama Arşivi için Logger
const emailLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, message }) => {
      return `[${timestamp}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'email_verifications.log') })
  ]
});

module.exports = {
  logCisoAction: (action, details, ipAddress = 'N/A') => {
    cisoLogger.info({
      action,
      details,
      ipAddress,
      timestamp: new Date().toISOString()
    });
  },
  archiveEmailVerification: (email, username, ipAddress = 'N/A') => {
    emailLogger.info(`E-POSTA DOĞRULANDI VE ARŞİVLENDİ: E-posta: ${email}, Kullanıcı: ${username}, IP: ${ipAddress}`);
  }
};
