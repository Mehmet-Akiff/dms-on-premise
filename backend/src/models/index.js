/**
 * DMS On-Premise - Model İlişkileri ve Merkezi Dışa Aktarım
 * Tüm Sequelize modellerini yükler, ilişkileri kurar ve tek noktadan dışa aktarır.
 */

const sequelize = require('../config/database');
const User = require('./User');
const Document = require('./Document');
const DocumentMetadata = require('./DocumentMetadata');
const ProcessingJob = require('./ProcessingJob');
const SystemSettings = require('./SystemSettings');
const AuditLog = require('./AuditLog');
const ApprovalRequest = require('./ApprovalRequest');
const ChatRoom = require('./ChatRoom');
const Message = require('./Message');

// ============================================================
// Model İlişkileri (Associations)
// ============================================================

// User → Document (1:N) — Bir kullanıcı birden fazla doküman yükleyebilir
User.hasMany(Document, {
  foreignKey: 'user_id',
  as: 'documents',
  onDelete: 'SET NULL',
});
Document.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'owner',
});

// Document → DocumentMetadata (1:1) — Her dokümanın bir meta-veri kaydı vardır
Document.hasOne(DocumentMetadata, {
  foreignKey: 'document_id',
  as: 'metadata',
  onDelete: 'CASCADE',
});
DocumentMetadata.belongsTo(Document, {
  foreignKey: 'document_id',
  as: 'document',
});

// Document → ProcessingJob (1:N) — Bir doküman yeniden işlenebilir (retry)
Document.hasMany(ProcessingJob, {
  foreignKey: 'document_id',
  as: 'jobs',
  onDelete: 'CASCADE',
});
ProcessingJob.belongsTo(Document, {
  foreignKey: 'document_id',
  as: 'document',
});

// User → AuditLog (1:N) — Kullanıcı işlem geçmişi
User.hasMany(AuditLog, {
  foreignKey: 'user_id',
  as: 'auditLogs',
  onDelete: 'SET NULL',
});
AuditLog.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// ============================================================
// Staj 2 - Intranet Chat (WebSocket) İlişkileri
// ============================================================

// User → Message (1:N) - Gönderilen ve alınan mesajlar
User.hasMany(Message, { foreignKey: 'sender_id', as: 'sentMessages' });
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });

User.hasMany(Message, { foreignKey: 'receiver_id', as: 'receivedMessages' });
Message.belongsTo(User, { foreignKey: 'receiver_id', as: 'receiver' });

// ChatRoom → Message (1:N) - Odaya ait mesajlar
ChatRoom.hasMany(Message, { foreignKey: 'room_id', as: 'messages', onDelete: 'CASCADE' });
Message.belongsTo(ChatRoom, { foreignKey: 'room_id', as: 'room' });

// ============================================================
// Dışa Aktarım
// ============================================================

module.exports = {
  sequelize,
  User,
  Document,
  DocumentMetadata,
  ProcessingJob,
  SystemSettings,
  AuditLog,
  ApprovalRequest,
  ChatRoom,
  Message,
};
