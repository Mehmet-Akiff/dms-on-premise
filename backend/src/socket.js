const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { Message, User } = require('./models');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_dms_key_2026';

let io;

module.exports = {
  init: (server) => {
    io = socketIo(server, {
      cors: {
        origin: '*', // Production'da spesifik frontend domainine kısıtlanmalı
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
        socket.user = decoded; // { id, role, ... }
        next();
      });
    });

    // ============================================================
    // Bağlantı Yönetimi
    // ============================================================
    io.on('connection', (socket) => {
      console.log(`[SOCKET] Kullanıcı bağlandı: ${socket.user.username} (${socket.id})`);

      // 1. Kullanıcıyı kendi özel odasına (userId) ekle
      // Bu sayede ona atılan direkt mesajlar sadece bu odaya gönderilir.
      socket.join(socket.user.id);
      
      // 2. Olay: Mesaj Gönderme
      socket.on('send_message', async (data, callback) => {
        try {
          const { receiverId, roomId, content } = data;
          
          if (!content || (!receiverId && !roomId)) {
            if(callback) callback({ error: 'Eksik parametreler.' });
            return;
          }

          // Asenkron olarak veritabanına kaydet
          const newMessage = await Message.create({
            sender_id: socket.user.id,
            receiver_id: receiverId || null,
            room_id: roomId || null,
            content: content
          });

          // İlişkili gönderici bilgisini çek (frontend'de göstermek için)
          const populatedMessage = await Message.findByPk(newMessage.id, {
            include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'fullName'] }]
          });

          // Karşı tarafa veya odaya ilet
          if (receiverId) {
            // Birebir mesaj
            io.to(receiverId).emit('receive_message', populatedMessage);
            // Kendi diğer açık sekmelerine de ilet
            socket.to(socket.user.id).emit('receive_message', populatedMessage); 
          } else if (roomId) {
            // Grup mesajı
            io.to(roomId).emit('receive_message', populatedMessage);
          }

          if(callback) callback({ success: true, data: populatedMessage });
        } catch (error) {
          console.error('[SOCKET_ERR] Mesaj kaydedilemedi:', error);
          if(callback) callback({ error: 'Mesaj iletilemedi.' });
        }
      });

      // 3. Olay: Gruba Katılma (ChatRoom)
      socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`[SOCKET] ${socket.user.username} odaya katıldı: ${roomId}`);
      });

      socket.on('disconnect', () => {
        console.log(`[SOCKET] Kullanıcı ayrıldı: ${socket.user.username} (${socket.id})`);
      });
    });

    return io;
  },
  
  getIo: () => {
    if (!io) {
      throw new Error('Socket.io başlatılmadı!');
    }
    return io;
  }
};
