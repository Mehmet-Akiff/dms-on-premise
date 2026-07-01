/**
 * DMS On-Premise - Backend API Server
 * Node.js / Express
 * Port: 3000
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// ============================================================
// Uygulama Yapılandırması
// ============================================================

const app = express();
const PORT = process.env.PORT || 3000;

// Ortam değişkenleri
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://dms_user:dms_secure_pass@localhost:5432/dms_db';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';

// ============================================================
// Middleware Katmanı
// ============================================================

app.use(helmet());                              // Güvenlik başlıkları
app.use(cors());                                // Cross-Origin isteklerine izin ver
app.use(morgan('combined'));                     // HTTP istek loglaması
app.use(express.json({ limit: '10mb' }));       // JSON body parser
app.use(express.urlencoded({ extended: true })); // URL-encoded body parser

// Statik dosya sunumu (yüklenen dokümanlar için)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================================
// Sağlık Kontrolü (Health Check)
// ============================================================

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'dms-backend',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ============================================================
// API Rotaları (Placeholder)
// ============================================================

// Doküman yükleme endpoint'i (Gün 3'te implemente edilecek)
app.post('/api/documents/upload', (req, res) => {
  // TODO: Multer entegrasyonu
  res.status(501).json({ message: 'Henüz implemente edilmedi' });
});

// Doküman listeleme endpoint'i
app.get('/api/documents', (req, res) => {
  // TODO: Sequelize ile DB sorgusu
  res.status(501).json({ message: 'Henüz implemente edilmedi' });
});

// Doküman detay endpoint'i
app.get('/api/documents/:id', (req, res) => {
  // TODO: Sequelize ile tekil doküman sorgusu
  res.status(501).json({ message: 'Henüz implemente edilmedi' });
});

// İş durumu sorgulama endpoint'i
app.get('/api/jobs/:jobId', (req, res) => {
  // TODO: İş kuyruğu durumu
  res.status(501).json({ message: 'Henüz implemente edilmedi' });
});

// Doküman arama endpoint'i (Gün 7'de implemente edilecek)
app.get('/api/documents/search', (req, res) => {
  // TODO: PostgreSQL FTS entegrasyonu
  res.status(501).json({ message: 'Henüz implemente edilmedi' });
});

// ============================================================
// 404 ve Genel Hata Yönetimi
// ============================================================

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı', path: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error('[HATA]', err.stack);
  res.status(500).json({ error: 'Sunucu hatası', message: err.message });
});

// ============================================================
// Sunucuyu Başlat
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║   DMS Backend API - Çalışıyor               ║
  ║   Port: ${PORT}                                ║
  ║   Ortam: ${(process.env.NODE_ENV || 'development').padEnd(35)}║
  ║   DB: ${DATABASE_URL.substring(0, 40).padEnd(39)}║
  ║   AI: ${AI_SERVICE_URL.padEnd(39)}║
  ╚══════════════════════════════════════════════╝
  `);
});

module.exports = app;
