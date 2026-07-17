/**
 * DMS On-Premise - ApprovalRequest Modeli
 * Yöneticilerin ve CISO'nun onay taleplerini ve onay zincirlerini takip eder.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ApprovalRequest = sequelize.define('approval_requests', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  targetId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'target_id',
    comment: 'İlgili nesnenin/kullanıcının ID\'si',
  },
  requestData: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'request_data',
    comment: 'Talebe ilişkin geçici veri (örn: yeni kullanıcı bilgileri, yeni isim vb.)',
  },
  approvalsRequired: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    field: 'approvals_required',
  },
  approvalsReceived: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    field: 'approvals_received',
    comment: 'Onay veren adminlerin e-postaları veya kullanıcı adları listesi',
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'pending',
  },
  token: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
    comment: 'E-posta onay linki için benzersiz token',
  },
}, {
  underscored: true,
  timestamps: true,
});

module.exports = ApprovalRequest;
