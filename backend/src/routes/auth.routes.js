/**
 * DMS On-Premise - Kasa & Kullanıcı Yetkilendirme Rotaları
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const { User, SystemSettings, ApprovalRequest, sequelize } = require('../models');
const { verifyToken, requireAdmin, requireCiso } = require('../middleware/auth.middleware');
const { logCisoAction, archiveEmailVerification } = require('../utils/cisoLogger');
const { logAction } = require('../utils/auditLogger');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dms_jwt_secret_key_2026';

// Bellek içi hatalı giriş takibi
const loginAttempts = {};

// Bellek içi e-posta gönderim limit takibi (2 ardışık mail sonrası 1 dk bekleme)
const emailRequestLogs = {};

function addWorkingDays(startDate, days) {
  let result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) { // 0: Pazar, 6: Cumartesi
      added++;
    }
  }
  return result;
}

// Gelişmiş Rate Limit Takip Durumu
const emailRateLimits = {};

function checkAndRecordEmailLimit(email, ip, role) {
  if (role === 'ciso') {
    return 0; // CISO için limit yok
  }

  const now = Date.now();
  const keys = [email, ip].filter(Boolean);

  for (const key of keys) {
    let state = emailRateLimits[key];
    
    // 24 saat boyunca işlem yapılmadıysa hakkı sıfırla ve başa sar
    if (state && now - state.lastTime > 24 * 60 * 60 * 1000) {
      delete emailRateLimits[key];
      state = null;
    }

    if (!state) {
      state = { count: 0, lastTime: 0 };
      emailRateLimits[key] = state;
    }

    // Deneme sayısına göre bekleme süresini (milisaniye) belirle
    let waitMs = 0;
    if (state.count >= 3) {
      const penaltyIndex = state.count - 3; // 0: 5dk, 1: 15dk, 2: 1saat, 3+: 24saat
      if (penaltyIndex === 0) waitMs = 5 * 60 * 1000;
      else if (penaltyIndex === 1) waitMs = 15 * 60 * 1000;
      else if (penaltyIndex === 2) waitMs = 60 * 60 * 1000;
      else waitMs = 24 * 60 * 60 * 1000;
    }

    if (waitMs > 0) {
      const elapsed = now - state.lastTime;
      if (elapsed < waitMs) {
        // Bekleme süresi dolmadıysa kalan saniyeyi dön
        return Math.ceil((waitMs - elapsed) / 1000);
      }
    }
  }

  // Hak aşılmadıysa, sayaçları güncelle ve kaydet
  for (const key of keys) {
    if (!emailRateLimits[key]) {
      emailRateLimits[key] = { count: 0, lastTime: 0 };
    }
    emailRateLimits[key].count += 1;
    emailRateLimits[key].lastTime = now;
  }
  
  return 0;
}

// SMTP Detaylı Hata Çeviricisi
function getSmtpFriendlyError(errorMsg) {
  const msg = errorMsg.toLowerCase();
  if (msg.includes('connection timeout') || msg.includes('etimedout')) {
    return 'Sunucu bağlantı zaman aşımına uğradı. Port veya host bilgisini kontrol edin.';
  }
  if (msg.includes('connection refused') || msg.includes('econnrefused')) {
    return 'Sunucu bağlantısı reddedildi. Port veya host adresinin doğru olduğundan emin olun.';
  }
  if (msg.includes('username and password not accepted') || msg.includes('invalid credentials') || msg.includes('authentication failed') || msg.includes('invalid login')) {
    return 'Kullanıcı adı veya şifre SMTP sunucusu tarafından kabul edilmedi.';
  }
  if (msg.includes('application-specific password required')) {
    return 'Google hesabı için Uygulama Şifresi (App Password) kullanılması zorunludur.';
  }
  if (msg.includes('enotfound')) {
    return 'SMTP sunucu adresi bulunamadı (DNS Hatası). Host adresini kontrol edin.';
  }
  return 'SMTP sunucusuna bağlanırken bilinmeyen bir hata oluştu.';
}

// Lockout Süreleri Eşleme
const getLockoutDuration = (attempts) => {
  if (attempts < 3) return 0;
  switch (attempts) {
    case 3: return 1 * 60 * 1000;
    case 4: return 3 * 60 * 1000;
    case 5: return 5 * 60 * 1000;
    default: return 15 * 60 * 1000;
  }
};

// SMTP Transporter
const getMailTransporter = (smtp) => {
  if (smtp && smtp.auth && smtp.auth.user && smtp.auth.pass) {
    const port = parseInt(smtp.port) || 465;
    const isSecure = port === 465;
    return nodemailer.createTransport({
      host: smtp.host || 'smtp.gmail.com',
      port: port,
      secure: isSecure,
      auth: {
        user: smtp.auth.user,
        pass: smtp.auth.pass
      },
      tls: { rejectUnauthorized: false }
    });
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT) || 1025,
    ignoreTLS: true
  });
};

// ============================================================
// POST /api/auth/login — Kullanıcı / Admin / CISO Giriş
// ============================================================
router.post('/login', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const { username, password, isCiso } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
  }

  try {
    const user = await User.findOne({ where: { username } });

    if (!loginAttempts[username]) {
      loginAttempts[username] = { attempts: 0, lockUntil: null };
    }
    const attemptsInfo = loginAttempts[username];

    if (attemptsInfo.lockUntil && attemptsInfo.lockUntil > Date.now()) {
      const left = Math.ceil((attemptsInfo.lockUntil - Date.now()) / 1000);
      return res.status(423).json({ error: `Çok fazla hatalı giriş. Lütfen ${left} saniye bekleyin.` });
    }

    const record = await SystemSettings.findByPk('kasa_settings');
    const settings = record ? record.value : {};
    const threshold = settings.alertThreshold || 3;

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      attemptsInfo.attempts += 1;
      
      // ALARM EMAİL TETİKLEME (Kullanıcıya bildirmeden)
      if (attemptsInfo.attempts >= threshold) {
        if (settings.verifiedAlertEmail && settings.smtpConfig?.auth?.user) {
          try {
            const transporter = getMailTransporter(settings.smtpConfig);
            const fromUser = settings.smtpConfig.auth.user;
            transporter.sendMail({
              from: `"DMS Security Alert" <${fromUser}>`,
              to: settings.verifiedAlertEmail,
              subject: 'DMS - Yetkisiz Erişim Alarmı',
              text: `DMS On-Premise sisteminde ardışık olarak hatalı giriş denemeleri yapılmıştır.\n\nHedef Kullanıcı: ${username}\nHatalı Deneme Sayısı: ${attemptsInfo.attempts}\nIP Adresi: ${ip}\nTarih: ${new Date().toLocaleString('tr-TR')}`
            }).catch(err => console.warn('[ALARM_MAIL_ERR]', err.message));
          } catch (e) {
            console.warn('[ALARM_MAIL_SMTP_ERR]', e.message);
          }
        }
      }

      const duration = getLockoutDuration(attemptsInfo.attempts);
      if (duration > 0) {
        attemptsInfo.lockUntil = Date.now() + duration;
      }
      return res.status(401).json({ error: 'Hatalı kullanıcı adı veya şifre.' });
    }

    // E-posta Çakışma Kontrolü (Bloke etmeden sadece uyarı bayrağı set edilir)
    let hasDuplicateEmail = false;
    if (user.email) {
      const emailUsageCount = await User.count({ where: { email: user.email } });
      if (emailUsageCount > 1) {
        hasDuplicateEmail = true;
      }
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Hesabınız henüz onaylanmamış.' });
    }

    if (isCiso && user.role !== 'ciso') {
      return res.status(403).json({ error: 'Bu panelden sadece CISO giriş yapabilir.' });
    }

    attemptsInfo.attempts = 0;
    attemptsInfo.lockUntil = null;

    user.lastLogin = new Date();
    user.lastActive = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullName: user.fullName, email: user.email, hasDuplicateEmail },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    if (user.role === 'ciso') {
      logCisoAction('LOGIN', `CISO sisteme giriş yaptı. IP: ${ip}`, ip);
    } else {
      logAction('LOGIN', user.id, user.fullName, null, null, `Kullanıcı sisteme girdi. Rol: ${user.role}`, ip);
    }

    res.status(200).json({
      message: 'Giriş başarılı.',
      token,
      hasDuplicateEmail,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('[LOGIN_HATA]', error.message);
    res.status(500).json({ error: 'Giriş yapılırken hata oluştu.' });
  }
});

// ============================================================
// POST /api/auth/logout — Kullanıcı Çıkış Yapma (Inaktiflik)
// ============================================================
router.post('/logout', verifyToken, async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  try {
    if (req.user.role === 'ciso') {
      logCisoAction('LOGOUT', `CISO sistemden çıkış yaptı / inaktif oldu. IP: ${ip}`, ip);
    } else {
      logAction('LOGOUT', req.user.id, req.user.fullName, null, null, `Kullanıcı çıkış yaptı / inaktif oldu. IP: ${ip}`, ip);
    }
    res.status(200).json({ message: 'Çıkış yapıldı.' });
  } catch (error) {
    res.status(500).json({ error: 'Çıkış sırasında hata.' });
  }
});

// ============================================================
// POST /api/auth/register-send-code — Kayıt OTP E-posta Gönder (1 dk Limitli)
// ============================================================
router.post('/register-send-code', async (req, res) => {
  const { email, role } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!email) {
    return res.status(400).json({ error: 'E-posta adresi gereklidir.' });
  }

  // Gönderim Limiti Kontrolü (Role göre dinamik limit kontrolü)
  const waitSeconds = checkAndRecordEmailLimit(email, ip, role || 'user');
  if (waitSeconds > 0) {
    const minStr = waitSeconds >= 60 ? `${Math.ceil(waitSeconds / 60)} dakika` : `${waitSeconds} saniye`;
    return res.status(429).json({ 
      error: 'E-posta limitine takıldınız.', 
      message: `Çok sık e-posta talebi gönderdiniz. Lütfen tekrar kod talep etmek için ${minStr} bekleyin.` 
    });
  }

  try {
    const emailExists = await User.findOne({ where: { email } });
    if (emailExists) {
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kayıtlı.' });
    }

    const settingsRecord = await SystemSettings.findByPk('kasa_settings');
    const settings = settingsRecord ? settingsRecord.value : {};
    
    if (!settings.smtpConfig?.auth?.user || !settings.smtpConfig?.auth?.pass) {
      return res.status(400).json({ 
        error: 'SMTP ayarları eksik.', 
        message: 'Sistemin onay veya bildirim maili atabilmesi için öncelikle yöneticinin SMTP Gönderici Ayarlarını kaydetmesi gerekmektedir.' 
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    await ApprovalRequest.destroy({ where: { type: 'REGISTRATION_OTP', targetId: email } });
    await ApprovalRequest.create({
      type: 'REGISTRATION_OTP',
      targetId: email,
      token: code,
      requestData: { expiresAt },
      status: 'pending'
    });

    const transporter = getMailTransporter(settings.smtpConfig);
    const fromUser = settings.smtpConfig.auth.user;
    await transporter.sendMail({
      from: `"DMS Security" <${fromUser}>`,
      to: email,
      subject: 'DMS - Kayıt E-posta Doğrulama Kodu',
      text: `DMS On-Premise sistemine kayıt başvurusu yapabilmek için doğrulama kodunuz:\n\n${code}\n\nBu kod 5 dakika geçerlidir.`
    });

    console.log(`\n[REGISTRATION OTP KODU] Email: ${email} -> Kod: ${code}\n`);
    res.status(200).json({ message: 'Doğrulama kodu gönderildi.' });
  } catch (error) {
    console.error('[REG_SEND_CODE_ERR]', error.message);
    res.status(500).json({ error: 'Kod gönderilirken hata oluştu.', message: error.message });
  }
});

// ============================================================
// POST /api/auth/register-verify-code — Kayıt OTP Doğrula
// ============================================================
router.post('/register-verify-code', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'E-posta ve doğrulama kodu gereklidir.' });
  }

  try {
    const request = await ApprovalRequest.findOne({
      where: { type: 'REGISTRATION_OTP', targetId: email, token: code, status: 'pending' }
    });

    if (!request) {
      return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş doğrulama kodu.' });
    }

    if (request.requestData?.expiresAt < Date.now()) {
      request.status = 'rejected';
      await request.save();
      return res.status(400).json({ error: 'Doğrulama kodunun süresi dolmuş.' });
    }

    request.status = 'approved';
    await request.save();

    res.status(200).json({ message: 'E-posta adresi başarıyla doğrulandı.' });
  } catch (error) {
    res.status(500).json({ error: 'Doğrulama sırasında hata oluştu.' });
  }
});

// ============================================================
// POST /api/auth/register — Yeni Kullanıcı / Admin Kaydı (Zorunlu Mail Onaylı)
// ============================================================
router.post('/register', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const { fullName, username, email, password, role, passwordHint } = req.body;

  if (!fullName || !username || !email || !password || !role) {
    return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
  }

  const t = await sequelize.transaction();
  try {
    const otpApproved = await ApprovalRequest.findOne({
      where: { type: 'REGISTRATION_OTP', targetId: email, status: 'approved' },
      transaction: t
    });

    if (!otpApproved) {
      await t.rollback();
      return res.status(400).json({ error: 'Lütfen kayıt işleminden önce e-posta adresinizi doğrulayın.' });
    }

    const userExists = await User.findOne({ where: { username }, transaction: t });
    if (userExists) {
      await t.rollback();
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanımda.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const settingsRecord = await SystemSettings.findByPk('kasa_settings', { transaction: t });
    const settings = settingsRecord ? settingsRecord.value : {};
    const alertEmail = settings.alertEmail || '';

    const newUser = await User.create({
      fullName,
      username,
      email,
      passwordHash,
      role: role === 'admin' ? 'admin' : 'user',
      status: 'pending_approval',
      passwordHint: passwordHint || null,
      permissions: {
        canRead: true,
        canWrite: role === 'admin'
      }
    }, { transaction: t });

    otpApproved.status = 'consumed';
    await otpApproved.save({ transaction: t });

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 saat onay süresi

    if (role === 'admin') {
      const activeAdmins = await User.findAll({ where: { role: 'admin', status: 'active' }, transaction: t });
      const requiredCount = Math.max(1, activeAdmins.length);

      await ApprovalRequest.create({
        type: 'ADMIN_CREATION',
        targetId: newUser.id,
        requestData: { username: newUser.username, email: newUser.email, expiresAt },
        approvalsRequired: requiredCount,
        approvalsReceived: [],
        status: 'pending',
        token
      }, { transaction: t });

      // Veritabanı işlemlerini commit et
      await t.commit();

      // Commit sonrası asenkron e-posta gönderimi
      for (const adm of activeAdmins) {
        try {
          const transporter = getMailTransporter(settings.smtpConfig);
          const fromUser = settings.smtpConfig?.auth?.user || 'security@dms.com';
          await transporter.sendMail({
            from: `"DMS Security" <${fromUser}>`,
            to: adm.email,
            subject: 'DMS - Yeni Yönetici Onay Talebi',
            text: `Sisteme yeni bir yönetici (Admin) kayıt talebi geldi.\n\nKullanıcı: ${newUser.fullName} (${newUser.username})\nE-posta: ${newUser.email}\n\nLütfen aşağıdaki 6 haneli güvenlik kodunu DMS Bildirim panelindeki ilgili alana girerek onaylayın:\n\nGüvenlik Kodu: ${token}`
          });
        } catch (mailErr) {
          console.warn(`Admin e-posta gönderimi başarısız (${adm.email}):`, mailErr.message);
        }
      }
    } else {
      await ApprovalRequest.create({
        type: 'STANDARD_USER_CREATION',
        targetId: newUser.id,
        requestData: { username: newUser.username, email: newUser.email, expiresAt },
        approvalsRequired: 1,
        approvalsReceived: [],
        status: 'pending',
        token
      }, { transaction: t });

      // Veritabanı işlemlerini commit et
      await t.commit();

      // Commit sonrası asenkron e-posta gönderimi
      if (alertEmail) {
        try {
          const transporter = getMailTransporter(settings.smtpConfig);
          const fromUser = settings.smtpConfig?.auth?.user || 'security@dms.com';
          await transporter.sendMail({
            from: `"DMS Security" <${fromUser}>`,
            to: alertEmail,
            subject: 'DMS - Yeni Kullanıcı Onay Talebi',
            text: `Sisteme yeni bir kullanıcı kayıt talebi geldi.\n\nKullanıcı: ${newUser.fullName} (${newUser.username})\nE-posta: ${newUser.email}\n\nLütfen aşağıdaki 6 haneli güvenlik kodunu DMS Bildirim panelindeki ilgili alana girerek onaylayın:\n\nGüvenlik Kodu: ${token}`
          });
        } catch (mailErr) {
          console.warn('Kullanıcı onay e-postası gönderilemedi:', mailErr.message);
        }
      }
    }

    console.log(`\n=================== [YENİ KAYIT ONAY GÜVENLİK KODU] ===================`);
    console.log(`Kullanıcı: ${newUser.username} (${role})`);
    console.log(`Güvenlik Kodu: ${token}`);
    console.log(`========================================================================\n`);

    res.status(201).json({ message: 'Kayıt talebiniz alındı. Yönetici onayı bekleniyor.' });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }
    console.error('[REGISTER_HATA]', error.message);
    res.status(500).json({ error: 'Kayıt sırasında bir hata oluştu.' });
  }
});

// ============================================================
// GET /api/auth/approve — Link ile E-posta Onaylama
// ============================================================
router.get('/approve', async (req, res) => {
  return res.status(403).send(`
    <div style="font-family: sans-serif; text-align: center; padding: 3rem; background: #0f172a; color: #fff; height: 100vh;">
      <h1 style="color: #ef4444;">⚠ Erişim Engellendi</h1>
      <p>Güvenlik politikaları gereği e-posta üzerinden doğrudan link ile onaylama kaldırılmıştır.</p>
      <p>Lütfen e-postanıza gönderilen 6 haneli onay kodunu DMS arayüzündeki <strong>Bildirimler</strong> panelinden girerek onaylayın.</p>
    </div>
  `);
});

// Eski onay linki işleme kodları temizlendi. Onaylar sadece e-posta onay kodu (OTP) ve arayüz üzerinden yapılmaktadır.

// ============================================================
// GET /api/auth/users — Kullanıcıları Listele (Admin/CISO)
// ============================================================
router.get('/users', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'ciso') {
    return res.status(403).json({ error: 'Yetkisiz erişim.' });
  }
  try {
    const users = await User.findAll({
      attributes: ['id', 'fullName', 'username', 'email', 'role', 'permissions', 'status', 'createdAt']
    });
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Kullanıcı listesi getirilemedi.' });
  }
});

// ============================================================
// GET /api/auth/chat-users — Sohbet için Kullanıcı Listesi (Tüm Kullanıcılar)
// ============================================================
router.get('/chat-users', verifyToken, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'fullName', 'username', 'status'] // Sadece temel bilgiler
    });
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Kullanıcı listesi getirilemedi.' });
  }
});

// ============================================================
// GET /api/auth/users/:id/detail — CISO Kullanıcı Detay & Log Paneli
// ============================================================
router.get('/users/:id/detail', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'ciso') {
    return res.status(403).json({ error: 'Bu alana erişim yetkiniz yok.' });
  }
  try {
    const { AuditLog } = require('../models');
    const { Op } = require('sequelize');

    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'fullName', 'username', 'email', 'role', 'permissions', 'status', 'createdAt']
    });
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const logs = await AuditLog.findAll({
      where: { userId: user.id },
      order: [['created_at', 'DESC']],
      limit: 50
    });

    res.status(200).json({ user, logs });
  } catch (error) {
    res.status(500).json({ error: 'Kullanıcı detayı getirilemedi.' });
  }
});


// ============================================================
// PUT /api/auth/users/:id/permissions — Dinamik Yetkilendirme
// ============================================================
router.put('/users/:id/permissions', verifyToken, requireAdmin, async (req, res) => {
  const { permissions } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  try {
    const targetUser = await User.findByPk(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    if (targetUser.role === 'ciso') {
      return res.status(403).json({ error: 'CISO okuma ve yazma yetkileri hiçbir şekilde kapatılamaz.' });
    }

    if (targetUser.role === 'admin') {
      return res.status(403).json({ 
        error: 'Yöneticilerin yetkileri doğrudan kısıtlanamaz.',
        message: 'Yöneticinin yetkilerini kısmak için öncelikle rolünü Standart Kullanıcı yapmalısınız.'
      });
    }

    targetUser.permissions = {
      canRead: permissions.canRead !== undefined ? permissions.canRead : targetUser.permissions.canRead,
      canWrite: permissions.canWrite !== undefined ? permissions.canWrite : targetUser.permissions.canWrite
    };
    targetUser.changed('permissions', true);
    await targetUser.save();

    logAction('PERM_UPDATE', req.user.id, req.user.fullName, targetUser.id, targetUser.fullName, `Kullanıcı yetkileri güncellendi: canRead=${targetUser.permissions.canRead}, canWrite=${targetUser.permissions.canWrite}`, ip);

    res.status(200).json({ message: 'Yetkiler başarıyla güncellendi.', user: targetUser });
  } catch (error) {
    res.status(500).json({ error: 'Yetkiler güncellenirken hata oluştu.' });
  }
});

// ============================================================
// PUT /api/auth/users/:id/role — Rol Değiştirme (Kendini Standarta Düşüremez)
// ============================================================
router.put('/users/:id/role', verifyToken, requireAdmin, async (req, res) => {
  const { role } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  try {
    const targetUser = await User.findByPk(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    if (targetUser.role === 'ciso') {
      return res.status(403).json({ error: 'CISO rolü değiştirilemez.' });
    }

    if (role === 'ciso') {
      return res.status(403).json({ error: 'Sistemde sadece tek bir CISO bulunabilir.' });
    }

    // Kendini Standart yapma engeli
    if (targetUser.id === req.user.id && targetUser.role === 'admin' && role === 'user') {
      return res.status(403).json({ error: 'Kendi yöneticilik yetkinizi düşüremezsiniz.' });
    }

    const oldRole = targetUser.role;
    targetUser.role = role;

    if (role === 'user') {
      targetUser.permissions = { canRead: true, canWrite: false };
      targetUser.changed('permissions', true);
    } else if (role === 'admin') {
      targetUser.permissions = { canRead: true, canWrite: true };
      targetUser.changed('permissions', true);
    }

    await targetUser.save();

    logAction('ROLE_UPDATE', req.user.id, req.user.fullName, targetUser.id, targetUser.fullName, `Kullanıcı rolü değiştirildi. Eski: ${oldRole}, Yeni: ${role}`, ip);

    res.status(200).json({ message: 'Rol başarıyla güncellendi.', user: targetUser });
  } catch (error) {
    res.status(500).json({ error: 'Rol güncellenirken hata oluştu.' });
  }
});

// ============================================================
// DELETE /api/auth/users/:id — Kullanıcı Silme (Tüm Adminlerin Ortak Onayı ile)
// ============================================================
router.delete('/users/:id', verifyToken, requireAdmin, async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  try {
    const targetUser = await User.findByPk(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Silinecek kullanıcı bulunamadı.' });
    }

    if (targetUser.role === 'ciso') {
      return res.status(403).json({ error: 'CISO profili sistemden hiçbir zaman silinemez.' });
    }

    const { Op } = require('sequelize');
    const activeAdmins = await User.findAll({ where: { role: 'admin', status: 'active' } });

    if (targetUser.role === 'admin') {
      if (activeAdmins.length <= 1) {
        return res.status(403).json({ error: 'Sistemdeki son yönetici (Admin) hesabı silinemez.' });
      }
    }

    // Sistemde tek admin varsa (veya sadece silmeyi başlatan admin varsa) doğrudan sil
    const otherAdmins = activeAdmins.filter(a => a.id !== req.user.id);
    if (otherAdmins.length === 0) {
      // Tek admin - doğrudan sil, onay süreci gerekmiyor
      await targetUser.destroy();
      logAction('DELETE_USER_DIRECT', req.user.id, req.user.fullName, targetUser.id, targetUser.fullName, `Kullanıcı tek yönetici kararıyla doğrudan silindi.`, ip);
      return res.status(200).json({ 
        message: `"${targetUser.fullName}" kullanıcısı başarıyla silindi.`,
        deleted: true
      });
    }

    // Birden fazla admin var - ortak onay kaydı oluştur
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    // Başlatan adminin onayını otomatik olarak say
    const requesterSignature = `Admin (${req.user.fullName || req.user.username})`;

    const request = await ApprovalRequest.create({
      type: 'USER_DELETION',
      targetId: targetUser.id,
      requestData: { 
        username: targetUser.username, 
        fullName: targetUser.fullName, 
        role: targetUser.role,
        requesterId: req.user.id,
        requesterName: req.user.fullName || req.user.username,
        expiresAt 
      },
      approvalsRequired: activeAdmins.length,
      approvalsReceived: [requesterSignature],
      status: 'pending',
      token
    });

    // Diğer adminlere e-posta bildirimi gönder
    const settingsRecord = await SystemSettings.findByPk('kasa_settings');
    const settings = settingsRecord ? settingsRecord.value : {};
    
    for (const adm of otherAdmins) {
      try {
        const transporter = getMailTransporter(settings.smtpConfig);
        const fromUser = settings.smtpConfig?.auth?.user || 'security@dms.com';
        await transporter.sendMail({
          from: `"DMS Security" <${fromUser}>`,
          to: adm.email,
          subject: 'DMS - Kullanıcı Silme Ortak Onay Talebi',
          text: `Yönetici ${req.user.fullName || req.user.username}, "${targetUser.fullName} (${targetUser.username})" isimli kullanıcıyı sistemden silmek istiyor.\n\nBu silme işleminin gerçekleşmesi için tüm yöneticilerin onay vermesi gerekmektedir.\n\nGüvenlik Onay Kodu: ${token}\n\nLütfen DMS arayüzündeki Bildirimler panelinden onay verin.`
        });
      } catch (mailErr) {
        console.warn(`Silme onay maili gönderilemedi (${adm.email}):`, mailErr.message);
      }
    }

    logAction('DELETE_USER_REQUESTED', req.user.id, req.user.fullName, targetUser.id, targetUser.fullName, `Kullanıcı silme talebi oluşturuldu. Ortak karar bekleniyor.`, ip);

    res.status(202).json({ 
      message: 'Kullanıcı silme ortak onay talebi oluşturuldu. Diğer yöneticilerin onayı bekleniyor.',
      pendingApproval: true
    });
  } catch (error) {
    console.error('[DELETE_USER_ERROR]', error.message);
    res.status(500).json({ error: 'Kullanıcı silme talebi oluşturulurken hata oluştu.' });
  }
});

// ============================================================
// PUT /api/auth/profile — Kendi Profilini Güncelle (Ad Soyad / K.Adı CISO Onaylı, Şifre Doğrudan)
// ============================================================
router.put('/profile', verifyToken, async (req, res) => {
  const { fullName, username, oldPassword, newPassword, email, emailOtp } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    const settingsRecord = await SystemSettings.findByPk('kasa_settings');
    const settings = settingsRecord ? settingsRecord.value : {};

    const cisoUser = await User.findOne({ where: { role: 'ciso' } });
    const cisoEmail = cisoUser ? cisoUser.email : 'ciso@dms.com';

    // 0. E-posta Değiştirme (OTP doğrulamalı)
    if (email) {
      if (email === user.email) {
        return res.status(400).json({ error: 'Zaten bu e-posta adresini kullanmaktasınız.' });
      }

      const emailExistsBefore = await User.findOne({ where: { email } });
      if (emailExistsBefore && emailExistsBefore.id !== user.id) {
        return res.status(409).json({ error: 'Bu e-posta adresi zaten başka bir hesap tarafından kullanılıyor.' });
      }

      if (!emailOtp) {
        // OTP yoksa — OTP gönder
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000;
        const val = settings || {};
        val.emailChangeCode = code;
        val.emailChangeTarget = email;
        val.emailChangeUserId = user.id;
        val.emailChangeExpires = expiresAt;
        settingsRecord.value = val;
        settingsRecord.changed('value', true);
        await settingsRecord.save();

        try {
          const transporter = getMailTransporter(settings.smtpConfig);
          const fromUser = settings.smtpConfig?.auth?.user || 'security@dms.com';
          await transporter.sendMail({
            from: `"DMS Security" <${fromUser}>`,
            to: email,
            subject: 'DMS - E-posta Değişikliği Doğrulama Kodu',
            text: `E-posta değişikliği doğrulama kodunuz: ${code}\n\nBu kod 5 dakika geçerlidir.`
          });
        } catch (mailErr) {
          // Logla ama kullanıcıya sadece genel mesaj ver
          console.warn('[EMAIL_CHANGE] Mail gönderilemedi:', mailErr.code || 'SMTP_ERR');
        }
        return res.status(202).json({ message: 'Doğrulama kodu yeni e-posta adresinize gönderildi.', needsOtp: true });
      }

      // OTP var — doğrula
      const now = Date.now();
      if (
        settings.emailChangeCode !== emailOtp ||
        settings.emailChangeUserId !== user.id ||
        settings.emailChangeTarget !== email ||
        (settings.emailChangeExpires && now > settings.emailChangeExpires)
      ) {
        return res.status(400).json({ error: 'Doğrulama kodu geçersiz veya süresi dolmuş.' });
      }

      const emailExists = await User.findOne({ where: { email } });
      if (emailExists && emailExists.id !== user.id) {
        return res.status(409).json({ error: 'Bu e-posta adresi zaten başka bir hesap tarafından kullanılıyor.' });
      }

      const oldEmail = user.email;
      user.email = email;
      logAction('EMAIL_UPDATE', user.id, user.fullName, null, null, `E-posta güncellendi. Eski: ${oldEmail}, Yeni: ${email}`, ip);

      // Yöneticinin/CISO'nun e-postası güncellendiyse yetkisiz erişim alarm mailini de otomatik güncelle
      if (user.role === 'admin' || user.role === 'ciso') {
        const val = settingsRecord.value || {};
        val.alertEmail = email;
        val.verifiedAlertEmail = email;
        settingsRecord.value = val;
        settingsRecord.changed('value', true);
        await settingsRecord.save();
      }

      // Kodu sil
      const val = settings || {};
      delete val.emailChangeCode;
      delete val.emailChangeTarget;
      delete val.emailChangeUserId;
      delete val.emailChangeExpires;
      settingsRecord.value = val;
      settingsRecord.changed('value', true);
      await settingsRecord.save();
    }

    // 1. Şifre Değişikliği (Doğrudan Yapılır - CISO Onayı Gerektirmez)
    if (newPassword) {
      if (!oldPassword) {
        return res.status(400).json({ error: 'Mevcut şifrenizi girmeniz gerekmektedir.' });
      }
      const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Mevcut şifreniz hatalı.' });
      }
      if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return res.status(400).json({ error: 'Yeni şifre en az 8 karakter olmalı, harf ve rakam içermelidir.' });
      }
      user.passwordHash = await bcrypt.hash(newPassword, 10);
      logAction('PASSWORD_UPDATE', user.id, user.fullName, null, null, `Kullanıcı şifresini başarıyla değiştirdi.`, ip);
    }

    // 2. Kullanıcı Adı Değişikliği (Doğrudan Yapılır - CISO Onayı Gerektirmez)
    if (username && username !== user.username) {
      const usernameExists = await User.findOne({ where: { username } });
      if (usernameExists) {
        return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanımda.' });
      }
      const oldUsername = user.username;
      user.username = username;
      logAction('USERNAME_UPDATE', user.id, user.fullName, null, null, `Kullanıcı adını güncelledi. Eski: ${oldUsername}, Yeni: ${username}`, ip);
    }

    // 3. İsim Değişikliği (Admin veya CISO ise Onaya Gider)
    if (fullName && fullName !== user.fullName) {
      let targetEmail = user.role === 'ciso' ? user.email : cisoEmail;
      
      if (!targetEmail || targetEmail === 'ciso@dms.com') {
        return res.status(400).json({ error: "Sistemde CISO (G�venlik Y�neticisi) e-postas� tan�ml� olmad��� i�in onay maili g�nderilemiyor." });
      }

      const waitSeconds = checkAndRecordEmailLimit(targetEmail, ip, user.role);
      if (waitSeconds > 0) {
        const minStr = waitSeconds >= 60 ? Math.ceil(waitSeconds / 60) + ' dakika' : waitSeconds + ' saniye';
        return res.status(429).json({ 
          error: 'E-posta limitine tak�ld�n�z.', 
          message: 'Yeni bir onay maili g�ndermek i�in l�tfen ' + minStr + ' bekleyin.' 
        });
      }

      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      await ApprovalRequest.create({
        type: 'NAME_CHANGE',
        targetId: user.id,
        requestData: { fullName: fullName, oldFullName: user.fullName, newFullName: fullName, expiresAt },
        approvalsRequired: 1,
        status: 'pending',
        token
      });

      try {
        const transporter = getMailTransporter(settings.smtpConfig);
        const fromUser = settings.smtpConfig?.auth?.user || 'security@dms.com';
        await transporter.sendMail({
          from: `"DMS Security" <${fromUser}>`,
          to: targetEmail,
          subject: 'DMS - Ad Soyad Değişikliği Onay Talebi',
          text: `Kullanıcı ${user.username} (${user.role}) gerçek ismini "${fullName}" yapmak istiyor.

Lütfen aşağıdaki 6 haneli güvenlik kodunu DMS Bildirim panelindeki ilgili alana girerek onaylayın:

Güvenlik Kodu: ${token}`
        });
      } catch (mailErr) {
        console.warn('Onay maili gönderilemedi:', mailErr.message);
      }

      console.log(`
[NAME_CHANGE ONAY GÜVENLİK KODU] Güvenlik Kodu: ${token}
`);
      return res.status(202).json({ 
        message: 'İsim değişikliği talebi alındı. E-posta onay kodu veya onay paneli bekleniyor.',
        pendingApproval: true,
        token
      });
    }

    await user.save();

    const hasDuplicateEmail = user.email ? (await User.count({ where: { email: user.email } }) > 1) : false;

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullName: user.fullName, email: user.email, hasDuplicateEmail },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.status(200).json({ 
      message: 'Profil başarıyla güncellendi.', 
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Profil güncellenirken hata oluştu.' });
  }
});

// ============================================================
// PUT /api/auth/settings — Kasa / Sistem Ayarlarını Güncelle (SMTP Doğrulamalı)
// ============================================================
router.put('/settings', verifyToken, requireAdmin, async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  try {
    const { masterUsername, newPassword, alertThreshold, smtpConfig, mode, doubleApprovalEnabled } = req.body;
    
    if (mode) {
      const { Op } = require('sequelize');
      const activeSignatories = await User.findAll({ 
        where: { role: { [Op.in]: ['admin', 'ciso'] }, status: 'active' } 
      });
      const requiredCount = activeSignatories.length;
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

      await ApprovalRequest.create({
        type: 'MODE_CHANGE',
        targetId: 'deployment_mode',
        requestData: { mode, expiresAt },
        approvalsRequired: requiredCount,
        approvalsReceived: [],
        status: 'pending',
        token
      });

      console.log(`\n[MODE_CHANGE ONAY GÜVENLİK KODU] Güvenlik Kodu: ${token}\n`);
      return res.status(202).json({ message: 'Mod değişikliği talebi oluşturuldu. Tüm yöneticilerin (Admin ve CISO) ayarlar panelinden bu güvenlik kodunu girerek onaylaması gerekiyor.' });
    }

    const record = await SystemSettings.findByPk('kasa_settings') || await SystemSettings.create({ key: 'kasa_settings', value: {} });
    const settings = JSON.parse(JSON.stringify(record.value || {}));

    if (masterUsername) settings.masterUsername = masterUsername;
    if (newPassword) {
      const salt = await bcrypt.genSalt(10);
      settings.masterPasswordHash = await bcrypt.hash(newPassword, salt);
    }
    if (alertThreshold !== undefined) settings.alertThreshold = parseInt(alertThreshold);
    if (doubleApprovalEnabled !== undefined) settings.doubleApprovalEnabled = !!doubleApprovalEnabled;

    if (smtpConfig) {
      let finalPass = smtpConfig.auth?.pass || '';
      if (finalPass === '••••••••' || finalPass === '        ' || !finalPass.trim()) {
        finalPass = settings.smtpConfig?.auth?.pass || '';
      }

      if (smtpConfig.auth?.user && finalPass) {
        try {
          const testPort = parseInt(smtpConfig.port) || 465;
          const testSecure = testPort === 465;
          const testTransporter = nodemailer.createTransport({
            host: smtpConfig.host || 'smtp.gmail.com',
            port: testPort,
            secure: testSecure,
            auth: {
              user: smtpConfig.auth.user,
              pass: finalPass
            },
            tls: { rejectUnauthorized: false }
          });

          await testTransporter.sendMail({
            from: `"DMS Security Test" <${smtpConfig.auth.user}>`,
            to: smtpConfig.auth.user,
            subject: 'DMS - SMTP Gönderici Doğrulama Testi',
            text: 'Bu e-posta, DMS On-Premise SMTP gönderici ayarlarının doğrulanması amacıyla otomatik olarak gönderilmiştir. Bu maili alıyorsanız gönderici ayarlarınız başarıyla doğrulanmıştır.'
          });

          if (!settings.smtpConfig) settings.smtpConfig = {};
          settings.smtpConfig.host = smtpConfig.host || 'smtp.gmail.com';
          settings.smtpConfig.port = parseInt(smtpConfig.port) || 465;
          settings.smtpConfig.secure = smtpConfig.secure !== undefined ? smtpConfig.secure : true;
          if (!settings.smtpConfig.auth) settings.smtpConfig.auth = {};
          settings.smtpConfig.auth.user = smtpConfig.auth.user;
          settings.smtpConfig.auth.pass = finalPass;
          settings.smtpConfig.isVerified = true;

          archiveEmailVerification(smtpConfig.auth.user, 'SMTP_SENDER', ip);
          logAction('SMTP_VERIFICATION', req.user?.id, req.user?.fullName, null, null, `SMTP gönderici hesabı doğrulandı: ${smtpConfig.auth.user}`, ip);

        } catch (smtpErr) {
          console.error('[SMTP_VERIFY_ERR]', smtpErr.message);
          return res.status(400).json({ 
            error: 'SMTP ayarları doğrulanamadı.', 
            message: getSmtpFriendlyError(smtpErr.message)
          });
        }
      }
    }

    record.value = settings;
    record.changed('value', true);
    await record.save();

    res.status(200).json({ message: 'Ayarlar güncellendi.', settings });
  } catch (error) {
    console.error('[SETTINGS_PUT_ERR]', error.message);
    res.status(500).json({ error: 'Ayarlar güncellenirken hata oluştu.' });
  }
});

// ============================================================
// GET /api/auth/settings — Sistem Modu & Kasa Ayarlarını Çek
// ============================================================
router.get('/settings', verifyToken, async (req, res) => {
  try {
    const record = await SystemSettings.findByPk('kasa_settings');
    const settings = record ? record.value : {};
    const modeRecord = await SystemSettings.findByPk('deployment_mode');
    const currentMode = modeRecord ? modeRecord.value.mode : 'single_pc';

    res.status(200).json({
      mode: currentMode,
      settings: {
        masterUsername: settings.masterUsername || 'admin',
        alertEmail: settings.alertEmail || '',
        verifiedAlertEmail: settings.verifiedAlertEmail || '',
        alertThreshold: settings.alertThreshold || 3,
        isEmailVerified: !!settings.verifiedAlertEmail,
        doubleApprovalEnabled: settings.doubleApprovalEnabled !== undefined ? settings.doubleApprovalEnabled : false,
        smtpConfig: {
          host: settings.smtpConfig?.host || 'smtp.gmail.com',
          port: settings.smtpConfig?.port || 465,
          secure: settings.smtpConfig?.secure !== undefined ? settings.smtpConfig.secure : true,
          auth: {
            user: settings.smtpConfig?.auth?.user || '',
            pass: settings.smtpConfig?.auth?.pass ? '••••••••' : ''
          }
        },
        workingHours: {
          start: settings.workingHours?.start || '09:00',
          end: settings.workingHours?.end || '18:00'
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Ayarlar getirilemedi.' });
  }
});

// ============================================================
// POST /api/auth/send-verification — Ayarlar Alarm Maili Kodu Gönder (1 dk Limitli)
// ============================================================
router.post('/send-verification', verifyToken, async (req, res) => {
  const { email } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!email) return res.status(400).json({ error: 'E-posta adresi gereklidir.' });

  // Gönderim Limiti Kontrolü
  const waitSeconds = checkAndRecordEmailLimit(email, ip, req.user.role);
  if (waitSeconds > 0) {
    const minStr = waitSeconds >= 60 ? `${Math.ceil(waitSeconds / 60)} dakika` : `${waitSeconds} saniye`;
    return res.status(429).json({ 
      error: 'E-posta limitine takıldınız.', 
      message: `Lütfen yeni bir kod istemek için ${minStr} bekleyin.` 
    });
  }

  try {
    const record = await SystemSettings.findByPk('kasa_settings');
    const settings = record ? record.value : {};

    if (!settings.smtpConfig?.auth?.user || !settings.smtpConfig?.auth?.pass) {
      return res.status(400).json({ 
        error: 'SMTP ayarları eksik.', 
        message: 'Mail gönderilebilmesi için öncelikle SMTP Gönderici Ayarlarının yapılması gerekmektedir.' 
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    await ApprovalRequest.destroy({ where: { type: 'SETTINGS_OTP', targetId: email } });
    await ApprovalRequest.create({
      type: 'SETTINGS_OTP',
      targetId: email,
      token: code,
      requestData: { expiresAt },
      status: 'pending'
    });

    const transporter = getMailTransporter(settings.smtpConfig);
    const fromUser = settings.smtpConfig.auth.user;
    await transporter.sendMail({
      from: `"DMS Security" <${fromUser}>`,
      to: email,
      subject: 'DMS - Alarm E-posta Doğrulama Kodu',
      text: `DMS On-Premise sisteminde alarm alıcı e-postası tanımlayabilmek için doğrulama kodunuz:\n\n${code}\n\nBu kod 5 dakika geçerlidir.`
    });

    console.log(`\n[SETTINGS OTP KODU] Email: ${email} -> Kod: ${code}\n`);
    res.status(200).json({ message: 'Doğrulama kodu gönderildi.' });
  } catch (error) {
    res.status(500).json({ error: 'Kod gönderilerken hata oluştu.', message: error.message });
  }
});

// ============================================================
// POST /api/auth/verify-code — Ayarlar Alarm Maili Kodu Doğrula
// ============================================================
router.post('/verify-code', verifyToken, async (req, res) => {
  const { code } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!code) return res.status(400).json({ error: 'Kod gereklidir.' });

  try {
    const request = await ApprovalRequest.findOne({
      where: { type: 'SETTINGS_OTP', token: code, status: 'pending' }
    });

    if (!request) {
      return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş doğrulama kodu.' });
    }

    if (request.requestData?.expiresAt < Date.now()) {
      request.status = 'rejected';
      await request.save();
      return res.status(400).json({ error: 'Kodun süresi dolmuş.' });
    }

    request.status = 'approved';
    await request.save();

    const record = await SystemSettings.findByPk('kasa_settings');
    const settings = record ? record.value : {};
    settings.alertEmail = request.targetId;
    settings.verifiedAlertEmail = request.targetId;
    
    record.value = settings;
    record.changed('value', true);
    await record.save();

    archiveEmailVerification(request.targetId, 'ALERT_RECEIVER', ip);
    logAction('EMAIL_VERIFICATION', req.user?.id, req.user?.fullName, null, null, `Alarm alıcı e-postası doğrulandı: ${request.targetId}`, ip);

    res.status(200).json({ verifiedAlertEmail: request.targetId });
  } catch (error) {
    res.status(500).json({ error: 'Doğrulama başarısız oldu.' });
  }
});

// ============================================================
// GET /api/auth/approvals — Onay Bekleyen Talepleri Listele (Admin/CISO)
// ============================================================
router.get('/approvals', verifyToken, async (req, res) => {
  try {
    const approvals = await ApprovalRequest.findAll({
      order: [['createdAt', 'DESC']]
    });
    
    const now = Date.now();
    const list = [];

    for (const reqRecord of approvals) {
      const isExpired = reqRecord.requestData?.expiresAt && reqRecord.requestData.expiresAt < now;
      let displayStatus = reqRecord.status;
      if (reqRecord.status === 'pending' && isExpired) {
        displayStatus = 'expired';
      }

      let shouldShow = true;

      // Standart kullanıcı sadece kendi taleplerini görebilir
      if (req.user.role === 'user') {
        const isRequester = reqRecord.requestData?.requesterId === req.user.id;
        const isTarget = reqRecord.targetId === req.user.id;
        if (!isRequester && !isTarget) {
          shouldShow = false;
        }
      }

      // Admin veya CISO profil talepleri: Sadece CISO görebilir.
      if (reqRecord.type === 'NAME_CHANGE' || reqRecord.type === 'USERNAME_CHANGE') {
        const targetUser = await User.findByPk(reqRecord.targetId);
        if (targetUser && (targetUser.role === 'admin' || targetUser.role === 'ciso')) {
          if (req.user.role !== 'ciso') {
            shouldShow = false;
          }
        }
      }

      if (shouldShow) {
        list.push({
          id: reqRecord.id,
          type: reqRecord.type,
          targetId: reqRecord.targetId,
          requestData: reqRecord.requestData,
          approvalsRequired: reqRecord.approvalsRequired,
          approvalsReceived: reqRecord.approvalsReceived,
          status: displayStatus,
          createdAt: reqRecord.createdAt
        });
      }
    }

    const settingsRecord = await SystemSettings.findByPk('kasa_settings');
    const doubleApprovalEnabled = settingsRecord?.value?.doubleApprovalEnabled || false;

    res.status(200).json({ approvals: list, doubleApprovalEnabled });
  } catch (error) {
    res.status(500).json({ error: 'Onay talepleri listelenemedi.' });
  }
});

// ============================================================
// POST /api/auth/approvals/:id/approve — Talebi Doğrudan Onayla (Arayüzden)
// ============================================================
router.post('/approvals/:id/approve', verifyToken, async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (req.user.role !== 'admin' && req.user.role !== 'ciso') {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
  }

  const { code } = req.body;

  const t = await sequelize.transaction();
  try {
    const settingsRecord = await SystemSettings.findByPk('kasa_settings', { transaction: t });
    const doubleApprovalEnabled = settingsRecord?.value?.doubleApprovalEnabled || false;

    const request = await ApprovalRequest.findByPk(req.params.id, { transaction: t });
    if (!request || request.status !== 'pending') {
      await t.rollback();
      return res.status(404).json({ error: 'Onay talebi bulunamadı veya süresi dolmuş/işlenmiş.' });
    }

    // Süre dolma kontrolü
    if (request.requestData?.expiresAt && request.requestData.expiresAt < Date.now()) {
      request.status = 'rejected';
      await request.save({ transaction: t });
      await t.commit();
      return res.status(400).json({ error: 'Bu talebin onay süresi dolmuştur.' });
    }

    if ((request.type === 'NAME_CHANGE' || request.type === 'USERNAME_CHANGE') && req.user.role !== 'ciso') {
      await t.rollback();
      return res.status(403).json({ error: 'Yönetici profil değişikliklerini sadece CISO onaylayabilir.' });
    }

    if ((request.type === 'STANDARD_USER_CREATION' || request.type === 'ADMIN_CREATION') && req.user.role === 'ciso') {
      await t.rollback();
      return res.status(403).json({ error: 'Yeni kullanıcı onaylama/reddetme işlemini sadece Sistem Yoneticisi (Admin) yapabilir.' });
    }

    const received = request.approvalsReceived || [];

    // E-posta Kodu ile mi onaylanıyor, yoksa arayüzden butonla mı?
    if (code) {
      if (code.trim() !== request.token) {
        await t.rollback();
        return res.status(400).json({ error: 'Geçersiz güvenlik onay kodu.' });
      }
      
      const sig = (request.type === 'NAME_CHANGE' || request.type === 'USERNAME_CHANGE') 
        ? 'CISO (E-posta)' 
        : 'Yönetici (E-posta)';
        
      if (!received.includes(sig)) {
        received.push(sig);
      }
    } else {
      const sig = (request.type === 'NAME_CHANGE' || request.type === 'USERNAME_CHANGE') 
        ? 'CISO (Arayüz)' 
        : 'Yönetici (Arayüz)';
        
      if (!received.includes(sig)) {
        received.push(sig);
      }
    }

    request.approvalsReceived = received;
    request.changed('approvalsReceived', true);

    if (request.type === 'STANDARD_USER_CREATION' || request.type === 'ADMIN_CREATION') {
      const user = await User.findByPk(request.targetId, { transaction: t });
      if (!user) {
        await t.rollback();
        return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      }

      const isApproved = doubleApprovalEnabled 
        ? (received.includes('Yönetici (E-posta)') && received.includes('Yönetici (Arayüz)'))
        : true;

      if (isApproved) {
        request.status = 'approved';
        await request.save({ transaction: t });

        user.status = 'active';
        await user.save({ transaction: t });

        await t.commit();

        archiveEmailVerification(user.email, user.username, ip);
        logAction('APPROVE_USER', req.user.id, req.user.fullName, user.id, user.fullName, `Kullanıcı kaydı onaylandı.`, ip);
      } else {
        await request.save({ transaction: t });
        await t.commit();
      }
    } else if (request.type === 'NAME_CHANGE') {
      const user = await User.findByPk(request.targetId, { transaction: t });
      if (!user) {
        await t.rollback();
        return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      }

      const isApproved = (received.includes('CISO (E-posta)') && received.includes('CISO (Arayüz)'));

      if (isApproved) {
        request.status = 'approved';
        await request.save({ transaction: t });

        const oldName = user.fullName;
        user.fullName = request.requestData.fullName || request.requestData.newFullName;
        await user.save({ transaction: t });

        await t.commit();

        logCisoAction('NAME_CHANGE_APPROVED', `İsim değişikliği onaylandı (Çift Onay). Eski: ${oldName}, Yeni: ${user.fullName}`, ip);
      } else {
        await request.save({ transaction: t });
        await t.commit();
      }
    } else if (request.type === 'USERNAME_CHANGE') {
      const user = await User.findByPk(request.targetId, { transaction: t });
      if (!user) {
        await t.rollback();
        return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      }

      const oldUsername = user.username;
      const isApproved = (received.includes('CISO (E-posta)') && received.includes('CISO (Arayüz)'));

      if (isApproved) {
        request.status = 'approved';
        await request.save({ transaction: t });

        user.username = request.requestData.username || request.requestData.newUsername;
        await user.save({ transaction: t });

        await t.commit();

        logCisoAction('USERNAME_CHANGE_APPROVED', `Kullanıcı adı değişikliği onaylandı (Çift Onay). Eski: ${oldUsername}, Yeni: ${user.username}`, ip);
      } else {
        await request.save({ transaction: t });
        await t.commit();
      }
    } else if (request.type === 'MODE_CHANGE') {
      const isApproved = doubleApprovalEnabled
        ? (received.includes('Yönetici (E-posta)') && received.includes('Yönetici (Arayüz)'))
        : true;

      if (isApproved) {
        request.status = 'approved';
        await request.save({ transaction: t });

        const record = await SystemSettings.findByPk('deployment_mode', { transaction: t }) || await SystemSettings.create({ key: 'deployment_mode', value: { mode: 'single_pc' } }, { transaction: t });
        record.value = { mode: request.requestData.mode };
        record.changed('value', true);
        await record.save({ transaction: t });

        await t.commit();

        logAction('MODE_CHANGE', req.user.id, req.user.fullName, null, 'System', `Sistem modu ${request.requestData.mode} olarak değiştirildi.`, ip);
      } else {
        await request.save({ transaction: t });
        await t.commit();
      }
    } else if (request.type === 'USER_DELETION') {
      // CISO kullanıcı silme onayı veremez
      if (req.user.role === 'ciso') {
        await t.rollback();
        return res.status(403).json({ error: 'Kullanıcı silme onayını sadece Sistem Yöneticisi (Admin) verebilir.' });
      }

      const user = await User.findByPk(request.targetId, { transaction: t });
      if (!user) {
        request.status = 'approved';
        await request.save({ transaction: t });
        await t.commit();
        return res.status(200).json({ message: 'Silinecek kullanıcı zaten bulunmuyor.', status: 'approved' });
      }

      // Sadece admin-spesifik imza kullan (genel imzayı temizle)
      const adminSignature = `Admin (${req.user.fullName || req.user.username})`;
      // Genel blokta eklenen generic imzaları kaldır
      const cleanReceived = (request.approvalsReceived || []).filter(s => 
        !s.includes('Yönetici (Arayüz)') && !s.includes('Yönetici (E-posta)')
      );
      if (!cleanReceived.includes(adminSignature)) {
        cleanReceived.push(adminSignature);
      }
      request.approvalsReceived = cleanReceived;
      request.changed('approvalsReceived', true);

      const uniqueApprovers = [...new Set(cleanReceived)];
      if (uniqueApprovers.length >= request.approvalsRequired) {
        request.status = 'approved';
        await request.save({ transaction: t });

        await user.destroy({ transaction: t });

        await t.commit();
        logAction('DELETE_USER_APPROVED', req.user.id, req.user.fullName, user.id, user.fullName, `Kullanıcı tüm yöneticilerin ortak kararıyla silindi.`, ip);
      } else {
        await request.save({ transaction: t });
        await t.commit();
      }
    }

    // Onaylanan talep güncel kullanıcının kendi talebiyse, güncel JWT tokenını oluşturup dön
    let responseToken = null;
    if (request.targetId === req.user.id) {
      const updatedUser = await User.findByPk(req.user.id);
      responseToken = jwt.sign(
        { id: updatedUser.id, username: updatedUser.username, role: updatedUser.role, fullName: updatedUser.fullName, email: updatedUser.email },
        JWT_SECRET,
        { expiresIn: '12h' }
      );
    }

    res.status(200).json({ message: 'Talep onaylandı.', status: request.status, token: responseToken });
  } catch (error) {
    console.error('[APPROVAL_APPROVE_ERR]', error.message);
    res.status(500).json({ error: 'Onaylama başarısız.' });
  }
});

// ============================================================
// POST /api/auth/approvals/:id/reject — Talebi Doğrudan Reddet (Arayüzden)
// ============================================================
router.post('/approvals/:id/reject', verifyToken, async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (req.user.role !== 'admin' && req.user.role !== 'ciso') {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
  }

  try {
    const request = await ApprovalRequest.findByPk(req.params.id);
    if (!request || request.status !== 'pending') {
      return res.status(404).json({ error: 'Onay talebi bulunamadı.' });
    }

    request.status = 'rejected';
    await request.save();

    if (request.type === 'STANDARD_USER_CREATION' || request.type === 'ADMIN_CREATION') {
      const user = await User.findByPk(request.targetId);
      if (user) {
        user.status = 'rejected';
        await user.save();
        logAction('REJECT_USER', req.user.id, req.user.fullName, user.id, user.fullName, `Kullanıcı kayıt talebi reddedildi.`, ip);
      }
    } else if (request.type === 'NAME_CHANGE') {
      logCisoAction('NAME_CHANGE_REJECTED', `CISO, admin ${request.targetId} isim değişikliği talebini reddetti.`, ip);
    } else if (request.type === 'USERNAME_CHANGE') {
      logCisoAction('USERNAME_CHANGE_REJECTED', `CISO, admin ${request.targetId} kullanıcı adı değişikliği talebini reddetti.`, ip);
    } else if (request.type === 'MODE_CHANGE') {
      logAction('MODE_CHANGE_REJECTED', req.user.id, req.user.fullName, null, 'System', `Mod değişikliği talebi reddedildi.`, ip);
    } else if (request.type === 'USER_DELETION') {
      logAction('DELETE_USER_REJECTED', req.user.id, req.user.fullName, request.targetId, request.requestData?.fullName || 'Bilinmeyen Kullanıcı', `Kullanıcı silme talebi yöneticilerden biri tarafından reddedildi.`, ip);
    }

    res.status(200).json({ message: 'Talep reddedildi.', status: request.status });
  } catch (error) {
    res.status(500).json({ error: 'Reddetme başarısız.' });
  }
});

// ============================================================
// POST /api/auth/demo-login — Geriye Dönük Demo Giriş
// ============================================================
router.post('/demo-login', async (req, res) => {
  try {
    const token = jwt.sign(
      { role: 'user', systemAccess: true },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.status(200).json({
      message: 'Standart kullanıcı demo girişi başarılı.',
      token
    });
  } catch (error) {
    res.status(500).json({ error: 'Demo giriş yapılamadı.' });
  }
});

// Kasa Lock Geriye Dönük Uyumluluk Rotaları
router.get('/kasa-status', async (req, res) => {
  res.status(200).json({ remainingAttempts: 3, lockoutSecondsLeft: 0 });
});

router.post('/kasa-login', async (req, res) => {
  const { username, password } = req.body;
  const settingsRecord = await SystemSettings.findByPk('kasa_settings');
  const settings = settingsRecord ? settingsRecord.value : {};
  if (username === settings.masterUsername && await bcrypt.compare(password, settings.masterPasswordHash)) {
    const token = jwt.sign({ role: 'admin', systemAccess: true }, JWT_SECRET, { expiresIn: '12h' });
    return res.status(200).json({ token });
  }
  res.status(401).json({ error: 'Kasa şifresi hatalı.' });
});

// ============================================================
// LOG DOSYASI YÖNETİM ROTALARI
// ============================================================
router.get('/log-file-status', verifyToken, async (req, res) => {
  if (req.user.role !== 'ciso' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim.' });
  }
  try {
    const fs = require('fs');
    const { SystemSettings } = require('../models');
    const record = await SystemSettings.findByPk('kasa_settings');
    let filePath = '/app/uploads/dms-audit.jsonl';
    if (record && record.value?.logFilePath) {
      filePath = record.value.logFilePath;
    }
    const exists = fs.existsSync(filePath);
    let fileSize = 0;
    if (exists) {
      const stats = fs.statSync(filePath);
      fileSize = stats.size;
    }
    res.status(200).json({ 
      exists, 
      path: filePath,
      fileSize,
      note: 'Bu yol Docker konteyneri içindeki dahili yoldur. Dosyayı bilgisayarınıza indirmek için "Log Dosyasını İndir" butonunu kullanın.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Log dosyası durumu alınamadı.' });
  }
});

// Log dosyasını doğrudan indirme
router.get('/log-file-download', verifyToken, async (req, res) => {
  if (req.user.role !== 'ciso' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim.' });
  }
  try {
    const fs = require('fs');
    const pathModule = require('path');
    const { SystemSettings } = require('../models');
    const record = await SystemSettings.findByPk('kasa_settings');
    let filePath = '/app/uploads/dms-audit.jsonl';
    if (record && record.value?.logFilePath) {
      filePath = record.value.logFilePath;
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Log dosyası bulunamadı.' });
    }
    const fileName = pathModule.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/jsonl');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Log dosyası indirilemedi.' });
  }
});

router.post('/create-log-file', verifyToken, async (req, res) => {
  if (req.user.role !== 'ciso' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim.' });
  }
  try {
    const fs = require('fs');
    const { SystemSettings } = require('../models');
    const record = await SystemSettings.findByPk('kasa_settings') || await SystemSettings.create({ key: 'kasa_settings', value: {} });
    let path = record.value?.logFilePath || '/app/uploads/dms-audit.jsonl';
    
    fs.writeFileSync(path, '');
    
    const { logAction } = require('../utils/auditLogger');
    logAction('LOG_FILE_CREATED', req.user.id, req.user.fullName, null, null, `Yeni log dosyası oluşturuldu: ${path}`, req.ip);

    res.status(200).json({ message: 'Log dosyası başarıyla oluşturuldu.', path });
  } catch (err) {
    res.status(500).json({ error: 'Log dosyası oluşturulamadı.', details: err.message });
  }
});

router.post('/import-log-file', verifyToken, async (req, res) => {
  if (req.user.role !== 'ciso' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim.' });
  }
  const { filePath } = req.body;
  if (!filePath) {
    return res.status(400).json({ error: 'Dosya yolu gereklidir.' });
  }
  try {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Belirtilen dosya bulunamadı. Lütfen yolu kontrol edin.' });
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    const parsedLogs = [];
    for (let i = 0; i < lines.length; i++) {
      try {
        const log = JSON.parse(lines[i]);
        if (!log.action || !log.userName) {
          throw new Error('Eksik alanlar');
        }
        parsedLogs.push(log);
      } catch (parseErr) {
        return res.status(400).json({ error: `Geçersiz log formatı. Satır: ${i + 1} geçerli bir log satırı değil.` });
      }
    }
    
    const { SystemSettings, AuditLog } = require('../models');
    const record = await SystemSettings.findByPk('kasa_settings') || await SystemSettings.create({ key: 'kasa_settings', value: {} });
    const val = record.value || {};
    val.logFilePath = filePath;
    record.value = val;
    record.changed('value', true);
    await record.save();

    for (const log of parsedLogs) {
      await AuditLog.findOrCreate({
        where: {
          action: log.action,
          createdAt: new Date(log.createdAt),
          details: log.details || ''
        },
        defaults: {
          userId: log.userId || null,
          userName: log.userName,
          documentId: log.documentId || null,
          documentName: log.documentName || null,
          ipAddress: log.ipAddress || null
        }
      });
    }

    const { logAction } = require('../utils/auditLogger');
    logAction('LOG_FILE_IMPORTED', req.user.id, req.user.fullName, null, null, `Dosya içe aktarıldı ve aktif log dosyası yapıldı: ${filePath}`, req.ip);

    res.status(200).json({ message: 'Log dosyası başarıyla içe aktarıldı ve aktif olarak ayarlandı.' });
  } catch (err) {
    res.status(500).json({ error: 'Log dosyası yüklenirken hata oluştu.', details: err.message });
  }
});
// ============================================================
// ŞİFREMI UNUTTUM RATE LIMITER
// ============================================================
const forgotPasswordAttempts = new Map();

function checkForgotPasswordRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  let record = forgotPasswordAttempts.get(ip);
  
  if (record && now >= record.nextAllowedTime) {
     if (record.currentPenaltyMins >= 1440) {
         record = null;
         forgotPasswordAttempts.delete(ip);
     }
  }

  if (!record) {
    forgotPasswordAttempts.set(ip, { count: 1, nextAllowedTime: now + 60 * 1000, currentPenaltyMins: 1 });
    return next();
  }
  
  if (now < record.nextAllowedTime) {
    const waitMs = record.nextAllowedTime - now;
    const waitMins = Math.ceil(waitMs / 60000);
    let timeStr = `${waitMins} dakika`;
    if (waitMins >= 60) {
       const h = Math.floor(waitMins / 60);
       const m = waitMins % 60;
       timeStr = `${h} saat ${m > 0 ? m + ' dakika' : ''}`.trim();
    }
    return res.status(429).json({ error: `Güvenlik nedeniyle geçici olarak engellendiniz. Lütfen ${timeStr} sonra tekrar deneyin.` });
  }
  
  record.count += 1;
  let nextWaitMins = Math.pow(2, record.count - 1);
  if (nextWaitMins >= 1440) {
      nextWaitMins = 1440; 
  }
  
  record.currentPenaltyMins = nextWaitMins;
  record.nextAllowedTime = now + nextWaitMins * 60 * 1000;
  return next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of forgotPasswordAttempts.entries()) {
    if (now > record.nextAllowedTime + 24 * 60 * 60 * 1000) {
      forgotPasswordAttempts.delete(ip);
    }
  }
}, 60 * 60 * 1000);

// ============================================================
// ŞİFREMI UNUTTUM - IPUCU SORGULAMA
// ============================================================
router.post('/forgot-password-hint', checkForgotPasswordRateLimit, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-posta adresi gereklidir.' });
  try {
    const user = await User.findOne({ where: { email, status: 'active' } });
    if (!user) {
      return res.status(400).json({ error: 'Bu e-posta adresi ile kayıtlı aktif bir kullanıcı bulunamadı.' });
    }
    return res.status(200).json({ 
      hint: user.passwordHint || 'Tanımlanmış bir şifre ipucunuz bulunmuyor.' 
    });
  } catch (err) {
    return res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// ============================================================
// ŞİFREMI UNUTTUM - SIFIRLAMA MAİLİ GÖNDERME
// ============================================================
router.post('/forgot-password-email', checkForgotPasswordRateLimit, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-posta adresi gereklidir.' });
  try {
    const user = await User.findOne({ where: { email, status: 'active' } });
    if (!user) {
      return res.status(400).json({ error: 'Bu e-posta adresi ile kayıtlı aktif bir kullanıcı bulunamadı.' });
    }

    const settingsRecord = await SystemSettings.findByPk('kasa_settings');
    const settings = settingsRecord ? settingsRecord.value : {};
    if (!settings.smtpConfig?.auth?.user || !settings.smtpConfig?.auth?.pass) {
      return res.status(400).json({ error: 'Sistem SMTP ayarları yapılandırılmamış. Lütfen yöneticiyle iletişime geçin.' });
    }

    const token = uuidv4();
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 Saat

    await ApprovalRequest.create({
      type: 'PASSWORD_RESET',
      targetId: user.id,
      requestData: { email: user.email, expiresAt },
      approvalsRequired: 1,
      approvalsReceived: [],
      status: 'pending',
      token
    });

    const transporter = getMailTransporter(settings.smtpConfig);
    const fromUser = settings.smtpConfig.auth.user;
    const resetLink = `http://localhost/api/auth/reset-password-page?token=${token}`;

    await transporter.sendMail({
      from: `"DMS Güvenlik Portalı" <${fromUser}>`,
      to: user.email,
      subject: 'DMS On-Premise - Şifre Sıfırlama Talebi',
      html: `
        <div style="font-family: sans-serif; padding: 2.5rem; background: #0f172a; color: #fff; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid rgba(139, 92, 246, 0.2);">
          <h2 style="color: #a78bfa; margin-top:0;">Şifrenizi Sıfırlayın</h2>
          <p style="color: #9ca3af; line-height: 1.5;">DMS On-Premise hesabınız için şifre sıfırlama talebi aldık. Aşağıdaki butona tıklayarak yeni şifrenizi güvenle belirleyebilirsiniz:</p>
          <div style="margin: 2rem 0; text-align: center;">
            <a href="${resetLink}" style="background: linear-gradient(135deg, #8b5cf6, #6366f1); color: #fff; padding: 0.9rem 2rem; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(99,102,241,0.4); display: inline-block;">Yeni Şifre Belirle</a>
          </div>
          <p style="font-size: 0.8rem; color: #6b7280; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 1rem; margin-top: 2rem;">Eğer bu talebi siz yapmadıysanız bu e-postayı dikkate almayınız. Bu onay linki 1 saat geçerlidir.</p>
        </div>
      `
    });

    logAction('PASSWORD_RESET_REQUESTED', user.id, user.fullName, null, null, `Şifre sıfırlama talebi gönderildi: ${user.email}`, req.ip);
    return res.status(200).json({ message: 'Şifre sıfırlama linki e-posta adresinize gönderildi.' });
  } catch (err) {
    console.error('[RESET_EMAIL_ERR]', err.message);
    return res.status(500).json({ error: 'Şifre sıfırlama postası gönderilirken hata oluştu.', details: err.message });
  }
});

// ============================================================
// GET /api/auth/reset-password-page — Şifre Sıfırlama Sayfası (HTML)
// ============================================================
router.get('/reset-password-page', async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send('<h1>Hata: Geçersiz şifre sıfırlama kodu</h1>');
  }

  try {
    const request = await ApprovalRequest.findOne({ where: { token, type: 'PASSWORD_RESET', status: 'pending' } });
    if (!request || request.requestData?.expiresAt < Date.now()) {
      return res.status(400).send('<h1>Hata: Şifre sıfırlama talebinin süresi dolmuş veya geçersiz.</h1>');
    }

    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DMS On-Premise - Şifre Sıfırlama</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: #030712;
            color: #f3f4f6;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .card {
            background: rgba(17, 24, 39, 0.8);
            border: 1.5px solid rgba(139, 92, 246, 0.25);
            backdrop-filter: blur(16px);
            border-radius: 16px;
            padding: 2.5rem;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.7);
            text-align: center;
          }
          h2 {
            color: #a78bfa;
            margin-top: 0;
            font-size: 1.45rem;
            font-weight: 800;
          }
          p {
            color: #9ca3af;
            font-size: 0.85rem;
            margin-bottom: 2rem;
          }
          .form-group {
            text-align: left;
            margin-bottom: 1.25rem;
            position: relative;
          }
          label {
            display: block;
            font-size: 0.75rem;
            font-weight: 700;
            color: #9ca3af;
            margin-bottom: 0.45rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
          }
          input {
            width: 100%;
            background: rgba(15, 23, 42, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 8px;
            padding: 0.75rem 2.5rem 0.75rem 0.75rem;
            color: #fff;
            font-size: 0.9rem;
            outline: none;
            box-sizing: border-box;
          }
          input:focus {
            border-color: #8b5cf6;
            box-shadow: 0 0 10px rgba(139, 92, 246, 0.2);
          }
          .btn-eye {
            position: absolute;
            right: 10px;
            background: transparent;
            border: none;
            color: #a78bfa;
            cursor: pointer;
            font-size: 1rem;
            opacity: 0.7;
          }
          .btn-eye:hover {
            opacity: 1;
          }
          .info-trigger {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 14px;
            height: 14px;
            background: rgba(255,255,255,0.15);
            color: #a78bfa;
            border-radius: 50%;
            font-size: 0.65rem;
            font-weight: bold;
            cursor: pointer;
            margin-left: 0.35rem;
          }
          .info-tooltip {
            display: none;
            position: absolute;
            background: #1e1b4b;
            border: 1px solid rgba(167, 139, 250, 0.3);
            border-radius: 6px;
            padding: 0.65rem;
            width: 250px;
            z-index: 10;
            color: #cbd5e1;
            font-size: 0.72rem;
            top: 25px;
            left: 0;
            box-shadow: 0 10px 15px rgba(0,0,0,0.5);
            line-height: 1.4;
          }
          .info-trigger:hover + .info-tooltip, .info-tooltip:hover {
            display: block;
          }
          .btn-submit {
            background: linear-gradient(135deg, #8b5cf6, #6366f1);
            color: #fff;
            border: none;
            border-radius: 8px;
            padding: 0.85rem;
            width: 100%;
            font-weight: 700;
            font-size: 0.92rem;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            transition: all 0.2s ease;
            margin-top: 1rem;
          }
          .btn-submit:hover {
            box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
            transform: translateY(-1px);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>🔒 Şifrenizi Yenileyin</h2>
          <p>Lütfen DMS On-Premise hesabınız için belirlemek istediğiniz yeni şifreyi girin.</p>
          
          <form action="/api/auth/reset-password-submit" method="POST">
            <input type="hidden" name="token" value="${token}" />
            
            <div class="form-group">
              <div style="display:flex; align-items:center; margin-bottom: 0.45rem; position: relative;">
                <label>Yeni Şifre</label>
                <span class="info-trigger">i</span>
                <div class="info-tooltip">
                  Şifreniz en az 8 karakter uzunluğunda olmalı; en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter (!@#$%^&*) içermelidir.
                </div>
              </div>
              <div class="input-wrapper">
                <input type="password" name="password" id="password" required placeholder="••••••••" />
                <button type="button" class="btn-eye" onclick="togglePass('password')">👁️</button>
              </div>
            </div>

            <div class="form-group">
              <label>Şifreyi Doğrula</label>
              <div class="input-wrapper">
                <input type="password" name="confirmPassword" id="confirmPassword" required placeholder="••••••••" />
                <button type="button" class="btn-eye" onclick="togglePass('confirmPassword')">👁️</button>
              </div>
            </div>

            <button type="submit" class="btn-submit">Şifreyi Güncelle</button>
          </form>
        </div>

        <script>
          function togglePass(id) {
            const input = document.getElementById(id);
            if (input.type === 'password') {
              input.type = 'text';
            } else {
              input.type = 'password';
            }
          }
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('<h1>Şifre sıfırlama sayfası yüklenirken hata oluştu.</h1>');
  }
});

// ============================================================
// POST /api/auth/reset-password-submit — Yeni Şifreyi Kaydet ve Otomatik Giriş Yaptır
// ============================================================
router.post('/reset-password-submit', async (req, res) => {
  const { token, password, confirmPassword } = req.body;
  if (!token || !password || !confirmPassword) {
    return res.status(400).send('<h1>Hata: Tüm alanlar zorunludur.</h1>');
  }

  if (password !== confirmPassword) {
    return res.status(400).send('<h1>Hata: Şifreler uyuşmuyor.</h1>');
  }

  // Şifre kuralları
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).send('<h1>Hata: Şifre güvenlik kurallarına uygun değil (En az 8 karakter, büyük-küçük harf, rakam ve özel karakter içermelidir).</h1>');
  }

  const t = await sequelize.transaction();
  try {
    const request = await ApprovalRequest.findOne({ 
      where: { token, type: 'PASSWORD_RESET', status: 'pending' },
      transaction: t
    });

    if (!request || request.requestData?.expiresAt < Date.now()) {
      await t.rollback();
      return res.status(400).send('<h1>Hata: Geçersiz veya süresi dolmuş sıfırlama kodu.</h1>');
    }

    const user = await User.findByPk(request.targetId, { transaction: t });
    if (!user) {
      await t.rollback();
      return res.status(404).send('<h1>Hata: Kullanıcı bulunamadı.</h1>');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    user.passwordHash = passwordHash;
    await user.save({ transaction: t });

    request.status = 'consumed';
    await request.save({ transaction: t });

    await t.commit();

    // Otomatik login için JWT token üretelim
    const jwtToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullName: user.fullName, email: user.email },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    logAction('PASSWORD_RESET_SUCCESSFUL', user.id, user.fullName, null, null, `E-posta üzerinden şifre başarıyla yenilendi: ${user.email}`, req.ip);

    // Otomatik giriş yapacak şık başarılı ekranı dönüyoruz!
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Şifre Güncellendi</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: #030712;
            color: #f3f4f6;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .card {
            background: rgba(17, 24, 39, 0.8);
            border: 1.5px solid #10b981;
            backdrop-filter: blur(16px);
            border-radius: 16px;
            padding: 2.5rem;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.7);
            text-align: center;
          }
          h2 {
            color: #34d399;
            margin-top: 0;
            font-size: 1.45rem;
          }
          p {
            color: #9ca3af;
            font-size: 0.85rem;
            line-height: 1.5;
            margin-bottom: 2rem;
          }
          .btn-login {
            background: linear-gradient(135deg, #10b981, #059669);
            color: #fff;
            border: none;
            border-radius: 8px;
            padding: 0.9rem;
            width: 100%;
            font-weight: 700;
            font-size: 0.92rem;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            transition: all 0.2s ease;
            text-decoration: none;
            display: block;
            box-sizing: border-box;
            margin-bottom: 0.75rem;
          }
          .btn-login:hover {
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
            transform: translateY(-1px);
          }
          .btn-mail {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #cbd5e1;
            border-radius: 8px;
            padding: 0.85rem;
            width: 100%;
            font-weight: 700;
            font-size: 0.9rem;
            cursor: pointer;
            text-decoration: none;
            display: block;
            box-sizing: border-box;
          }
          .btn-mail:hover {
            background: rgba(255, 255, 255, 0.1);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>✓ Şifre Değiştirildi!</h2>
          <p>Yeni şifreniz başarıyla kaydedilmiştir. Aşağıdaki butona tıklayarak doğrudan sisteme giriş yapabilirsiniz.</p>
          
          <button class="btn-login" onclick="autoLogin()">Sisteme Giriş Yap ve Oturumu Aç</button>
          <a href="https://mail.google.com" target="_blank" class="btn-mail">Mail Hesabıma Git</a>
        </div>

        <script>
          function autoLogin() {
            // JWT Tokenı localStorage'a yazarak anında oturum açıyoruz
            localStorage.setItem('token', '${jwtToken}');
            localStorage.setItem('kasa_token', '${jwtToken}');
            
            // Kullanıcı bilgilerini de yazalım
            const userObj = {
              id: '${user.id}',
              fullName: '${user.fullName}',
              username: '${user.username}',
              role: '${user.role}',
              email: '${user.email}'
            };
            localStorage.setItem('currentUser', JSON.stringify(userObj));
            
            // Kasa kilit durumunu kaldır ve ana siteye yönlendir
            window.location.href = 'http://' + window.location.hostname;
          }
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    if (t) await t.rollback();
    res.status(500).send('<h1>Şifre güncellenirken hata oluştu.</h1>');
  }
});

module.exports = router;
