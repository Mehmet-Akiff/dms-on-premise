/**
 * DMS On-Premise - AuditLog Modeli
 * Kullanıcı işlem geçmişini (kim, ne zaman, hangi işlemi yaptı) takip eder.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('audit_logs', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'user_id',
    comment: 'İşlemi yapan kullanıcının ID\'si',
  },
  userName: {
    type: DataTypes.STRING(200),
    allowNull: true,
    field: 'user_name',
    comment: 'Kullanıcı adı — hızlı referans için (JOIN gerektirmez)',
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  documentId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'document_id',
    comment: 'İlgili belgenin ID\'si (varsa)',
  },
  documentName: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'document_name',
    comment: 'Belge adı — belge silinse bile kayıtta kalır',
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'İşlem detayları (ör: "Fatura.pdf belgesini çöp kutusuna gönderdi")',
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
    field: 'ip_address',
    comment: 'İşlemi yapan IP adresi',
  },
}, {
  underscored: true,
  timestamps: true,
  updatedAt: false, // Audit log güncellenmez, sadece oluşturulur
  indexes: [
    { fields: ['user_id'] },
    { fields: ['action'] },
    { fields: ['document_id'] },
    { fields: ['created_at'] },
  ],
});

module.exports = AuditLog;
