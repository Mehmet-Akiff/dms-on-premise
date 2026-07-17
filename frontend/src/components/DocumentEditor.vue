<template>
  <div class="document-editor">
    <div class="editor-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
      <div class="editor-title-group">
        <span class="editor-sparkle">✏️</span>
        <div>
          <h4>Doküman Düzenleyici</h4>
          <p class="editor-subtitle">OCR metnini düzenleyerek kaydet butonuna bakın.</p>
        </div>
      </div>
      <button class="btn-reset-format" @click="resetFormatting" title="Tüm metnin renk ve arka plan biçimlendirmesini temizler.">
        🧹 Renkleri & Biçimi Temizle
      </button>
    </div>

    <!-- Etiket Yönetim Alanı -->
    <div class="editor-tags-section" style="margin-bottom:0.75rem; display:flex; flex-direction:column; gap:0.4rem;">
      <label style="font-size:0.76rem; font-weight:700; color:#e2e8f0;">Belge Etiketleri (Enter veya virgül ile ekleyin)</label>
      <div style="display:flex; flex-wrap:wrap; gap:0.4rem; padding:0.4rem; background:var(--bg-primary); border:1px solid var(--border); border-radius:8px; align-items:center;">
        <span 
          v-for="(tag, idx) in tags" 
          :key="tag" 
          style="display:inline-flex; align-items:center; gap:0.25rem; font-size:0.72rem; font-weight:700; background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.3); color:#a78bfa; padding:0.2rem 0.5rem; border-radius:4px;"
        >
          {{ tag }}
          <button type="button" @click="removeTag(idx)" style="background:transparent; border:none; color:#f87171; font-weight:700; cursor:pointer; font-size:0.68rem; padding:0 0.1rem;">✕</button>
        </span>
        <input 
          v-model="tagInput" 
          type="text" 
          placeholder="Etiket yazıp Enter'a basın..." 
          @keydown.enter.prevent="addTag"
          @keydown.comma.prevent="addTag"
          style="flex:1; border:none; background:transparent; outline:none; color:#fff; font-size:0.78rem; min-width:150px; padding:0.2rem;"
        />
      </div>
    </div>

    <!-- Editör Alanı -->
    <div class="editor-body">
      <QuillEditor 
        ref="editorRef"
        v-model:content="content" 
        contentType="html" 
        theme="snow" 
        :toolbar="customToolbar"
        class="rich-editor"
        placeholder="Belge metnini buraya girin veya düzenleyin..."
      />
    </div>

    <!-- Aksiyonlar -->
    <div class="editor-actions">
      <button class="btn-cancel" @click="cancelEdit" :disabled="isSaving">
        Vazgeç
      </button>
      <button class="btn-save" @click="triggerSaveConfirm" :disabled="isSaving">
        <span v-if="isSaving" class="spinner-xs"></span>
        {{ isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet' }}
      </button>
    </div>

    <!-- Kaydetme Onay Modalı -->
    <div v-if="isSaveConfirmOpen" class="editor-confirm-overlay" @click.self="isSaveConfirmOpen = false">
      <div class="editor-confirm-card">
        <h4>📝 Belge Değişikliklerini Kaydet</h4>
        <p>"<strong>{{ documentName || 'Belge' }}</strong>" içeriğinde yaptığınız düzenlemeleri kaydetmek istediğinize emin misiniz?</p>
        <div class="confirm-actions" style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:1.2rem;">
          <button class="btn-cancel" @click="isSaveConfirmOpen = false">Vazgeç</button>
          <button 
            class="btn-save" 
            :disabled="saveConfirmTimer > 0"
            @click="executeSave"
          >
            {{ saveConfirmTimer > 0 ? `Evet, Kaydet (${saveConfirmTimer}s)` : 'Evet, Kaydet' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'

const props = defineProps({
  documentId: {
    type: String,
    required: true
  },
  documentName: {
    type: String,
    default: ''
  },
  initialText: {
    type: String,
    default: ''
  },
  initialTags: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['save', 'cancel'])

const content = ref('')
const editorRef = ref(null)
const isSaving = ref(false)

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

function resetFormatting() {
  if (!editorRef.value) return
  const quill = editorRef.value.getQuill()
  const length = quill.getLength()
  // Tüm metnin biçimlendirmesini (color ve background) sıfırla
  quill.formatText(0, length, {
    color: false,
    background: false
  })
}

// Özel Toolbar Seçenekleri
const customToolbar = [
  ['bold', 'italic', 'underline', 'strike'],        // Kalın, italik, altı çizili, üstü çizili
  [{ 'list': 'ordered'}, { 'list': 'bullet' }],     // Sıralı ve sırasız listeler
  [{ 'header': [1, 2, 3, false] }],                 // Başlık seviyeleri
  [{ 'color': [] }, { 'background': [] }],          // Renkler
  ['clean']                                         // Biçimlendirmeyi temizle
]

// İlk veriyi yükle
function loadInitialContent() {
  tags.value = Array.isArray(props.initialTags) ? [...props.initialTags] : []
  // Eğer veritabanından ham düz metin geldiyse, Quill HTML olarak okusun diye
  // satır sonlarını <p> etiketlerine dönüştürebiliriz
  if (props.initialText && !props.initialText.trim().startsWith('<')) {
    const formatted = props.initialText
      .split('\n')
      .map(line => line.trim() ? `<p>${line}</p>` : '<p><br></p>')
      .join('');
    content.value = formatted;
  } else {
    content.value = props.initialText || '';
  }
}

onMounted(() => {
  loadInitialContent()
})

watch([() => props.initialText, () => props.initialTags], () => {
  loadInitialContent()
})

const isSaveConfirmOpen = ref(false)
const saveConfirmTimer = ref(0)
let saveConfirmInterval = null

function triggerSaveConfirm() {
  isSaveConfirmOpen.value = true
  saveConfirmTimer.value = 1
  if (saveConfirmInterval) clearInterval(saveConfirmInterval)
  saveConfirmInterval = setInterval(() => {
    if (saveConfirmTimer.value > 0) {
      saveConfirmTimer.value--
    } else {
      clearInterval(saveConfirmInterval)
      saveConfirmInterval = null
    }
  }, 1000)
}

function executeSave() {
  isSaveConfirmOpen.value = false
  saveContent()
}

async function saveContent() {
  if (!props.documentId) return

  isSaving.value = true
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`/api/documents/${props.documentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        extractedText: content.value,
        tags: tags.value
      })
    })

    if (response.ok) {
      const data = await response.json()
      emit('save', data.document)
    } else {
      console.error('[DocumentEditor] Kaydetme hatası: Sunucu hatası')
    }
  } catch (error) {
    console.error('[DocumentEditor] Kaydetme hatası:', error)
  } finally {
    isSaving.value = false
  }
}

function cancelEdit() {
  emit('cancel')
}
</script>

<style>
/* Editörün kendi stilleri genel olduğu için scoped yapmıyoruz, Quill CSS ezmelerini ekliyoruz */
.document-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem;
  margin-top: 0.5rem;
}

.editor-header {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.editor-title-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.editor-sparkle {
  font-size: 1.1rem;
}

.editor-header h4 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
}

.editor-subtitle {
  font-size: 0.75rem;
  color: var(--text-secondary);
  opacity: 0.8;
}

.editor-body {
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-primary);
  border: 1px solid var(--border);
}

/* Quill Editör Arayüz Özelleştirmeleri (Karanlık Tema ile Uyumlu) */
.rich-editor .ql-toolbar.ql-snow {
  border: none !important;
  border-bottom: 1px solid var(--border) !important;
  background: rgba(30, 41, 59, 0.5) !important;
}

.rich-editor .ql-container.ql-snow {
  border: none !important;
  min-height: 240px;
  max-height: 400px;
  overflow-y: auto;
}

.rich-editor .ql-editor {
  font-family: inherit;
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--bg-primary);
}

.rich-editor .ql-editor.ql-blank::before {
  color: var(--text-secondary) !important;
  opacity: 0.45;
  font-style: normal;
}

/* Quill Buton Renklerini Karanlık Temaya Eşle */
.rich-editor .ql-snow .ql-stroke {
  stroke: var(--text-secondary) !important;
}

.rich-editor .ql-snow .ql-fill {
  fill: var(--text-secondary) !important;
}

.rich-editor .ql-snow .ql-picker {
  color: var(--text-secondary) !important;
}

.rich-editor .ql-snow .ql-picker-options {
  background-color: var(--bg-card) !important;
  border: 1px solid var(--border) !important;
}

.rich-editor .ql-snow.ql-toolbar button:hover .ql-stroke,
.rich-editor .ql-snow.ql-toolbar button.ql-active .ql-stroke {
  stroke: var(--accent) !important;
}

.rich-editor .ql-snow.ql-toolbar button:hover .ql-fill,
.rich-editor .ql-snow.ql-toolbar button.ql-active .ql-fill {
  fill: var(--accent) !important;
}

.rich-editor .ql-snow.ql-toolbar .ql-picker-label:hover,
.rich-editor .ql-snow.ql-toolbar .ql-picker-label.ql-active {
  color: var(--accent) !important;
}

/* Aksiyon Butonları */
.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 0.55rem 1.25rem;
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cancel:hover:not(:disabled) {
  border-color: #ef4444;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

.btn-save {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #a78bfa, #8b5cf6);
  color: #fff;
  border: none;
  padding: 0.55rem 1.5rem;
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
}

.btn-save:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(139, 92, 246, 0.35);
  background: linear-gradient(135deg, #c4b5fd, #7c3aed);
}

.btn-save:disabled, .btn-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.btn-reset-format {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #f87171;
  padding: 0.4rem 0.85rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-reset-format:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
}

/* Onay Modalı Stilleri */
.editor-confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(3, 7, 18, 0.7);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 11000;
  pointer-events: auto;
}

.editor-confirm-card {
  background: #111827;
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
  padding: 1.75rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  text-align: center;
}

.editor-confirm-card h4 {
  color: #a78bfa;
  font-size: 1.05rem;
  margin: 0 0 0.5rem 0;
}

.editor-confirm-card p {
  color: #9ca3af;
  font-size: 0.82rem;
  line-height: 1.4;
  margin: 0 0 1.25rem 0;
}
</style>
