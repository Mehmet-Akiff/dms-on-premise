/**
 * DMS On-Premise - Document Modeli
 * Yüklenen dokümanların temel bilgilerini ve işleme durumunu tutar.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Document = sequelize.define('documents', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  originalName: {
    type: DataTypes.STRING(500),
    allowNull: false,
    field: 'original_name',
  },
  mimeType: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'mime_type',
    validate: {
      isIn: [['application/pdf', 'image/png', 'image/jpeg']],
    },
  },
  filePath: {
    type: DataTypes.STRING(1000),
    allowNull: false,
    field: 'file_path',
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'),
    defaultValue: 'PENDING',
    allowNull: false,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'user_id',
  },
}, {
  timestamps: true,
  underscored: true,
  paranoid: true,
});

module.exports = Document;
