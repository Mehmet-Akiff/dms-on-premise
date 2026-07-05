/**
 * DMS On-Premise - DocumentMetadata Modeli
 * AI servisinden dönen kategori, etiket ve NER verilerini tutar.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DocumentMetadata = sequelize.define('document_metadata', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  documentId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'document_id',
  },
  category: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'AI tarafından belirlenen doküman kategorisi (Fatura, Sözleşme, Rapor vb.)',
  },
  extractedText: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'extracted_text',
    comment: 'Tesseract OCR ile çıkarılan ham metin',
  },
  extractedTags: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    field: 'extracted_tags',
    comment: 'SpaCy/TinyBERT ile çıkarılan etiketler ve NER varlıkları',
  },
  confidence: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0.0,
    comment: 'Sınıflandırma güven skoru (0.0 - 1.0)',
  },
});

module.exports = DocumentMetadata;
