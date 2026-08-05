<template>
  <div class="search-container" :class="{ 'ai-theme-active': isAISearch }">
    <!-- Üst Satır: AI Modu Toggle + Input + Ara Butonu -->
    <div class="search-row">
      <!-- Yapay Zeka Arama Modu Toggle -->
      <button 
        class="ai-toggle-btn" 
        :class="{ 'active': isAISearch }"
        @click="toggleAISearch"
        title="Yapay Zeka Destekli Doğal Dil Aramasını Aç/Kapat"
      >
        <svg class="ai-sparkle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z"/>
        </svg>
        {{ isAISearch ? ($t('search.aiMode') || 'AI Arama') : ($t('search.standardMode') || 'Standart') }}
      </button>

      <div class="search-input-group" :class="{ 'ai-focus': isAISearch }">
        <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          v-model="query"
          type="text"
          class="search-input"
          :placeholder="isAISearch ? 'Örn: bana mehmet beyin son faturalarını getir...' : ($t('search.placeholder') || 'Doküman adı veya içeriğinde ara...')"
          @keydown.enter="search"
        />
        <button v-if="query.length > 0" class="search-clear-btn" @click="clearSearch" title="Temizle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <button class="search-submit" :class="{ 'ai-submit': isAISearch }" @click="search" :disabled="isSearching">
        <svg v-if="!isSearching" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <div v-else class="search-spinner" :class="{ 'ai-spinner': isAISearch }"></div>
        {{ isSearching ? ($t('common.loading') || 'Aranıyor...') : ($t('search.searchBtn') || 'Ara') }}
      </button>
    </div>

    <!-- Yapay Zeka Analiz Sonuç Paneli -->
    <transition name="fade-slide">
      <div v-if="aiAnalysisResult && isAISearch" class="ai-analysis-banner">
        <div class="ai-banner-header">
          <svg class="sparkle-gold" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z"/>
          </svg>
          <strong>Yapay Zeka Analiz Raporu:</strong>
        </div>
        <div class="ai-banner-chips">
          <div class="ai-chip" v-if="aiAnalysisResult.category && aiAnalysisResult.category !== 'Tümü'">
            <span class="ai-chip-label">Kategori:</span>
            <span class="ai-chip-value">{{ aiAnalysisResult.category }}</span>
          </div>
          <div class="ai-chip ai-chip--exclude" v-if="aiAnalysisResult.excludeCategory">
            <span class="ai-chip-label">Kategori Hariç:</span>
            <span class="ai-chip-value">{{ aiAnalysisResult.excludeCategory }}</span>
          </div>
          <div class="ai-chip" v-if="aiAnalysisResult.fileType && aiAnalysisResult.fileType !== 'Tümü'">
            <span class="ai-chip-label">Dosya Türü:</span>
            <span class="ai-chip-value uppercase">{{ aiAnalysisResult.fileType }}</span>
          </div>
          <div class="ai-chip ai-chip--exclude" v-if="aiAnalysisResult.excludeFileType">
            <span class="ai-chip-label">Tür Hariç:</span>
            <span class="ai-chip-value uppercase">{{ aiAnalysisResult.excludeFileType }}</span>
          </div>
          <div class="ai-chip" v-if="aiAnalysisResult.cleanedQuery">
            <span class="ai-chip-label">Aranan Terim:</span>
            <span class="ai-chip-value">"{{ aiAnalysisResult.cleanedQuery }}"</span>
          </div>
          <div class="ai-chip ai-chip--exclude" v-if="aiAnalysisResult.excludeKeywords && aiAnalysisResult.excludeKeywords.length > 0">
            <span class="ai-chip-label">Kelimeler Hariç:</span>
            <span class="ai-chip-value">"{{ aiAnalysisResult.excludeKeywords.join(', ') }}"</span>
          </div>
        </div>
      </div>
    </transition>

    <!-- Alt Satır: Filtre Dropdown'ları (AI arama modunda devre dışı bırakılır) -->
    <div class="filter-row" :class="{ 'disabled-row': isAISearch }">
      <div class="filter-item">
        <label class="filter-label">{{ $t('search.mode') || 'Arama Modu' }}</label>
        <select v-model="searchMode" class="filter-select" :disabled="isAISearch" @change="onFilterChange">
          <option value="fuzzy">🧠 {{ $t('search.modeFuzzy') || 'Akıllı - Yazım hatalarını tolere eder, en esnek' }}</option>
          <option value="broad">🌐 {{ $t('search.modeBroad') || 'Geniş - Kelimenin kökünü veya parçasını arar' }}</option>
          <option value="exact">🎯 {{ $t('search.modeExact') || 'Katı - Birebir yazdığın gibi arar' }}</option>
        </select>
      </div>

      <div class="filter-item filter-item--sm">
        <label class="filter-label">{{ $t('search.category') || 'Kategori' }}</label>
        <select v-model="categoryFilter" class="filter-select" :disabled="isAISearch" @change="onFilterChange">
          <option value="all">📁 {{ $t('search.allCategories') || 'Tüm Kategoriler' }}</option>
          <option value="Fatura">🧾 Fatura</option>
          <option value="Bordro">💵 Bordro</option>
          <option value="Sozlesme">📝 Sözleşme</option>
          <option value="Rapor">📊 Rapor</option>
          <option value="Dilekce">✉️ Dilekçe</option>
          <option value="Diger">📌 Diğer</option>
        </select>
      </div>

      <div class="filter-item filter-item--sm">
        <label class="filter-label">{{ $t('search.fileType') || 'Dosya Türü' }}</label>
        <select v-model="fileType" class="filter-select" :disabled="isAISearch" @change="onFilterChange">
          <option value="all">📁 {{ $t('search.allFiles') || 'Tüm Dosyalar' }}</option>
          <option value="pdf">📕 Sadece PDF</option>
          <option value="image">🖼️ Resim (JPG, PNG)</option>
        </select>
      </div>

      <div class="filter-item filter-item--sm">
        <label class="filter-label">{{ $t('search.status') || 'Durum' }}</label>
        <select v-model="statusFilter" class="filter-select" @change="onFilterChange">
          <option value="all">{{ $t('search.allStatus') || 'Tümü' }}</option>
          <option value="completed">✅ Tamamlanan</option>
          <option value="pending">⏳ Bekleyen</option>
          <option value="failed">❌ Başarısız</option>
        </select>
      </div>

      <div class="filter-item filter-item--sm">
        <label class="filter-label">{{ $t('search.sort') || 'Sıralama' }}</label>
        <select v-model="sortOrder" class="filter-select" @change="onFilterChange">
          <option value="relevance">⭐ {{ $t('search.sortByRelevance') || 'Alaka Düzeyine Göre' }}</option>
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
const categoryFilter = ref('all')
const statusFilter = ref('all')
const sortOrder = ref('relevance')
const isSearching = ref(false)

// AI Arama State'leri
const isAISearch = ref(false)
const aiAnalysisResult = ref(null)

function toggleAISearch() {
  isAISearch.value = !isAISearch.value
  aiAnalysisResult.value = null
  search()
}

function onFilterChange() {
  search()
}

async function search() {
  const term = query.value.trim()

  isSearching.value = true
  emit('loading', true)
  aiAnalysisResult.value = null

  try {
    let url = ''
    let params = null

    if (isAISearch.value) {
      // 1. Yapay Zeka Arama Modu
      params = new URLSearchParams({
        q: term,
        status: statusFilter.value,
        sort: sortOrder.value,
      })
      url = `/api/documents/ai-search?${params}`
    } else {
      // 2. Normal Filtreli Arama Modu
      params = new URLSearchParams({
        q: term,
        mode: searchMode.value,
        fileType: fileType.value,
        category: categoryFilter.value,
        status: statusFilter.value,
        sort: sortOrder.value,
      })
      url = `/api/documents/search?${params}`
    }

    const token = localStorage.getItem('token')
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    if (response.ok) {
      const data = await response.json()
      
      // AI analiz raporu varsa kaydet
      if (data.aiAnalysis) {
        aiAnalysisResult.value = data.aiAnalysis
      }
      
      emit('results', data.results || [], data.aiAnalysis ? (data.aiAnalysis.cleanedQuery || term) : term)
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
  categoryFilter.value = 'all'
  statusFilter.value = 'all'
  sortOrder.value = 'relevance'
  isAISearch.value = false
  aiAnalysisResult.value = null
  emit('clear')
}

watch(query, (newVal) => {
  if (newVal.trim().length === 0) {
    emit('clear')
    aiAnalysisResult.value = null
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
  transition: all 0.3s ease;
}

/* AI Arama Modu Aktifken Arka Plan ve Neon Gölge */
.ai-theme-active {
  border-color: rgba(167, 139, 250, 0.45);
  box-shadow: 0 4px 20px rgba(167, 139, 250, 0.06);
}

/* ===== Üst Satır ===== */
.search-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

/* AI Arama Modu Aç-Kapat Butonu */
.ai-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  border-radius: 10px;
  padding: 0.55rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
  user-select: none;
}

.ai-toggle-btn:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.ai-toggle-btn.active {
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.15), rgba(139, 92, 246, 0.2));
  color: #c4b5fd;
  border-color: rgba(167, 139, 250, 0.6);
  box-shadow: 0 0 10px rgba(167, 139, 250, 0.1);
}

.ai-sparkle-icon {
  opacity: 0.7;
}
.ai-toggle-btn.active .ai-sparkle-icon {
  color: #c4b5fd;
  animation: pulse-glow 2s infinite alternate;
}

@keyframes pulse-glow {
  0% { transform: scale(1); filter: drop-shadow(0 0 1px #a78bfa); }
  100% { transform: scale(1.1); filter: drop-shadow(0 0 4px #a78bfa); }
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

.search-input-group.ai-focus:focus-within {
  border-color: rgba(167, 139, 250, 0.8);
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.12);
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

.search-submit.ai-submit {
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.25), rgba(139, 92, 246, 0.2));
  color: #c4b5fd;
  border-color: rgba(167, 139, 250, 0.5);
}

.search-submit.ai-submit:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.35), rgba(139, 92, 246, 0.3));
  border-color: rgba(167, 139, 250, 0.8);
  box-shadow: 0 4px 12px rgba(167, 139, 250, 0.2);
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

.search-spinner.ai-spinner {
  border-color: rgba(167, 139, 250, 0.2);
  border-top-color: #c4b5fd;
}

@keyframes spin-s {
  to { transform: rotate(360deg); }
}

/* ===== Yapay Zeka Analiz Bandı ===== */
.ai-analysis-banner {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: rgba(139, 92, 246, 0.05);
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
  margin-top: 0.2rem;
}

.ai-banner-header {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: #c4b5fd;
}

.sparkle-gold {
  color: #f59e0b;
}

.ai-banner-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.ai-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(139, 92, 246, 0.12);
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 5px;
  padding: 0.2rem 0.45rem;
  font-size: 0.7rem;
}

.ai-chip--exclude {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.3);
}

.ai-chip--exclude .ai-chip-label {
  color: #f87171;
}

.ai-chip--exclude .ai-chip-value {
  color: #fee2e2;
}

.ai-chip-label {
  color: #a78bfa;
  opacity: 0.85;
}

.ai-chip-value {
  color: #fef9c3;
  font-weight: 600;
}

/* ===== Alt Satır: Filtreler ===== */
.filter-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  transition: all 0.3s ease;
}

.filter-row.disabled-row {
  opacity: 0.45;
  pointer-events: none;
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

.filter-select:disabled {
  background-color: var(--bg-primary);
  border-color: var(--border);
  color: var(--text-secondary);
  opacity: 0.6;
  cursor: not-allowed;
}

/* Geçiş Animasyonları */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
