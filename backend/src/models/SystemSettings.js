/**
 * DMS On-Premise - SystemSettings Modeli
 * Kasa şifresi, mail doğrulama ve alarm eşiği ayarlarını saklar.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SystemSettings = sequelize.define('system_settings', {
  key: {
    type: DataTypes.STRING(100),
    primaryKey: true,
    defaultValue: 'kasa_settings'
  },
  value: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {
      masterUsername: 'admin',
      masterPasswordHash: '', // bcrypt hash'li şifre
      alertEmail: '', // yetkisiz erişim bildirim maili
      verifiedAlertEmail: '', // doğrulanmış bildirim maili
      alertThreshold: 3, // kaçıncı hatalı denemede mail atılacağı
      verificationCode: null, // e-posta doğrulama kodu
      verificationExpires: null // kodun son geçerlilik süresi
    }
  }
}, {
  underscored: true,
  timestamps: true
});

module.exports = SystemSettings;
