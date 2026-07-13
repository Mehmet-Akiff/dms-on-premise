/**
 * DMS On-Premise - User Modeli
 * Kullanıcı bilgilerini ve kimlik doğrulama verilerini tutar.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('users', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  fullName: {
    type: DataTypes.STRING(200),
    allowNull: false,
    field: 'full_name',
    validate: {
      len: [2, 200],
    },
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash',
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'user',
    comment: 'Kullanıcı rolü (admin, user vb.)'
  }
}, {
  underscored: true, // created_at ve updated_at alanlarını otomatik yılan-kasa yapar
  timestamps: true
});

module.exports = User;
