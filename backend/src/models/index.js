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
};
