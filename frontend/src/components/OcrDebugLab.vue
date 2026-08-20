<template>
  <Transition name="modal">
    <div v-if="visible" class="debug-overlay" @click.self="$emit('close')">
      <div class="debug-modal">
        <!-- Header -->
        <div class="debug-header">
          <div class="debug-title-wrap">
            <span class="debug-icon">🧪</span>
            <h3>OCR Test & Konsensüs Laboratuvarı</h3>
            <span class="debug-badge">AR-GE / DEBUG</span>
          </div>
          <button class="btn-close-debug" @click="$emit('close')" title="Kapat">✕</button>
        </div>

        <!-- Upload Area -->
        <div class="debug-upload-area">
          <div v-if="!isProcessing && !hasResults" class="upload-zone" @drop.prevent="onDrop" @dragover.prevent>
            <input type="file" ref="fileInput" @change="onFileSelect" accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp,.webp" class="file-input-hidden" />
            <div class="upload-placeholder" @click="$refs.fileInput.click()">
              <span class="upload-big-icon">📂</span>
              <p class="upload-text">Test edilecek belgeyi sürükleyin veya tıklayarak seçin</p>
              <span class="upload-formats">PDF, PNG, JPG, TIFF, BMP, WEBP</span>
            </div>
          </div>

          <!-- Processing State -->
          <div v-if="isProcessing" class="processing-state">
            <div class="spinner-ensemble"></div>
            <p class="processing-text">{{ processingStatus }}</p>
            <p class="processing-sub">3 motor paralel çalışıyor — lütfen bekleyin...</p>
          </div>
        </div>

        <!-- Results -->
        <div v-if="hasResults" class="debug-results">
          <!-- Timing Bar -->
          <div class="timing-bar">
            <span class="timing-label">⏱️ Motor Süreleri:</span>
            <span v-for="(val, key) in results.timings" :key="key" class="timing-chip">
              {{ key }}: <strong>{{ val }}s</strong>
            </span>
            <button class="btn-reset" @click="resetLab">🔄 Yeni Test</button>
          </div>

          <div class="results-grid">
            <!-- Sol: Motor Çıktıları -->
            <div class="engines-panel">
              <div class="engine-tabs">
                <button
                  v-for="(text, name) in results.engines"
                  :key="name"
                  class="engine-tab"
                  :class="{ active: activeEngine === name }"
                  @click="activeEngine = name"
                >
                  {{ getEngineIcon(name) }} {{ name }}
                </button>
              </div>
              <div class="engine-output">
                <pre class="engine-text">{{ results.engines[activeEngine] || 'Çıktı yok' }}</pre>
              </div>
            </div>

            <!-- Sağ: Konsensüs Özeti -->
            <div class="consensus-panel">
              <div class="consensus-header">
                <span>✨</span>
                <h4>Yapay Zeka Konsensüs Özeti</h4>
              </div>
              <div class="consensus-body" v-html="formattedConsensus"></div>
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div v-if="errorMsg" class="debug-error">
          <span>❌</span>
          <p>{{ errorMsg }}</p>
          <button class="btn-reset" @click="resetLab">Tekrar Dene</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed } from 'vue'

defineProps({ visible: Boolean })
defineEmits(['close'])

const fileInput = ref(null)
const isProcessing = ref(false)
const processingStatus = ref('Motorlar başlatılıyor...')
const results = ref(null)
const errorMsg = ref('')
const activeEngine = ref('')

const hasResults = computed(() => results.value && results.value.engines)

const formattedConsensus = computed(() => {
  if (!results.value?.consensus) return ''
  let text = results.value.consensus
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Bold
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

  // Lines to blocks
  const lines = text.split('\n')
  return lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('- ')) {
      return `<div class="cons-item">▸ ${trimmed.substring(2)}</div>`
    }
    if (/^(?:📄|🎯|📋|📌|🔍|📊|🔬|⚠️|💡)/.test(trimmed)) {
      return `<div class="cons-header">${trimmed}</div>`
    }
    return `<p class="cons-p">${trimmed}</p>`
  }).join('')
})

function getEngineIcon(name) {
  if (name.includes('Tesseract')) return '🔤'
  if (name.includes('pdfplumber')) return '📊'
  if (name.includes('Easy')) return '🧠'
  return '⚙️'
}

function onDrop(e) {
  const files = e.dataTransfer?.files
  if (files?.length) runTest(files[0])
}

function onFileSelect(e) {
  const file = e.target?.files?.[0]
  if (file) runTest(file)
}

async function runTest(file) {
  isProcessing.value = true
  errorMsg.value = ''
  results.value = null
  processingStatus.value = `"${file.name}" analiz ediliyor...`

  try {
    const formData = new FormData()
    formData.append('file', file)

    const token = localStorage.getItem('token') || ''
    const response = await fetch('/api/ocr/debug-ensemble', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail?.message || err.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    results.value = data
    activeEngine.value = Object.keys(data.engines || {})[0] || ''
  } catch (e) {
    errorMsg.value = e.message || 'Bilinmeyen bir hata oluştu.'
  } finally {
    isProcessing.value = false
  }
}

function resetLab() {
  results.value = null
  errorMsg.value = ''
  isProcessing.value = false
  activeEngine.value = ''
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<style scoped>
.debug-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(6px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.debug-modal {
  background: #0f172a;
  border: 1px solid rgba(234, 179, 8, 0.3);
  border-radius: 16px;
  width: 100%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6), 0 0 40px rgba(234, 179, 8, 0.08);
}

.debug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(234, 179, 8, 0.2);
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.06) 0%, transparent 100%);
}

.debug-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.debug-icon { font-size: 1.3rem; }

.debug-title-wrap h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #fbbf24;
}

.debug-badge {
  font-size: 0.62rem;
  font-weight: 800;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(234, 179, 8, 0.2);
  color: #fcd34d;
  border: 1px solid rgba(234, 179, 8, 0.4);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.btn-close-debug {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.btn-close-debug:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  transform: rotate(90deg);
}

/* Upload */
.debug-upload-area {
  padding: 1.5rem;
}

.upload-zone {
  border: 2px dashed rgba(234, 179, 8, 0.25);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
}
.upload-zone:hover {
  border-color: rgba(234, 179, 8, 0.5);
  background: rgba(234, 179, 8, 0.04);
}

.file-input-hidden {
  display: none;
}

.upload-placeholder {
  padding: 2.5rem;
  text-align: center;
}

.upload-big-icon { font-size: 2.5rem; }

.upload-text {
  margin: 0.75rem 0 0.25rem;
  font-size: 0.9rem;
  color: #e2e8f0;
  font-weight: 600;
}

.upload-formats {
  font-size: 0.72rem;
  color: #64748b;
}

/* Processing */
.processing-state {
  text-align: center;
  padding: 3rem;
}

.spinner-ensemble {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(234, 179, 8, 0.15);
  border-top-color: #fbbf24;
  border-radius: 50%;
  animation: spin-ens 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin-ens {
  to { transform: rotate(360deg); }
}

.processing-text {
  font-size: 0.92rem;
  font-weight: 700;
  color: #fbbf24;
  margin: 0;
}

.processing-sub {
  font-size: 0.78rem;
  color: #64748b;
  margin: 0.35rem 0 0;
}

/* Results */
.debug-results {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.timing-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(15, 23, 42, 0.8);
  flex-wrap: wrap;
}

.timing-label {
  font-size: 0.78rem;
  color: #94a3b8;
  font-weight: 600;
}

.timing-chip {
  font-size: 0.72rem;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.25);
  color: #a5b4fc;
}
.timing-chip strong {
  color: #e0e7ff;
}

.btn-reset {
  margin-left: auto;
  font-size: 0.75rem;
  padding: 0.3rem 0.65rem;
  border-radius: 8px;
  background: rgba(234, 179, 8, 0.15);
  border: 1px solid rgba(234, 179, 8, 0.3);
  color: #fbbf24;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}
.btn-reset:hover {
  background: rgba(234, 179, 8, 0.25);
}

.results-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  flex: 1;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
}

/* Engines Panel */
.engines-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0f172a;
}

.engine-tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.engine-tab {
  flex: 1;
  padding: 0.65rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #64748b;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.engine-tab:hover {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.03);
}
.engine-tab.active {
  color: #fbbf24;
  border-bottom-color: #fbbf24;
  background: rgba(234, 179, 8, 0.06);
}

.engine-output {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
}

.engine-text {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.6;
  color: #cbd5e1;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
}

/* Consensus Panel */
.consensus-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0f172a;
}

.consensus-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid rgba(139, 92, 246, 0.2);
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, transparent 100%);
}

.consensus-header span { font-size: 1.1rem; }

.consensus-header h4 {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 700;
  color: #a78bfa;
}

.consensus-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

:deep(.cons-header) {
  background: rgba(15, 23, 42, 0.7);
  border-left: 3px solid #8b5cf6;
  padding: 0.6rem 0.85rem;
  border-radius: 0 8px 8px 0;
  font-size: 0.84rem;
  color: #f1f5f9;
  line-height: 1.5;
}

:deep(.cons-item) {
  padding-left: 0.75rem;
  font-size: 0.82rem;
  color: #e2e8f0;
  line-height: 1.5;
}

:deep(.cons-p) {
  margin: 0;
  font-size: 0.82rem;
  color: #cbd5e1;
  line-height: 1.6;
}

:deep(strong) {
  color: #ffffff;
  font-weight: 700;
}

/* Error */
.debug-error {
  padding: 2rem;
  text-align: center;
  color: #fca5a5;
}
.debug-error span { font-size: 1.5rem; }
.debug-error p {
  margin: 0.5rem 0 1rem;
  font-size: 0.88rem;
}

/* Transitions */
.modal-enter-active, .modal-leave-active {
  transition: all 0.3s ease;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
