const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Message, User, SystemSettings } = require('../models');
const { verifyToken } = require('../middleware/auth.middleware');
const { logAction } = require('../utils/auditLogger');
const { logCisoAction } = require('../utils/cisoLogger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Global oda için sabit UUID (DB'de room_id UUID tipinde)
const GLOBAL_ROOM_ID = '00000000-0000-0000-0000-000000000001';

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
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });
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
    const { receiverId, roomId, content, scheduledAt, mediaUrl, mediaType } = req.body;
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
// POST /api/chat/upload — Chat Medya Yükleme
// ============================================================
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenemedi.' });
    }
    // URL olarak /api/chat/media/... üzerinden erişim sağlayabiliriz
    const mediaUrl = `/api/chat/media/${req.file.filename}`;
    
    // MimeType üzerinden 'image', 'audio', 'document' ayrımı
    let mediaType = 'document';
    if (req.file.mimetype.startsWith('image/')) mediaType = 'image';
    else if (req.file.mimetype.startsWith('audio/') || req.file.mimetype.startsWith('video/')) mediaType = 'audio';

    res.json({ success: true, url: mediaUrl, type: mediaType, name: req.file.originalname });
  } catch (error) {
    console.error('[CHAT_UPLOAD_ERR] Dosya yüklenemedi:', error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// ============================================================
// GET /api/chat/media/:filename — Medya Erişim (CISO Koruması eklenebilir, şimdilik JWT korumalı)
// ============================================================
router.get('/media/:filename', (req, res) => {
  const filePath = path.join('/app/uploads/chat', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Dosya bulunamadı.' });
  }
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

module.exports = router;

