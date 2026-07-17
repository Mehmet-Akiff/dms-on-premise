/**
 * DMS On-Premise - User Modeli
 * Kullanıcı bilgilerini, rollerini ve yetkilerini tutar.
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
  username: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 100],
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
    type: DataTypes.ENUM('ciso', 'admin', 'user'),
    allowNull: false,
    defaultValue: 'user',
  },
  permissions: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {
      canRead: true,
      canWrite: false,
    },
  },
  status: {
    type: DataTypes.ENUM('pending_approval', 'active'),
    allowNull: false,
    defaultValue: 'pending_approval',
  },
  lastLogin: {
    type: DataTypes.DATE,
    field: 'last_login',
    allowNull: true,
  },
  lastActive: {
    type: DataTypes.DATE,
    field: 'last_active',
    allowNull: true,
  },
  passwordHint: {
    type: DataTypes.STRING(255),
    field: 'password_hint',
    allowNull: true,
  },
}, {
  underscored: true,
  timestamps: true,
});

module.exports = User;
