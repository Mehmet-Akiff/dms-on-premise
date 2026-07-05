/**
 * DMS On-Premise - ProcessingJob Modeli
 * Asenkron doküman işleme kuyruğundaki işlerin durumunu takip eder.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProcessingJob = sequelize.define('processing_jobs', {
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
  jobStatus: {
    type: DataTypes.ENUM('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'),
    defaultValue: 'QUEUED',
    allowNull: false,
    field: 'job_status',
  },
  resultSummary: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'result_summary',
    comment: 'İşlem tamamlandığında AI servisinden dönen özet',
  },
  errorLog: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_log',
    comment: 'İşlem başarısız olursa hata detayları',
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'started_at',
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'completed_at',
  },
});

module.exports = ProcessingJob;
