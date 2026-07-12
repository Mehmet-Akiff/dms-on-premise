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
// GET /api/documents/search — Arama (mode, fileType, status, sort)
// ============================================================

router.get('/search', async (req, res) => {
  try {
    const { q, mode = 'fuzzy', fileType = 'all', status = 'all', sort = 'relevance' } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Arama sorgusu (q) parametresi gereklidir.' });
    }

    const searchTerm = q.trim();
    console.log(`[ARAMA] Mod: ${mode} | Tür: ${fileType} | Durum: ${status} | Sıra: ${sort} | Sorgu: "${searchTerm}"`);

    let queryStr = '';
    const isFuzzy = mode === 'fuzzy';
    
    // Filtreler
    let extraFilters = '';
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

    // Sıralama
    let orderClause = 'ORDER BY relevance DESC';
    if (sort === 'newest') orderClause = 'ORDER BY d.created_at DESC';
    else if (sort === 'oldest') orderClause = 'ORDER BY d.created_at ASC';
    else if (sort === 'name_asc') orderClause = 'ORDER BY d.original_name ASC';
    else if (sort === 'name_desc') orderClause = 'ORDER BY d.original_name DESC';

    if (mode === 'exact') {
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
      // 3. AKILLI ARAMA (Fuzzy Match + Hybrid Scoring)
      // Eşleşme hassasiyeti (threshold) > 0.30 olarak yükseltildi, alakasız kelimeler getirilmez.
      queryStr = `
        SELECT
         d.id, d.title, d.original_name AS "originalName", d.mime_type AS "mimeType", d.status, d.created_at AS "createdAt", dm.category, dm.confidence,
         (
           (CASE WHEN d.original_name ILIKE '%' || :searchTerm || '%' THEN 10 ELSE 0 END) +
           (word_similarity(:searchTerm, d.original_name) * 5) +
           (CASE WHEN COALESCE(dm.extracted_text, '') ILIKE '%' || :searchTerm || '%' THEN 3 ELSE 0 END) +
           (word_similarity(:searchTerm, COALESCE(dm.extracted_text, '')) * 1)
         ) AS relevance,
         (CASE WHEN (d.original_name ILIKE '%' || :searchTerm || '%' OR word_similarity(:searchTerm, d.original_name) > 0.35) THEN false ELSE true END) AS "isDimmed",
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
      replacements: { searchTerm },
      type: sequelize.constructor.QueryTypes.SELECT,
    });

    // JS tabanlı dinamik snippet ve highlight oluşturma
    const isExact = (mode === 'exact');
    results.forEach(r => {
      const name = r.originalName || '';
      const inFilename = isExact ? name.includes(searchTerm) : name.toLowerCase().includes(searchTerm.toLowerCase());
      r.matchLocation = inFilename ? 'filename' : 'content';

      // Dinamik snippet oluştur ve highlight et
      const rawText = r.extractedText || '';
      const snippet = getMatchSnippet(rawText, searchTerm, isExact);
      r.highlight = applyHighlight(snippet, searchTerm, isExact);

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
