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

const { sequelize } = require('./models');
const documentRoutes = require('./routes/document.routes');

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

app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({
      status: 'healthy',
      service: 'dms-backend',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'dms-backend',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'error',
    });
  }
});

// ============================================================
// API Rotaları
// ============================================================

app.use('/api/documents', documentRoutes);

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
// Veritabanı Senkronizasyonu ve Sunucu Başlatma
// ============================================================

const startServer = async () => {
  let retries = 5;
  while (retries > 0) {
    try {
      // Veritabanı bağlantısını doğrula
      await sequelize.authenticate();
      console.log('[DB] PostgreSQL bağlantısı başarılı.');

      // Tabloları otomatik oluştur/güncelle
      await sequelize.sync({ alter: true });
      console.log('[DB] Tablolar senkronize edildi.');

      // Fuzzy Search için pg_trgm eklentisini aktifleştir
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
      console.log('[DB] pg_trgm eklentisi (Fuzzy Search) aktifleştirildi.');

      break;
    } catch (error) {
      console.error(`[UYARI] Veritabanı bağlantısı kurulamadı. Yeniden deneniyor... Kalan deneme: ${retries - 1}`);
      retries -= 1;
      if (retries === 0) {
        console.error('[KRITIK] Sunucu başlatılamadı:', error.message);
        process.exit(1);
      }
      // 5 saniye bekle
      await new Promise(res => setTimeout(res, 5000));
    }
  }

  try {
    // Sunucuyu başlat
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
  ╔══════════════════════════════════════════════╗
  ║   DMS Backend API - Çalışıyor               ║
  ║   Port: ${PORT}                                ║
  ║   Ortam: ${(process.env.NODE_ENV || 'development').padEnd(35)}║
  ║   DB: Bağlı                                 ║
  ║   AI: ${AI_SERVICE_URL.padEnd(39)}║
  ╚══════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('[KRITIK] Sunucu başlatılamadı:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
