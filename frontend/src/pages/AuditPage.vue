<template>
  <div class="audit-page">
    <div class="audit-card">
      <div class="audit-page-header">
        <div>
          <h2>📜 {{ $t('nav.auditLogsTitle') || 'Sistem Günlükleri (CISO Denetim Alanı)' }}</h2>
          <p class="subtitle">Sistem genelinde gerçekleştirilen tüm dosya, kullanıcı, oturum ve yetki işlemlerinin değiştirilemez denetim izi.</p>
        </div>
      </div>
      <div class="audit-body">
        <AuditLog />
      </div>
    </div>
  </div>
</template>

<script setup>
import AuditLog from '../components/AuditLog.vue'
</script>

<style scoped>
.audit-page {
  padding: 1.5rem;
  width: 100%;
  box-sizing: border-box;
}
.audit-card {
  background: var(--bg-secondary, #1e293b);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  padding: 1.5rem;
}
.audit-page-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
}
.audit-page-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary, #f8fafc);
}
.subtitle {
  margin: 0.35rem 0 0 0;
  font-size: 0.8rem;
  color: var(--text-secondary, #94a3b8);
}
</style>
