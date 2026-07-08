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
      <div class="doc-header-actions">
        <span v-if="isPolling" class="polling-indicator" title="Otomatik güncelleme aktif">
          <span class="polling-dot"></span>
          Canlı
        </span>
        <span class="doc-count">{{ documents.length }} doküman</span>
      </div>
    </div>

    <!-- Yükleniyor -->
    <div v-if="isLoading && documents.length === 0" class="doc-loading">
      <div class="spinner-sm"></div>
      <p>Dokümanlar yükleniyor...</p>
    </div>

    <!-- Tablo -->
    <div class="doc-table-wrap" v-else-if="documents.length > 0">
      <table class="doc-table">
        <thead>
          <tr>
            <th>Dosya Adı</th>
            <th>Tür</th>
            <th>Durum</th>
            <th>Tarih</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="doc in documents"
            :key="doc.id"
            class="doc-row"
          >
            <td class="doc-name">
              <span class="doc-icon">{{ getFileIcon(doc.mimeType || doc.mime_type) }}</span>
              {{ doc.originalName || doc.original_name }}
            </td>
            <td>
              <span class="type-badge">{{ getTypeLabel(doc.mimeType || doc.mime_type) }}</span>
            </td>
            <td>
              <span class="status-badge" :class="'status--' + (doc.status || '').toLowerCase()">
                <span class="status-dot"></span>
                {{ getStatusLabel(doc.status) }}
              </span>
            </td>
            <td class="doc-date">{{ formatDate(doc.createdAt || doc.created_at) }}</td>
            <td class="doc-actions">
              <button
                v-if="doc.status === 'COMPLETED'"
                class="action-btn"
                @click="openDetail(doc)"
                title="OCR Metnini Görüntüle"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              <span v-else-if="doc.status === 'PROCESSING'" class="action-hint">
                <div class="spinner-xs"></div>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Boş Durum -->
    <div v-else class="doc-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3; margin-bottom:0.75rem">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
        <polyline points="13 2 13 9 20 9"/>
      </svg>
      <p>Henüz yüklenmiş doküman bulunmuyor.</p>
      <p class="doc-empty-sub">Sol panelden dosya yükleyerek başlayabilirsiniz.</p>
    </div>

    <!-- OCR Detay Modalı -->
    <Transition name="modal">
      <div v-if="selectedDoc" class="modal-overlay" @click.self="closeDetail">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title-wrap">
              <h3 class="modal-title">{{ selectedDoc.originalName || selectedDoc.original_name }}</h3>
              <span class="status-badge status--completed" style="font-size:0.72rem">
                <span class="status-dot"></span>
                Tamamlandı
              </span>
            </div>
            <button class="modal-close" @click="closeDetail">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Meta Bilgiler -->
          <div class="modal-meta" v-if="detailData">
            <div class="meta-item" v-if="detailData.metadata?.category">
              <span class="meta-label">Kategori</span>
              <span class="meta-value">{{ detailData.metadata.category }}</span>
            </div>
            <div class="meta-item" v-if="detailData.metadata?.confidence">
              <span class="meta-label">Güven Skoru</span>
              <span class="meta-value">{{ (detailData.metadata.confidence * 100).toFixed(0) }}%</span>
            </div>
          </div>

          <!-- OCR Çıktısı -->
          <div class="modal-body">
            <div v-if="isLoadingDetail" class="modal-loading">
              <div class="spinner-sm"></div>
              <p>OCR metni yükleniyor...</p>
            </div>
            <div v-else-if="detailData?.metadata?.extracted_text || detailData?.metadata?.extractedText" class="ocr-output">
              <div class="ocr-header">
                <span class="ocr-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
                  </svg>
                  Çıkarılan Metin (OCR)
                </span>
              </div>
              <pre class="ocr-text">{{ detailData.metadata.extracted_text || detailData.metadata.extractedText }}</pre>
            </div>
            <div v-else class="modal-empty">
              <p>Bu doküman için henüz çıkarılmış metin bulunmuyor.</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const documents = ref([])
const isLoading = ref(true)
const isPolling = ref(false)
const selectedDoc = ref(null)
const detailData = ref(null)
const isLoadingDetail = ref(false)

let pollInterval = null

// ============================================================
// Doküman Listesini Çek
// ============================================================

async function fetchDocuments() {
  try {
    const response = await fetch('/api/documents')
    if (response.ok) {
      const data = await response.json()
      documents.value = data.documents || []
    }
  } catch (error) {
    console.error('[DocumentList] Veri çekme hatası:', error)
  } finally {
    isLoading.value = false
  }
}

// ============================================================
// Polling (5 saniyede bir güncelleme)
// ============================================================

function startPolling() {
  isPolling.value = true
  pollInterval = setInterval(() => {
    fetchDocuments()
  }, 5000)
  console.log('[DocumentList] Polling başlatıldı (5s aralık)')
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  isPolling.value = false
}

// ============================================================
// Doküman Detay Modalı
// ============================================================

async function openDetail(doc) {
  selectedDoc.value = doc
  isLoadingDetail.value = true
  detailData.value = null

  try {
    const response = await fetch(`/api/documents/${doc.id}`)
    if (response.ok) {
      const data = await response.json()
      detailData.value = data.document || data
      console.log('[DocumentList] Detay yüklendi:', doc.id)
    }
  } catch (error) {
    console.error('[DocumentList] Detay yükleme hatası:', error)
  } finally {
    isLoadingDetail.value = false
  }
}

function closeDetail() {
  selectedDoc.value = null
  detailData.value = null
}

// ============================================================
// Dışarıdan tetiklenebilir yenile fonksiyonu
// ============================================================

function refresh() {
  fetchDocuments()
}

defineExpose({ refresh })

// ============================================================
// Yardımcı Fonksiyonlar
// ============================================================

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

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ============================================================
// Yaşam Döngüsü (Lifecycle)
// ============================================================

onMounted(() => {
  fetchDocuments()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})
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

.doc-header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.polling-indicator {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-weight: 500;
  color: #22c55e;
}

.polling-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  animation: pulse-poll 1.5s infinite ease-in-out;
}

@keyframes pulse-poll {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.doc-count {
  font-size: 0.78rem;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  border: 1px solid var(--border);
}

/* Loading */
.doc-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-secondary);
  font-size: 0.88rem;
}

.spinner-sm {
  width: 24px;
  height: 24px;
  border: 2.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-xs {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
.status--pending .status-dot { background: #facc15; }

.status--processing {
  background: rgba(56, 189, 248, 0.1);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.25);
}
.status--processing .status-dot {
  background: #38bdf8;
  animation: pulse-poll 1.2s infinite ease-in-out;
}

.status--completed {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.25);
}
.status--completed .status-dot { background: #22c55e; }

.status--failed {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.25);
}
.status--failed .status-dot { background: #ef4444; }

/* Action Button */
.doc-actions {
  text-align: center;
}

.action-btn {
  background: var(--accent-glow);
  color: var(--accent);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 8px;
  padding: 0.35rem 0.5rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(56, 189, 248, 0.25);
  border-color: var(--accent);
  transform: scale(1.05);
}

.action-hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Boş Durum */
.doc-empty {
  padding: 3rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.doc-empty-sub {
  font-size: 0.78rem;
  opacity: 0.6;
  margin-top: 0.25rem;
}

/* ============================================================
   MODAL
   ============================================================ */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  padding: 2rem;
}

.modal {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: 100%;
  max-width: 680px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
}

.modal-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.modal-close {
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.35rem;
  display: flex;
  align-items: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.modal-close:hover {
  border-color: var(--text-primary);
  color: var(--text-primary);
}

.modal-meta {
  display: flex;
  gap: 1.5rem;
  padding: 0.85rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.4);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.meta-label {
  font-size: 0.68rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.meta-value {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.modal-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.modal-empty {
  text-align: center;
  color: var(--text-secondary);
  padding: 2rem;
  font-size: 0.88rem;
}

.ocr-output {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ocr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ocr-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.76rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ocr-label svg {
  color: var(--accent);
}

.ocr-text {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.25rem;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 0.82rem;
  line-height: 1.7;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow-y: auto;
}

/* Modal Transition */
.modal-enter-active {
  animation: modal-in 0.3s ease;
}
.modal-leave-active {
  animation: modal-in 0.2s ease reverse;
}

@keyframes modal-in {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
