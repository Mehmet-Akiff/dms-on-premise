/**
 * DMS On-Premise - Doküman Yükleme ve Yönetim Rotaları
 * Multer ile dosya yükleme, MIME tipi doğrulama ve DB kaydı.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Document, ProcessingJob } = require('../models');

const router = express.Router();

// ============================================================
// Multer Yapılandırması
// ============================================================

// İzin verilen MIME tipleri
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

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
