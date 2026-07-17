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

  AuditLog.create(logData).catch(err => {
    console.error('[AUDIT_LOG_HATA] İşlem geçmişi kaydedilemedi:', err.message);
  });
}

module.exports = { logAction };
