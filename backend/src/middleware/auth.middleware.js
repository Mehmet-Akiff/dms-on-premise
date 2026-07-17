/**
 * DMS On-Premise - Kimlik Doğrulama Middleware'i
 * Gelen isteklerde JWT token kontrolü ve dinamik rol/izin doğrulaması yapar.
 */

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const JWT_SECRET = process.env.JWT_SECRET || 'dms_jwt_secret_key_2026';

/**
 * verifyToken Middleware
 * İstek başlığında (Header) geçerli bir JWT olup olmadığını doğrular ve güncel kullanıcıyı veritabanından çeker.
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Erişim engellendi. Kimlik doğrulama token\'ı bulunamadı.' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Token formatı geçersiz. "Bearer <token>" formatında olmalıdır.' });
    }

    const token = parts[1];

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token.' });
      }

      // Geriye dönük uyumluluk veya master / demo girişleri için fallback kontrolü
      if (decoded.systemAccess && !decoded.id) {
        req.user = {
          id: null,
          fullName: decoded.role === 'admin' ? 'Sistem Yöneticisi' : 'Demo Kullanıcı',
          username: decoded.role === 'admin' ? 'admin' : 'demo_user',
          role: decoded.role,
          permissions: {
            canRead: true,
            canWrite: decoded.role === 'admin',
          },
          status: 'active'
        };
        return next();
      }

      try {
        const user = await User.findByPk(decoded.id);
        if (!user) {
          return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
        }
        if (user.status !== 'active') {
          return res.status(403).json({ error: 'Hesabınız henüz onaylanmamış veya askıya alınmış.' });
        }
        req.user = user;
        user.lastActive = new Date();
        user.save().catch(() => {});
        next();
      } catch (dbError) {
        console.error('[MIDDLEWARE_DB_HATA]', dbError.message);
        return res.status(500).json({ error: 'Kullanıcı doğrulanırken veritabanı hatası oluştu.' });
      }
    });
  } catch (error) {
    console.error('[MIDDLEWARE_HATA] Auth middleware hatası:', error.message);
    res.status(500).json({ error: 'Kimlik doğrulama sırasında bir sunucu hatası oluştu.' });
  }
};

/**
 * requireAdmin Middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'ciso')) {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz bulunmamaktadır. Sadece yöneticiler işlem yapabilir.' });
  }
  next();
};

/**
 * requireCiso Middleware
 */
const requireCiso = (req, res, next) => {
  if (!req.user || req.user.role !== 'ciso') {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz bulunmamaktadır. Sadece Bilgi Güvenliği Yöneticisi (CISO) erişebilir.' });
  }
  next();
};

/**
 * requireReadPermission Middleware (Dinamik Okuma Yetkisi)
 */
const requireReadPermission = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Kimlik doğrulanmadı.' });
  }
  if (req.user.role === 'ciso' || req.user.role === 'admin') {
    return next();
  }
  if (req.user.permissions && req.user.permissions.canRead) {
    return next();
  }
  return res.status(403).json({ error: 'Belgeleri görüntülemek/okumak için yetkiniz bulunmamaktadır.' });
};

/**
 * requireWritePermission Middleware (Dinamik Yazma/Düzenleme Yetkisi)
 */
const requireWritePermission = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Kimlik doğrulanmadı.' });
  }
  if (req.user.role === 'ciso' || req.user.role === 'admin') {
    return next();
  }
  if (req.user.permissions && req.user.permissions.canWrite) {
    return next();
  }
  return res.status(403).json({ error: 'Belge eklemek veya düzenlemek için yetkiniz bulunmamaktadır.' });
};

module.exports = {
  verifyToken,
  requireAdmin,
  requireCiso,
  requireReadPermission,
  requireWritePermission
};
