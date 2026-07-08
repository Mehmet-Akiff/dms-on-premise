<template>
  <div
    class="upload-zone"
    :class="{ 'upload-zone--active': isDragging }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
    @click="triggerFileInput"
  >
    <input
      ref="fileInput"
      type="file"
      accept=".pdf,.png,.jpg,.jpeg"
      class="upload-input"
      @change="onFileSelected"
    />

    <!-- İkon ve Mesaj -->
    <div class="upload-content" v-if="!selectedFile">
      <div class="upload-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <p class="upload-title">Dosyalarınızı buraya sürükleyin</p>
      <p class="upload-subtitle">veya <span class="upload-link">dosya seçmek için tıklayın</span></p>
      <div class="upload-formats">
        <span class="format-badge">PDF</span>
        <span class="format-badge">PNG</span>
        <span class="format-badge">JPG</span>
        <span class="format-sep">•</span>
        <span class="format-limit">Maks. 50 MB</span>
      </div>
    </div>

    <!-- Dosya Seçildi -->
    <div class="upload-preview" v-else>
      <div class="preview-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div class="preview-info">
        <p class="preview-name">{{ selectedFile.name }}</p>
        <p class="preview-size">{{ formatSize(selectedFile.size) }}</p>
      </div>
      <button class="preview-remove" @click.stop="clearFile" title="Kaldır">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const isDragging = ref(false)
const selectedFile = ref(null)
const fileInput = ref(null)

let dragCounter = 0

function onDragEnter() {
  dragCounter++
  isDragging.value = true
}

function onDragOver() {
  isDragging.value = true
}

function onDragLeave() {
  dragCounter--
  if (dragCounter <= 0) {
    isDragging.value = false
    dragCounter = 0
  }
}

function onDrop(event) {
  isDragging.value = false
  dragCounter = 0
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    handleFile(files[0])
  }
}

function triggerFileInput() {
  if (!selectedFile.value) {
    fileInput.value?.click()
  }
}

function onFileSelected(event) {
  const files = event.target.files
  if (files && files.length > 0) {
    handleFile(files[0])
  }
}

function handleFile(file) {
  const allowed = ['application/pdf', 'image/png', 'image/jpeg']
  if (!allowed.includes(file.type)) {
    console.warn(`[FileUpload] Desteklenmeyen dosya tipi: ${file.type}`)
    return
  }
  selectedFile.value = file
  console.log(`[FileUpload] Dosya seçildi: ${file.name} (${formatSize(file.size)})`)
}

function clearFile() {
  selectedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  console.log('[FileUpload] Dosya kaldırıldı.')
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style scoped>
.upload-zone {
  position: relative;
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  padding: 2.5rem 2rem;
  cursor: pointer;
  transition: all 0.25s ease;
  text-align: center;
}

.upload-zone:hover {
  border-color: var(--accent);
  background: rgba(56, 189, 248, 0.04);
}

.upload-zone--active {
  border-color: var(--accent);
  background: var(--accent-glow);
  box-shadow: 0 0 24px rgba(56, 189, 248, 0.12);
}

.upload-input {
  display: none;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.upload-icon {
  color: var(--accent);
  margin-bottom: 0.25rem;
  opacity: 0.85;
  transition: transform 0.25s ease;
}

.upload-zone:hover .upload-icon,
.upload-zone--active .upload-icon {
  transform: translateY(-4px);
  opacity: 1;
}

.upload-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
}

.upload-subtitle {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.upload-link {
  color: var(--accent);
  font-weight: 500;
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: text-decoration-color 0.2s;
}

.upload-zone:hover .upload-link {
  text-decoration-color: var(--accent);
}

.upload-formats {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

.format-badge {
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  letter-spacing: 0.5px;
}

.format-sep {
  color: var(--border);
  font-size: 0.75rem;
}

.format-limit {
  color: var(--text-secondary);
  font-size: 0.72rem;
  opacity: 0.7;
}

/* Dosya Önizleme */
.upload-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
  text-align: left;
}

.preview-icon {
  color: var(--accent);
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-glow);
  border-radius: 10px;
}

.preview-info {
  flex: 1;
  min-width: 0;
}

.preview-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-size {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-top: 0.15rem;
}

.preview-remove {
  flex-shrink: 0;
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.preview-remove:hover {
  border-color: #ef4444;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}
</style>
