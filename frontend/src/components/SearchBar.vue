<template>
  <div class="search-container">
    <!-- Üst Satır: Input + Ara Butonu -->
    <div class="search-row">
      <div class="search-input-group">
        <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          v-model="query"
          type="text"
          class="search-input"
          placeholder="Doküman adı veya içeriğinde ara..."
          @keydown.enter="search"
        />
        <button v-if="query.length > 0" class="search-clear-btn" @click="clearSearch" title="Temizle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <button class="search-submit" @click="search" :disabled="isSearching || query.trim().length === 0">
        <svg v-if="!isSearching" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <div v-else class="search-spinner"></div>
        {{ isSearching ? 'Aranıyor...' : 'Ara' }}
      </button>
    </div>

    <!-- Alt Satır: Filtre Dropdown'ları -->
    <div class="filter-row">
      <div class="filter-item">
        <label class="filter-label">Arama Modu</label>
        <select v-model="searchMode" class="filter-select" @change="onFilterChange">
          <option value="fuzzy">🔮 Akıllı — Yazım hatalarını tolere eder, en esnek</option>
          <option value="broad">🔍 Geniş — Kelimenin kökünü veya parçasını arar</option>
          <option value="exact">🎯 Katı — Birebir yazdığın gibi arar (büyük/küçük harf duyarsız)</option>
        </select>
      </div>

      <div class="filter-item filter-item--sm">
        <label class="filter-label">Dosya Türü</label>
        <select v-model="fileType" class="filter-select" @change="onFilterChange">
          <option value="all">📁 Tüm Dosyalar</option>
          <option value="pdf">📕 Sadece PDF</option>
          <option value="image">🖼️ Sadece Resim (JPG, PNG)</option>
        </select>
      </div>

      <div class="filter-item filter-item--sm">
        <label class="filter-label">Durum</label>
        <select v-model="statusFilter" class="filter-select" @change="onFilterChange">
          <option value="all">Tümü</option>
          <option value="completed">✅ Tamamlanan</option>
          <option value="pending">⏳ Bekleyen</option>
          <option value="failed">❌ Başarısız</option>
        </select>
      </div>

      <div class="filter-item filter-item--sm">
        <label class="filter-label">Sıralama</label>
        <select v-model="sortOrder" class="filter-select" @change="onFilterChange">
          <option value="relevance">⭐ Alaka Düzeyine Göre</option>
          <option value="newest">📅 En Yeni Önce</option>
          <option value="oldest">📅 En Eski Önce</option>
          <option value="name_asc">🔤 A → Z</option>
          <option value="name_desc">🔤 Z → A</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const emit = defineEmits(['results', 'clear', 'loading'])
const query = ref('')
const searchMode = ref('fuzzy')
const fileType = ref('all')
const statusFilter = ref('all')
const sortOrder = ref('relevance')
const isSearching = ref(false)

function onFilterChange() {
  if (query.value.trim().length > 0) search()
}

async function search() {
  const term = query.value.trim()
  if (term.length === 0) return

  isSearching.value = true
  emit('loading', true)

  try {
    const params = new URLSearchParams({
      q: term,
      mode: searchMode.value,
      fileType: fileType.value,
      status: statusFilter.value,
      sort: sortOrder.value,
    })
    const response = await fetch(`/api/documents/search?${params}`)
    if (response.ok) {
      const data = await response.json()
      emit('results', data.results || [], term)
    } else {
      emit('results', [], term)
    }
  } catch (error) {
    console.error('[Search] Hata:', error)
    emit('results', [], term)
  } finally {
    isSearching.value = false
    emit('loading', false)
  }
}

function clearSearch() {
  query.value = ''
  searchMode.value = 'fuzzy'
  fileType.value = 'all'
  statusFilter.value = 'all'
  sortOrder.value = 'relevance'
  emit('clear')
}

watch(query, (newVal) => {
  if (newVal.trim().length === 0) {
    emit('clear')
  }
})
</script>

<style scoped>
.search-container {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.85rem 1rem;
}

/* ===== Üst Satır ===== */
.search-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.search-input-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.55rem 0.85rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-width: 0;
}

.search-input-group:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.08);
}

.search-icon {
  color: var(--text-secondary);
  opacity: 0.5;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.88rem;
  font-family: inherit;
  min-width: 0;
}

.search-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.45;
}

.search-clear-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.15rem;
  display: flex;
  align-items: center;
  opacity: 0.4;
  transition: opacity 0.15s, color 0.15s;
  flex-shrink: 0;
}

.search-clear-btn:hover {
  opacity: 1;
  color: #ef4444;
}

.search-submit {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(167, 139, 250, 0.15));
  color: var(--accent);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 10px;
  padding: 0.55rem 1rem;
  font-size: 0.82rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  flex-shrink: 0;
}

.search-submit:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.35), rgba(167, 139, 250, 0.25));
  border-color: var(--accent);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(56, 189, 248, 0.15);
}

.search-submit:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.search-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(56, 189, 248, 0.2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin-s 0.6s linear infinite;
}

@keyframes spin-s {
  to { transform: rotate(360deg); }
}

/* ===== Alt Satır: Filtreler ===== */
.filter-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-item {
  flex: 1 1 140px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.filter-item--sm {
  flex: 1 1 110px;
}

.filter-label {
  font-size: 0.62rem;
  font-weight: 700;
  color: var(--text-secondary);
  opacity: 0.55;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  padding-left: 0.15rem;
}

.filter-select {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  border-radius: 8px;
  padding: 0.4rem 0.55rem;
  font-size: 0.75rem;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  padding-right: 1.5rem;
  text-overflow: ellipsis;
}

.filter-select:hover,
.filter-select:focus {
  border-color: var(--accent);
  color: var(--text-primary);
}
</style>
