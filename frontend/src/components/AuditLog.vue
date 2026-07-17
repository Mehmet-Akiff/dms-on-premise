<template>
  <div class="audit-log-panel">
    <!-- Başlık -->
    <div class="audit-header">
      <div class="audit-title-group">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <div>
          <h2 class="audit-title">İşlem Geçmişi</h2>
          <p class="audit-subtitle">Sistem üzerinde yapılan tüm aksiyonların kronolojik kaydı</p>
        </div>
      </div>
      <span class="audit-badge" v-if="totalCount > 0">{{ totalCount }} kayıt</span>
    </div>

    <!-- Filtreler -->
    <div class="audit-filters">
      <div class="filter-group">
        <label class="filter-label">Aksiyon</label>
        <select v-model="filterAction" @change="fetchLogs(1)" class="filter-select">
          <option value="">Tümü</option>
          <option value="UPLOAD">📤 Yükleme</option>
          <option value="UPDATE">✏️ Güncelleme</option>
          <option value="DELETE">🗑️ Silme (Çöp Kutusu)</option>
          <option value="FORCE_DELETE">💀 Kalıcı Silme</option>
          <option value="RESTORE">♻️ Geri Yükleme</option>
          <option value="BULK_DELETE">📦 Toplu Silme</option>
          <option value="LOGIN">🔑 Giriş</option>
          <option value="LOGOUT">🔒 Çıkış / İnaktiflik</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Başlangıç</label>
        <input type="date" v-model="filterStartDate" @change="fetchLogs(1)" class="filter-input" />
      </div>
      <div class="filter-group">
        <label class="filter-label">Bitiş</label>
        <input type="date" v-model="filterEndDate" @change="fetchLogs(1)" class="filter-input" />
      </div>
      <button class="filter-clear-btn" @click="clearFilters" title="Filtreleri Temizle">
        🔄 Sıfırla
      </button>
    </div>

    <!-- Yükleniyor -->
    <div v-if="isLoading" class="audit-loading">
      <div class="spinner"></div>
      <p>İşlem geçmişi yükleniyor...</p>
    </div>

    <!-- Boş Durum -->
    <div v-else-if="logs.length === 0" class="audit-empty">
      <span class="audit-empty-icon">📋</span>
      <p>Henüz kayıtlı işlem geçmişi bulunmuyor.</p>
    </div>

    <!-- Log Tablosu -->
    <div v-else class="audit-table-wrap">
      <table class="audit-table">
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Kullanıcı</th>
            <th>Aksiyon</th>
            <th>Belge</th>
            <th>Detay</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id" class="audit-row">
            <td class="audit-date">{{ formatDate(log.createdAt || log.created_at) }}</td>
            <td class="audit-user">
              <span class="user-avatar">{{ getInitials(log.userName || log.user_name) }}</span>
              <span>{{ log.userName || log.user_name || '—' }}</span>
            </td>
            <td>
              <span class="action-badge" :class="'action--' + (log.action || '').toLowerCase()">
                {{ getActionIcon(log.action) }} {{ getActionLabel(log.action) }}
              </span>
            </td>
            <td class="audit-doc-name">{{ log.documentName || log.document_name || '—' }}</td>
            <td class="audit-details">{{ log.details || '—' }}</td>
            <td class="audit-ip">{{ log.ipAddress || log.ip_address || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Sayfalama -->
    <div v-if="totalPages > 1" class="audit-pagination">
      <button 
        class="page-btn" 
        :disabled="currentPage <= 1" 
        @click="fetchLogs(currentPage - 1)"
      >
        ← Önceki
      </button>
      <span class="page-info">Sayfa {{ currentPage }} / {{ totalPages }}</span>
      <button 
        class="page-btn" 
        :disabled="currentPage >= totalPages" 
        @click="fetchLogs(currentPage + 1)"
      >
        Sonraki →
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const logs = ref([])
const isLoading = ref(true)
const totalCount = ref(0)
const currentPage = ref(1)
const totalPages = ref(1)

// Filtreler
const filterAction = ref('')
const filterStartDate = ref('')
const filterEndDate = ref('')

async function fetchLogs(page = 1) {
  isLoading.value = true
  const token = localStorage.getItem('token')

  try {
    const params = new URLSearchParams()
    params.set('page', page)
    params.set('limit', '25')
    if (filterAction.value) params.set('action', filterAction.value)
    if (filterStartDate.value) params.set('startDate', filterStartDate.value)
    if (filterEndDate.value) params.set('endDate', filterEndDate.value)

    const response = await fetch(`/api/documents/audit-logs?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      logs.value = data.logs || []
      totalCount.value = data.totalCount || 0
      currentPage.value = data.currentPage || 1
      totalPages.value = data.totalPages || 1
    } else {
      console.error('[AuditLog] API hatası:', response.status)
    }
  } catch (error) {
    console.error('[AuditLog] Veri çekme hatası:', error)
  } finally {
    isLoading.value = false
  }
}

function clearFilters() {
  filterAction.value = ''
  filterStartDate.value = ''
  filterEndDate.value = ''
  fetchLogs(1)
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}

function getActionIcon(action) {
  const icons = {
    UPLOAD: '📤',
    UPDATE: '✏️',
    DELETE: '🗑️',
    FORCE_DELETE: '💀',
    RESTORE: '♻️',
    BULK_DELETE: '📦',
    LOGIN: '🔑',
    LOGOUT: '🔒',
  }
  return icons[action] || '📋'
}

function getActionLabel(action) {
  const labels = {
    UPLOAD: 'Yükleme',
    UPDATE: 'Güncelleme',
    DELETE: 'Silme',
    FORCE_DELETE: 'Kalıcı Silme',
    RESTORE: 'Geri Yükleme',
    BULK_DELETE: 'Toplu Silme',
    LOGIN: 'Giriş',
    LOGOUT: 'Çıkış / İnaktiflik',
  }
  return labels[action] || action
}

onMounted(() => {
  fetchLogs(1)
})
</script>

<style scoped>
.audit-log-panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.audit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
}

.audit-title-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.audit-title-group svg {
  color: var(--accent);
  opacity: 0.85;
}

.audit-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.audit-subtitle {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0.15rem 0 0;
  opacity: 0.7;
}

.audit-badge {
  font-size: 0.75rem;
  color: var(--accent);
  background: var(--accent-glow);
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.3);
  font-weight: 600;
}

/* Filtreler */
.audit-filters {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.3);
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.filter-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.filter-select,
.filter-input {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 0.45rem 0.75rem;
  border-radius: 8px;
  font-size: 0.82rem;
  transition: border-color 0.2s;
}

.filter-select:focus,
.filter-input:focus {
  outline: none;
  border-color: var(--accent);
}

.filter-clear-btn {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #f87171;
  padding: 0.45rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-clear-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
}

/* Loading */
.audit-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-secondary);
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty State */
.audit-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem;
  color: var(--text-secondary);
}

.audit-empty-icon {
  font-size: 2rem;
  opacity: 0.5;
}

/* Table */
.audit-table-wrap {
  overflow-x: auto;
}

.audit-table {
  width: 100%;
  border-collapse: collapse;
}

.audit-table thead {
  background: rgba(15, 23, 42, 0.4);
}

.audit-table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.audit-row {
  transition: background 0.15s ease;
}

.audit-row:hover {
  background: rgba(56, 189, 248, 0.03);
}

.audit-row td {
  padding: 0.7rem 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.06);
  font-size: 0.82rem;
  color: var(--text-primary);
  vertical-align: middle;
}

.audit-date {
  white-space: nowrap;
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.audit-user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(56, 189, 248, 0.3));
  color: #e2e8f0;
  font-size: 0.65rem;
  font-weight: 700;
  flex-shrink: 0;
}

.audit-doc-name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audit-details {
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
  font-size: 0.78rem;
}

.audit-ip {
  font-size: 0.75rem;
  color: var(--text-secondary);
  opacity: 0.7;
  font-family: monospace;
}

/* Action Badges */
.action-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}

.action--upload {
  background: rgba(34, 197, 94, 0.1);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.action--update {
  background: rgba(56, 189, 248, 0.1);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.2);
}

.action--delete {
  background: rgba(251, 146, 60, 0.1);
  color: #fb923c;
  border: 1px solid rgba(251, 146, 60, 0.2);
}

.action--force_delete {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.action--restore {
  background: rgba(139, 92, 246, 0.1);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.2);
}

.action--bulk_delete {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.action--login {
  background: rgba(250, 204, 21, 0.1);
  color: #fbbf24;
  border: 1px solid rgba(250, 204, 21, 0.2);
}

.action--logout {
  background: rgba(148, 163, 184, 0.1);
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

/* Pagination */
.audit-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
}

.page-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 0.45rem 1rem;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 500;
}
</style>
