<template>
  <div class="upload-wrapper">
    <div
      class="upload-zone"
      :class="{
        'upload-zone--active': isDragging,
        'upload-zone--uploading': isUploading,
      }"
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

      <!-- Yükleme Animasyonu -->
      <div class="upload-content" v-if="isUploading">
        <div class="spinner"></div>
        <p class="upload-title">{{ $t('upload.uploading') }}</p>
        <p class="upload-subtitle">{{ $t('upload.sending') }}</p>
      </div>

      <!-- Varsayılan Alan -->
      <div class="upload-content" v-else-if="!selectedFile">
        <div class="upload-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <p class="upload-title">{{ $t('upload.dragDrop') || 'Dosyalarınızı buraya sürükleyin' }}</p>
        <p class="upload-subtitle">{{ $t('upload.orClick') || 'veya dosya seçmek için tıklayın' }}</p>
        <div class="upload-formats">
          <span class="format-badge">PDF</span>
          <span class="format-badge">PNG</span>
          <span class="format-badge">JPG</span>
          <span class="format-sep">•</span>
          <span class="format-limit">{{ $t('upload.maxLimit') || 'Maks. 50 MB' }}</span>
        </div>
      </div>

      <!-- Dosya Seçildi -->
      <div class="upload-preview" v-else @click.stop>
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
        <button class="preview-remove" @click.stop="clearFile" :title="$t('common.remove') || 'Kaldır'">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Dosya Etiketleri (Yüklemeden Önce) -->
    <div v-if="selectedFile && !isUploading" class="upload-tags-section" style="margin: 0.5rem 0; text-align: left; display: flex; flex-direction: column; gap: 0.35rem;">
      <label style="font-size: 0.72rem; font-weight: 700; color: #9ca3af; text-transform: uppercase;">{{ $t('upload.tagsLabel') || 'Etiketler (Enter veya Virgül ile ekleyin)' }}</label>
      <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; padding: 0.5rem; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 8px; align-items: center;">
        <span 
          v-for="(tag, idx) in tags" 
          :key="tag" 
          style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.68rem; font-weight: 700; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; padding: 0.15rem 0.45rem; border-radius: 4px;"
        >
          {{ tag }}
          <button type="button" @click="removeTag(idx)" style="background: transparent; border: none; color: #f87171; font-weight: 700; cursor: pointer; font-size: 0.65rem; padding: 0;">✕</button>
        </span>
        <input 
          v-model="tagInput" 
          type="text" 
          :placeholder="$t('upload.tagsPlaceholder') || 'Etiket ekleyin...'" 
          @keydown.enter.prevent="addTag"
          @keydown.comma.prevent="addTag"
          style="flex: 1; border: none; background: transparent; outline: none; color: #fff; font-size: 0.78rem; min-width: 100px; padding: 0.1rem;"
        />
      </div>
    </div>

    <!-- Belge Hassasiyet Seviyesi -->
    <div v-if="selectedFile && !isUploading" class="upload-sensitivity-section" style="margin: 0.5rem 0; text-align: left; display: flex; flex-direction: column; gap: 0.35rem;">
      <label style="font-size: 0.72rem; font-weight: 700; color: #9ca3af; text-transform: uppercase;">{{ $t('upload.sensitivityLabel') || 'Belge Hassasiyeti' }}</label>
      <select v-model="sensitivity" style="width: 100%; padding: 0.5rem; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 8px; color: #fff; font-size: 0.78rem; outline: none; cursor: pointer;">
        <option value="public">{{ $t('upload.sensitivityPublic') || '🟢 Herkese Açık (Standart, Admin, CISO görebilir)' }}</option>
        <option value="medium">{{ $t('upload.sensitivityMedium') || '🟡 Orta Hassas (Sadece Admin ve CISO görebilir)' }}</option>
        <option value="high">{{ $t('upload.sensitivityHigh') || '🔴 En Hassas (Sadece Admin görebilir)' }}</option>
      </select>
    </div>

    <!-- Yükle Butonu -->
    <button
      v-if="selectedFile && !isUploading"
      class="upload-btn"
      @click="uploadFile"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      {{ $t('upload.submitBtn') || 'Dokümanı Yükle ve İşle' }}
    </button>

    <!-- Toast Mesajları -->
    <Transition name="toast">
      <div v-if="toast.show" class="toast" :class="'toast--' + toast.type">
        <span class="toast-icon">{{ toast.type === 'success' ? '✅' : '❌' }}</span>
        <span>{{ toast.message }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['uploaded'])

const isDragging = ref(false)
const isUploading = ref(false)
const selectedFile = ref(null)
const fileInput = ref(null)
const toast = ref({ show: false, message: '', type: 'success' })

const sensitivity = ref('public')
const tags = ref([])
const tagInput = ref('')

function addTag() {
  const val = tagInput.value.trim().replace(/,/g, '')
  if (val && !tags.value.includes(val)) {
    tags.value.push(val)
  }
  tagInput.value = ''
}

function removeTag(index) {
  tags.value.splice(index, 1)
}

let dragCounter = 0
let toastTimer = null

function showToast(message, type = 'success', duration = 4000) {
  clearTimeout(toastTimer)
  toast.value = { show: true, message, type }
  toastTimer = setTimeout(() => {
    toast.value.show = false
  }, duration)
}

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
  if (!selectedFile.value && !isUploading.value) {
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
    showToast(`Desteklenmeyen dosya tipi: ${file.type}`, 'error')
    return
  }
  if (file.size > 50 * 1024 * 1024) {
    showToast('Dosya boyutu 50 MB sınırını aşıyor.', 'error')
    return
  }
  selectedFile.value = file
  console.log(`[FileUpload] Dosya seçildi: ${file.name} (${formatSize(file.size)})`)
}

function clearFile() {
  selectedFile.value = null
  tags.value = []
  tagInput.value = ''
  sensitivity.value = 'public'
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

async function uploadFile() {
  if (!selectedFile.value || isUploading.value) return

  isUploading.value = true
  console.log(`[FileUpload] Yükleme başlatılıyor: ${selectedFile.value.name}`)

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('title', selectedFile.value.name)
    formData.append('tags', JSON.stringify(tags.value))
    formData.append('sensitivity', sensitivity.value)

    const token = localStorage.getItem('token')
    const response = await fetch('/api/documents/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData,
    })

    const result = await response.json()

    if (response.ok) {
      console.log(`[FileUpload] Yükleme başarılı — Doküman ID: ${result.document?.id}`)
      showToast(`"${selectedFile.value.name}" başarıyla yüklendi ve işleme kuyruğuna eklendi.`, 'success')
      clearFile()
      emit('uploaded')
    } else {
      console.error('[FileUpload] Sunucu hatası:', result)
      showToast(result.error || result.message || 'Yükleme başarısız oldu.', 'error')
    }
  } catch (error) {
    console.error('[FileUpload] Ağ hatası:', error)
    showToast('Sunucuya bağlanılamadı. Backend çalışıyor mu?', 'error')
  } finally {
    isUploading.value = false
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style scoped>
.upload-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

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

.upload-zone--uploading {
  pointer-events: none;
  opacity: 0.85;
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

/* Spinner */
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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

/* Yükle Butonu */
.upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: var(--radius);
  background: linear-gradient(135deg, var(--accent), #818cf8);
  color: #fff;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 2px 12px rgba(56, 189, 248, 0.25);
}

.upload-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(56, 189, 248, 0.4);
}

.upload-btn:active {
  transform: translateY(0);
}

/* Toast */
.toast {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.85rem 1.25rem;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 500;
  z-index: 9999;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.toast--success {
  background: #14532d;
  color: #bbf7d0;
  border: 1px solid #166534;
}

.toast--error {
  background: #450a0a;
  color: #fecaca;
  border: 1px solid #7f1d1d;
}

.toast-icon {
  font-size: 1rem;
}

.toast-enter-active {
  animation: toast-in 0.35s ease;
}

.toast-leave-active {
  animation: toast-in 0.25s ease reverse;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateY(16px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
