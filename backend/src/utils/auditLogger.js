/**
 * DMS On-Premise - Audit Logger Yardımcı Fonksiyonu
 * 
 * İş mantığı seviyesinde kullanıcı aksiyonlarını audit_logs tablosuna kaydeder.
 * Çift imza desteği sayesinde hem Express request nesnesiyle hem de doğrudan sistem parametreleriyle çalışabilir.
 */

const AuditLog = require('../models/AuditLog');

/**
 * @param {Object|string} reqOrAction - Express request nesnesi veya doğrudan aksiyon adı
 * @param {string|null} actionOrUserId - Aksiyon adı veya kullanıcı ID'si
 * @param {string|null} documentIdOrUserName - Belge ID'si veya kullanıcı adı
 * @param {string|null} documentNameOrDocId - Belge adı veya belge ID'si
 * @param {string|null} detailsOrDocName - Detay açıklaması veya belge adı
 * @param {string|null} [directDetails] - Doğrudan çağrıda detay açıklaması
 * @param {string|null} [directIp] - Doğrudan çağrıda IP adresi
 */
function logAction(
  reqOrAction, 
  actionOrUserId, 
  documentIdOrUserName, 
  documentNameOrDocId, 
  detailsOrDocName, 
  directDetails, 
  directIp
) {
  let logData = {};

  if (reqOrAction && typeof reqOrAction === 'object' && (reqOrAction.headers || reqOrAction.connection)) {
    // İmza 1: logAction(req, action, documentId, documentName, details)
    const req = reqOrAction;
    const action = actionOrUserId;
    const documentId = documentIdOrUserName;
    const documentName = documentNameOrDocId;
    const details = detailsOrDocName;

    logData = {
      userId: req.user?.id || null,
      userName: req.user?.fullName || req.user?.username || 'Bilinmeyen Kullanıcı',
      action,
      documentId: documentId || null,
      documentName: documentName || null,
      details: details || '',
      ipAddress: req.ip || req.connection?.remoteAddress || null,
    };
  } else {
    // İmza 2: logAction(action, userId, userName, documentId, documentName, details, ipAddress)
    const action = reqOrAction;
    const userId = actionOrUserId;
    const userName = documentIdOrUserName;
    const documentId = documentNameOrDocId;
    const documentName = detailsOrDocName;
    const details = directDetails;
    const ipAddress = directIp;

    logData = {
      userId: userId || null,
      userName: userName || 'Sistem',
      action,
      documentId: documentId || null,
      documentName: documentName || null,
      details: details || '',
      ipAddress: ipAddress || null,
    };
  }

  AuditLog.create(logData).then(async (newLog) => {
    try {
      const fs = require('fs');
      const { SystemSettings } = require('../models');
      const record = await SystemSettings.findByPk('kasa_settings');
      let path = '/app/uploads/dms-audit.jsonl';
      if (record && record.value?.logFilePath) {
        path = record.value.logFilePath;
      }
      const logLine = JSON.stringify({
        id: newLog.id,
        userId: newLog.userId,
        userName: newLog.userName,
        action: newLog.action,
        documentId: newLog.documentId,
        documentName: newLog.documentName,
        details: newLog.details,
        ipAddress: newLog.ipAddress,
        createdAt: newLog.createdAt
      }) + '\n';
      fs.appendFileSync(path, logLine);
    } catch (fsErr) {
      console.warn('[AUDIT_LOG_FILE_ERR] Log dosyasına yazılamadı:', fsErr.message);
    }
  }).catch(err => {
    console.error('[AUDIT_LOG_HATA] İşlem geçmişi kaydedilemedi:', err.message);
  });
}

module.exports = { logAction };
