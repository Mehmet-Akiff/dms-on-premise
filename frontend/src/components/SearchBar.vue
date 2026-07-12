<template>
  <div class="search-wrapper">
    <div class="search-box">
      <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        v-model="query"
        type="text"
        class="search-input"
        placeholder="Doküman içeriğinde ara..."
        @keydown.enter="search"
      />
      
      <!-- Arama Modu Seçici -->
      <select v-model="searchMode" class="search-mode-select" title="Arama Hassasiyeti" @change="search">
        <option value="broad">Geniş (Herhangi bir yerde)</option>
        <option value="exact">Katı (Tam eşleşme)</option>
        <option value="fuzzy">Akıllı (Yazım hatası toleranslı)</option>
      </select>

      <button
        v-if="query.length > 0"
        class="search-clear"
        @click="clearSearch"
        title="Temizle"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <button class="search-btn" @click="search" :disabled="isSearching || query.trim().length === 0">
        {{ isSearching ? 'Aranıyor...' : 'Ara' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const emit = defineEmits(['results', 'clear', 'loading'])
const query = ref('')
const searchMode = ref('broad')
const isSearching = ref(false)

async function search() {
  const term = query.value.trim()
  if (term.length === 0) return

  isSearching.value = true
  emit('loading', true)

  try {
    const response = await fetch(`/api/documents/search?q=${encodeURIComponent(term)}&mode=${searchMode.value}`)
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
  emit('clear')
}

watch(query, (newVal) => {
  if (newVal.trim().length === 0) {
    emit('clear')
  }
})
</script>

<style scoped>
.search-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
  transition: border-color 0.2s;
}

.search-box:focus-within {
  border-color: var(--accent);
}

.search-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
  opacity: 0.6;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.88rem;
  font-family: inherit;
}

.search-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.5;
}

.search-mode-select {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  transition: all 0.2s;
}

.search-mode-select:hover, .search-mode-select:focus {
  border-color: var(--accent);
  color: var(--text-primary);
}

.search-clear {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.2rem;
  display: flex;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.search-clear:hover {
  opacity: 1;
}

.search-btn {
  background: var(--accent-glow);
  color: var(--accent);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 8px;
  padding: 0.4rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.search-btn:hover:not(:disabled) {
  background: rgba(56, 189, 248, 0.25);
}

.search-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
