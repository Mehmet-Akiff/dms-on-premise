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

    <!-- Arama Sonuçları -->
    <div v-if="hasSearched" class="search-results">
      <div class="results-header">
        <span class="results-count">
          "<strong>{{ lastQuery }}</strong>" için {{ results.length }} sonuç bulundu
        </span>
        <button class="results-close" @click="clearSearch">Temizle</button>
      </div>

      <div v-if="results.length > 0" class="results-list">
        <div v-for="item in results" :key="item.id" class="result-card">
          <div class="result-top">
            <span class="result-name">{{ item.originalName }}</span>
            <span class="result-score" :title="`Eşleşme skoru: ${item.relevance}`">
              {{ (item.relevance * 100).toFixed(0) }}%
            </span>
          </div>
          <div class="result-category" v-if="item.category && item.category !== 'uncategorized'">
            {{ item.category }}
          </div>
          <div class="result-highlight" v-html="item.highlight"></div>
        </div>
      </div>

      <div v-else class="results-empty">
        <p>Eşleşen doküman bulunamadı.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const query = ref('')
const results = ref([])
const lastQuery = ref('')
const isSearching = ref(false)
const hasSearched = ref(false)

async function search() {
  const term = query.value.trim()
  if (term.length === 0) return

  isSearching.value = true
  hasSearched.value = true
  lastQuery.value = term

  try {
    const response = await fetch(`/api/documents/search?q=${encodeURIComponent(term)}`)
    if (response.ok) {
      const data = await response.json()
      results.value = data.results || []
      console.log(`[Search] "${term}" — ${results.value.length} sonuç`)
    } else {
      results.value = []
    }
  } catch (error) {
    console.error('[Search] Hata:', error)
    results.value = []
  } finally {
    isSearching.value = false
  }
}

function clearSearch() {
  query.value = ''
  results.value = []
  hasSearched.value = false
  lastQuery.value = ''
}
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

/* Sonuçlar */
.search-results {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.4);
}

.results-count {
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.results-count strong {
  color: var(--accent);
}

.results-close {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.72rem;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
  transition: all 0.2s;
}

.results-close:hover {
  border-color: var(--text-primary);
  color: var(--text-primary);
}

.results-list {
  display: flex;
  flex-direction: column;
}

.result-card {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}

.result-card:last-child {
  border-bottom: none;
}

.result-card:hover {
  background: rgba(56, 189, 248, 0.03);
}

.result-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.35rem;
}

.result-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
}

.result-score {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-glow);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

.result-category {
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  text-transform: capitalize;
}

.result-highlight {
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.6;
  background: var(--bg-primary);
  border-radius: 6px;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--border);
}

.result-highlight :deep(mark) {
  background: rgba(56, 189, 248, 0.25);
  color: var(--accent);
  padding: 0.1rem 0.2rem;
  border-radius: 3px;
}

.results-empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.85rem;
}
</style>
