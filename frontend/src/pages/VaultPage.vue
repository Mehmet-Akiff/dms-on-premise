<template>
  <div class="vault-page">
    <div class="dms-main">
      <!-- Sol Panel: Dosya Yükleme -->
      <section class="panel panel--upload">
        <h3 class="panel-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {{ $t('upload.title') || 'Doküman Yükle' }}
        </h3>
        <FileUpload @uploaded="onDocumentUploaded" />
        <div class="panel-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          {{ $t('upload.privacyNotice') || 'Tüm dosyalar yerel sunucuda güvenle işlenir. Veri dışarı çıkmaz.' }}
        </div>

        <!-- 🧪 Debug Lab Button (Sadece Geliştirici Modunda Görünür) -->
        <button
          v-if="isDevMode"
          class="btn-debug-lab"
          @click="showDebugLab = true"
        >
          🧪 OCR Test & Konsensüs Laboratuvarı
        </button>
      </section>

      <!-- Sağ Panel: Dashboard + Arama + Doküman Listesi -->
      <section class="panel panel--list">
        <Dashboard ref="dashboardRef" @stat-click="onStatClick" />
        <SearchBar @results="onSearchResults" @clear="onSearchClear" @loading="onSearchLoading" />
        <DocumentList ref="documentListRef" />
      </section>
    </div>

    <!-- 🧪 OCR Debug Lab Modal -->
    <OcrDebugLab v-if="isDevMode" :visible="showDebugLab" @close="showDebugLab = false" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import FileUpload from '../components/FileUpload.vue'
import Dashboard from '../components/Dashboard.vue'
import SearchBar from '../components/SearchBar.vue'
import DocumentList from '../components/DocumentList.vue'
import OcrDebugLab from '../components/OcrDebugLab.vue'

const documentListRef = ref(null)
const dashboardRef = ref(null)
const showDebugLab = ref(false)

// Dev mode: ortam değişkeni VEYA localStorage flag'i ile aktifleştirilebilir
const isDevMode = computed(() => {
  const envMode = import.meta.env.VITE_APP_MODE
  const localFlag = localStorage.getItem('dms_dev_mode')
  return envMode === 'debug' || localFlag === 'true'
})

function onDocumentUploaded() {
  documentListRef.value?.refresh()
  dashboardRef.value?.refresh()
}

function onSearchResults(results, query, meta = {}) {
  documentListRef.value?.setSearchResults(results, query, meta)
}

function onSearchClear() {
  documentListRef.value?.clearSearch()
}

function onSearchLoading(val) {
  documentListRef.value?.setSearchLoading(val)
}

function onStatClick(type) {
  documentListRef.value?.filterFromDashboard(type)
}
</script>

<style scoped>
.vault-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}
.dms-main {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 1.5rem;
  padding: 1.5rem;
  width: 100%;
  box-sizing: border-box;
}
.panel {
  background: var(--bg-secondary, #1e293b);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  padding: 1.25rem;
}
.panel--upload {
  display: flex;
  flex-direction: column;
  height: fit-content;
}
.panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary, #f8fafc);
}
.panel-hint {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 1rem;
  font-size: 0.72rem;
  color: var(--text-secondary, #94a3b8);
}
.panel--list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

/* 🧪 Debug Lab Button */
.btn-debug-lab {
  margin-top: 1rem;
  padding: 0.65rem 1rem;
  border-radius: 10px;
  border: 1px dashed rgba(234, 179, 8, 0.35);
  background: rgba(234, 179, 8, 0.06);
  color: #fbbf24;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s ease;
  letter-spacing: 0.01em;
}
.btn-debug-lab:hover {
  background: rgba(234, 179, 8, 0.15);
  border-color: rgba(234, 179, 8, 0.6);
  box-shadow: 0 0 20px rgba(234, 179, 8, 0.1);
  transform: translateY(-1px);
}

@media (max-width: 1024px) {
  .dms-main {
    grid-template-columns: 1fr;
  }
}
</style>

