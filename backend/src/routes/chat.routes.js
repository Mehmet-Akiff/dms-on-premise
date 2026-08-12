const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Message, User, SystemSettings } = require('../models');
const { verifyToken } = require('../middleware/auth.middleware');
const { logAction } = require('../utils/auditLogger');
const { logCisoAction } = require('../utils/cisoLogger');

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

    // Zamanlanmış mesajlar: sadece zamanı gelmiş olanlar gösterilir
    const deliveredCondition = {
      [Op.or]: [
        { scheduled_at: null },
        { scheduled_at: { [Op.lte]: now } }
      ]
    };

    if (target === 'global') {
      messages = await Message.findAll({
        where: {
          room_id: 'global',
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
// POST /api/chat/send — Not gönderme (Tek PC modu / asenkron)
// ============================================================
router.post('/send', async (req, res) => {
  try {
    const { receiverId, roomId, content, scheduledAt } = req.body;
    const senderId = req.user.id;

    if (!content || (!receiverId && !roomId)) {
      return res.status(400).json({ error: 'Eksik parametreler.' });
    }

    const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();

    const newMessage = await Message.create({
      sender_id: senderId,
      receiver_id: receiverId || null,
      room_id: roomId || null,
      content: content,
      type: 'note',
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

module.exports = router;
