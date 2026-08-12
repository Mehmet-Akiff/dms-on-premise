const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { Message, User } = require('./models');
const { logAction } = require('./utils/auditLogger');
const { logCisoAction } = require('./utils/cisoLogger');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_dms_key_2026';

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
      console.log(`[SOCKET] Kullanıcı bağlandı: ${socket.user.username} (${socket.id})`);

      // 1. Kullanıcıyı kendi özel odasına ekle
      socket.join(socket.user.id);
      
      // 2. Tüm kullanıcıları otomatik olarak 'global' odasına ekle (BUG FIX)
      socket.join('global');

      // 3. Olay: Mesaj Gönderme
      socket.on('send_message', async (data, callback) => {
        try {
          const { receiverId, roomId, content, scheduledAt } = data;
          
          if (!content || (!receiverId && !roomId)) {
            if(callback) callback({ error: 'Eksik parametreler.' });
            return;
          }

          const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();

          // Veritabanına kaydet
          const newMessage = await Message.create({
            sender_id: socket.user.id,
            receiver_id: receiverId || null,
            room_id: roomId || null,
            content: content,
            type: 'message',
            scheduled_at: isScheduled ? new Date(scheduledAt) : null,
            is_delivered: !isScheduled,
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

          // CISO LOG: Tam içerik (sadece CISO erişebilir)
          logCisoAction('MESAJ_ICERIK_DETAY', {
            senderId: socket.user.id,
            senderName: socket.user.fullName || socket.user.username,
            targetId: receiverId || roomId,
            targetType: roomId ? 'room' : 'user',
            contentPreview: content,
            scheduledAt: scheduledAt || null,
            messageId: newMessage.id,
          });

          // Zamanlanmış mesajlar anında gönderilmez
          if (isScheduled) {
            if(callback) callback({ success: true, data: populatedMessage, scheduled: true });
            return;
          }

          // Karşı tarafa veya odaya ilet
          if (roomId === 'global') {
            // Global odaya broadcast (gönderen dahil herkese)
            io.to('global').emit('receive_message', populatedMessage);
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
        console.log(`[SOCKET] ${socket.user.username} odaya katıldı: ${roomId}`);
      });

      socket.on('disconnect', () => {
        console.log(`[SOCKET] Kullanıcı ayrıldı: ${socket.user.username} (${socket.id})`);
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
            scheduled_at: { [require('sequelize').Op.lte]: now },
            is_delivered: false,
          },
          include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'fullName'] }]
        });

        for (const msg of pendingMessages) {
          msg.is_delivered = true;
          await msg.save();

          // Mesajı ilgili odaya/kişiye ilet
          if (msg.room_id === 'global') {
            io.to('global').emit('receive_message', msg);
          } else if (msg.receiver_id) {
            io.to(msg.receiver_id).emit('receive_message', msg);
            io.to(msg.sender_id).emit('receive_message', msg);
          } else if (msg.room_id) {
            io.to(msg.room_id).emit('receive_message', msg);
          }

          console.log(`[SCHEDULER] Zamanlanmış mesaj teslim edildi: ${msg.id}`);
        }
      } catch (err) {
        // Sessizce logla, cron'u durdurma
        if (err.message && !err.message.includes('no such table')) {
          console.error('[SCHEDULER_ERR]', err.message);
        }
      }
    }, 30000);

    return io;
  },
  
  getIo: () => {
    if (!io) {
      throw new Error('Socket.io başlatılmadı!');
    }
    return io;
  }
};
