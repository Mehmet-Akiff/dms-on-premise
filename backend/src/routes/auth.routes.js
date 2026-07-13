/**
 * DMS On-Premise - Kasa Yetkilendirme ve Ayar Rotaları
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { SystemSettings } = require('../models');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dms_jwt_secret_key_2026';

// Bellek içi hatalı giriş takibi
const loginAttempts = {};

// Lockout Süreleri Eşleme (Hata Sayısı -> Kilit Süresi Milisaniye)
const getLockoutDuration = (attempts) => {
  if (attempts < 3) return 0;
  switch (attempts) {
    case 3: return 1 * 60 * 1000;      // 1 dakika
    case 4: return 3 * 60 * 1000;      // 3 dakika
    case 5: return 5 * 60 * 1000;      // 5 dakika
    case 6: return 10 * 60 * 1000;     // 10 dakika
    case 7: return 15 * 60 * 1000;     // 15 dakika
    case 8: return 20 * 60 * 1000;     // 20 dakika
    case 9: return 30 * 60 * 1000;     // 30 dakika
    case 10: return 60 * 60 * 1000;    // 1 saat
    default: return 24 * 60 * 60 * 1000; // 24 saat (1 gün)
  }
};

// Mailer Yardımcı Fonksiyonu
const sendAlertEmail = async (toEmail, attemptsCount, clientIp) => {
  if (!toEmail) return;
  try {
    // Console Mock Mailer (SMTP yoksa hata vermemesi için)
    console.log(`\n=================== [E-POSTA UYARISI] ===================`);
    console.log(`Kime: ${toEmail}`);
    console.log(`Konu: DMS - YETKİSİZ ERİŞİM ALARMI!`);
    console.log(`Mesaj: DMS On-Premise sisteminize ardışık hatalı giriş denemeleri yapılmıştır.`);
    console.log(`Hatalı Deneme Sayısı: ${attemptsCount}`);
    console.log(`IP Adresi: ${clientIp}`);
    console.log(`Güvenlik nedeniyle sistem geçici olarak kilitlenmiştir.`);
    console.log(`=========================================================\n`);

    // SMTP Gönderimi (mock etseler bile kod çalışır durumda olmalıdır)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT) || 1025,
      ignoreTLS: true
    });

    await transporter.sendMail({
      from: '"DMS Security" <security@dms-onpremise.com>',
      to: toEmail,
      subject: 'DMS - YETKİSİZ ERİŞİM ALARMI!',
      text: `DMS On-Premise sisteminize ardışık hatalı giriş denemeleri yapılmıştır. Hatalı Deneme: ${attemptsCount}, IP: ${clientIp}`
    });
    console.log(`[MAIL] Uyarı maili başarıyla gönderildi: ${toEmail}`);
  } catch (err) {
    console.warn(`[MAIL_UYARI] SMTP gönderimi başarısız oldu (Mock loglama yapıldı):`, err.message);
  }
};

// ============================================================
// GET /api/auth/kasa-status — Giriş Hakları ve Lockout Durumu
// ============================================================
router.get('/kasa-status', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const attemptsInfo = loginAttempts[ip] || { attempts: 0, lockUntil: null };

  let lockoutSecondsLeft = 0;
  if (attemptsInfo.lockUntil && attemptsInfo.lockUntil > Date.now()) {
    lockoutSecondsLeft = Math.ceil((attemptsInfo.lockUntil - Date.now()) / 1000);
  }

  // Kalan hak (3 hatalı hak var)
  const remainingAttempts = Math.max(0, 3 - (attemptsInfo.attempts % 3));

  res.status(200).json({
    attempts: attemptsInfo.attempts,
    remainingAttempts: remainingAttempts === 0 && lockoutSecondsLeft > 0 ? 0 : (attemptsInfo.attempts >= 3 ? 1 : 3 - attemptsInfo.attempts),
    lockoutSecondsLeft
  });
});

// ============================================================
// POST /api/auth/kasa-login — Kasa Kilidi Açma
// ============================================================
router.post('/kasa-login', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  if (!loginAttempts[ip]) {
    loginAttempts[ip] = { attempts: 0, lockUntil: null };
  }
  
  const attemptsInfo = loginAttempts[ip];

  // 1. Kilit kontrolü
  if (attemptsInfo.lockUntil && attemptsInfo.lockUntil > Date.now()) {
    const secondsLeft = Math.ceil((attemptsInfo.lockUntil - Date.now()) / 1000);
    return res.status(423).json({
      error: 'Kasa geçici olarak kilitlendi.',
      message: `Çok fazla hatalı deneme! Lütfen ${secondsLeft} saniye sonra tekrar deneyin.`,
      lockoutSecondsLeft: secondsLeft
    });
  }

  try {
    const { username, password } = req.body;
    
    // Ayarları çek
    const settingsRecord = await SystemSettings.findByPk('kasa_settings');
    const settings = settingsRecord.value;

    const isUsernameValid = username === settings.masterUsername;
    const isPasswordValid = isUsernameValid && await bcrypt.compare(password, settings.masterPasswordHash);

    if (!isUsernameValid || !isPasswordValid) {
      attemptsInfo.attempts += 1;

      // Lockout sınırları kontrol et
      const duration = getLockoutDuration(attemptsInfo.attempts);
      if (duration > 0) {
        attemptsInfo.lockUntil = Date.now() + duration;
        
        // E-posta uyarısı tetikleme limitini aşmış mı kontrol et
        const threshold = settings.alertThreshold || 3;
        if (attemptsInfo.attempts >= threshold && settings.verifiedAlertEmail) {
          await sendAlertEmail(settings.verifiedAlertEmail, attemptsInfo.attempts, ip);
        }

        const secondsLeft = Math.ceil(duration / 1000);
        return res.status(423).json({
          error: 'Kasa kilitlendi.',
          message: `Hatalı giriş! Kasa ${secondsLeft} saniye kilitlendi.`,
          attempts: attemptsInfo.attempts,
          lockoutSecondsLeft: secondsLeft
        });
      }

      const remaining = 3 - attemptsInfo.attempts;
      return res.status(401).json({
        error: 'Hatalı kullanıcı adı veya şifre.',
        message: `Hatalı giriş! Kalan deneme hakkı: ${remaining}`,
        attempts: attemptsInfo.attempts,
        remainingAttempts: remaining
      });
    }

    // Giriş Başarılı: IP limitlerini sıfırla
    attemptsInfo.attempts = 0;
    attemptsInfo.lockUntil = null;

    // JWT Token oluştur
    const token = jwt.sign(
      { role: 'admin', systemAccess: true },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.status(200).json({
      message: 'Kasa kilidi başarıyla açıldı.',
      token
    });

  } catch (error) {
    console.error('[HATA] Kasa giriş hatası:', error.message);
    res.status(500).json({ error: 'Giriş yapılırken bir hata oluştu.' });
  }
});

// ============================================================
// GET /api/auth/settings — Kasa Ayarlarını Getir
// ============================================================
router.get('/settings', async (req, res) => {
  try {
    const record = await SystemSettings.findByPk('kasa_settings');
    const settings = record.value;

    res.status(200).json({
      settings: {
        masterUsername: settings.masterUsername,
        alertEmail: settings.alertEmail,
        verifiedAlertEmail: settings.verifiedAlertEmail,
        alertThreshold: settings.alertThreshold || 3,
        isEmailVerified: !!settings.verifiedAlertEmail && settings.alertEmail === settings.verifiedAlertEmail
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Ayarlar getirilemedi.' });
  }
});

// ============================================================
// PUT /api/auth/settings — Kasa Ayarlarını Güncelle (Şifre vb.)
// ============================================================
router.put('/settings', async (req, res) => {
  try {
    const { masterUsername, newPassword, alertThreshold } = req.body;
    const record = await SystemSettings.findByPk('kasa_settings');
    const settings = { ...record.value };

    if (masterUsername) {
      settings.masterUsername = masterUsername;
    }

    if (newPassword) {
      const salt = await bcrypt.genSalt(10);
      settings.masterPasswordHash = await bcrypt.hash(newPassword, salt);
    }

    if (alertThreshold !== undefined) {
      settings.alertThreshold = parseInt(alertThreshold) || 3;
    }

    await record.update({ value: settings });
    res.status(200).json({ message: 'Ayarlar başarıyla güncellendi.', settings });
  } catch (error) {
    res.status(500).json({ error: 'Ayarlar güncellenirken hata oluştu.' });
  }
});

// ============================================================
// POST /api/auth/send-verification — Doğrulama E-postası Gönder
// ============================================================
router.post('/send-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'E-posta adresi zorunludur.' });
    }

    // 6 haneli kod üret
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 5 * 60 * 1000; // 5 dakika geçerli

    const record = await SystemSettings.findByPk('kasa_settings');
    const settings = { ...record.value };

    settings.alertEmail = email;
    settings.verificationCode = code;
    settings.verificationExpires = expires;

    await record.update({ value: settings });

    // Kodu e-postayla gönder (log ve smtp)
    console.log(`\n=================== [DOĞRULAMA KODU] ===================`);
    console.log(`Kime: ${email}`);
    console.log(`Doğrulama Kodu: ${code}`);
    console.log(`Geçerlilik Süresi: 5 dakika`);
    console.log(`========================================================\n`);

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT) || 1025,
        ignoreTLS: true
      });

      await transporter.sendMail({
        from: '"DMS Security" <security@dms-onpremise.com>',
        to: email,
        subject: 'DMS - Kasa Bildirim E-posta Doğrulama',
        text: `DMS bildirim e-postası doğrulama kodunuz: ${code}. Bu kod 5 dakika geçerlidir.`
      });
    } catch (mailErr) {
      console.warn(`[MAIL_DOĞRULAMA] SMTP gönderimi başarısız oldu (Log yeterlidir):`, mailErr.message);
    }

    res.status(200).json({ message: 'Doğrulama kodu e-posta adresinize gönderildi.' });
  } catch (error) {
    res.status(500).json({ error: 'Doğrulama kodu gönderilirken hata oluştu.' });
  }
});

// ============================================================
// POST /api/auth/verify-code — Doğrulama Kodunu Kontrol Et
// ============================================================
router.post('/verify-code', async (req, res) => {
  try {
    const { code } = req.body;
    const record = await SystemSettings.findByPk('kasa_settings');
    const settings = { ...record.value };

    if (!settings.verificationCode || settings.verificationCode !== code) {
      return res.status(400).json({ error: 'Geçersiz doğrulama kodu.' });
    }

    if (Date.now() > settings.verificationExpires) {
      return res.status(400).json({ error: 'Doğrulama kodunun süresi dolmuş.' });
    }

    // Kod doğru, e-postayı doğrula
    settings.verifiedAlertEmail = settings.alertEmail;
    settings.verificationCode = null;
    settings.verificationExpires = null;

    await record.update({ value: settings });

    res.status(200).json({
      message: 'E-posta başarıyla doğrulandı.',
      verifiedAlertEmail: settings.verifiedAlertEmail
    });
  } catch (error) {
    res.status(500).json({ error: 'Kod doğrulanırken hata oluştu.' });
  }
});

module.exports = router;
