/**
 * DMS On-Premise - Hayalet Kayıt Temizlik Script'i
 * 
 * Veritabanında asılı kalan PENDING durumundaki dokümanları
 * ve ilişkili ProcessingJob kayıtlarını temizler.
 * 
 * Kullanım:
 *   node src/scripts/clear-ghosts.js
 *   docker exec dms_backend node src/scripts/clear-ghosts.js
 */

const { sequelize, Document, ProcessingJob } = require('../models');

async function clearGhosts() {
  console.log('[TEMİZLİK] Hayalet kayıt temizliği başlatılıyor...\n');

  try {
    await sequelize.authenticate();
    console.log('[DB] PostgreSQL bağlantısı başarılı.');

    // İlişkili ProcessingJob kayıtlarını önce sil (foreign key kısıtı)
    const ghostDocs = await Document.findAll({
      where: { status: 'PENDING' },
      attributes: ['id', 'title', 'originalName', 'createdAt'],
    });

    if (ghostDocs.length === 0) {
      console.log('\n[TEMİZLİK] Temizlenecek hayalet kayıt bulunamadı. Veritabanı temiz.');
      process.exit(0);
    }

    console.log(`\n[TEMİZLİK] ${ghostDocs.length} adet PENDING kayıt bulundu:\n`);
    ghostDocs.forEach((doc, i) => {
      console.log(`  ${i + 1}. ${doc.originalName || doc.title} (ID: ${doc.id})`);
    });

    const ghostIds = ghostDocs.map(d => d.id);

    // İlişkili job'ları sil
    const deletedJobs = await ProcessingJob.destroy({
      where: { documentId: ghostIds },
    });
    console.log(`\n[TEMİZLİK] ${deletedJobs} adet ilişkili ProcessingJob kaydı silindi.`);

    // PENDING dokümanları sil
    const deletedDocs = await Document.destroy({
      where: { status: 'PENDING' },
    });
    console.log(`[TEMİZLİK] ${deletedDocs} adet hayalet Document kaydı silindi.`);

    console.log(`\n✅ Temizlik tamamlandı, ${deletedDocs} adet hayalet kayıt silindi.\n`);
    process.exit(0);
  } catch (error) {
    console.error('[HATA] Temizlik sırasında hata oluştu:', error.message);
    process.exit(1);
  }
}

clearGhosts();
