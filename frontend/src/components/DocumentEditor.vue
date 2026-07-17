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
      <button class="btn-save" @click="saveContent" :disabled="isSaving">
        <span v-if="isSaving" class="spinner-xs"></span>
        {{ isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet' }}
      </button>
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
  initialText: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['save', 'cancel'])

const content = ref('')
const editorRef = ref(null)
const isSaving = ref(false)

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

watch(() => props.initialText, () => {
  loadInitialContent()
})

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
        // Düz metin olarak da kaydedebiliriz ancak zengin düzenlemeyi korumak için html olarak kaydediyoruz
        extractedText: content.value
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
</style>
