const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  sender_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  receiver_id: {
    type: DataTypes.UUID,
    allowNull: true, // Grup mesajıysa null olabilir, room_id kullanılır
  },
  room_id: {
    type: DataTypes.STRING,
    allowNull: true, // Birebir mesajsa null olabilir, 'global' da olabilir
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'message', // 'message' veya 'note'
  },
  scheduled_at: {
    type: DataTypes.DATE,
    allowNull: true, // null ise anında gönderilir
  },
  is_delivered: {
    type: DataTypes.BOOLEAN,
    defaultValue: true, // Zamanlanmış mesajlar false olarak başlar
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  reactions: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  media_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  media_type: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  tableName: 'messages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Message;
