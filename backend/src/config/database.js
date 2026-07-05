/**
 * DMS On-Premise - Sequelize Veritabanı Yapılandırması
 * PostgreSQL bağlantısını DATABASE_URL ortam değişkeninden alır.
 */

const { Sequelize } = require('sequelize');

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://dms_user:dms_secure_pass@db:5432/dms_db';

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'production' ? false : console.log,
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,       // createdAt & updatedAt otomatik eklenir
    underscored: true,      // snake_case kolon isimleri
    freezeTableName: true,  // Tablo ismi çoğaltılmasın
  },
});

module.exports = sequelize;
