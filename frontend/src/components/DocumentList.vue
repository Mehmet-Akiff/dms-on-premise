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
        {{ isSearchMode ? 'Arama Sonuçları' : 'Son Yüklenen Dokümanlar' }}
      </h2>
      <div class="doc-header-actions">
        <span v-if="isPolling && !isSearchMode" class="polling-indicator" title="Otomatik güncelleme aktif">
          <span class="polling-dot"></span>
          Canlı
        </span>
        <span v-if="isSearchMode" class="search-badge">
          "<strong>{{ searchQuery }}</strong>" için {{ documents.length }} sonuç
        </span>
        <span v-else class="doc-count">{{ documents.length }} doküman</span>
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
          <!-- Kesin Eşleşmeler -->
          <template v-for="doc in primaryResults" :key="doc.id">
            <tr class="doc-row">
              <td class="doc-name">
                <span class="doc-icon">{{ getFileIcon(doc.mimeType || doc.mime_type) }}</span>
                <span class="doc-name-text">{{ doc.originalName || doc.original_name }}</span>
                <span v-if="isSearchMode && doc.matchLocation" class="match-badge" :class="'match--' + doc.matchLocation">
                  {{ doc.matchLocation === 'filename' ? '📌 Adında' : '📄 İçerikte' }}
                </span>
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
            <!-- Arama Highlight Satırı -->
            <tr v-if="isSearchMode && doc.highlight" class="doc-row-highlight">
              <td colspan="5">
                <div class="search-highlight" v-html="doc.highlight"></div>
              </td>
            </tr>
          </template>

          <!-- Olası Eşleşmeler Ayırıcı -->
          <tr v-if="isSearchMode && dimmedResults.length > 0 && primaryResults.length > 0" class="dimmed-separator-row">
            <td colspan="5">
              <div class="dimmed-separator">
                <div class="dimmed-separator-line"></div>
                <span class="dimmed-separator-text">💡 Olası Eşleşmeler ({{ dimmedResults.length }})</span>
                <div class="dimmed-separator-line"></div>
              </div>
            </td>
          </tr>

          <!-- Olası (Dimmed) Eşleşmeler -->
          <template v-for="doc in dimmedResults" :key="'dim-' + doc.id">
            <tr class="doc-row doc-row--dimmed">
              <td class="doc-name">
                <span class="doc-icon">{{ getFileIcon(doc.mimeType || doc.mime_type) }}</span>
                <span class="doc-name-text">{{ doc.originalName || doc.original_name }}</span>
                <span v-if="doc.matchLocation" class="match-badge" :class="'match--' + doc.matchLocation">
                  {{ doc.matchLocation === 'filename' ? '📌 Adında' : '📄 İçerikte' }}
                </span>
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
            <tr v-if="isSearchMode && doc.highlight" class="doc-row-highlight doc-row--dimmed">
              <td colspan="5">
                <div class="search-highlight" v-html="doc.highlight"></div>
              </td>
            </tr>
          </template>
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
                
                <!-- Doküman içi arama çubuğu -->
                <div class="doc-search-box">
                  <input
                    v-model="docSearchQuery"
                    type="text"
                    class="doc-search-input"
                    placeholder="Metin içinde ara..."
                    @input="onDocSearch"
                    @keydown.enter.prevent="nextMatch"
                  />
                  <div class="doc-search-nav" v-if="matchCount > 0">
                    <span class="doc-search-count">{{ activeMatchIndex + 1 }} / {{ matchCount }}</span>
                    <button class="doc-nav-btn" @click="prevMatch" title="Önceki">▲</button>
                    <button class="doc-nav-btn" @click="nextMatch" title="Sonraki">▼</button>
                  </div>
                </div>
              </div>
              <pre class="ocr-text" v-html="highlightedOcrHtml"></pre>
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
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

const documents = ref([])
const isLoading = ref(true)
const isPolling = ref(false)
const isSearchMode = ref(false)
const searchQuery = ref('')
const selectedDoc = ref(null)
const detailData = ref(null)
const isLoadingDetail = ref(false)

let pollInterval = null

// Doküman içi arama durumları
const docSearchQuery = ref('')
const matchCount = ref(0)
const activeMatchIndex = ref(0)
const highlightedOcrHtml = ref('')

// ============================================================
// Computed: Kesin ve Olası Sonuçlar
// ============================================================

const primaryResults = computed(() => {
  if (!isSearchMode.value) return documents.value
  return documents.value.filter(d => !d.isDimmed)
})

const dimmedResults = computed(() => {
  if (!isSearchMode.value) return []
  return documents.value.filter(d => d.isDimmed)
})

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
// Doküman Detay Modalı ve İçerik Arama Mantığı
// ============================================================

function getHighlightedHtml(text, query) {
  if (!text) return '';
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  if (!query || query.trim().length === 0) {
    matchCount.value = 0;
    activeMatchIndex.value = 0;
    return escaped;
  }

  const term = query.trim();
  const escapedTerm = term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedTerm})`, 'gi');
  
  let matchId = 0;
  const highlighted = escaped.replace(regex, (match) => {
    const id = matchId++;
    return `<span class="doc-match" data-match-index="${id}">${match}</span>`;
  });

  matchCount.value = matchId;
  return highlighted;
}

function updateActiveMatch() {
  nextTick(() => {
    const container = document.querySelector('.ocr-text');
    if (!container) return;

    const matches = container.querySelectorAll('.doc-match');
    matches.forEach((el, idx) => {
      if (idx === activeMatchIndex.value) {
        el.classList.add('doc-match--active');
        
        // Sadece container elementini kaydır
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        container.scrollTop = container.scrollTop + (elRect.top - containerRect.top) - (containerRect.height / 2) + (elRect.height / 2);
      } else {
        el.classList.remove('doc-match--active');
      }
    });
  });
}

function onDocSearch() {
  activeMatchIndex.value = 0;
  updateHighlightHtml();
}

function nextMatch() {
  if (matchCount.value === 0) return;
  activeMatchIndex.value = (activeMatchIndex.value + 1) % matchCount.value;
  updateActiveMatch();
}

function prevMatch() {
  if (matchCount.value === 0) return;
  activeMatchIndex.value = (activeMatchIndex.value - 1 + matchCount.value) % matchCount.value;
  updateActiveMatch();
}

function updateHighlightHtml() {
  const text = detailData.value?.metadata?.extracted_text || detailData.value?.metadata?.extractedText || '';
  highlightedOcrHtml.value = getHighlightedHtml(text, docSearchQuery.value);
  updateActiveMatch();
}

watch([docSearchQuery, detailData], () => {
  updateHighlightHtml();
});

async function openDetail(doc) {
  selectedDoc.value = doc
  isLoadingDetail.value = true
  detailData.value = null
  docSearchQuery.value = searchQuery.value || '' // Arama sorgusuyla başlat
  activeMatchIndex.value = 0

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
  docSearchQuery.value = ''
  matchCount.value = 0
  activeMatchIndex.value = 0
  highlightedOcrHtml.value = ''
}

// ============================================================
// Dışarıdan tetiklenebilir yenile fonksiyonu
// ============================================================

function refresh() {
  if (!isSearchMode.value) {
    fetchDocuments()
  }
}

// ============================================================
// Arama Fonksiyonları
// ============================================================

function setLoading(state) {
  isLoading.value = state
  if (state) documents.value = []
}

function setSearchResults(results, term) {
  stopPolling() // Arama modunda polling'i durdur
  documents.value = results
  isSearchMode.value = true
  searchQuery.value = term
  isLoading.value = false
}

function clearSearch() {
  isSearchMode.value = false
  searchQuery.value = ''
  isLoading.value = true
  fetchDocuments()
  startPolling()
}

defineExpose({ refresh, setLoading, setSearchResults, clearSearch })

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

.search-badge {
  font-size: 0.78rem;
  color: var(--accent);
  background: var(--accent-glow);
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.3);
}
.search-badge strong {
  color: #fff;
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

.doc-row--dimmed {
  opacity: 0.5;
}

.doc-row--dimmed:hover {
  opacity: 0.72;
}

/* Olası Eşleşmeler Ayırıcı */
.dimmed-separator-row {
  border: none !important;
}

.dimmed-separator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 0;
}

.dimmed-separator-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--border), transparent);
}

.dimmed-separator-text {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
  opacity: 0.7;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.doc-row-highlight {
  border-bottom: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.3);
}

.search-highlight {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.6;
  padding: 0 1.25rem 1rem 3.5rem;
}

.search-highlight :deep(mark) {
  background: linear-gradient(120deg, rgba(250, 204, 21, 0.4) 0%, rgba(74, 222, 128, 0.35) 100%);
  color: #fef9c3;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(250, 204, 21, 0.15);
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
  max-width: 380px;
  overflow: hidden;
}

.doc-name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

/* Eşleşme Konumu Badge */
.match-badge {
  flex-shrink: 0;
  font-size: 0.62rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: 6px;
  white-space: nowrap;
  letter-spacing: 0.3px;
}

.match--filename {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.25);
}

.match--content {
  background: rgba(56, 189, 248, 0.1);
  color: #7dd3fc;
  border: 1px solid rgba(56, 189, 248, 0.2);
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
  gap: 1rem;
  flex-wrap: wrap;
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

/* Doküman içi arama çubuğu */
.doc-search-box {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.25rem 0.55rem;
  max-width: 280px;
  transition: border-color 0.2s;
}

.doc-search-box:focus-within {
  border-color: var(--accent);
}

.doc-search-input {
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.75rem;
  font-family: inherit;
  width: 130px;
}

.doc-search-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.5;
}

.doc-search-nav {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  border-left: 1px solid var(--border);
  padding-left: 0.35rem;
}

.doc-search-count {
  font-size: 0.68rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.doc-nav-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.1rem 0.2rem;
  font-size: 0.65rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
}

.doc-nav-btn:hover {
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
  position: relative;
}

/* Match Highlights (Fosforlu Kalem) */
.ocr-text :deep(.doc-match) {
  background: rgba(250, 204, 21, 0.35);
  color: #fff;
  border-radius: 2px;
  transition: all 0.15s;
  padding: 0.05rem 0.1rem;
}

.ocr-text :deep(.doc-match--active) {
  background: linear-gradient(120deg, rgba(34, 197, 94, 0.75) 0%, rgba(74, 222, 128, 0.7) 100%) !important;
  color: #ffffff !important;
  box-shadow: 0 0 10px rgba(74, 222, 128, 0.6), 0 2px 4px rgba(0, 0, 0, 0.2);
  font-weight: 600;
  transform: scale(1.03);
  display: inline-block;
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
