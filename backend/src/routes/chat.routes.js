const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Message, User, SystemSettings, Document } = require('../models');
const { verifyToken } = require('../middleware/auth.middleware');
const { logAction } = require('../utils/auditLogger');
const { logCisoAction } = require('../utils/cisoLogger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Global oda için sabit UUID (DB'de room_id UUID tipinde)
const GLOBAL_ROOM_ID = '00000000-0000-0000-0000-000000000001';

const DANGEROUS_EXTENSIONS = [
  '.exe', '.apk', '.bat', '.cmd', '.sh', '.vbs', '.js', '.jar', '.msi', 
  '.ps1', '.com', '.scr', '.hta', '.dll', '.bin', '.iso', '.deb', '.rpm', 
  '.appimage', '.pif', '.reg', '.wsf', '.cpl', '.action', '.command'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return cb(new Error('Güvenlik Protokolü Engeli: Çalıştırılabilir ve zararlı kod içerebilecek (.exe, .apk, .bat, .sh vb.) dosyaların kapalı ağ transferi yasaktır.'), false);
  }
  cb(null, true);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = '/app/uploads/chat';
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB Max
  fileFilter
});
// Tüm chat rotaları korumalıdır
router.use(verifyToken);

// ============================================================
// GET /api/chat/mode — Sistem çalışma modunu döndür
// ============================================================
router.get('/mode', async (req, res) => {
  try {
    const record = await SystemSettings.findByPk('deployment_mode');
    const rawMode = record?.value?.mode || 'single_pc';
    // Frontend'e tutarlı mod adı döndür
    const mode = rawMode === 'network_sync' ? 'network' : 'standalone';
    res.json({ success: true, mode });
  } catch (error) {
    res.json({ success: true, mode: 'standalone' });
  }
});

// ============================================================
// GET /api/chat/users — Sohbet kişileri listesi
// ============================================================
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'fullName', 'username', 'status']
    });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: 'Kullanıcı listesi alınamadı.' });
  }
});

// ============================================================
// GET /api/chat/history/:target — Mesaj / Not geçmişi
// ============================================================
router.get('/history/:target', async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const target = req.params.target;
    const now = new Date();

    let messages = [];

    // Zamanlanmış mesajlar: sadece zamanı gelmiş olanlar VEYA kullanıcının KENDİ gönderdikleri (henüz gitmemiş olsa bile)
    const deliveredCondition = {
      [Op.or]: [
        { scheduled_at: null },
        { scheduled_at: { [Op.lte]: now } },
        { sender_id: currentUserId } // Kendi zamanlanmış mesajlarını görebilsin
      ]
    };

    if (target === 'global') {
      messages = await Message.findAll({
        where: {
          room_id: GLOBAL_ROOM_ID,
          ...deliveredCondition
        },
        include: [
          { model: User, as: 'sender', attributes: ['id', 'username', 'fullName'] }
        ],
        order: [['created_at', 'ASC']],
        limit: 200
      });
    } else {
      const targetUser = await User.findByPk(target);
      if (!targetUser) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      }

      messages = await Message.findAll({
        where: {
          [Op.and]: [
            {
              [Op.or]: [
                { sender_id: currentUserId, receiver_id: target },
                { sender_id: target, receiver_id: currentUserId }
              ]
            },
            deliveredCondition
          ]
        },
        include: [
          { model: User, as: 'sender', attributes: ['id', 'username', 'fullName'] },
          { model: User, as: 'receiver', attributes: ['id', 'username', 'fullName'] }
        ],
        order: [['created_at', 'ASC']],
        limit: 200
      });
    }

    // Süresi dolmuş mesajları kontrol et ve güncelle
    for (const msg of messages) {
      if (msg.expires_at && new Date(msg.expires_at) <= now && !msg.is_expired) {
        msg.is_expired = true;
        msg.content = '[Bu içeriğin süresi doldu]';
        msg.media_url = null;
        msg.file_url = null;
        await msg.save();
      }
    }

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('[CHAT_API_ERR] Mesaj geçmişi alınamadı:', error);
    res.status(500).json({ error: 'Mesaj geçmişi alınırken sunucu hatası oluştu.' });
  }
});

// ============================================================
// POST /api/chat/send — Standalone Mod (Tek PC) için Not/Mesaj Gönderimi
// ============================================================
router.post('/send', async (req, res) => {
  try {
    const { receiverId, roomId, content, scheduledAt, mediaUrl, mediaType, isViewOnce, expiresIn } = req.body;
    const senderId = req.user.id;

    if (!content && !mediaUrl && (!receiverId && !roomId)) {
      return res.status(400).json({ error: 'Eksik parametreler.' });
    }

    const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();

    // 'global' string'ini gerçek UUID'ye çevir
    const resolvedRoomId = roomId === 'global' ? GLOBAL_ROOM_ID : (roomId || null);

    const newMessage = await Message.create({
      sender_id: senderId,
      receiver_id: receiverId || null,
      room_id: resolvedRoomId,
      content: content || '',
      type: 'note',
      media_url: mediaUrl || null,
      media_type: mediaType || null,
      scheduled_at: isScheduled ? new Date(scheduledAt) : null,
      is_delivered: !isScheduled,
      is_view_once: isViewOnce || false,
      expires_at: expiresIn ? new Date(Date.now() + expiresIn) : null,
    });

    const populatedMessage = await Message.findByPk(newMessage.id, {
      include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'fullName'] }]
    });

    // GENEL LOG: Sadece metadata (metin içeriği YOK)
    const targetLabel = roomId === 'global' ? 'Sistem Odası' : (receiverId || 'bilinmiyor');
    logAction(
      req,
      'MESAJ_GONDERILDI',
      null,
      null,
      `${req.user.fullName || req.user.username} -> ${targetLabel} (${isScheduled ? 'Zamanlanmış' : 'Anlık'} not)`
    );

    // CISO LOG: Tam içerik (sadece CISO erişebilir)
    logCisoAction('MESAJ_ICERIK_DETAY', {
      senderId,
      senderName: req.user.fullName || req.user.username,
      targetId: receiverId || roomId,
      targetType: roomId ? 'room' : 'user',
      contentPreview: content,
      scheduledAt: scheduledAt || null,
      messageId: newMessage.id,
    }, req.ip);

    res.json({ success: true, data: populatedMessage });
  } catch (error) {
    console.error('[CHAT_API_ERR] Not gönderilemedi:', error);
    res.status(500).json({ error: 'Not gönderilirken sunucu hatası oluştu.' });
  }
});

// ============================================================
// POST /api/chat/upload — Chat Medya/Dosya Yükleme (50MB Sınır + CISO Koruma)
// ============================================================
router.post('/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Dosya boyutu maksimum 50MB sınırını aşamaz.' });
      }
      return res.status(400).json({ error: `Yükleme hatası: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Lütfen yüklenecek geçerli bir dosya seçin.' });
    }

    const mediaUrl = `/api/chat/media/${req.file.filename}`;
    
    let mediaType = 'document';
    const mime = req.file.mimetype || '';
    if (mime.startsWith('image/')) mediaType = 'image';
    else if (mime.startsWith('audio/') || mime.startsWith('video/')) mediaType = 'audio';

    // CISO Transfer Güvenlik Logu
    logCisoAction('DOSYA_YUKLENDI', {
      userId: req.user ? req.user.id : null,
      userName: req.user ? (req.user.fullName || req.user.username) : 'Bilinmiyor',
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: mime,
      mediaUrl
    }, req.ip);

    res.json({
      success: true,
      url: mediaUrl,
      file_url: mediaUrl,
      type: mediaType,
      file_type: mediaType,
      name: req.file.originalname,
      file_name: req.file.originalname,
      size: req.file.size,
      file_size: req.file.size
    });
  });
});

// ============================================================
// GET /api/chat/media/:filename — Medya/Dosya İndirme & İnceleme (JWT & CISO Korumalı)
// ============================================================
router.get('/media/:filename', async (req, res) => {
  const filePath = path.join('/app/uploads/chat', req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Dosya bulunamadı.' });
  }

  // View-once kontrolü: Bu dosyaya ait mesajı bul
  const mediaPath = `/api/chat/media/${req.params.filename}`;
  const msg = await Message.findOne({ where: { [Op.or]: [{ media_url: mediaPath }, { file_url: mediaPath }] } });

  if (msg && msg.is_expired) {
    return res.status(410).json({ error: 'Bu içerik süresi dolduğu için artık erişilemez.' });
  }

  logCisoAction('DOSYA_INDIRILDI', {
    userId: req.user ? req.user.id : null,
    userName: req.user ? (req.user.fullName || req.user.username) : 'Anonim',
    filename: req.params.filename
  }, req.ip);

  // View-once: İlk görüntülemeden sonra imha et
  if (msg && msg.is_view_once && !msg.is_expired && msg.sender_id !== (req.user ? req.user.id : null)) {
    msg.is_expired = true;
    await msg.save();

    logCisoAction('SURELI_ICERIK_IMHA', {
      userId: req.user ? req.user.id : null,
      userName: req.user ? (req.user.fullName || req.user.username) : 'Bilinmiyor',
      messageId: msg.id,
      fileName: msg.file_name || req.params.filename,
      reason: '1 kez görüntüleme hakkı kullanıldı'
    }, req.ip);

    // Fiziksel dosyayı sil (CISO kuralı: üstveri logda kalır)
    setTimeout(() => {
      try { fs.unlinkSync(filePath); } catch(e) {}
    }, 5000);
  }

  res.sendFile(filePath);
});

// ============================================================
// DELETE /api/chat/scheduled/:id — Zamanlanmış mesajı sil/iptal et
// ============================================================
router.delete('/scheduled/:id', async (req, res) => {
  try {
    const messageId = req.params.id;
    const currentUserId = req.user.id;

    const msg = await Message.findByPk(messageId);
    if (!msg) {
      return res.status(404).json({ error: 'Mesaj bulunamadı.' });
    }

    // Sadece kendi mesajını silebilir
    if (msg.sender_id !== currentUserId) {
      return res.status(403).json({ error: 'Bu mesajı silme yetkiniz yok.' });
    }

    // Sadece henüz iletilmemiş zamanlanmış mesajlar silinebilir
    if (msg.is_delivered) {
      return res.status(400).json({ error: 'Zaten iletilmiş bir mesaj silinemez.' });
    }

    await msg.destroy();

    logAction(
      req,
      'ZAMANLANMIS_MESAJ_SILINDI',
      null,
      null,
      `${req.user.fullName || req.user.username} zamanlanmış mesajı sildi (ID: ${messageId})`
    );

    res.json({ success: true, message: 'Zamanlanmış mesaj silindi.' });
  } catch (error) {
    console.error('[CHAT_API_ERR] Zamanlanmış mesaj silinemedi:', error);
    res.status(500).json({ error: 'Silme işlemi sırasında sunucu hatası.' });
  }
});

// ============================================================
// PUT /api/chat/message/:id — Mesaj düzenleme (ilk 2 dakika)
// ============================================================
router.put('/message/:id', async (req, res) => {
  try {
    const messageId = req.params.id;
    const currentUserId = req.user.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Mesaj içeriği boş olamaz.' });
    }

    const msg = await Message.findByPk(messageId);
    if (!msg) return res.status(404).json({ error: 'Mesaj bulunamadı.' });
    if (msg.sender_id !== currentUserId) return res.status(403).json({ error: 'Bu mesajı düzenleme yetkiniz yok.' });
    if (msg.is_deleted) return res.status(400).json({ error: 'Silinmiş mesaj düzenlenemez.' });

    // 2 dakika kuralı
    const twoMinutes = 2 * 60 * 1000;
    const elapsed = Date.now() - new Date(msg.created_at).getTime();
    if (elapsed > twoMinutes) {
      return res.status(400).json({ error: 'Düzenleme süresi doldu (maks. 2 dakika).' });
    }

    const oldContent = msg.content;

    msg.content = content.trim();
    msg.is_edited = true;
    msg.edited_at = new Date();
    await msg.save();

    // GENEL LOG: metin yok
    logAction(req, 'MESAJ_DUZENLENDI', null, null,
      `${req.user.fullName || req.user.username} mesajı düzenledi (ID: ${messageId})`);

    // CISO LOG: tam içerik (eski + yeni)
    logCisoAction('MESAJ_DUZENLENDI', {
      senderId: currentUserId,
      senderName: req.user.fullName || req.user.username,
      messageId,
      oldContent,
      newContent: content.trim(),
    }, req.ip);

    const updated = await Message.findByPk(messageId, {
      include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'fullName'] }]
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[CHAT_API_ERR] Mesaj düzenlenemedi:', error);
    res.status(500).json({ error: 'Düzenleme sırasında sunucu hatası.' });
  }
});

// ============================================================
// DELETE /api/chat/message/:id — Mesaj silme (soft delete)
// ============================================================
router.delete('/message/:id', async (req, res) => {
  try {
    const messageId = req.params.id;
    const currentUserId = req.user.id;

    const msg = await Message.findByPk(messageId);
    if (!msg) return res.status(404).json({ error: 'Mesaj bulunamadı.' });
    if (msg.sender_id !== currentUserId) return res.status(403).json({ error: 'Bu mesajı silme yetkiniz yok.' });
    if (msg.is_deleted) return res.status(400).json({ error: 'Mesaj zaten silinmiş.' });

    const deletedContent = msg.content;

    msg.content = '';
    msg.is_deleted = true;
    msg.media_url = null;
    msg.media_type = null;
    await msg.save();

    // GENEL LOG: metin yok
    logAction(req, 'MESAJ_SILINDI', null, null,
      `${req.user.fullName || req.user.username} mesajı sildi (ID: ${messageId})`);

    // CISO LOG: silinen metin
    logCisoAction('MESAJ_SILINDI', {
      senderId: currentUserId,
      senderName: req.user.fullName || req.user.username,
      messageId,
      deletedContent,
    }, req.ip);

    res.json({ success: true, message: 'Mesaj silindi.' });
  } catch (error) {
    console.error('[CHAT_API_ERR] Mesaj silinemedi:', error);
    res.status(500).json({ error: 'Silme sırasında sunucu hatası.' });
  }
});

// ============================================================
// PUT /api/chat/scheduled/:id — Zamanlanmış mesajı düzenle
// ============================================================
router.put('/scheduled/:id', async (req, res) => {
  try {
    const messageId = req.params.id;
    const currentUserId = req.user.id;
    const { content, scheduled_at } = req.body;

    const msg = await Message.findByPk(messageId);
    if (!msg) {
      return res.status(404).json({ error: 'Mesaj bulunamadı.' });
    }

    // Sadece kendi mesajını düzenleyebilir
    if (msg.sender_id !== currentUserId) {
      return res.status(403).json({ error: 'Bu mesajı düzenleme yetkiniz yok.' });
    }

    // Sadece henüz iletilmemiş zamanlanmış mesajlar düzenlenebilir
    if (msg.is_delivered) {
      return res.status(400).json({ error: 'Zaten iletilmiş bir mesaj düzenlenemez.' });
    }

    // Geçmiş bir tarih seçilmesini engelle
    if (scheduled_at) {
      const scheduledDate = new Date(scheduled_at);
      if (scheduledDate <= new Date()) {
        return res.status(400).json({ error: 'Zamanlanmış tarih geçmişte olamaz.' });
      }
      msg.scheduled_at = scheduled_at;
    }

    if (content !== undefined) {
      msg.content = content;
    }

    await msg.save();

    logAction(
      req,
      'ZAMANLANMIS_MESAJ_DUZENLENDI',
      null,
      null,
      `${req.user.fullName || req.user.username} zamanlanmış mesajı düzenledi (ID: ${messageId})`
    );

    res.json({ success: true, message: 'Zamanlanmış mesaj başarıyla güncellendi.', data: msg });
  } catch (error) {
    console.error('[CHAT_API_ERR] Zamanlanmış mesaj düzenlenemedi:', error);
    res.status(500).json({ error: 'Düzenleme işlemi sırasında sunucu hatası.' });
  }
});

// ============================================================
// POST /api/chat/message/:id/reaction — Reaksiyon Ekle / Kaldır
// ============================================================
router.post('/message/:id/reaction', async (req, res) => {
  try {
    const messageId = req.params.id;
    const { emoji } = req.body;
    const userId = req.user.id;
    const username = req.user.fullName || req.user.username;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji parametresi gerekli.' });
    }

    const msg = await Message.findByPk(messageId);
    if (!msg) {
      return res.status(404).json({ error: 'Mesaj bulunamadı.' });
    }

    let reactions = [];
    if (typeof msg.reactions === 'string') {
      try { reactions = JSON.parse(msg.reactions); } catch (e) {}
    } else if (Array.isArray(msg.reactions)) {
      reactions = [...msg.reactions];
    }

    const existingIdx = reactions.findIndex(r => r.userId === userId && r.emoji === emoji);

    if (existingIdx >= 0) {
      reactions.splice(existingIdx, 1); // toggle off
    } else {
      reactions.push({ userId, emoji, username });
    }

    msg.set('reactions', reactions);
    msg.changed('reactions', true);
    await msg.save();

    res.json({ success: true, reactions: msg.reactions });
  } catch (error) {
    console.error('[CHAT_API_ERR] Reaksiyon eklenemedi:', error);
    res.status(500).json({ error: 'Reaksiyon işlenirken sunucu hatası.' });
  }
});

// ============================================================
// POST /api/chat/message/:id/view-once — Tek Seferlik Mesajı Aç & İmha Et
// ============================================================
router.post('/message/:id/view-once', async (req, res) => {
  try {
    const messageId = req.params.id;
    const currentUserId = req.user.id;
    const msg = await Message.findByPk(messageId);
    if (!msg) return res.status(404).json({ error: 'Mesaj bulunamadı.' });

    if (!msg.is_view_once) {
      return res.status(400).json({ error: 'Bu mesaj tek seferlik değil.' });
    }

    if (msg.is_expired) {
      return res.status(410).json({ error: 'Bu içerik süresi dolduğu veya daha önce görüntülendiği için imha edildi.' });
    }

    // Gönderen dışındaki alıcı görüntülediğinde imha et
    if (msg.sender_id !== currentUserId) {
      msg.is_expired = true;
      await msg.save();

      const fileUrl = msg.media_url || msg.file_url;
      if (fileUrl) {
        const filename = fileUrl.split('/').pop();
        const filePath = path.join('/app/uploads/chat', filename);
        setTimeout(() => {
          try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
        }, 10000);
      }

      logCisoAction('SURELI_ICERIK_IMHA', {
        userId: currentUserId,
        userName: req.user.fullName || req.user.username,
        messageId: msg.id,
        fileName: msg.file_name || null,
        reason: '1 Kez Görüntüleme hakkı kullanıldı (Alıcı tarafından açıldı)'
      }, req.ip);

      try {
        const socketModule = require('../socket');
        const io = socketModule.getIo();
        const expireUpdate = { messageId: msg.id, is_expired: true };
        if (msg.room_id) io.to(msg.room_id).emit('message_expired', expireUpdate);
        if (msg.receiver_id) {
          io.to(msg.receiver_id).emit('message_expired', expireUpdate);
          io.to(msg.sender_id).emit('message_expired', expireUpdate);
        }
      } catch (e) {}
    }

    res.json({
      success: true,
      data: {
        id: msg.id,
        content: msg.content,
        media_url: msg.media_url,
        media_type: msg.media_type,
        file_url: msg.file_url,
        file_name: msg.file_name,
        file_type: msg.file_type,
        file_size: msg.file_size,
        is_view_once: msg.is_view_once,
        is_expired: true
      }
    });
  } catch (error) {
    console.error('[CHAT_API_ERR] View-once açılamadı:', error);
    res.status(500).json({ error: 'İçerik açılırken sunucu hatası.' });
  }
});

// ============================================================
// POST /api/chat/message/:id/archive — Chat dosyasını E-Arşive aktar
// ============================================================
router.post('/message/:id/archive', async (req, res) => {
  try {
    const messageId = req.params.id;
    const currentUserId = req.user.id;

    const msg = await Message.findByPk(messageId, {
      include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'fullName'] }]
    });
    if (!msg) return res.status(404).json({ error: 'Mesaj bulunamadı.' });

    const fileUrl = msg.media_url || msg.file_url;
    if (!fileUrl) return res.status(400).json({ error: 'Bu mesajda arşivlenecek dosya bulunmamaktadır.' });

    // Chat uploads dizinindeki dosya yolunu çıkar
    const filename = fileUrl.split('/').pop();
    const sourcePath = path.join('/app/uploads/chat', filename);
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: 'Dosya sunucuda bulunamadı.' });
    }

    // Hedef: Ana doküman yükleme dizini (/app/uploads) - Önizleme ve indirme ile tam uyumlu
    const archiveDir = '/app/uploads';
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
    const archiveFilename = `${uuidv4()}${path.extname(filename)}`;
    const destPath = path.join(archiveDir, archiveFilename);
    fs.copyFileSync(sourcePath, destPath);

    // Dosya uzantısından mimeType belirle
    const ext = path.extname(filename).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.svg') mimeType = 'image/svg+xml';
    else if (ext === '.docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === '.doc') mimeType = 'application/msword';
    else if (ext === '.xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (ext === '.xls') mimeType = 'application/vnd.ms-excel';
    else if (ext === '.txt') mimeType = 'text/plain';
    else if (ext === '.zip') mimeType = 'application/zip';

    // Document tablosuna kayıt ekle
    const { DocumentMetadata } = require('../models');
    const archiveDoc = await Document.create({
      title: msg.file_name || filename,
      originalName: msg.file_name || filename,
      mimeType,
      filePath: `/app/uploads/${archiveFilename}`,
      status: 'COMPLETED',
      userId: currentUserId,
      tags: ['chat-arsiv'],
      sensitivity: 'public',
    });

    // DocumentMetadata kaydı ekle
    try {
      await DocumentMetadata.create({
        document_id: archiveDoc.id,
        extracted_text: `Chat üzerinden aktarılan dosya: ${msg.file_name || filename}`,
        comments: [`Chat modülünden aktarıldı (Gönderen: ${msg.sender?.fullName || msg.sender?.username || 'Bilinmiyor'})`],
      });
    } catch (metaErr) {
      console.warn('[ARCHIVE_META_WARN]', metaErr.message);
    }

    // AI OCR & Sınıflandırma Kuyruğuna Ekle (Görsel ve PDF'ler için)
    const isProcessable = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'].includes(ext);
    if (isProcessable) {
      try {
        const { ProcessingJob } = require('../models');
        const job = await ProcessingJob.create({
          documentId: archiveDoc.id,
          jobStatus: 'QUEUED',
          startedAt: new Date(),
        });
        const documentRoutes = require('./document.routes');
        if (documentRoutes.processDocumentWithAI) {
          documentRoutes.processDocumentWithAI(archiveDoc, job).catch((err) => {
            console.warn('[ARCHIVE_AI_PROCESSING_WARN]', err.message);
          });
        }
      } catch (jobErr) {
        console.warn('[ARCHIVE_JOB_CREATE_WARN]', jobErr.message);
      }
    }

    // CISO LOG
    logCisoAction('DOSYA_ARSIVLENDI', {
      userId: currentUserId,
      userName: req.user.fullName || req.user.username,
      sourceMessageId: messageId,
      sourceFileName: msg.file_name || filename,
      archiveDocId: archiveDoc.id,
      senderName: msg.sender?.fullName || msg.sender?.username || 'Bilinmiyor',
    }, req.ip);

    // GENEL LOG
    logAction(req, 'DOSYA_E_ARSIVE_AKTARILDI', null, null,
      `${req.user.fullName || req.user.username} chat dosyasını E-Arşiv'e aktardı (Mesaj ID: ${messageId})`);

    res.json({
      success: true,
      message: 'Dosya başarıyla E-Arşiv\'e aktarıldı ve işleme alındı.',
      archiveId: archiveDoc.id
    });
  } catch (error) {
    console.error('[CHAT_API_ERR] E-Arşiv aktarımı başarısız:', error);
    res.status(500).json({ error: `E-Arşiv aktarımı sırasında hata: ${error.message}` });
  }
});

module.exports = router;

