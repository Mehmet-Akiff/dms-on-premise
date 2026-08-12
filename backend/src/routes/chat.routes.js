const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Message, User } = require('../models');
const { verifyToken } = require('../middleware/auth.middleware');

// Tüm chat rotaları korumalıdır
router.use(verifyToken);

/**
 * GET /api/chat/history/:target
 * Eğer target 'global' ise genel oda (Sistem Odası) mesajlarını getirir.
 * Değilse, req.user.id ile target (userId) arasındaki 1'e 1 mesajları getirir.
 */
router.get('/history/:target', async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const target = req.params.target;

    let messages = [];

    if (target === 'global') {
      // Genel oda (room_id: 'global') mesajlarını çek
      messages = await Message.findAll({
        where: { room_id: 'global' },
        include: [
          { model: User, as: 'sender', attributes: ['id', 'username', 'fullName'] }
        ],
        order: [['created_at', 'ASC']],
        limit: 100 // Son 100 mesaj
      });
    } else {
      // Hedef kullanıcının varlığını kontrol et
      const targetUser = await User.findByPk(target);
      if (!targetUser) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      }

      // İki kullanıcı arasındaki tüm mesajları çek
      messages = await Message.findAll({
        where: {
          [Op.or]: [
            { sender_id: currentUserId, receiver_id: target },
            { sender_id: target, receiver_id: currentUserId }
          ]
        },
        include: [
          { model: User, as: 'sender', attributes: ['id', 'username', 'fullName'] },
          { model: User, as: 'receiver', attributes: ['id', 'username', 'fullName'] }
        ],
        order: [['created_at', 'ASC']],
        limit: 100 // Son 100 mesaj
      });
    }

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('[CHAT_API_ERR] Mesaj geçmişi alınamadı:', error);
    res.status(500).json({ error: 'Mesaj geçmişi alınırken sunucu hatası oluştu.' });
  }
});

/**
 * GET /api/chat/users
 * Sohbet kişileri için aktif tüm kullanıcıları getirir.
 */
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

module.exports = router;
