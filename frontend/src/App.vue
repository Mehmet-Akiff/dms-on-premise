<template>
  <div id="dms-app">
    <!-- Header -->
    <header class="dms-header">
      <div class="header-inner">
        <div class="logo">
          <span class="logo-icon">📄</span>
          <h1>DMS</h1>
          <span class="badge">On-Premise</span>
        </div>
        <p class="subtitle">Yapay Zeka Destekli Akıllı Doküman Yönetim Sistemi</p>
      </div>
      <div class="header-status">
        <span class="status-indicator status-indicator--online"></span>
        <span class="status-text">Sistem Aktif</span>
      </div>
    </header>

    <!-- Ana İçerik -->
    <main class="dms-main">
      <!-- Sol Panel: Dosya Yükleme -->
      <section class="panel panel--upload">
        <h3 class="panel-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Doküman Yükle
        </h3>
        <FileUpload @uploaded="onDocumentUploaded" />
        <div class="panel-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Tüm dosyalar yerel sunucuda güvenle işlenir. Veri dışarı çıkmaz.
        </div>
      </section>

      <!-- Sağ Panel: Arama + Doküman Listesi -->
      <section class="panel panel--list">
        <SearchBar @results="onSearchResults" @clear="onSearchClear" @loading="onSearchLoading" />
        <DocumentList ref="documentListRef" />
      </section>
    </main>

    <!-- Footer -->
    <footer class="dms-footer">
      <p>&copy; 2026 DMS On-Premise — Tüm veriler yerel sunucuda işlenmektedir.</p>
    </footer>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import FileUpload from './components/FileUpload.vue'
import DocumentList from './components/DocumentList.vue'
import SearchBar from './components/SearchBar.vue'

const documentListRef = ref(null)

function onDocumentUploaded() {
  // Yükleme başarılı olduğunda doküman listesini yenile
  documentListRef.value?.refresh()
}

function onSearchResults(results, term) {
  documentListRef.value?.setSearchResults(results, term)
}

function onSearchClear() {
  documentListRef.value?.clearSearch()
}

function onSearchLoading(isLoading) {
  if (isLoading) {
    documentListRef.value?.setLoading(true)
  }
}
</script>

<style>
/* ============================================================
   GLOBAL TASARIM SİSTEMİ (Design Tokens)
   ============================================================ */
:root {
  --bg-primary: #0f172a;
  --bg-secondary: #131c31;
  --bg-card: #1e293b;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --accent: #38bdf8;
  --accent-glow: rgba(56, 189, 248, 0.15);
  --border: #334155;
  --radius: 12px;
  --shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

/* ============================================================
   UYGULAMA LAYOUT
   ============================================================ */
#dms-app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 1.5rem 2rem;
  max-width: 1280px;
  margin: 0 auto;
}

/* ============================================================
   HEADER
   ============================================================ */
.dms-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.header-inner {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.logo-icon {
  font-size: 1.8rem;
}

.logo h1 {
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, var(--accent), #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.badge {
  background: var(--accent-glow);
  color: var(--accent);
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 600;
  border: 1px solid rgba(56, 189, 248, 0.3);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-card);
  padding: 0.5rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--border);
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-indicator--online {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
  animation: pulse-glow 2s infinite ease-in-out;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(34, 197, 94, 0.5); }
  50% { box-shadow: 0 0 16px rgba(34, 197, 94, 0.8); }
}

.status-text {
  font-size: 0.78rem;
  font-weight: 500;
  color: #22c55e;
}

/* ============================================================
   ANA İÇERİK (2 Sütun Grid)
   ============================================================ */
.dms-main {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 1.5rem;
  flex: 1;
  align-items: start;
}

.panel--upload {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel--list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-title svg {
  color: var(--accent);
  opacity: 0.8;
}

.panel-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  opacity: 0.65;
  padding: 0.5rem 0;
}

.panel-hint svg {
  color: #22c55e;
  flex-shrink: 0;
}

/* ============================================================
   FOOTER
   ============================================================ */
.dms-footer {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
  text-align: center;
}

.dms-footer p {
  color: var(--text-secondary);
  font-size: 0.75rem;
  opacity: 0.55;
}

/* ============================================================
   RESPONSIVE
   ============================================================ */
@media (max-width: 900px) {
  .dms-main {
    grid-template-columns: 1fr;
  }

  .dms-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}
</style>
