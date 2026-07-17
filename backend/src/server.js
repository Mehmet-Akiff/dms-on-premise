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
const authRoutes = require('./routes/auth.routes');

const IS_PROD = process.env.NODE_ENV === 'production';

// ============================================================
// Merkezi Yapılandırma
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
app.use(morgan(':date[iso] :method :url :status :res[content-length] - :response-time ms'));
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

// ============================================================
// Server-Sent Events (SSE) Altyapısı (Gerçek Zamanlı Güncelleme)
// ============================================================

global.sseClients = [];

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Bağlantıyı kaydet
  global.sseClients.push(res);
  console.log(`[SSE] Yeni bir istemci bağlandı. Toplam dinleyici: ${global.sseClients.length}`);

  // Heartbeat (Bağlantının açık kalmasını garantilemek için 20s'de bir boş yorum yolla)
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    global.sseClients = global.sseClients.filter(client => client !== res);
    console.log(`[SSE] İstemci bağlantıyı kesti. Kalan dinleyici: ${global.sseClients.length}`);
  });
});

// İstemcilere veri fırlatan global fonksiyon
global.sendDocumentUpdateToClients = (documentData) => {
  const message = `event: document_updated\ndata: ${JSON.stringify(documentData)}\n\n`;
  global.sseClients.forEach(client => {
    try {
      client.write(message);
    } catch (e) {
      console.error('[SSE_WRITE_ERR] İstemciye veri yazılamadı:', e.message);
    }
  });
};

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

// ============================================================
// 404 ve Genel Hata Yönetimi
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint bulunamadı',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// MERKEZİ HATA YÖNETİMİ MIDDLEWARE’u (Global Error Handler)
// ============================================================

// Yardımcı: Sequelize veya bilinen hata tiplerini temiz mesajlara çevirir
function formatError(err) {
  // Sequelize: UniqueConstraintError
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors?.[0]?.path || 'alan';
    const labelMap = {
      email: 'Bu e-posta adresi zaten kullanımda.',
      username: 'Bu kullanıcı adı zaten alınmış.',
    };
    return { status: 409, message: labelMap[field] || 'Bu değer zaten kayıtlı.' };
  }
  // Sequelize: ValidationError
  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map(e => e.message).join(', ');
    return { status: 400, message: `Geçersiz veri: ${messages}` };
  }
  // JWT: TokenExpiredError / JsonWebTokenError
  if (err.name === 'TokenExpiredError') {
    return { status: 401, message: 'Oturum süreniz dolmuştur. Lütfen tekrar giriş yapın.' };
  }
  if (err.name === 'JsonWebTokenError') {
    return { status: 401, message: 'Geçersiz oturum belirteci.' };
  }
  // Multer: LIMIT_FILE_SIZE
  if (err.code === 'LIMIT_FILE_SIZE') {
    return { status: 413, message: 'Dosya boyutu izin verilen sınırı aşıyor.' };
  }
  // Multer: LIMIT_UNEXPECTED_FILE
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return { status: 400, message: 'Beklenmeyen dosya alanı tespit edildi.' };
  }
  // HTTP statusCode zaten ayarlanmış
  if (err.status || err.statusCode) {
    return { status: err.status || err.statusCode, message: err.message || 'Bir hata oluştu.' };
  }
  // Varsayılan: 500
  return { status: 500, message: IS_PROD ? 'Sunucuda beklenmeyen bir hata oluştu.' : (err.message || 'Sunucu hatası') };
}

app.use((err, req, res, next) => {
  const { status, message } = formatError(err);
  // Production'da hassas stack bilgisi loglanmaz
  if (!IS_PROD) {
    console.error('[HATA]', err.stack || err.message);
  } else {
    console.error(`[HATA] ${req.method} ${req.originalUrl} -> ${status}: ${message}`);
  }
  res.status(status).json({
    error: message,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// SÜREÇ DÜZEYİNDE HATA YAKALAMA (Uygulamanın çökmesini önler)
// ============================================================

process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection] :', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] :', err.message);
  // Production'da graceful shutdown yap
  if (IS_PROD) process.exit(1);
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

      // Tabloları otomatik oluştur/güncelle (drop:false → mevcut kolonları/kısıtları korur)
      await sequelize.sync({ alter: { drop: false } });
      console.log('[DB] Tablolar senkronize edildi.');

      // Kasa Varsayılan Ayarlarını Başlat
      const { SystemSettings, User } = require('./models');
      const bcrypt = require('bcryptjs');
      const defaultSettings = await SystemSettings.findByPk('kasa_settings');
      if (!defaultSettings) {
        const salt = await bcrypt.genSalt(10);
        const masterPasswordHash = await bcrypt.hash('admin', salt);
        await SystemSettings.create({
          key: 'kasa_settings',
          value: {
            masterUsername: 'admin',
            masterPasswordHash: masterPasswordHash,
            alertEmail: '',
            verifiedAlertEmail: '',
            alertThreshold: 3,
            verificationCode: null,
            verificationExpires: null,
            smtpConfig: {
              host: 'smtp.gmail.com',
              port: 465,
              secure: true,
              auth: {
                user: '',
                pass: ''
              }
            }
          }
        });
        console.log('[DB] Kasa varsayılan şifresi ("admin" / "DmsSecureKasa2026!") oluşturuldu.');
      }

      // Varsayılan CISO Hesabını Tohumla
      const cisoExists = await User.findOne({ where: { role: 'ciso' } });
      if (!cisoExists) {
        const passwordHash = await bcrypt.hash('ciso_secure_2026', 10);
        await User.create({
          fullName: 'Security Officer',
          username: 'ciso',
          email: 'ciso@dms.com',
          passwordHash,
          role: 'ciso',
          status: 'active',
          permissions: { canRead: true, canWrite: true }
        });
        console.log('[DB] Varsayılan CISO hesabı oluşturuldu (ciso / ciso_secure_2026)');
      }

      // Varsayılan Admin Hesabını Tohumla
      const adminExists = await User.findOne({ where: { username: 'admin' } });
      if (!adminExists) {
        const passwordHash = await bcrypt.hash('admin', 10);
        await User.create({
          fullName: 'Sistem Yöneticisi',
          username: 'admin',
          email: 'admin@dms.com',
          passwordHash,
          role: 'admin',
          status: 'active',
          permissions: { canRead: true, canWrite: true }
        });
        console.log('[DB] Varsayılan Admin hesabı oluşturuldu (admin / admin)');
      }

      // Fuzzy Search için pg_trgm eklentisini güvenli bir şekilde aktifleştir
      try {
        await sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
        console.log('[DB] pg_trgm eklentisi (Fuzzy Search) aktifleştirildi.');
      } catch (extError) {
        console.warn('[UYARI] pg_trgm eklentisi aktifleştirilemedi (yetki sorunu olabilir). Fuzzy search tam verimle çalışmayabilir:', extError.message);
      }

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

      // 30 GÜNLÜK ÇÖP KUTUSU OTOMATİK TEMİZLEME GÖREVİ
      // Her 24 saatte bir çalışır. 30 günden eski silinmiş belgeleri diskten ve DB'den temizler.
      setInterval(async () => {
        try {
          const fs = require('fs');
          const path = require('path');
          const { Op } = require('sequelize');
          const Document = require('./models/Document');

          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const expiredDocs = await Document.findAll({
            where: {
              deletedAt: { [Op.lt]: thirtyDaysAgo }
            },
            paranoid: false
          });

          for (const doc of expiredDocs) {
            const absolutePath = path.resolve(doc.filePath);
            if (fs.existsSync(absolutePath)) {
              fs.unlinkSync(absolutePath);
            }
            await doc.destroy({ force: true });
          }

          if (expiredDocs.length > 0) {
            console.log(`[CLEANUP] 30 günü geçmiş ${expiredDocs.length} silinmiş doküman diskten ve DB'den kalıcı olarak temizlendi.`);
          }
        } catch (err) {
          console.error('[CLEANUP_ERR] Çöp kutusu temizlenirken hata oluştu:', err.message);
        }
      }, 24 * 60 * 60 * 1000); // 24 saat
    });
  } catch (error) {
    console.error('[KRITIK] Sunucu başlatılamadı:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
