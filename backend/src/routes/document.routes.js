/**
 * DMS On-Premise - Doküman Yükleme ve Yönetim Rotaları
 * Multer ile dosya yükleme, MIME tipi doğrulama, DB kaydı ve AI Servis entegrasyonu.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { sequelize, Document, DocumentMetadata, ProcessingJob } = require('../models');

const router = express.Router();

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
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 dk timeout

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
      // Başarılı: Metni DocumentMetadata tablosuna kaydet
      await DocumentMetadata.create({
        documentId: document.id,
        extractedText: result.text,
        category: 'uncategorized',
        extractedTags: [],
        confidence: 0.0,
      });

      const charCount = (result.text || '').length;
      console.log(`[AI_SERVICE] OCR metni kaydedildi — ${charCount} karakter`);

      // Document ve Job durumlarını COMPLETED yap
      await document.update({ status: 'COMPLETED' });
      await job.update({
        jobStatus: 'COMPLETED',
        resultSummary: `OCR başarılı. ${charCount} karakter çıkarıldı.`,
        completedAt: new Date(),
      });

      console.log(`[AI_SERVICE] ✅ İşlem başarıyla tamamlandı — Doküman: ${document.id}`);

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
  }

  console.log(`[AI_SERVICE] ========== İşleme Bitti ==========\n`);
}

// ============================================================
// POST /api/documents/upload — Doküman Yükle
// ============================================================

router.post('/upload', upload.single('file'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya bulunamadı. Lütfen bir dosya yükleyin.' });
    }

    // Dokümanı veritabanına PENDING statüsüyle kaydet
    const document = await Document.create({
      title: req.body.title || path.parse(req.file.originalname).name,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      filePath: req.file.path,
      status: 'PENDING',
      userId: req.body.userId || null,
    });

    // İşleme kuyruğuna yeni iş ekle
    const job = await ProcessingJob.create({
      documentId: document.id,
      jobStatus: 'QUEUED',
    });

    console.log(`[UPLOAD] Doküman yüklendi — ID: ${document.id} — Dosya: ${req.file.originalname}`);

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
// GET /api/documents/search?q=kelime — Full-Text Search (PostgreSQL FTS)
// ============================================================

router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Arama sorgusu (q) parametresi gereklidir.' });
    }

    const searchTerm = q.trim();
    console.log(`[ARAMA] Full-Text Search sorgusu: "${searchTerm}"`);

    // PostgreSQL FTS: tsvector + tsquery ile metin içi arama
    const results = await sequelize.query(
      `SELECT
         d.id,
         d.title,
         d.original_name AS "originalName",
         d.mime_type AS "mimeType",
         d.status,
         d.created_at AS "createdAt",
         dm.category,
         dm.confidence,
         ts_rank(
           to_tsvector('simple', COALESCE(dm.extracted_text, '')),
           plainto_tsquery('simple', :searchTerm)
         ) AS relevance,
         ts_headline(
           'simple',
           COALESCE(dm.extracted_text, ''),
           plainto_tsquery('simple', :searchTerm),
           'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=20'
         ) AS highlight
       FROM documents d
       INNER JOIN document_metadata dm ON dm.document_id = d.id
       WHERE
         to_tsvector('simple', COALESCE(dm.extracted_text, ''))
         @@ plainto_tsquery('simple', :searchTerm)
       ORDER BY relevance DESC
       LIMIT 50`,
      {
        replacements: { searchTerm },
        type: sequelize.constructor.QueryTypes.SELECT,
      }
    );

    console.log(`[ARAMA] "${searchTerm}" için ${results.length} sonuç bulundu.`);

    res.status(200).json({
      query: searchTerm,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('[HATA] Full-Text Search:', error.message);
    res.status(500).json({ error: 'Arama sırasında bir hata oluştu.' });
  }
});

// ============================================================
// GET /api/documents — Tüm Dokümanları Listele
// ============================================================

router.get('/', async (req, res) => {
  try {
    const documents = await Document.findAll({
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

router.get('/:id', async (req, res) => {
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

module.exports = router;
