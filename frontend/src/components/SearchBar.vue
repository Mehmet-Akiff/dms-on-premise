<template>
  <div class="search-container">
    <!-- Ana Arama Satırı -->
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
        <button
          v-if="query.length > 0"
          class="search-clear-btn"
          @click="clearSearch"
          title="Temizle"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <button class="search-submit" @click="search" :disabled="isSearching || query.trim().length === 0">
        <svg v-if="!isSearching" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <div v-else class="search-spinner"></div>
        {{ isSearching ? 'Aranıyor...' : 'Ara' }}
      </button>
    </div>

    <!-- Filtre Satırı -->
    <div class="filter-row">
      <!-- Arama Modu -->
      <div class="filter-group">
        <span class="filter-label">Mod:</span>
        <div class="filter-chips">
          <button
            v-for="m in modes"
            :key="m.value"
            class="filter-chip"
            :class="{ 'filter-chip--active': searchMode === m.value }"
            @click="setMode(m.value)"
          >
            <span class="chip-icon">{{ m.icon }}</span>
            {{ m.label }}
          </button>
        </div>
      </div>

      <!-- Ayırıcı -->
      <div class="filter-divider"></div>

      <!-- Dosya Türü -->
      <div class="filter-group">
        <span class="filter-label">Tür:</span>
        <div class="filter-chips">
          <button
            v-for="ft in fileTypes"
            :key="ft.value"
            class="filter-chip"
            :class="{ 'filter-chip--active': fileType === ft.value }"
            @click="setFileType(ft.value)"
          >
            <span class="chip-icon">{{ ft.icon }}</span>
            {{ ft.label }}
          </button>
        </div>
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
const isSearching = ref(false)

const modes = [
  { value: 'fuzzy', label: 'Akıllı', icon: '✨' },
  { value: 'broad', label: 'Geniş', icon: '🔍' },
  { value: 'exact', label: 'Katı', icon: '🎯' },
]

const fileTypes = [
  { value: 'all', label: 'Tümü', icon: '📁' },
  { value: 'pdf', label: 'PDF', icon: '📕' },
  { value: 'image', label: 'Resim', icon: '🖼️' },
]

function setMode(mode) {
  searchMode.value = mode
  if (query.value.trim().length > 0) search()
}

function setFileType(type) {
  fileType.value = type
  if (query.value.trim().length > 0) search()
}

async function search() {
  const term = query.value.trim()
  if (term.length === 0) return

  isSearching.value = true
  emit('loading', true)

  try {
    const response = await fetch(`/api/documents/search?q=${encodeURIComponent(term)}&mode=${searchMode.value}&fileType=${fileType.value}`)
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
  gap: 0.65rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.85rem 1rem;
}

/* ===== Ana Arama Satırı ===== */
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

/* ===== Filtre Satırı ===== */
.filter-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.filter-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.filter-divider {
  width: 1px;
  height: 20px;
  background: var(--border);
  flex-shrink: 0;
}

.filter-chips {
  display: flex;
  gap: 0.3rem;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.28rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.filter-chip:hover {
  border-color: rgba(56, 189, 248, 0.4);
  color: var(--text-primary);
  background: rgba(56, 189, 248, 0.05);
}

.filter-chip--active {
  background: var(--accent-glow);
  color: var(--accent);
  border-color: rgba(56, 189, 248, 0.4);
  font-weight: 600;
}

.chip-icon {
  font-size: 0.72rem;
  line-height: 1;
}
</style>
