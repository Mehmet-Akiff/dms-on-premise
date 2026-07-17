/**
 * DMS On-Premise - Doküman Yükleme ve Yönetim Rotaları
 * Multer ile dosya yükleme, MIME tipi doğrulama, DB kaydı ve AI Servis entegrasyonu.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { sequelize, Document, DocumentMetadata, ProcessingJob, AuditLog } = require('../models');
const { verifyToken, requireAdmin, requireCiso, requireReadPermission, requireWritePermission } = require('../middleware/auth.middleware');
const { logAction } = require('../utils/auditLogger');

const router = express.Router();
const { Op } = require('sequelize');

function getSensitivityWhere(user) {
  if (!user) return { sensitivity: 'public' };
  if (user.role === 'admin') return {};
  
  const allowedSensitivities = user.role === 'ciso' ? ['public', 'medium'] : ['public'];
  
  return {
    [Op.or]: [
      { uploadedBy: user.id },
      { sensitivity: { [Op.in]: allowedSensitivities } }
    ]
  };
}

function getSensitivitySql(user) {
  if (!user) return " AND d.sensitivity = 'public'";
  if (user.role === 'admin') return "";
  
  const allowedSens = user.role === 'ciso' ? "'public', 'medium'" : "'public'";
  return ` AND (d.uploaded_by = '${user.id}' OR d.sensitivity IN (${allowedSens}))`;
}

function hasSensitivityAccess(document, user) {
  if (!document) return false;
  if (!user) return document.sensitivity === 'public';
  if (user.role === 'admin') return true;
  
  // Kendi yüklediği belgeye her zaman erişebilir
  if (document.uploadedBy === user.id || document.uploaded_by === user.id) return true;
  
  if (user.role === 'ciso') {
    return document.sensitivity === 'public' || document.sensitivity === 'medium';
  }
  return document.sensitivity === 'public';
}

// Doküman yönetim rotalarının tamamı için JWT doğrulaması şimdilik devre dışı (kullanıcı isteğiyle)
// router.use(verifyToken);

// ============================================================
// Yapılandırma
// ============================================================

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';

// İzin verilen MIME tipleri
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// ============================================================
// Multer Yapılandırması
// ============================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/app/uploads');
  },
  filename: (req, file, cb) => {
    // Benzersiz dosya adı: UUID + orijinal uzantı
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Desteklenmeyen dosya tipi: ${file.mimetype}. İzin verilen tipler: PDF, PNG, JPG`
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

// ============================================================
// Hata Yakalama Middleware'i (Multer hataları için)
// ============================================================

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'Dosya boyutu çok büyük',
        message: `Maksimum dosya boyutu: ${MAX_FILE_SIZE / (1024 * 1024)} MB`,
      });
    }
    return res.status(400).json({ error: 'Dosya yükleme hatası', message: err.message });
  }
  if (err) {
    return res.status(400).json({ error: 'Geçersiz istek', message: err.message });
  }
  next();
};

// ============================================================
// Asenkron AI Servis İşleme Fonksiyonu
// ============================================================

const fs = require('fs');

/**
 * Yüklenen dokümanı arka planda AI servisine gönderir.
 * Başarılıysa: DocumentMetadata oluşturur, Document → COMPLETED, Job → COMPLETED
 * Başarısızsa: Document → FAILED, Job → FAILED + errorLog
 *
 * ÖNEMLİ: Bu fonksiyon fire-and-forget çağrıldığı için kendi içinde
 * tüm hataları yakalamalıdır. Dışarıya ASLA hata fırlatmamalıdır.
 */
async function processDocumentWithAI(document, job) {
  const fileName = path.basename(document.filePath);
  const fullPath = document.filePath; // /app/uploads/UUID.ext

  console.log(`[AI_SERVICE] ========== İşleme Başlıyor ==========`);
  console.log(`[AI_SERVICE] Doküman ID : ${document.id}`);
  console.log(`[AI_SERVICE] Dosya Adı  : ${fileName}`);
  console.log(`[AI_SERVICE] Tam Yol    : ${fullPath}`);
  console.log(`[AI_SERVICE] Hedef      : ${AI_SERVICE_URL}/api/ocr`);

  try {
    // 0. Dosyanın diskte var olduğunu kontrol et
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Dosya diskte bulunamadı: ${fullPath}`);
    }
    console.log(`[AI_SERVICE] Dosya diskte doğrulandı ✓`);

    // 1. İş durumunu PROCESSING olarak güncelle
    await job.update({ jobStatus: 'PROCESSING', startedAt: new Date() });
    await document.update({ status: 'PROCESSING' });
    console.log(`[AI_SERVICE] Durum → PROCESSING`);

    // 2. AI servisine OCR isteği at (JSON body ile dosya yolunu gönder)
    //    Not: Backend ve AI servisi aynı Docker volume'ü paylaşır.
    //    Backend: /app/uploads/x.png ↔ AI Service: /app/shared-uploads/x.png
    console.log(`[AI_SERVICE] POST isteği gönderiliyor → filePath: "${fileName}"`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 dk timeout (PDF çok sayfalı olabilir)

    let response;
    try {
      response = await fetch(`${AI_SERVICE_URL}/api/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: fileName }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      // Ağ hatası veya timeout — AI servisi erişilemez
      const isAbort = fetchError.name === 'AbortError';
      throw new Error(
        isAbort
          ? `AI servisi ${AI_SERVICE_URL} adresinden 120 saniye içinde yanıt vermedi (TIMEOUT)`
          : `AI servisine bağlanılamadı (${AI_SERVICE_URL}): ${fetchError.message}`
      );
    } finally {
      clearTimeout(timeoutId);
    }

    console.log(`[AI_SERVICE] HTTP yanıt kodu: ${response.status} ${response.statusText}`);

    // 3. Yanıtı parse et
    let result;
    const rawBody = await response.text();
    try {
      result = JSON.parse(rawBody);
    } catch (parseError) {
      console.error(`[AI_SERVICE_ERROR] JSON parse hatası. Ham yanıt: ${rawBody.substring(0, 500)}`);
      throw new Error(`AI servisi geçersiz JSON döndü (HTTP ${response.status})`);
    }

    console.log(`[AI_SERVICE] Yanıt status: ${result.status || 'bilinmiyor'}`);

    // 4. AI yanıtını değerlendir
    if (response.ok && result.status === 'success') {
      const extractedText = result.text || '';
      let category = 'Diger';
      let confidence = 0.0;
      let tags = [];

      // 4.1. Sınıflandırma ve NER Analizi (SpaCy NLP)
      if (extractedText.trim().length > 0) {
        console.log(`[AI_SERVICE] Kategori ve NER analizi başlatılıyor...`);
        try {
          const classResponse = await fetch(`${AI_SERVICE_URL}/api/classify-and-extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: extractedText }),
          });
          
          if (classResponse.ok) {
            const classResult = await classResponse.json();
            if (classResult.status === 'success') {
              category = classResult.category || classResult.documentCategory || 'Diger';
              confidence = classResult.confidence || 0.0;
              tags = classResult.tags || [];
              console.log(`[AI_SERVICE] Analiz Başarılı. Kategori: ${category} (Güven: ${confidence}), Etiketler: [${tags.join(', ')}]`);
            }
          }
        } catch (classError) {
          console.error(`[AI_SERVICE_WARN] Kategori sınıflandırma hatası (süreci etkilemez):`, classError.message);
        }
      }

      // Başarılı: Metni ve analiz verilerini DocumentMetadata tablosuna kaydet
      await DocumentMetadata.create({
        documentId: document.id,
        extractedText: extractedText,
        category: category,
        extractedTags: tags,
        confidence: confidence,
      });

      const charCount = (result.text || '').length;
      console.log(`[AI_SERVICE] OCR metni kaydedildi — ${charCount} karakter`);

      // Document ve Job durumlarını COMPLETED yap
      const updatedDoc = await Document.findByPk(document.id, {
        include: [{ association: 'metadata' }]
      });
      await document.update({ status: 'COMPLETED' });
      await job.update({
        jobStatus: 'COMPLETED',
        resultSummary: `OCR başarılı. ${charCount} karakter çıkarıldı.`,
        completedAt: new Date(),
      });

      console.log(`[AI_SERVICE] ✅ İşlem başarıyla tamamlandı — Doküman: ${document.id}`);

      // SSE ile durumu canlı yolla
      if (global.sendDocumentUpdateToClients) {
        global.sendDocumentUpdateToClients({
          id: document.id,
          status: 'COMPLETED',
          category: category,
          document: updatedDoc
        });
      }

    } else {
      // AI servisi hata döndü — detaylı mesaj çıkar
      let errorMessage;
      if (result.detail && typeof result.detail === 'object') {
        errorMessage = result.detail.message || JSON.stringify(result.detail);
      } else {
        errorMessage = result.detail || result.message || result.error || `AI servisi hata döndü (HTTP ${response.status})`;
      }
      throw new Error(errorMessage);
    }

  } catch (error) {
    // ==========================================
    // HATA YAKALAMA — Document → FAILED garantisi
    // ==========================================
    console.error(`[AI_SERVICE_ERROR] ❌ İşlem başarısız — Doküman: ${document.id}`);
    console.error(`[AI_SERVICE_ERROR] Hata Mesajı: ${error.message}`);
    console.error(`[AI_SERVICE_ERROR] Stack Trace:`, error.stack);

    // Veritabanını güncelle — her ne olursa olsun FAILED'a düşür
    try {
      await document.update({ status: 'FAILED' });
      console.log(`[AI_SERVICE] Doküman durumu → FAILED`);
    } catch (dbError) {
      console.error(`[AI_SERVICE_ERROR] Document.update başarısız:`, dbError.message);
    }

    try {
      await job.update({
        jobStatus: 'FAILED',
        errorLog: `${error.message}\n\nStack: ${error.stack || 'N/A'}`,
        completedAt: new Date(),
      });
      console.log(`[AI_SERVICE] Job durumu → FAILED`);
    } catch (dbError) {
      console.error(`[AI_SERVICE_ERROR] Job.update başarısız:`, dbError.message);
    }

    // SSE ile durumu canlı yolla (Hata durumunda)
    if (global.sendDocumentUpdateToClients) {
      global.sendDocumentUpdateToClients({
        id: document.id,
        status: 'FAILED',
        category: 'Diger'
      });
    }
  }

  console.log(`[AI_SERVICE] ========== İşleme Bitti ==========\n`);
}

// ============================================================
// GET /api/documents/audit-logs — Kullanıcı İşlem Geçmişi (Sadece CISO)
// ============================================================

router.get('/audit-logs', verifyToken, requireCiso, async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;
    const action = req.query.action || null;
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    const username = req.query.username || null;
    const details = req.query.details || null;

    // Filtre koşulları
    const where = {};
    if (action) {
      where.action = action;
    }
    if (username) {
      where.userName = { [Op.iLike]: `%${username}%` };
    }
    if (details) {
      where.details = { [Op.iLike]: `%${details}%` };
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate + 'T23:59:59.999Z');
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    res.status(200).json({
      totalCount: count,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      logs: rows,
    });
  } catch (error) {
    console.error('[HATA] Audit log listeleme:', error.message);
    res.status(500).json({ error: 'İşlem geçmişi getirilirken bir hata oluştu.' });
  }
});

// ============================================================
// POST /api/documents/audit-logs/click — Ekran Tıklama / İndirme / Önizleme Eylemlerini Kaydet
// ============================================================
router.post('/audit-logs/click', verifyToken, requireReadPermission, async (req, res) => {
  const { action, documentId, documentName, details } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  try {
    logAction(
      action || 'CLICK',
      req.user.id || null,
      req.user.fullName || 'Bilinmeyen Kullanıcı',
      documentId || null,
      documentName || null,
      details || 'Ekrana tıklandı.',
      ip
    );
    res.status(200).json({ message: 'Eylem başarıyla loglandı.' });
  } catch (err) {
    console.error('[HATA] Tıklama logu kaydedilemedi:', err.message);
    res.status(500).json({ error: 'Tıklama logu kaydedilemedi.' });
  }
});

// ============================================================
// GET /api/documents/stats — Dashboard İstatistikleri
// ============================================================

router.get('/stats', verifyToken, async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const sensWhere = getSensitivityWhere(req.user);

    // Toplam doküman sayısı (soft-delete olmayanlar)
    const totalDocuments = await Document.count({ where: { deletedAt: null, ...sensWhere } });

    // Durum dağılımı
    const statusCounts = await Document.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('documents.id')), 'count']],
      where: { deletedAt: null, ...sensWhere },
      group: ['status'],
      raw: true,
    });

    // Kategoriye göre dağılım (metadata tablosundan)
    const categoryCounts = await DocumentMetadata.findAll({
      attributes: ['category', [sequelize.fn('COUNT', sequelize.col('document_metadata.id')), 'count']],
      include: [{
        model: Document,
        as: 'document',
        attributes: [],
        where: { deletedAt: null, ...sensWhere },
        required: true,
      }],
      group: ['category'],
      raw: true,
    });

    // Son 24 saatte yüklenen
    const last24h = await Document.count({
      where: {
        deletedAt: null,
        createdAt: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        ...sensWhere
      },
    });

    // Son 7 günde yüklenen
    const last7d = await Document.count({
      where: {
        deletedAt: null,
        createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        ...sensWhere
      },
    });

    // Çöp kutusundaki doküman sayısı
    const trashCount = await Document.count({ where: { deletedAt: { [Op.ne]: null }, ...sensWhere }, paranoid: false });

    // Kategorileri konsolide et (uncategorized ve boş olanları 'Diger' yap)
    const consolidatedCats = {};
    categoryCounts.forEach(c => {
      let catName = c.category || 'Diger';
      if (catName === 'uncategorized' || catName === 'undefined') catName = 'Diger';
      consolidatedCats[catName] = (consolidatedCats[catName] || 0) + parseInt(c.count);
    });

    res.status(200).json({
      totalDocuments,
      last24h,
      last7d,
      trashCount,
      statusDistribution: statusCounts.reduce((acc, s) => { acc[s.status] = parseInt(s.count); return acc; }, {}),
      categoryDistribution: Object.keys(consolidatedCats).map(key => ({
        category: key,
        count: consolidatedCats[key]
      })),
    });
  } catch (error) {
    console.error('[HATA] İstatistikler:', error.message);
    res.status(500).json({ error: 'İstatistikler getirilirken bir hata oluştu.' });
  }
});

// ============================================================
// GET /api/documents/:id/download — Orijinal Dosyayı İndir
// ============================================================
// ============================================================
// GET /api/documents/:id/download — Orijinal Dosyayı İndir
// ============================================================
router.get('/:id/download', verifyToken, requireReadPermission, async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id, { paranoid: false });
    if (!document) {
      return res.status(404).json({ error: 'Belge bulunamadı.' });
    }

    if (!hasSensitivityAccess(document, req.user)) {
      return res.status(403).json({ error: 'Erişim reddedildi.', message: 'Bu hassasiyet seviyesindeki belgeye erişim yetkiniz bulunmamaktadır.' });
    }

    const fs = require('fs');
    const path = require('path');
    const absolutePath = path.resolve(document.filePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Dosya sunucuda bulunamadı.' });
    }

    res.download(absolutePath, document.originalName);
  } catch (error) {
    console.error('[HATA] Dosya indirme:', error.message);
    res.status(500).json({ error: 'Dosya indirilirken bir hata oluştu.' });
  }
});

// ============================================================
// GET /api/documents/:id/export — OCR Metnini ve Yorumları Word (.doc) Dosyası Olarak İndir
// ============================================================
router.get('/:id/export', verifyToken, requireReadPermission, async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id, {
      include: [{ association: 'metadata' }]
    });

    if (!document) {
      return res.status(404).json({ error: 'Belge bulunamadı.' });
    }

    if (!hasSensitivityAccess(document, req.user)) {
      return res.status(403).json({ error: 'Erişim reddedildi.', message: 'Bu hassasiyet seviyesindeki belgeye erişim yetkiniz bulunmamaktadır.' });
    }

    const text = document.metadata?.extractedText || document.metadata?.extracted_text || 'OCR metni bulunamadı.';
    const comments = document.metadata?.comments || [];
    
    let commentsMarkup = '<p style="color: #94a3b8; font-style: italic;">Yorum bulunmamaktadır.</p>';
    if (Array.isArray(comments) && comments.length > 0) {
      commentsMarkup = comments.map(c => {
        const author = c.author || c.username || 'Bilinmeyen Kullanıcı';
        const date = c.createdAt || c.created_at || new Date().toISOString();
        const formattedDate = new Date(date).toLocaleString('tr-TR');
        return `
          <div style="background: #fef08a; border-left: 5px solid #eab308; padding: 10px 15px; margin-bottom: 10px; border-radius: 3px; color: #000;">
            <div style="font-weight: bold; font-size: 0.85em; color: #71717a; margin-bottom: 5px;">Yazar: ${author} | Tarih: ${formattedDate}</div>
            <div>${c.text || c.comment || ''}</div>
          </div>
        `;
      }).join('');
    }

    const docHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>${document.originalName}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333333; padding: 20px; }
          h2 { color: #8b5cf6; border-bottom: 2px solid #8b5cf6; padding-bottom: 5px; }
          .doc-meta { background: #f1f5f9; padding: 10px; border-radius: 5px; margin-bottom: 20px; font-size: 0.9em; }
          .ocr-text { background: #fafafa; padding: 15px; border: 1px solid #e2e8f0; border-radius: 5px; white-space: pre-wrap; margin-bottom: 30px; }
        </style>
      </head>
      <body>
        <h2>DMS On-Premise Belge Raporu</h2>
        <div class="doc-meta">
          <strong>Dosya Adı:</strong> ${document.originalName}<br/>
          <strong>Kategori:</strong> ${document.metadata?.category || 'Belirtilmemiş'}<br/>
          <strong>Tarih:</strong> ${new Date(document.createdAt).toLocaleString('tr-TR')}
        </div>

        <h2>[OCR Çıkarılan Metin]</h2>
        <div class="ocr-text">${text}</div>

        <h2>[Yorumlar ve Notlar]</h2>
        <div>${commentsMarkup}</div>
      </body>
      </html>
    `;

    const cleanName = (document.originalName || 'ocr-text').replace(/\.[^/.]+$/, '');
    res.setHeader('Content-disposition', `attachment; filename=${encodeURIComponent(cleanName)}.doc`);
    res.setHeader('Content-type', 'application/msword; charset=utf-8');
    res.write(docHtml);
    res.end();
  } catch (error) {
    console.error('[HATA] OCR dışa aktarma:', error.message);
    res.status(500).json({ error: 'OCR metni dışa aktarılırken bir hata oluştu.' });
  }
});

// ============================================================
// DELETE /api/documents/bulk — Toplu Belge Silme (Admin Korumalı)
// ============================================================
router.delete('/bulk', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { ids, force = false } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Geçersiz veya boş ID listesi.' });
    }

    const fs = require('fs');
    const path = require('path');

    if (force) {
      // Kalıcı toplu silme
      const documents = await Document.findAll({
        where: { id: ids },
        paranoid: false
      });

      for (const doc of documents) {
        const absolutePath = path.resolve(doc.filePath);
        if (fs.existsSync(absolutePath)) {
          try {
            fs.unlinkSync(absolutePath);
          } catch (e) {
            console.error(`Dosya silinemedi: ${absolutePath}`, e.message);
          }
        }
        await doc.destroy({ force: true });
      }
      console.log(`[BULK_FORCE_DELETE] ${documents.length} belge kalıcı olarak silindi.`);
      // Audit Log
      const docNames = documents.map(d => d.originalName).join(', ');
      logAction(req, 'BULK_DELETE', null, null, `${documents.length} belge kalıcı olarak toplu silindi: ${docNames}`);
    } else {
      // Çöp kutusuna toplu taşıma (Soft Delete)
      const docsForLog = await Document.findAll({ where: { id: ids }, attributes: ['id', 'originalName'] });
      await Document.destroy({ where: { id: ids } });
      console.log(`[BULK_SOFT_DELETE] ${ids.length} belge çöp kutusuna taşındı.`);
      // Audit Log
      const docNames = docsForLog.map(d => d.originalName).join(', ');
      logAction(req, 'BULK_DELETE', null, null, `${ids.length} belge toplu olarak çöp kutusuna gönderildi: ${docNames}`);
    }

    res.status(200).json({ message: 'Toplu silme işlemi başarıyla tamamlandı.' });
  } catch (error) {
    console.error('[HATA] Toplu silme:', error.message);
    res.status(500).json({ error: 'Toplu silme işlemi sırasında bir hata oluştu.' });
  }
});

// ============================================================
// POST /api/documents/upload — Doküman Yükle
// ============================================================

router.post('/upload', verifyToken, requireWritePermission, upload.single('file'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya bulunamadı. Lütfen bir dosya yükleyin.' });
    }

    let tagsArr = [];
    if (req.body.tags) {
      try {
        tagsArr = typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags;
      } catch (e) {
        tagsArr = req.body.tags.split(',').map(t => t.trim()).filter(Boolean);
      }
    }

    let sensitivityVal = req.body.sensitivity || 'public';
    if (!['public', 'medium', 'high'].includes(sensitivityVal)) {
      sensitivityVal = 'public';
    }

    // Doküman ve ProcessingJob oluşturma işlemlerini transaction içine al
    const t = await sequelize.transaction();
    let document, job;
    try {
      document = await Document.create({
        title: req.body.title || path.parse(req.file.originalname).name,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        filePath: req.file.path,
        status: 'PENDING',
        userId: req.user ? req.user.id : null,
        tags: Array.isArray(tagsArr) ? tagsArr : [],
        sensitivity: sensitivityVal,
      }, { transaction: t });

      job = await ProcessingJob.create({
        documentId: document.id,
        jobStatus: 'QUEUED',
      }, { transaction: t });

      await t.commit();
    } catch (dbErr) {
      await t.rollback();
      throw dbErr;
    }

    console.log(`[UPLOAD] Doküman yüklendi — ID: ${document.id} — Dosya: ${req.file.originalname}`);

    // Audit Log
    logAction(req, 'UPLOAD', document.id, req.file.originalname, `"${req.file.originalname}" adlı belge sisteme yüklendi.`);

    // Asenkron olarak AI servisine gönder (yanıtı beklemeden istemciye 202 dön)
    // .catch() ile unhandled promise rejection koruması
    processDocumentWithAI(document, job).catch((unexpectedError) => {
      console.error('[AI_SERVICE_FATAL] Beklenmeyen kritik hata:', unexpectedError.message, unexpectedError.stack);
    });

    res.status(202).json({
      message: 'Doküman başarıyla yüklendi ve işleme kuyruğuna eklendi.',
      document: {
        id: document.id,
        title: document.title,
        originalName: document.originalName,
        mimeType: document.mimeType,
        status: document.status,
      },
      job: {
        id: job.id,
        status: job.jobStatus,
      },
    });
  } catch (error) {
    console.error('[HATA] Doküman yükleme:', error.message);
    res.status(500).json({ error: 'Doküman yüklenirken bir hata oluştu.', message: error.message });
  }
});

// ============================================================
// DELETE /api/documents/clear-ghosts — Hayalet PENDING Kayıtlarını Temizle
// ============================================================

router.delete('/clear-ghosts', async (req, res) => {
  try {
    console.log('[TEMİZLİK] Hayalet PENDING kayıtları temizleniyor...');

    // PENDING dokümanların ID'lerini bul
    const ghostDocs = await Document.findAll({
      where: { status: 'PENDING' },
      attributes: ['id'],
    });

    const ghostIds = ghostDocs.map(d => d.id);

    if (ghostIds.length === 0) {
      return res.status(200).json({ message: 'Temizlenecek hayalet kayıt bulunamadı.', deleted: 0 });
    }

    // İlişkili job'ları sil
    const deletedJobs = await ProcessingJob.destroy({
      where: { documentId: ghostIds },
    });

    // İlişkili metadata'ları sil
    const deletedMeta = await DocumentMetadata.destroy({
      where: { documentId: ghostIds },
    });

    // PENDING dokümanları sil
    const deletedDocs = await Document.destroy({
      where: { status: 'PENDING' },
    });

    console.log(`[TEMİZLİK] ✅ ${deletedDocs} doküman, ${deletedJobs} job, ${deletedMeta} metadata silindi.`);

    res.status(200).json({
      message: `Temizlik tamamlandı.`,
      deleted: { documents: deletedDocs, jobs: deletedJobs, metadata: deletedMeta },
    });
  } catch (error) {
    console.error('[HATA] Hayalet temizliği:', error.message);
    res.status(500).json({ error: 'Temizlik sırasında hata oluştu.', message: error.message });
  }
});

// ============================================================
// Yardımcı Fonksiyonlar: Akıllı Snippet ve Highlight (Fosforlu Kalem) Motoru
// ============================================================

function getMatchSnippet(text, query, isCaseSensitive = false) {
  if (!text) return '';
  const cleanText = text.replace(/\s+/g, ' ').trim();
  
  // 1. Birebir eşleşme ara (Katı modda büyük/küçük harf duyarlı)
  const textToSearch = isCaseSensitive ? cleanText : cleanText.toLowerCase();
  const queryToSearch = isCaseSensitive ? query : query.toLowerCase();
  const idx = textToSearch.indexOf(queryToSearch);
  
  if (idx !== -1) {
    const start = Math.max(0, idx - 80);
    const end = Math.min(cleanText.length, idx + query.length + 80);
    return (start > 0 ? '...' : '') + cleanText.substring(start, end) + (end < cleanText.length ? '...' : '');
  }
  
  // Katı modda fuzzy aramaya düşmesini engelle
  if (isCaseSensitive) {
    return cleanText.substring(0, 150) + (cleanText.length > 150 ? '...' : '');
  }
  
  // 2. Akıllı fuzzy eşleşme (kelime bazlı karakter benzerliği)
  const queryLower = query.toLowerCase();
  const words = cleanText.split(' ');
  let bestIdx = -1;
  let maxOverlap = 0;
  
  for (let i = 0; i < words.length; i++) {
    const cleanWord = words[i].toLowerCase().replace(/[^a-z0-9ıışğüçö]/gi, '');
    if (cleanWord.length < 2) continue;
    
    let matches = 0;
    const wordSet = new Set(cleanWord);
    for (const char of queryLower) {
      if (wordSet.has(char)) matches++;
    }
    const overlap = matches / Math.max(cleanWord.length, queryLower.length);
    if (overlap > maxOverlap) {
      maxOverlap = overlap;
      bestIdx = i;
    }
  }
  
  if (bestIdx !== -1 && maxOverlap > 0.35) {
    const startWord = Math.max(0, bestIdx - 8);
    const endWord = Math.min(words.length, bestIdx + 8);
    return (startWord > 0 ? '...' : '') + words.slice(startWord, endWord).join(' ') + (endWord < words.length ? '...' : '');
  }
  
  // 3. Fallback: eşleşme bulunamazsa ilk 150 karakteri göster
  return cleanText.substring(0, 150) + (cleanText.length > 150 ? '...' : '');
}

function applyHighlight(snippet, query, isCaseSensitive = false) {
  if (!snippet || !query) return snippet;
  const escaped = query.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, isCaseSensitive ? 'g' : 'gi');
  
  // Birebir eşleşmeyi sarı/yeşil işaretle
  if (regex.test(snippet)) {
    return snippet.replace(regex, '<mark>$1</mark>');
  }
  
  // Katı modda fuzzy highlight yapılmasın
  if (isCaseSensitive) return snippet;
  
  // Fuzzy kelime işaretlemesi
  const cleanQuery = query.toLowerCase().replace(/[^a-z0-9ıışğüçö]/gi, '');
  if (cleanQuery.length < 2) return snippet;
  
  const tokens = snippet.split(/(\s+)/);
  let bestIdx = -1;
  let maxOverlap = 0;
  
  for (let i = 0; i < tokens.length; i++) {
    const cleanToken = tokens[i].toLowerCase().replace(/[^a-z0-9ıışğüçö]/gi, '');
    if (cleanToken.length < 2) continue;
    
    let matches = 0;
    const tokenSet = new Set(cleanToken);
    for (const char of cleanQuery) {
      if (tokenSet.has(char)) matches++;
    }
    const overlap = matches / Math.max(cleanToken.length, cleanQuery.length);
    if (overlap > maxOverlap) {
      maxOverlap = overlap;
      bestIdx = i;
    }
  }
  
  if (bestIdx !== -1 && maxOverlap > 0.35) {
    tokens[bestIdx] = `<mark>${tokens[bestIdx]}</mark>`;
    return tokens.join('');
  }
  
  return snippet;
}

// ============================================================
// GET /api/documents/search — Arama (mode, fileType, status, sort, category)
// ============================================================

router.get('/search', verifyToken, async (req, res) => {
  try {
    const { q, mode = 'fuzzy', fileType = 'all', status = 'all', sort = 'relevance', category = 'all' } = req.query;

    const rawSearchTerm = q ? q.trim() : '';
    console.log(`[ARAMA] Mod: ${mode} | Tür: ${fileType} | Kategori: ${category} | Durum: ${status} | Sıra: ${sort} | Ham Sorgu: "${rawSearchTerm}"`);

    let queryStr = '';
    const isFuzzy = mode === 'fuzzy';
    const replacements = {};
    let extraFilters = getSensitivitySql(req.user) + ' AND d.deleted_at IS NULL';

    // 1. Negatif (hariç tutma) ve Pozitif kelimeleri ayrıştır
    const excludeWords = [];
    const searchWords = [];
    let searchTerm = '';

    if (rawSearchTerm.length > 0) {
      const rawWords = rawSearchTerm.split(/\s+/).filter(w => w.length > 0);
      let skipNext = false;

      for (let i = 0; i < rawWords.length; i++) {
        if (skipNext) {
          skipNext = false;
          continue;
        }

        const word = rawWords[i];
        const wordUpper = word.toUpperCase();

        if (word.startsWith('-') && word.length > 1) {
          excludeWords.push(word.substring(1));
        } else if (wordUpper === 'NOT' && i + 1 < rawWords.length) {
          excludeWords.push(rawWords[i + 1]);
          skipNext = true;
        } else {
          searchWords.push(word);
        }
      }

      searchTerm = searchWords.join(' ').trim();
      replacements.searchTerm = searchTerm;

      // Negatif filtreleri SQL'e ekle
      excludeWords.forEach((exWord, idx) => {
        const key = `excludeWord${idx}`;
        replacements[key] = `%${exWord}%`;
        extraFilters += ` AND d.original_name NOT ILIKE :${key} AND COALESCE(dm.extracted_text, '') NOT ILIKE :${key}`;
      });
    } else {
      replacements.searchTerm = '';
    }
    
    // Filtreler
    if (fileType === 'pdf') {
      extraFilters += ` AND d.mime_type = 'application/pdf'`;
    } else if (fileType === 'image') {
      extraFilters += ` AND d.mime_type LIKE 'image/%'`;
    }
    
    if (status === 'completed') {
      extraFilters += ` AND d.status = 'COMPLETED'`;
    } else if (status === 'pending') {
      extraFilters += ` AND d.status = 'PENDING'`;
    } else if (status === 'failed') {
      extraFilters += ` AND d.status = 'FAILED'`;
    }

    if (category && category !== 'all') {
      extraFilters += ` AND dm.category = :category`;
      replacements.category = category;
    }

    // Sıralama
    let orderClause = 'ORDER BY relevance DESC';
    if (searchTerm.length === 0 && sort === 'relevance') {
      orderClause = 'ORDER BY d.created_at DESC';
    } else if (sort === 'newest') {
      orderClause = 'ORDER BY d.created_at DESC';
    } else if (sort === 'oldest') {
      orderClause = 'ORDER BY d.created_at ASC';
    } else if (sort === 'name_asc') {
      orderClause = 'ORDER BY d.original_name ASC';
    } else if (sort === 'name_desc') {
      orderClause = 'ORDER BY d.original_name DESC';
    }

    if (searchTerm.length === 0) {
      // SADECE FİLTRELEME (Arama kelimesi yok)
      queryStr = `
        SELECT
         d.id, d.title, d.original_name AS "originalName", d.mime_type AS "mimeType", d.status, d.created_at AS "createdAt", dm.category, dm.confidence,
         1.0 AS relevance,
         false AS "isDimmed",
         COALESCE(dm.extracted_text, '') AS "extractedText"
       FROM documents d
       LEFT JOIN document_metadata dm ON dm.document_id = d.id
       WHERE 1=1
       ${extraFilters}
       ${orderClause} LIMIT 50`;
    } else if (mode === 'exact') {
      // 1. KATI EŞLEŞME (Exact Match): LIKE (Büyük/Küçük harf ve boşluk duyarlı)
      queryStr = `
        SELECT
         d.id, d.title, d.original_name AS "originalName", d.mime_type AS "mimeType", d.status, d.created_at AS "createdAt", dm.category, dm.confidence,
         1.0 AS relevance,
         (CASE WHEN d.original_name LIKE '%' || :searchTerm || '%' THEN false ELSE true END) AS "isDimmed",
         COALESCE(dm.extracted_text, '') AS "extractedText"
       FROM documents d
       LEFT JOIN document_metadata dm ON dm.document_id = d.id
       WHERE (d.original_name LIKE '%' || :searchTerm || '%' OR COALESCE(dm.extracted_text, '') LIKE '%' || :searchTerm || '%')
       ${extraFilters}
       ${orderClause} LIMIT 50`;
       
    } else if (isFuzzy) {
      // 3. AKILLI ARAMA (Fuzzy Match + Ağırlıklı Kelime Bazlı Trigram)
      // Arama terimini kelimelere ayırarak dinamik trigram eşleşmesi hesaplıyoruz.
      const searchWords = searchTerm.split(/\s+/).filter(w => w.length > 0);
      
      if (searchWords.length > 0) {
        const relevanceParts = [];
        const whereParts = [];
        
        searchWords.forEach((word, idx) => {
          const key = `word${idx}`;
          replacements[key] = word;
          
          relevanceParts.push(`
            (CASE WHEN d.original_name ILIKE '%' || :${key} || '%' THEN 10 ELSE 0 END) +
            (word_similarity(:${key}, d.original_name) * 5) +
            (CASE WHEN COALESCE(dm.extracted_text, '') ILIKE '%' || :${key} || '%' THEN 3 ELSE 0 END) +
            (word_similarity(:${key}, COALESCE(dm.extracted_text, '')) * 1)
          `);
          
          whereParts.push(`
            (
              word_similarity(:${key}, d.original_name) > 0.30
              OR word_similarity(:${key}, COALESCE(dm.extracted_text, '')) > 0.30
              OR d.original_name ILIKE '%' || :${key} || '%'
              OR COALESCE(dm.extracted_text, '') ILIKE '%' || :${key} || '%'
            )
          `);
        });

        // isDimmed bayrağı: eğer başlıkta aranan tüm sorgu doğrudan geçmiyorsa soluk gösterilir
        queryStr = `
          SELECT
           d.id, d.title, d.original_name AS "originalName", d.mime_type AS "mimeType", d.status, d.created_at AS "createdAt", dm.category, dm.confidence,
           ((${relevanceParts.join(' + ')}) / ${searchWords.length}) AS relevance,
           (CASE WHEN d.original_name ILIKE '%' || :searchTerm || '%' THEN false ELSE true END) AS "isDimmed",
           COALESCE(dm.extracted_text, '') AS "extractedText"
         FROM documents d
         LEFT JOIN document_metadata dm ON dm.document_id = d.id
         WHERE (${whereParts.join(' OR ')})
         ${extraFilters}
         ${orderClause} LIMIT 50`;
      } else {
        // Fallback düz fuzzy
        queryStr = `
          SELECT
           d.id, d.title, d.original_name AS "originalName", d.mime_type AS "mimeType", d.status, d.created_at AS "createdAt", dm.category, dm.confidence,
           (
             (CASE WHEN d.original_name ILIKE '%' || :searchTerm || '%' THEN 10 ELSE 0 END) +
             (word_similarity(:searchTerm, d.original_name) * 5) +
             (CASE WHEN COALESCE(dm.extracted_text, '') ILIKE '%' || :searchTerm || '%' THEN 3 ELSE 0 END) +
             (word_similarity(:searchTerm, COALESCE(dm.extracted_text, '')) * 1)
           ) AS relevance,
           (CASE WHEN d.original_name ILIKE '%' || :searchTerm || '%' THEN false ELSE true END) AS "isDimmed",
           COALESCE(dm.extracted_text, '') AS "extractedText"
         FROM documents d
         LEFT JOIN document_metadata dm ON dm.document_id = d.id
         WHERE (
           word_similarity(:searchTerm, d.original_name) > 0.30 
           OR word_similarity(:searchTerm, COALESCE(dm.extracted_text, '')) > 0.30
           OR d.original_name ILIKE '%' || :searchTerm || '%'
           OR COALESCE(dm.extracted_text, '') ILIKE '%' || :searchTerm || '%'
         )
         ${extraFilters}
         ${orderClause} LIMIT 50`;
      }
       
    } else {
      // 2. GENİŞ ARAMA (Broad Match): plainto_tsquery
      queryStr = `
        SELECT
         d.id, d.title, d.original_name AS "originalName", d.mime_type AS "mimeType", d.status, d.created_at AS "createdAt", dm.category, dm.confidence,
         (
           ts_rank(to_tsvector('simple', COALESCE(d.original_name, '')), plainto_tsquery('simple', :searchTerm)) * 2 +
           ts_rank(to_tsvector('simple', COALESCE(dm.extracted_text, '')), plainto_tsquery('simple', :searchTerm))
         ) AS relevance,
         (CASE WHEN to_tsvector('simple', COALESCE(d.original_name, '')) @@ plainto_tsquery('simple', :searchTerm) THEN false ELSE true END) AS "isDimmed",
         COALESCE(dm.extracted_text, '') AS "extractedText"
       FROM documents d
       LEFT JOIN document_metadata dm ON dm.document_id = d.id
       WHERE (
         to_tsvector('simple', COALESCE(d.original_name, '')) @@ plainto_tsquery('simple', :searchTerm) OR
         to_tsvector('simple', COALESCE(dm.extracted_text, '')) @@ plainto_tsquery('simple', :searchTerm)
       )
       ${extraFilters}
       ${orderClause} LIMIT 50`;
    }

    const results = await sequelize.query(queryStr, {
      replacements,
      type: sequelize.constructor.QueryTypes.SELECT,
    });

    // JS tabanlı dinamik snippet ve highlight oluşturma
    const isExact = (mode === 'exact');
    results.forEach(r => {
      const name = r.originalName || '';
      const rawText = r.extractedText || '';
      
      if (searchTerm && searchTerm.length > 0) {
        const inFilename = isExact ? name.includes(searchTerm) : name.toLowerCase().includes(searchTerm.toLowerCase());
        r.matchLocation = inFilename ? 'filename' : 'content';
        const snippet = getMatchSnippet(rawText, searchTerm, isExact);
        r.highlight = applyHighlight(snippet, searchTerm, isExact);
      } else {
        r.matchLocation = 'filename';
        r.highlight = rawText.substring(0, 150) + (rawText.length > 150 ? '...' : '');
      }

      // Gönderilen veriyi hafifletmek için extractedText alanını sil
      delete r.extractedText;
    });

    console.log(`[ARAMA] "${searchTerm}" için ${results.length} sonuç bulundu.`);

    res.status(200).json({
      query: searchTerm,
      mode,
      fileType,
      status,
      sort,
      category,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('[HATA] Full-Text Search:', error.message);
    res.status(500).json({ error: 'Arama sırasında bir hata oluştu.' });
  }
});

// ============================================================
// GET /api/documents/ai-search — Yapay Zeka Destekli Doğal Dil Arama
// ============================================================

router.get('/ai-search', verifyToken, async (req, res) => {
  try {
    const { q, status = 'all', sort = 'relevance' } = req.query;

    const originalQuery = q ? q.trim() : '';
    console.log(`[AI_SEARCH] Doğal Dil Sorgusu: "${originalQuery}"`);

    // 1. AI Servisinden NLP Analizi iste
    let cleanedQuery = originalQuery;
    let detectedCategory = null;
    let detectedFileType = null;
    let excludeCategory = null;
    let excludeFileType = null;
    let excludeKeywords = [];

    if (originalQuery.length > 0) {
      try {
        const aiResponse = await fetch(`${AI_SERVICE_URL}/api/nlp-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: originalQuery }),
        });

        if (aiResponse.ok) {
          const aiResult = await aiResponse.json();
          if (aiResult.status === 'success') {
            cleanedQuery = aiResult.q || '';
            detectedCategory = aiResult.category;
            detectedFileType = aiResult.fileType;
            excludeCategory = aiResult.excludeCategory;
            excludeFileType = aiResult.excludeFileType;
            excludeKeywords = aiResult.excludeKeywords || [];
            console.log(`[AI_SEARCH_OK] Çözümlendi -> q: "${cleanedQuery}", cat: ${detectedCategory}, type: ${detectedFileType}, exCat: ${excludeCategory}, exType: ${excludeFileType}, exKw: ${excludeKeywords}`);
          }
        }
      } catch (aiError) {
        console.error(`[AI_SEARCH_WARN] AI Servis NLP analizi başarısız (direkt aramaya düşülüyor):`, aiError.message);
      }
    }

    const finalSearchTerm = cleanedQuery ? cleanedQuery.trim() : '';
    const replacements = { searchTerm: finalSearchTerm };

    // 2. Çözümlenen parametrelerle iç arama sorgumuzu çalıştıralım
    // Filtreler
    let extraFilters = getSensitivitySql(req.user) + ' AND d.deleted_at IS NULL';

    if (detectedFileType === 'pdf') {
      extraFilters += ` AND d.mime_type = 'application/pdf'`;
    } else if (detectedFileType === 'image') {
      extraFilters += ` AND d.mime_type LIKE 'image/%'`;
    }

    if (excludeFileType === 'pdf') {
      extraFilters += ` AND d.mime_type != 'application/pdf'`;
    } else if (excludeFileType === 'image') {
      extraFilters += ` AND d.mime_type NOT LIKE 'image/%'`;
    }

    if (status === 'completed') {
      extraFilters += ` AND d.status = 'COMPLETED'`;
    } else if (status === 'pending') {
      extraFilters += ` AND d.status = 'PENDING'`;
    } else if (status === 'failed') {
      extraFilters += ` AND d.status = 'FAILED'`;
    }

    if (detectedCategory) {
      replacements.detectedCategory = detectedCategory;
    } else {
      replacements.detectedCategory = '';
    }

    if (excludeCategory) {
      extraFilters += ` AND (dm.category IS NULL OR dm.category != :excludeCategory)`;
      replacements.excludeCategory = excludeCategory;
    }

    if (excludeKeywords && excludeKeywords.length > 0) {
      excludeKeywords.forEach((exWord, idx) => {
        const exKey = `exWord${idx}`;
        replacements[exKey] = exWord;
        extraFilters += ` AND (d.original_name NOT ILIKE '%' || :${exKey} || '%' AND COALESCE(dm.extracted_text, '') NOT ILIKE '%' || :${exKey} || '%')`;
      });
    }

    // Sıralama
    let orderClause = 'ORDER BY relevance DESC';
    if (sort === 'newest') orderClause = 'ORDER BY d.created_at DESC';
    else if (sort === 'oldest') orderClause = 'ORDER BY d.created_at ASC';
    else if (sort === 'name_asc') orderClause = 'ORDER BY d.original_name ASC';
    else if (sort === 'name_desc') orderClause = 'ORDER BY d.original_name DESC';

    // Fuzzy arama kelimelerini ayır
    const searchWords = finalSearchTerm.split(/\s+/).filter(w => w.length > 0);
    let queryStr = '';

    if (finalSearchTerm.length === 0) {
      queryStr = `
        SELECT
         d.id, d.title, d.original_name AS "originalName", d.mime_type AS "mimeType", d.status, d.created_at AS "createdAt", dm.category, dm.confidence,
         (CASE WHEN dm.category = :detectedCategory THEN 15.0 ELSE 1.0 END) AS relevance,
         false AS "isDimmed",
         COALESCE(dm.extracted_text, '') AS "extractedText"
       FROM documents d
       LEFT JOIN document_metadata dm ON dm.document_id = d.id
       WHERE 1=1
       ${extraFilters}
       ${orderClause} LIMIT 50`;
    } else if (searchWords.length > 0) {
      const relevanceParts = [];
      const whereParts = [];

      searchWords.forEach((word, idx) => {
        const key = `word${idx}`;
        replacements[key] = word;

        relevanceParts.push(`
          (CASE WHEN d.original_name ILIKE '%' || :${key} || '%' THEN 10 ELSE 0 END) +
          (word_similarity(:${key}, d.original_name) * 5) +
          (CASE WHEN COALESCE(dm.extracted_text, '') ILIKE '%' || :${key} || '%' THEN 3 ELSE 0 END) +
          (word_similarity(:${key}, COALESCE(dm.extracted_text, '')) * 1)
        `);

        whereParts.push(`
          (
            word_similarity(:${key}, d.original_name) > 0.25
            OR word_similarity(:${key}, COALESCE(dm.extracted_text, '')) > 0.25
            OR d.original_name ILIKE '%' || :${key} || '%'
            OR COALESCE(dm.extracted_text, '') ILIKE '%' || :${key} || '%'
          )
        `);
      });

      queryStr = `
        SELECT
         d.id, d.title, d.original_name AS "originalName", d.mime_type AS "mimeType", d.status, d.created_at AS "createdAt", dm.category, dm.confidence,
         (((${relevanceParts.join(' + ')}) / ${searchWords.length}) + (CASE WHEN dm.category = :detectedCategory THEN 15.0 ELSE 0.0 END)) AS relevance,
         (CASE WHEN d.original_name ILIKE '%' || :searchTerm || '%' THEN false ELSE true END) AS "isDimmed",
         COALESCE(dm.extracted_text, '') AS "extractedText"
       FROM documents d
       LEFT JOIN document_metadata dm ON dm.document_id = d.id
       WHERE (${whereParts.join(' OR ')})
       ${extraFilters}
       ${orderClause} LIMIT 50`;
    } else {
      queryStr = `
        SELECT
         d.id, d.title, d.original_name AS "originalName", d.mime_type AS "mimeType", d.status, d.created_at AS "createdAt", dm.category, dm.confidence,
         (1.0 + (CASE WHEN dm.category = :detectedCategory THEN 15.0 ELSE 0.0 END)) AS relevance,
         (CASE WHEN d.original_name ILIKE '%' || :searchTerm || '%' THEN false ELSE true END) AS "isDimmed",
         COALESCE(dm.extracted_text, '') AS "extractedText"
       FROM documents d
       LEFT JOIN document_metadata dm ON dm.document_id = d.id
       WHERE (d.original_name ILIKE '%' || :searchTerm || '%' OR COALESCE(dm.extracted_text, '') ILIKE '%' || :searchTerm || '%')
       ${extraFilters}
       ${orderClause} LIMIT 50`;
    }

    const results = await sequelize.query(queryStr, {
      replacements,
      type: sequelize.constructor.QueryTypes.SELECT,
    });

    const containsWholeWord = (text, word) => {
      if (!text || !word) return false;
      const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ])\u200B*${escaped}\u200B*(?:$|[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ])`, 'i');
      return regex.test(text);
    };

    results.forEach(r => {
      const name = (r.originalName || '').toLowerCase();
      const rawText = (r.extractedText || '').toLowerCase();

      // Akıllı isDimmed hesaplaması
      let dimmed = true;

      if (finalSearchTerm && finalSearchTerm.length > 0) {
        // Arama kelimelerinden herhangi biri dosya adında bütün kelime olarak geçiyorsa veya
        // arama sorgusu doğrudan dosya adında yer alıyorsa soluk yapma!
        const matchesName = searchWords.some(word => containsWholeWord(name, word));
        if (matchesName || name.includes(finalSearchTerm.toLowerCase())) {
          dimmed = false;
        }

        // Eğer içerikte bütün kelime olarak geçiyorsa ve alaka düzeyi yüksekse (relevance > 2.0) soluk yapma!
        const matchesContent = searchWords.some(word => containsWholeWord(rawText, word));
        if (matchesContent && parseFloat(r.relevance) > 2.0) {
          dimmed = false;
        }
      } else {
        // Arama terimi yoksa hiçbir şey soluk olmasın
        dimmed = false;
      }

      r.isDimmed = dimmed;

      if (finalSearchTerm && finalSearchTerm.length > 0) {
        const inFilename = name.includes(finalSearchTerm.toLowerCase());
        r.matchLocation = inFilename ? 'filename' : 'content';
        const snippet = getMatchSnippet(r.extractedText || '', finalSearchTerm, false);
        r.highlight = applyHighlight(snippet, finalSearchTerm, false);
      } else {
        r.matchLocation = 'filename';
        const extracted = r.extractedText || '';
        r.highlight = extracted.substring(0, 150) + (extracted.length > 150 ? '...' : '');
      }

      delete r.extractedText;
    });

    res.status(200).json({
      query: originalQuery,
      aiAnalysis: {
        cleanedQuery: finalSearchTerm,
        category: detectedCategory || 'Tümü',
        excludeCategory: excludeCategory || null,
        fileType: detectedFileType || 'Tümü',
        excludeFileType: excludeFileType || null,
        excludeKeywords: excludeKeywords || []
      },
      count: results.length,
      results,
    });

  } catch (error) {
    console.error('[HATA] AI Search:', error.message);
    res.status(500).json({ error: 'AI Arama sırasında bir hata oluştu.' });
  }
});

// ============================================================
// GET /api/documents/trash — Silinmiş Dokümanları Listele
// ============================================================
router.get('/trash', verifyToken, async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const sensWhere = getSensitivityWhere(req.user);
    const documents = await Document.findAll({
      where: {
        deletedAt: { [Op.ne]: null },
        ...sensWhere
      },
      paranoid: false,
      order: [['deleted_at', 'DESC']],
      include: [
        { association: 'metadata', attributes: ['category', 'extractedTags', 'confidence'] },
      ],
    });

    res.status(200).json({
      count: documents.length,
      documents,
    });
  } catch (error) {
    console.error('[HATA] Çöp kutusu listeleme:', error.message);
    res.status(500).json({ error: 'Çöp kutusu listelenirken bir hata oluştu.' });
  }
});

// ============================================================
// POST /api/documents/:id/restore — Dokümanı Çöp Kutusundan Geri Yükle
// ============================================================
router.post('/:id/restore', verifyToken, requireAdmin, async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id, { paranoid: false });

    if (!document) {
      return res.status(404).json({ error: 'Kurtarılacak doküman bulunamadı.' });
    }

    await document.restore();
    console.log(`[RESTORE] Doküman geri yüklendi: ${document.originalName} (${document.id})`);

    // Audit Log
    logAction(req, 'RESTORE', document.id, document.originalName, `"${document.originalName}" adlı belge çöp kutusundan geri yüklendi.`);

    res.status(200).json({ message: 'Doküman başarıyla geri yüklendi.', document });
  } catch (error) {
    console.error('[HATA] Geri yükleme:', error.message);
    res.status(500).json({ error: 'Doküman geri yüklenirken bir hata oluştu.' });
  }
});

// ============================================================
// DELETE /api/documents/:id/force — Dokümanı Kalıcı Olarak Sil (Admin Korumalı)
// ============================================================
router.delete('/:id/force', verifyToken, requireAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const document = await Document.findByPk(req.params.id, { paranoid: false });

    if (!document) {
      return res.status(404).json({ error: 'Kalıcı silinecek doküman bulunamadı.' });
    }

    // Diskten dosyayı sil
    const absolutePath = path.resolve(document.filePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      console.log(`[FORCE_DELETE] Dosya diskten silindi: ${absolutePath}`);
    }

    // Veritabanından kalıcı sil
    await document.destroy({ force: true });
    console.log(`[FORCE_DELETE] Doküman veritabanından kalıcı silindi: ${document.originalName} (${document.id})`);

    // Audit Log
    logAction(req, 'FORCE_DELETE', document.id, document.originalName, `"${document.originalName}" adlı belge sistemden kalıcı olarak silindi.`);

    res.status(200).json({ message: 'Doküman kalıcı olarak silindi.' });
  } catch (error) {
    console.error('[HATA] Kalıcı silme:', error.message);
    res.status(500).json({ error: 'Doküman kalıcı olarak silinirken bir hata oluştu.' });
  }
});

// ============================================================
// DELETE /api/documents/:id — Dokümanı Çöp Kutusuna Gönder (Soft Delete - Admin Korumalı)
// ============================================================
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Silinecek doküman bulunamadı.' });
    }

    await document.destroy();
    console.log(`[SOFT_DELETE] Doküman çöp kutusuna gönderildi: ${document.originalName} (${document.id})`);

    // Audit Log
    logAction(req, 'DELETE', document.id, document.originalName, `"${document.originalName}" adlı belge çöp kutusuna gönderildi.`);

    res.status(200).json({ message: 'Doküman çöp kutusuna gönderildi.', document });
  } catch (error) {
    console.error('[HATA] Soft silme:', error.message);
    res.status(500).json({ error: 'Doküman çöp kutusuna gönderilirken bir hata oluştu.' });
  }
});

// ============================================================
// GET /api/documents — Tüm Dokümanları Listele
// ============================================================

router.get('/', verifyToken, requireReadPermission, async (req, res) => {
  try {
    const { tag } = req.query;
    const { Op } = require('sequelize');
    
    const sensWhere = getSensitivityWhere(req.user);
    const whereClause = {
      ...sensWhere
    };
    if (tag) {
      whereClause.tags = {
        [Op.contains]: [tag]
      };
    }

    const documents = await Document.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      include: [
        { association: 'metadata', attributes: ['category', 'extractedTags', 'confidence'] },
      ],
    });

    res.status(200).json({
      count: documents.length,
      documents,
    });
  } catch (error) {
    console.error('[HATA] Doküman listeleme:', error.message);
    res.status(500).json({ error: 'Dokümanlar listelenirken bir hata oluştu.' });
  }
});

// ============================================================
// GET /api/documents/:id — Tek Doküman Detayı
// ============================================================

router.get('/:id', verifyToken, requireReadPermission, async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id, {
      include: [
        { association: 'metadata' },
        { association: 'jobs', order: [['created_at', 'DESC']] },
        { association: 'owner', attributes: ['id', 'username', 'email'] },
      ],
    });

    if (!document) {
      return res.status(404).json({ error: 'Doküman bulunamadı.' });
    }

    if (!hasSensitivityAccess(document, req.user)) {
      return res.status(403).json({ error: 'Erişim reddedildi.', message: 'Bu hassasiyet seviyesindeki belgeye erişim yetkiniz bulunmamaktadır.' });
    }

    res.status(200).json({ document });
  } catch (error) {
    console.error('[HATA] Doküman detay:', error.message);
    res.status(500).json({ error: 'Doküman detayı getirilirken bir hata oluştu.' });
  }
});

// ============================================================
// GET /api/documents/jobs/:jobId — İş Durumu Sorgula
// ============================================================

router.get('/jobs/:jobId', async (req, res) => {
  try {
    const job = await ProcessingJob.findByPk(req.params.jobId, {
      include: [
        { association: 'document', attributes: ['id', 'title', 'status'] },
      ],
    });

    if (!job) {
      return res.status(404).json({ error: 'İş bulunamadı.' });
    }

    res.status(200).json({ job });
  } catch (error) {
    console.error('[HATA] İş durumu sorgulama:', error.message);
    res.status(500).json({ error: 'İş durumu sorgulanırken bir hata oluştu.' });
  }
});

// ============================================================
// PUT /api/documents/:id — Doküman Güncelleme (Rich Text Editor - Admin Korumalı)
// ============================================================
router.put('/:id', verifyToken, requireWritePermission, async (req, res) => {
  try {
    const { title, extractedText, category, comments, tags, sensitivity } = req.body;
    const document = await Document.findByPk(req.params.id, {
      include: [{ association: 'metadata' }]
    });

    if (!document) {
      return res.status(404).json({ error: 'Güncellenecek doküman bulunamadı.' });
    }

    if (!hasSensitivityAccess(document, req.user)) {
      return res.status(403).json({ error: 'Erişim reddedildi.', message: 'Bu hassasiyet seviyesindeki belgeye erişim yetkiniz bulunmamaktadır.' });
    }

    // 1. Doküman Başlığı, Etiketleri ve Hassasiyeti güncelle
    if (title !== undefined) {
      document.title = title;
    }
    if (tags !== undefined) {
      document.tags = Array.isArray(tags) ? tags : [];
    }
    if (sensitivity !== undefined && ['public', 'medium', 'high'].includes(sensitivity)) {
      document.sensitivity = sensitivity;
    }
    if (title !== undefined || tags !== undefined || sensitivity !== undefined) {
      await document.save();
    }

    // 2. Metadata Metnini güncelle
    if (document.metadata) {
      if (extractedText !== undefined) {
        document.metadata.extractedText = extractedText;
      }
      if (category !== undefined) {
        document.metadata.category = category;
      }
      if (comments !== undefined) {
        document.metadata.comments = comments;
      }
      await document.metadata.save();
    } else if (extractedText !== undefined || category !== undefined || comments !== undefined) {
      await DocumentMetadata.create({
        documentId: document.id,
        extractedText: extractedText || '',
        category: category || 'Diger',
        comments: comments || [],
        confidence: 1.0
      });
    }

    console.log(`[UPDATE] Doküman güncellendi: ${document.originalName || document.title} (${document.id})`);

    // Audit Log
    const changedFields = [];
    if (title !== undefined) changedFields.push('başlık');
    if (extractedText !== undefined) changedFields.push('OCR metni');
    if (category !== undefined) changedFields.push('kategori');
    if (comments !== undefined) changedFields.push('yorumlar');
    logAction(req, 'UPDATE', document.id, document.originalName || document.title, `"${document.originalName || document.title}" adlı belge güncellendi. Değişen alanlar: ${changedFields.join(', ')}`);

    const updatedDocument = await Document.findByPk(req.params.id, {
      include: [{ association: 'metadata' }]
    });

    res.status(200).json({ message: 'Doküman başarıyla güncellendi.', document: updatedDocument });
  } catch (error) {
    console.error('[HATA] Doküman güncelleme:', error.message);
    res.status(500).json({ error: 'Doküman güncellenirken bir hata oluştu.' });
  }
});

module.exports = router;
