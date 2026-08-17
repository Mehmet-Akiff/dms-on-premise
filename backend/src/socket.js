const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { Message, User } = require('./models');
const { logAction } = require('./utils/auditLogger');
const { logCisoAction } = require('./utils/cisoLogger');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_dms_key_2026';

// Global oda için sabit UUID (DB'de room_id UUID tipinde)
const GLOBAL_ROOM_ID = '00000000-0000-0000-0000-000000000001';

let io;

module.exports = {
  init: (server) => {
    io = socketIo(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    // ============================================================
    // Middleware: JWT Doğrulaması (Handshake)
    // ============================================================
    io.use((socket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) {
        return next(new Error('Yetkilendirme hatası: Token bulunamadı.'));
      }
      
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Yetkilendirme hatası: Geçersiz token.'));
        socket.user = decoded;
        next();
      });
    });

    // ============================================================
    // Bağlantı Yönetimi
    // ============================================================
    io.on('connection', (socket) => {


      // 1. Kullanıcıyı kendi özel odasına ekle
      socket.join(socket.user.id);
      
      // 2. Tüm kullanıcıları otomatik olarak global odasına ekle
      socket.join(GLOBAL_ROOM_ID);

      // 3. Olay: Mesaj Gönderme
      socket.on('send_message', async (data, callback) => {
        try {
          const { receiverId, roomId, content, scheduledAt, mediaUrl, mediaType, fileName, fileSize, fileType, fileUrl, isViewOnce, expiresIn } = data;
          const finalMediaUrl = mediaUrl || fileUrl || null;
          const finalMediaType = mediaType || fileType || null;
          
          if (!content && !finalMediaUrl && (!receiverId && !roomId)) {
            if(callback) callback({ error: 'Eksik parametreler.' });
            return;
          }

          const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();

          // 'global' string'ini gerçek UUID'ye çevir
          const resolvedRoomId = roomId === 'global' ? GLOBAL_ROOM_ID : (roomId || null);

          // Veritabanına kaydet
          const newMessage = await Message.create({
            sender_id: socket.user.id,
            receiver_id: receiverId || null,
            room_id: resolvedRoomId,
            content: content || '',
            type: 'message',
            media_url: finalMediaUrl,
            media_type: finalMediaType,
            file_url: finalMediaUrl,
            file_name: fileName || null,
            file_type: finalMediaType,
            file_size: fileSize || null,
            scheduled_at: isScheduled ? new Date(scheduledAt) : null,
            is_delivered: !isScheduled,
            is_view_once: isViewOnce || false,
            expires_at: expiresIn ? new Date(Date.now() + expiresIn) : null,
          });

          // Gönderici bilgisini çek
          const populatedMessage = await Message.findByPk(newMessage.id, {
            include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'fullName'] }]
          });

          // GENEL LOG: Sadece metadata (metin içeriği YOK - gizlilik)
          const targetLabel = roomId === 'global' ? 'Sistem Odası' : (receiverId || 'bilinmiyor');
          logAction(
            'MESAJ_GONDERILDI',
            socket.user.id,
            socket.user.fullName || socket.user.username,
            null,
            null,
            `${socket.user.fullName || socket.user.username} -> ${targetLabel} (${isScheduled ? 'Zamanlanmış' : 'Anlık'} mesaj)`
          );

          // CISO LOG: Tam içerik ve Dosya Transfer detayları
          logCisoAction('MESAJ_ICERIK_DETAY', {
            senderId: socket.user.id,
            senderName: socket.user.fullName || socket.user.username,
            targetId: receiverId || roomId,
            targetType: roomId ? 'room' : 'user',
            contentPreview: content,
            scheduledAt: scheduledAt || null,
            messageId: newMessage.id,
          });

          if (finalMediaUrl) {
            logCisoAction('DOSYA_TRANSFERI', {
              senderId: socket.user.id,
              senderName: socket.user.fullName || socket.user.username,
              targetId: receiverId || roomId,
              targetType: roomId ? 'room' : 'user',
              fileName: fileName || 'Dosya',
              fileSize: fileSize || null,
              fileType: finalMediaType,
              mediaUrl: finalMediaUrl,
              messageId: newMessage.id
            });
          }

          // Zamanlanmış mesajlar anında gönderilmez
          if (isScheduled) {
            if(callback) callback({ success: true, data: populatedMessage, scheduled: true });
            return;
          }

          // Karşı tarafa veya odaya ilet
          if (roomId === 'global') {
            // Global odaya broadcast (gönderen HARİÇ herkese, gönderen callback'ten alır)
            socket.broadcast.to(GLOBAL_ROOM_ID).emit('receive_message', populatedMessage);
          } else if (receiverId) {
            // Birebir mesaj: karşı tarafa ve kendi diğer sekmelerine
            io.to(receiverId).emit('receive_message', populatedMessage);
            socket.to(socket.user.id).emit('receive_message', populatedMessage);
          } else if (roomId) {
            // Diğer odalar
            io.to(roomId).emit('receive_message', populatedMessage);
          }

          if(callback) callback({ success: true, data: populatedMessage });
        } catch (error) {
          console.error('[SOCKET_ERR] Mesaj kaydedilemedi:', error);
          if(callback) callback({ error: 'Mesaj iletilemedi.' });
        }
      });

      // 4. Olay: Gruba Katılma
      socket.on('join_room', (roomId) => {
        socket.join(roomId);

      });

      // 5. Olay: Mesaja Reaksiyon Ekleme
      socket.on('add_reaction', async (data) => {
        try {
          const { messageId, emoji } = data;
          if (!messageId || !emoji) return;

          const msg = await Message.findByPk(messageId);
          if (!msg) return;

          let reactions = [];
          if (typeof msg.reactions === 'string') {
            try { reactions = JSON.parse(msg.reactions); } catch (e) {}
          } else if (Array.isArray(msg.reactions)) {
            reactions = [...msg.reactions];
          }

          const existingIdx = reactions.findIndex(r => r.userId === socket.user.id && r.emoji === emoji);
          
          if (existingIdx >= 0) {
            reactions.splice(existingIdx, 1); // toggle off
          } else {
            reactions.push({ userId: socket.user.id, emoji, username: socket.user.fullName || socket.user.username });
          }
          
          msg.set('reactions', reactions);
          msg.changed('reactions', true);
          await msg.save();

          // Broadcast reaction update
          const reactionUpdate = { messageId, reactions: msg.reactions };
          if (!msg.receiver_id && (!msg.room_id || msg.room_id === 'global')) {
            io.to('global').emit('receive_reaction', reactionUpdate);
          } else if (msg.receiver_id) {
            io.to(msg.receiver_id).emit('receive_reaction', reactionUpdate);
            io.to(msg.sender_id).emit('receive_reaction', reactionUpdate);
          } else if (msg.room_id) {
            io.to(msg.room_id).emit('receive_reaction', reactionUpdate);
          }
        } catch (err) {
          console.error('[SOCKET_ERR] Reaksiyon eklenemedi:', err);
        }
      });

      // 6. Olay: Mesaj Düzenleme
      socket.on('edit_message', async (data, callback) => {
        try {
          const { messageId, content } = data;
          if (!messageId || !content?.trim()) return;

          const msg = await Message.findByPk(messageId);
          if (!msg || msg.sender_id !== socket.user.id || msg.is_deleted) return;

          const twoMinutes = 2 * 60 * 1000;
          if (Date.now() - new Date(msg.created_at).getTime() > twoMinutes) {
            if (callback) callback({ error: 'Düzenleme süresi doldu.' });
            return;
          }

          const oldContent = msg.content;
          msg.content = content.trim();
          msg.is_edited = true;
          msg.edited_at = new Date();
          await msg.save();

          logCisoAction('MESAJ_DUZENLENDI', {
            senderId: socket.user.id,
            senderName: socket.user.fullName || socket.user.username,
            messageId, oldContent, newContent: content.trim(),
          });

          const editUpdate = { messageId, content: msg.content, is_edited: true, edited_at: msg.edited_at };
          if (!msg.receiver_id && (!msg.room_id || msg.room_id === 'global')) {
            io.to('global').emit('message_edited', editUpdate);
          } else if (msg.receiver_id) {
            io.to(msg.receiver_id).emit('message_edited', editUpdate);
            io.to(msg.sender_id).emit('message_edited', editUpdate);
          } else if (msg.room_id) {
            io.to(msg.room_id).emit('message_edited', editUpdate);
          }
          if (callback) callback({ success: true });
        } catch (err) {
          console.error('[SOCKET_ERR] Mesaj düzenlenemedi:', err);
        }
      });

      // 7. Olay: Mesaj Silme (Soft Delete)
      socket.on('delete_message', async (data, callback) => {
        try {
          const { messageId } = data;
          if (!messageId) return;

          const msg = await Message.findByPk(messageId);
          if (!msg || msg.sender_id !== socket.user.id || msg.is_deleted) return;

          const deletedContent = msg.content;
          msg.content = '';
          msg.is_deleted = true;
          msg.media_url = null;
          msg.media_type = null;
          await msg.save();

          logCisoAction('MESAJ_SILINDI', {
            senderId: socket.user.id,
            senderName: socket.user.fullName || socket.user.username,
            messageId, deletedContent,
          });

          const deleteUpdate = { messageId };
          if (!msg.receiver_id && (!msg.room_id || msg.room_id === 'global')) {
            io.to('global').emit('message_deleted', deleteUpdate);
          } else if (msg.receiver_id) {
            io.to(msg.receiver_id).emit('message_deleted', deleteUpdate);
            io.to(msg.sender_id).emit('message_deleted', deleteUpdate);
          } else if (msg.room_id) {
            io.to(msg.room_id).emit('message_deleted', deleteUpdate);
          }
          if (callback) callback({ success: true });
        } catch (err) {
          console.error('[SOCKET_ERR] Mesaj silinemedi:', err);
        }
      });

      socket.on('disconnect', () => {

      });
    });

    // ============================================================
    // Zamanlanmış Mesaj Kontrol Cron'u (her 30 saniyede bir)
    // ============================================================
    setInterval(async () => {
      try {
        const now = new Date();
        const pendingMessages = await Message.findAll({
          where: {
            scheduled_at: { [Op.lte]: now },
            is_delivered: false,
          },
          include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'fullName'] }]
        });

        for (const msg of pendingMessages) {
          msg.is_delivered = true;
          await msg.save();

          // Mesajı ilgili odaya/kişiye ilet
          if (!msg.receiver_id && (!msg.room_id || msg.room_id === 'global')) {
            io.to('global').emit('receive_message', msg);
          } else if (msg.receiver_id) {
            io.to(msg.receiver_id).emit('receive_message', msg);
            io.to(msg.sender_id).emit('receive_message', msg);
          } else if (msg.room_id) {
            io.to(msg.room_id).emit('receive_message', msg);
          }


        }
      } catch (err) {
        // Sessizce logla, cron'u durdurma
        if (err.message && !err.message.includes('no such table')) {
          console.error('[SCHEDULER_ERR]', err.message);
        }
      }
    }, 30000);

    // ============================================================
    // Süreli Mesaj İmha Cron'u (her 60 saniyede bir)
    // ============================================================
    setInterval(async () => {
      try {
        const now = new Date();
        const expiredMessages = await Message.findAll({
          where: {
            expires_at: { [Op.lte]: now },
            is_expired: false,
          }
        });

        for (const msg of expiredMessages) {
          msg.is_expired = true;
          msg.content = '[Bu mesajın süresi doldu]';
          await msg.save();

          // Fiziksel dosyayı diskten sil (CISO kuralı)
          const fileUrl = msg.media_url || msg.file_url;
          if (fileUrl) {
            const filename = fileUrl.split('/').pop();
            const filePath = path.join('/app/uploads/chat', filename);
            try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
          }

          // CISO LOG: İmha kaydı
          logCisoAction('SURELI_ICERIK_IMHA', {
            messageId: msg.id,
            senderId: msg.sender_id,
            fileName: msg.file_name || null,
            expiresAt: msg.expires_at,
            reason: 'Süre dolumu (otomatik imha)'
          });

          // Kullanıcılara bildir
          const expireUpdate = { messageId: msg.id, is_expired: true };
          if (!msg.receiver_id && (!msg.room_id || msg.room_id === GLOBAL_ROOM_ID)) {
            io.to(GLOBAL_ROOM_ID).emit('message_expired', expireUpdate);
          } else if (msg.receiver_id) {
            io.to(msg.receiver_id).emit('message_expired', expireUpdate);
            io.to(msg.sender_id).emit('message_expired', expireUpdate);
          } else if (msg.room_id) {
            io.to(msg.room_id).emit('message_expired', expireUpdate);
          }
        }
      } catch (err) {
        if (err.message && !err.message.includes('no such table')) {
          console.error('[EPHEMERAL_CRON_ERR]', err.message);
        }
      }
    }, 60000);

    return io;
  },
  
  getIo: () => {
    if (!io) {
      throw new Error('Socket.io başlatılmadı!');
    }
    return io;
  }
};
