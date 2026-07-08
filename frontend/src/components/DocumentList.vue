<template>
  <div class="doc-list">
    <div class="doc-list-header">
      <h2 class="doc-list-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        Son Yüklenen Dokümanlar
      </h2>
      <span class="doc-count">{{ documents.length }} doküman</span>
    </div>

    <div class="doc-table-wrap">
      <table class="doc-table">
        <thead>
          <tr>
            <th>Dosya Adı</th>
            <th>Tür</th>
            <th>Boyut</th>
            <th>Durum</th>
            <th>Tarih</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="doc in documents" :key="doc.id" class="doc-row">
            <td class="doc-name">
              <span class="doc-icon">{{ getFileIcon(doc.mimeType) }}</span>
              {{ doc.originalName }}
            </td>
            <td>
              <span class="type-badge">{{ getTypeLabel(doc.mimeType) }}</span>
            </td>
            <td class="doc-size">{{ doc.size }}</td>
            <td>
              <span class="status-badge" :class="'status--' + doc.status.toLowerCase()">
                <span class="status-dot"></span>
                {{ getStatusLabel(doc.status) }}
              </span>
            </td>
            <td class="doc-date">{{ doc.date }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="documents.length === 0" class="doc-empty">
      <p>Henüz yüklenmiş doküman bulunmuyor.</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// Mock veriler (backend entegrasyonuna kadar)
const documents = ref([
  {
    id: '1',
    originalName: 'fatura_haziran_2026.png',
    mimeType: 'image/png',
    size: '2.4 MB',
    status: 'COMPLETED',
    date: '08.07.2026',
  },
  {
    id: '2',
    originalName: 'sozlesme_muhasebe.pdf',
    mimeType: 'application/pdf',
    size: '1.1 MB',
    status: 'PROCESSING',
    date: '08.07.2026',
  },
  {
    id: '3',
    originalName: 'rapor_Q2_2026.pdf',
    mimeType: 'application/pdf',
    size: '4.7 MB',
    status: 'PENDING',
    date: '07.07.2026',
  },
  {
    id: '4',
    originalName: 'bozuk_gorsel.jpg',
    mimeType: 'image/jpeg',
    size: '890 KB',
    status: 'FAILED',
    date: '06.07.2026',
  },
])

function getFileIcon(mimeType) {
  if (mimeType === 'application/pdf') return '📕'
  if (mimeType === 'image/png') return '🖼️'
  if (mimeType === 'image/jpeg') return '📷'
  return '📄'
}

function getTypeLabel(mimeType) {
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType === 'image/png') return 'PNG'
  if (mimeType === 'image/jpeg') return 'JPG'
  return 'Diğer'
}

function getStatusLabel(status) {
  const labels = {
    PENDING: 'Beklemede',
    PROCESSING: 'İşleniyor',
    COMPLETED: 'Tamamlandı',
    FAILED: 'Başarısız',
  }
  return labels[status] || status
}
</script>

<style scoped>
.doc-list {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.doc-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
}

.doc-list-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.doc-list-title svg {
  color: var(--accent);
  opacity: 0.8;
}

.doc-count {
  font-size: 0.78rem;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  border: 1px solid var(--border);
}

/* Tablo */
.doc-table-wrap {
  overflow-x: auto;
}

.doc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.doc-table thead {
  background: rgba(15, 23, 42, 0.5);
}

.doc-table th {
  text-align: left;
  padding: 0.7rem 1.25rem;
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.doc-row {
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}

.doc-row:last-child {
  border-bottom: none;
}

.doc-row:hover {
  background: rgba(56, 189, 248, 0.03);
}

.doc-table td {
  padding: 0.75rem 1.25rem;
  white-space: nowrap;
}

.doc-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: var(--text-primary);
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.doc-size,
.doc-date {
  color: var(--text-secondary);
  font-size: 0.82rem;
}

/* Tür Badge */
.type-badge {
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  letter-spacing: 0.5px;
}

/* Durum Badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 500;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status--pending {
  background: rgba(234, 179, 8, 0.1);
  color: #facc15;
  border: 1px solid rgba(234, 179, 8, 0.25);
}
.status--pending .status-dot {
  background: #facc15;
}

.status--processing {
  background: rgba(56, 189, 248, 0.1);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.25);
}
.status--processing .status-dot {
  background: #38bdf8;
  animation: pulse-dot 1.2s infinite ease-in-out;
}

.status--completed {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.25);
}
.status--completed .status-dot {
  background: #22c55e;
}

.status--failed {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.25);
}
.status--failed .status-dot {
  background: #ef4444;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.75); }
}

/* Boş Durum */
.doc-empty {
  padding: 2.5rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
</style>
