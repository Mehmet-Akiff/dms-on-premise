/**
 * DMS On-Premise - CISO Logger Modülü
 * CISO eylemlerini veritabanından tamamen bağımsız şekilde dosya sisteminde loglar.
 * 
 * GİZLİLİK KURALI:
 * - Genel loglar (ciso_audit.log): Sadece META VERİ (kim, ne zaman, tür)
 * - Bireysel loglar (user_logs/<userId>.log): İçerik dahil TAM DETAY (Sadece CISO erişebilir)
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../../logs');
const userLogDir = path.join(logDir, 'user_logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
if (!fs.existsSync(userLogDir)) {
  fs.mkdirSync(userLogDir, { recursive: true });
}

// CISO Genel İşlem Logger (META VERİ ONLY — metin içeriği YOK)
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

// Kullanıcı bazında dinamik logger cache
const userLoggers = {};

function getUserLogger(userId) {
  if (!userId) return null;
  if (!userLoggers[userId]) {
    userLoggers[userId] = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: path.join(userLogDir, `${userId}.log`),
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        })
      ]
    });
  }
  return userLoggers[userId];
}

module.exports = {
  /**
   * Genel CISO Audit Log — Sadece metadata (metin içeriği ASLA yazılmaz)
   */
  logCisoAction: (action, details, ipAddress = 'N/A') => {
    // Genel log: metin/mesaj içeriği temizle
    const safeDetails = { ...details };
    delete safeDetails.contentPreview;
    delete safeDetails.content;
    delete safeDetails.messageBody;
    delete safeDetails.noteContent;

    cisoLogger.info({
      action,
      details: safeDetails,
      ipAddress,
      timestamp: new Date().toISOString()
    });

    // Bireysel kullanıcı logu: TAM İÇERİK (sadece CISO erişebilir)
    const userId = details?.senderId || details?.userId || null;
    if (userId) {
      const uLogger = getUserLogger(userId);
      if (uLogger) {
        uLogger.info({
          action,
          details,  // Tam içerik dahil
          ipAddress,
          timestamp: new Date().toISOString()
        });
      }
    }
  },

  /**
   * E-posta doğrulama arşivi
   */
  archiveEmailVerification: (email, username, ipAddress = 'N/A') => {
    emailLogger.info(`E-POSTA DOĞRULANDI VE ARŞİVLENDİ: E-posta: ${email}, Kullanıcı: ${username}, IP: ${ipAddress}`);
  }
};
