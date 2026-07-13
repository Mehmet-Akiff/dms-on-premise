/**
 * DMS On-Premise - Kimlik Doğrulama Middleware'i
 * Gelen isteklerde JWT token kontrolü yapar.
 */

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dms_jwt_secret_key_2026';

/**
 * verifyToken Middleware
 * İstek başlığında (Header) geçerli bir JWT olup olmadığını doğrular.
 */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Erişim engellendi. Kimlik doğrulama token\'ı bulunamadı.' });
    }

    // Token formatını doğrula: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Token formatı geçersiz. "Bearer <token>" formatında olmalıdır.' });
    }

    const token = parts[1];

    // Token'ı doğrula
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token.' });
      }

      // Çözülen kullanıcı verilerini request nesnesine ekle
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error('[MIDDLEWARE_HATA] Auth middleware hatası:', error.message);
    res.status(500).json({ error: 'Kimlik doğrulama sırasında bir sunucu hatası oluştu.' });
  }
};

module.exports = {
  verifyToken
};
