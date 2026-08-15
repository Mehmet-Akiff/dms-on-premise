<template>
  <div class="chat-drawer-wrapper" :class="{ 'drawer-open': isOpen }" @click.self="closeDrawer">
    <div class="drawer-overlay" @click="closeDrawer"></div>
    <div class="chat-drawer" :data-theme="chatThemeMode">
      <!-- Header -->
      <div class="drawer-header">
        <div class="header-title">
          <span>{{ systemMode === 'standalone' ? '📝' : '💬' }}</span>
          <h3>{{ systemMode === 'standalone' ? 'Not Panosu' : 'Kurum İçi İletişim' }}</h3>
          <span class="mode-badge" :class="systemMode">{{ systemMode === 'standalone' ? 'Tek PC' : 'Ağ' }}</span>
        </div>
        <div class="header-right">
          <span v-if="isConnected" class="connection-badge connected">● Bağlı</span>
          <span v-else-if="systemMode === 'network'" class="connection-badge disconnected">● Bağlantı yok</span>
          <!-- Chat Panel Tema Ayarı -->
          <button class="btn-chat-theme" @click="toggleChatTheme" :title="chatThemeMode === 'dark' ? 'Açık Tema' : 'Koyu Tema'">
            {{ chatThemeMode === 'dark' ? '☀️' : '🌙' }}
          </button>
          <button class="btn-close-drawer" @click="closeDrawer">✕</button>
        </div>
      </div>

      <div class="chat-layout">
        <!-- Sidebar / Kişiler -->
        <div class="chat-sidebar">
          <div class="sidebar-search">
            <div class="search-wrapper">
              <span class="search-icon">🔍</span>
              <input type="text" placeholder="Kişi ara..." v-model="searchQuery" class="search-input" />
            </div>
          </div>
          <ul class="room-list">
            <li class="room-item" :class="{ active: activeChat === 'global' }" @click="selectChat('global')">
              <div class="room-avatar global-avatar">#</div>
              <div class="room-info">
                <span class="room-name">Sistem Odası</span>
                <span class="room-preview">Genel iletişim kanalı</span>
              </div>
            </li>
            <li v-for="user in filteredUsers" :key="user.id" class="room-item" :class="{ active: activeChat === user.id }" @click="selectChat(user.id)">
              <div class="room-avatar">
                {{ user.fullName ? user.fullName.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase() }}
                <span v-if="systemMode === 'network' && user.status === 'active'" class="online-dot"></span>
              </div>
              <div class="room-info">
                <span class="room-name">{{ user.fullName || user.username }}</span>
              </div>
            </li>
          </ul>
        </div>

        <!-- Main Chat Area -->
        <div class="chat-main" @click="closeAllPopups" @dragenter="onDragEnter" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
          <!-- Sürükle-Bırak Katmanı (Drag & Drop Overlay) -->
          <div v-if="isDragging" class="drag-drop-overlay">
            <div class="drag-drop-box">
              <div class="drag-drop-icon">📎</div>
              <div class="drag-drop-title">Dosyayı Buraya Bırakın</div>
              <div class="drag-drop-sub">Güvenli dosya transferi için sohbet alanına bırakın</div>
            </div>
          </div>
          <!-- Aktif sohbet başlığı -->
          <div class="chat-top-bar">
            <div class="chat-top-avatar" :class="{'global-avatar': activeChat === 'global'}">
               {{ activeChat === 'global' ? '#' : (activeChatLabel.charAt(0).toUpperCase()) }}
            </div>
            <div class="chat-top-info">
              <span class="chat-target-name">{{ activeChatLabel }}</span>
              <span class="chat-status" v-if="systemMode === 'network' && activeChat !== 'global'">Çevrimiçi</span>
            </div>
          </div>

          <!-- Sticky Banner for Scheduled Messages -->
          <div class="scheduled-sticky-banner" v-if="pendingMessages.length > 0">
            <div class="banner-content">
              <span class="banner-icon">⏰</span>
              <span>Bu sohbet için <strong>{{ pendingMessages.length }}</strong> adet bekleyen zamanlanmış mesajınız var.</span>
            </div>
            <button class="btn-view-scheduled" @click="showScheduledModal = true">Görün</button>
          </div>

          <!-- Messages -->
          <div class="messages-container" ref="messagesContainer">
            <div v-if="deliveredMessages.length === 0" class="no-messages">
              <div class="empty-state-icon">💬</div>
              <p>{{ systemMode === 'standalone' ? 'Henüz not yok. İlk notu siz bırakın.' : 'Henüz mesaj yok. İlk mesajı siz gönderin.' }}</p>
            </div>
            
            <div v-for="(msg, index) in deliveredMessages" :key="msg.id || index" 
                 class="message-wrapper"
                 :class="{ 'message-self': isMine(msg), 'message-deleted': msg.is_deleted }"
                 @contextmenu.prevent="openContextMenu($event, msg)">
              
              <div class="message-bubble">
                <!-- Silinen mesaj gösterimi -->
                <div v-if="msg.is_deleted" class="deleted-message-content">
                  <span class="deleted-icon">🚫</span> Bu mesaj silindi.
                </div>

                <template v-else>
                  <div class="message-sender" v-if="!isMine(msg) && activeChat === 'global'">
                    {{ msg.sender?.fullName || msg.senderName || msg.sender?.username || 'Bilinmeyen' }}
                  </div>
                  
                  <!-- Media & Document Content -->
                  <div v-if="msg.media_url || msg.file_url" class="message-media">
                    <img v-if="(msg.media_type || msg.file_type) === 'image'" 
                         :src="getAuthMediaUrl(msg.media_url || msg.file_url)" 
                         class="media-image" 
                         alt="Görsel" 
                         @click="openImage(msg.media_url || msg.file_url)" />
                    <audio v-else-if="(msg.media_type || msg.file_type) === 'audio'" 
                           :src="getAuthMediaUrl(msg.media_url || msg.file_url)" 
                           controls 
                           class="media-audio" 
                           preload="metadata" 
                           @loadedmetadata="onAudioLoaded"></audio>
                    <div v-else class="file-card-preview" @click="downloadMedia(msg.media_url || msg.file_url, 'download')">
                      <div class="file-card-icon">
                        {{ getFileIcon(msg.file_name || msg.media_url, msg.media_type || msg.file_type) }}
                      </div>
                      <div class="file-card-info">
                        <div class="file-card-name" :title="msg.file_name || 'Dosya'">
                          {{ msg.file_name || getFileNameFromUrl(msg.media_url || msg.file_url) }}
                        </div>
                        <div class="file-card-size" v-if="msg.file_size">
                          {{ formatFileSize(msg.file_size) }}
                        </div>
                      </div>
                      <button class="file-card-download-btn" title="İndir">
                        📥
                      </button>
                    </div>
                  </div>

                  <!-- Inline Edit Mode -->
                  <div v-if="editingMessageId === msg.id" class="inline-edit-box">
                    <input v-model="editContent" class="edit-input" @keyup.enter="saveEdit(msg.id)" @keyup.escape="cancelEdit" ref="editInputRef" />
                    <div class="edit-actions">
                      <button class="btn-edit-save" @click="saveEdit(msg.id)">✓ Kaydet</button>
                      <button class="btn-edit-cancel" @click="cancelEdit">✕ İptal</button>
                    </div>
                  </div>
                  <!-- Normal Content -->
                  <div class="message-content" v-else-if="msg.content">
                    {{ msg.content }}
                  </div>
                </template>
                
                <div class="message-meta">
                  <span class="message-time">{{ formatTime(msg.created_at || msg.createdAt || msg.timestamp) }}</span>
                  <span v-if="msg.is_edited" class="edited-tag">düzenlendi</span>
                  <span v-if="msg.type === 'note'" class="note-icon" title="Not">📌</span>
                  <span v-if="isMine(msg) && !msg.is_deleted" class="read-receipt" :class="{ read: msg.is_read }">
                    <svg viewBox="0 0 16 15" width="16" height="15"><path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.32.32 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"></path></svg>
                  </span>
                </div>

                <!-- Reactions Display -->
                <div class="reactions-display" v-if="msg.reactions && msg.reactions.length > 0 && !msg.is_deleted">
                  <span v-for="(data, emoji) in aggregateReactions(msg.reactions)" :key="emoji" class="reaction-badge" @click.stop="addReaction(msg.id, emoji)" :title="data.users.length ? data.users.join(', ') : `${emoji} ile tepki ver/kaldır`">
                    {{ emoji }} <small style="opacity:0.8; font-size:0.65rem;" v-if="data.count > 1">{{ data.count }}</small>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Context Menu (Right Click) -->
          <Teleport to="body">
            <div v-if="contextMenu.visible" class="context-menu-overlay" @click="closeContextMenu" @contextmenu.prevent="closeContextMenu">
              <div class="context-menu" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }" @click.stop>
                <!-- Quick Reactions Row -->
                <div class="ctx-reactions-row">
                  <span v-for="emoji in quickReactionEmojis" :key="emoji" class="ctx-reaction-btn" @click="addReactionFromCtx(emoji)" :title="emoji">
                    {{ emoji }}
                  </span>
                  <span class="ctx-reaction-btn ctx-more-emoji" @click.stop="showReactionPicker = !showReactionPicker" title="Daha fazla emoji">➕</span>
                </div>

                <!-- Extended Emoji Picker -->
                <div v-if="showReactionPicker" class="ctx-emoji-picker">
                  <div class="ctx-emoji-grid">
                    <span v-for="emoji in allReactionEmojis" :key="emoji" class="ctx-emoji-item" @click="addReactionFromCtx(emoji)">{{ emoji }}</span>
                  </div>
                </div>

                <div class="ctx-divider"></div>

                <!-- Action Items -->
                <button v-if="contextMenu.isMine && contextMenu.canEdit" class="ctx-item" @click="startEditFromCtx">
                  <span class="ctx-icon">✏️</span> Düzenle
                </button>
                <button class="ctx-item" @click="copyMessageContent">
                  <span class="ctx-icon">📋</span> Kopyala
                </button>
                <button v-if="contextMenu.isMine" class="ctx-item ctx-danger" @click="deleteFromCtx">
                  <span class="ctx-icon">🗑️</span> Sil
                </button>
              </div>
            </div>
          </Teleport>

          <!-- Emoji Picker Panel (for composing messages) -->
          <div v-if="showEmojiPicker" class="emoji-picker-panel">
            <div class="emoji-grid">
              <span v-for="emoji in emojis" :key="emoji" class="emoji-item" @click="insertEmoji(emoji)">{{ emoji }}</span>
            </div>
          </div>

          <!-- Media Preview Box -->
          <div v-if="selectedFile" class="media-preview-box">
            <div class="preview-content">
              <span class="preview-icon">📎</span>
              <span class="preview-name">{{ selectedFile.name }}</span>
            </div>
            <button class="btn-clear-media" @click="clearMedia">✕</button>
          </div>
          
          <!-- Audio Recording UI -->
          <div v-if="isRecording" class="audio-recording-box">
            <div class="recording-pulse"></div>
            <span class="recording-text">Ses kaydediliyor... ({{ recordingTime }}s)</span>
            <div class="recording-actions">
              <button class="btn-stop-record" @click="stopRecording">✓ Gönder</button>
              <button class="btn-cancel-record" @click="cancelRecording">✕ İptal</button>
            </div>
          </div>

          <!-- Progress Bar & Error Banner -->
          <div v-if="isUploading" class="upload-progress-container">
            <div class="upload-progress-info">
              <span class="upload-progress-icon">⏳</span>
              <span class="upload-progress-text">Dosya yükleniyor... %{{ uploadProgress }}</span>
            </div>
            <div class="upload-progress-bar-bg">
              <div class="upload-progress-bar-fill" :style="{ width: uploadProgress + '%' }"></div>
            </div>
          </div>
          <div v-if="uploadError" class="upload-error-banner">
            <span>⚠️ {{ uploadError }}</span>
            <button @click="uploadError = ''" class="btn-close-banner">✕</button>
          </div>

          <!-- Input Area -->
          <div class="chat-input-area" v-if="!isRecording">
            <form @submit.prevent="handleSend" class="chat-form">
              <button type="button" class="btn-emoji-toggle" @click.stop="showEmojiPicker = !showEmojiPicker" title="Emoji">😊</button>
              
              <input type="file" ref="fileInput" @change="onFileSelected" style="display: none" />
              <button type="button" class="btn-attach" @click="$refs.fileInput.click()" title="Dosya Ekle">📎</button>

              <input 
                v-model="newMessage" 
                type="text" 
                :placeholder="systemMode === 'standalone' ? 'Notunuzu yazın...' : 'Bir mesaj yazın...'" 
                class="chat-input"
                ref="chatInput"
              />
              
              <button type="button" class="btn-schedule-toggle" @click="toggleScheduler" title="Zamanlanmış Gönderim" :class="{ active: scheduledTime }">⏰</button>
              
              <!-- Gönder veya Ses Kaydet Butonu -->
              <button v-if="newMessage.trim() || selectedFile" type="submit" class="btn-send">
                <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path></svg>
              </button>
              <button v-else type="button" class="btn-mic" @click="startRecording" title="Ses Kaydet">
                <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M11.999 14.942c2.001 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.53-3.531-3.531-3.531S8.469 2.35 8.469 4.35v7.061c0 2.001 1.53 3.53 3.53 3.531zm6.238-3.53c0 3.531-2.942 6.002-6.237 6.002s-6.237-2.471-6.237-6.002H3.761c0 4.001 3.178 7.297 7.061 7.885v3.884h2.354v-3.884c3.884-.588 7.061-3.884 7.061-7.885h-2.002z"></path></svg>
              </button>
            </form>

            <div v-if="scheduledTime || showScheduler" class="scheduler-drawer">
              <div v-if="showScheduler" class="scheduler-inputs">
                <input type="datetime-local" v-model="scheduledTime" class="schedule-input" :min="minScheduleTime" />
                <button class="btn-schedule-confirm" @click="showScheduler = false">Onayla</button>
              </div>
              <div v-if="scheduledTime && !showScheduler" class="schedule-indicator">
                ⏰ Gönderim: {{ formatScheduleDisplay(scheduledTime) }}
                <button @click="scheduledTime = ''" class="btn-clear-schedule">İptal</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Scheduled Messages Modal -->
    <div v-if="showScheduledModal" class="scheduled-modal-overlay">
      <div class="scheduled-modal">
        <div class="modal-header">
          <h3>Bekleyen Zamanlanmış Mesajlar</h3>
          <button @click="showScheduledModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div v-for="msg in pendingMessages" :key="msg.id" class="pending-item">
            <div class="pending-item-header">
              <div class="pending-time">⏰ {{ formatScheduleDisplay(msg.scheduled_at) }}</div>
              <div style="display:flex; gap:0.5rem;">
                <button class="btn-edit-scheduled" @click="startEditScheduled(msg)" title="Düzenle" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 0.8rem;">✏️ Düzenle</button>
                <button class="btn-delete-scheduled" @click="deleteScheduledMessage(msg.id)" title="Sil / İptal Et">🗑️ Sil</button>
              </div>
            </div>
            
            <div v-if="editingScheduledId === msg.id" class="scheduled-edit-box" style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
               <input type="text" v-model="editScheduledContent" class="chat-input" style="padding: 0.4rem;" />
               <input type="datetime-local" v-model="editScheduledTime" class="schedule-input" :min="minScheduleTime" />
               <div style="display:flex; gap:0.5rem; margin-top:0.2rem;">
                 <button @click="saveEditScheduled(msg.id)" class="btn-schedule-confirm">Kaydet</button>
                 <button @click="editingScheduledId = null" class="btn-clear-schedule">İptal</button>
               </div>
            </div>
            <div v-else class="pending-content">{{ msg.content || (msg.media_type ? `[${msg.media_type} Medyası]` : '') }}</div>
          </div>
          <div v-if="pendingMessages.length === 0" class="no-pending">
            Bekleyen mesajınız bulunmamaktadır.
          </div>
        </div>
      </div>
    </div>

    <!-- Mesaj Silme Onay Modalı -->
    <ConfirmModal
      :visible="showDeleteConfirm"
      title="Mesajı Sil"
      message="Bu mesaj kalıcı olarak silinecek. Emin misiniz?"
      confirmText="Sil"
      cancelText="Vazgeç"
      variant="danger"
      @confirm="executeDeleteMessage"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import { io as socketIoClient } from 'socket.io-client'
import { getChatTheme, setChatTheme } from '../../utils/ThemeProvider'
import ConfirmModal from '../ConfirmModal.vue'
import { useToast } from 'vue-toastification'

const toast = useToast()

const props = defineProps({
  isOpen: { type: Boolean, default: false }
})
const emit = defineEmits(['close'])

const socket = ref(null)
const isConnected = ref(false)
const messages = ref({ global: [] })
const newMessage = ref('')
const messagesContainer = ref(null)
const chatInput = ref(null)
const fileInput = ref(null)

const currentUserId = ref('')
const currentUserFullName = ref('')
const users = ref([])
const searchQuery = ref('')
const activeChat = ref('global')
const systemMode = ref('standalone')

// Chat Panel Tema
const chatThemeMode = ref(getChatTheme())
function toggleChatTheme() {
  const next = chatThemeMode.value === 'dark' ? 'light' : 'dark'
  chatThemeMode.value = next
  setChatTheme(next)
}

// Emoji & Schedule & Media
const showEmojiPicker = ref(false)
const selectedFile = ref(null)
const isUploading = ref(false)
const uploadProgress = ref(0)
const uploadError = ref('')
const isDragging = ref(false)
let dragCounter = 0
const isRecording = ref(false)
const recordingTime = ref(0)
const scheduledTime = ref('')
const showScheduler = ref(false)
const showScheduledModal = ref(false)

// Scheduled Edit Refs
const editingScheduledId = ref(null)
const editScheduledContent = ref('')
const editScheduledTime = ref('')

// Edit/Delete state
const editingMessageId = ref(null)
const editContent = ref('')
const showDeleteConfirm = ref(false)
const deleteTargetId = ref(null)

// Audio Recording
const mediaRecorder = ref(null)
const audioChunks = ref([])
let recordInterval = null

// Context Menu State
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  messageId: null,
  isMine: false,
  canEdit: false,
  content: ''
})
const showReactionPicker = ref(false)

const quickReactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const allReactionEmojis = [
  '👍','👎','❤️','🔥','😂','😮','😢','😡','🎉','🤔',
  '👏','🙏','💪','✅','❌','⭐','💯','🚀','👀','💡',
  '📌','🔒','⚠️','💬','🤝','😎','🥳','😇','🤩','😤',
  '💀','🫡','🤗','😴','🥲','😈','💜','💙','💚','🧡',
  '🤷','🫠','😏','🤭','🫣','🤐','😬','🫶'
]

const emojis = [
  '😊','😂','❤️','👍','🎉','🔥','😎','🤔','👋','✅',
  '⚠️','📌','💡','📎','📁','🔒','🔑','📊','📝','💬',
  '✨','🚀','💪','👏','🙏','😄','😢','😡','🤝','👀'
]

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const q = searchQuery.value.toLowerCase()
  return users.value.filter(u => (u.fullName || '').toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
})

const currentMessages = computed(() => {
  return messages.value[activeChat.value] || []
})

// Sadece iletilmiş mesajlar (is_delivered undefined/null/true hepsi geçer, sadece false filtrelenir)
const deliveredMessages = computed(() => {
  return currentMessages.value.filter(m => m.is_delivered !== false)
})

// Bekleyen zamanlanmış mesajlar
const pendingMessages = computed(() => {
  return currentMessages.value.filter(m => m.is_delivered === false && isMine(m))
})

const activeChatLabel = computed(() => {
  if (activeChat.value === 'global') return 'Sistem Odası'
  const user = users.value.find(u => u.id === activeChat.value)
  return user ? (user.fullName || user.username) : 'Sohbet'
})

const minScheduleTime = computed(() => {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 1)
  return d.toISOString().slice(0, 16)
})

function isMine(msg) {
  return (msg.sender_id || msg.senderId) === currentUserId.value
}



function closeDrawer() {
  showEmojiPicker.value = false
  showScheduler.value = false
  closeContextMenu()
  emit('close')
}

function closeAllPopups(e) {
  showEmojiPicker.value = false
  if (contextMenu.value.visible) closeContextMenu()
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function formatScheduleDisplay(dtLocal) {
  if (!dtLocal) return ''
  const d = new Date(dtLocal)
  return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTo({
        top: messagesContainer.value.scrollHeight,
        behavior: 'smooth'
      })
    }
  })
}

function insertEmoji(emoji) {
  newMessage.value += emoji
  showEmojiPicker.value = false
  chatInput.value?.focus()
}

function toggleScheduler() {
  showScheduler.value = !showScheduler.value
  showEmojiPicker.value = false
}

function onFileSelected(event) {
  const file = event.target.files[0]
  if (file) {
    selectedFile.value = file
  }
}

function clearMedia() {
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getFileIcon(filename, type) {
  if (type === 'image') return '🖼️'
  if (type === 'audio') return '🎵'
  const ext = (filename || '').split('.').pop().toLowerCase()
  if (['pdf'].includes(ext)) return '📄'
  if (['doc', 'docx'].includes(ext)) return '📝'
  if (['xls', 'xlsx'].includes(ext)) return '📊'
  if (['ppt', 'pptx'].includes(ext)) return '📊'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦'
  if (['txt', 'log'].includes(ext)) return '📑'
  return '📎'
}

function getFileNameFromUrl(url) {
  if (!url) return 'Dosya'
  return url.split('/').pop() || 'Dosya'
}

function onDragEnter(e) {
  e.preventDefault()
  e.stopPropagation()
  dragCounter++
  if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
    isDragging.value = true
  }
}

function onDragOver(e) {
  e.preventDefault()
  e.stopPropagation()
}

function onDragLeave(e) {
  e.preventDefault()
  e.stopPropagation()
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    isDragging.value = false
  }
}

function onDrop(e) {
  e.preventDefault()
  e.stopPropagation()
  dragCounter = 0
  isDragging.value = false

  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0]
    uploadAndSendMedia(file)
  }
}

// ============================================================
// Context Menu
// ============================================================
function openContextMenu(event, msg) {
  if (msg.is_deleted) return
  
  const mine = isMine(msg)
  const canEditMsg = mine && canEdit(msg)

  // Position the menu, clamping to viewport
  let x = event.clientX
  let y = event.clientY
  const menuWidth = 220
  const menuHeight = 280
  if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8
  if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8
  
  contextMenu.value = {
    visible: true,
    x,
    y,
    messageId: msg.id,
    isMine: mine,
    canEdit: canEditMsg,
    content: msg.content || ''
  }
  showReactionPicker.value = false
}

function closeContextMenu() {
  contextMenu.value.visible = false
  showReactionPicker.value = false
}

function addReactionFromCtx(emoji) {
  addReaction(contextMenu.value.messageId, emoji)
  closeContextMenu()
}

function startEditFromCtx() {
  const msgId = contextMenu.value.messageId
  const chatId = activeChat.value
  const msg = (messages.value[chatId] || []).find(m => m.id === msgId)
  if (msg) startEdit(msg)
  closeContextMenu()
}

function copyMessageContent() {
  if (contextMenu.value.content) {
    navigator.clipboard.writeText(contextMenu.value.content).catch(() => {})
  }
  closeContextMenu()
}

function deleteFromCtx() {
  const msgId = contextMenu.value.messageId
  closeContextMenu()
  deleteTargetId.value = msgId
  showDeleteConfirm.value = true
}

// ============================================================
// Audio Recording
// ============================================================
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream)
    audioChunks.value = []
    
    mediaRecorder.value.ondataavailable = e => {
      if (e.data.size > 0) audioChunks.value.push(e.data)
    }
    
    mediaRecorder.value.onstop = async () => {
      stream.getTracks().forEach(track => track.stop())
      isRecording.value = false
      clearInterval(recordInterval)
      // İptal edildiyse gönderme (audioChunks boşaltılır)
      if (audioChunks.value.length === 0) return
      const audioBlob = new Blob(audioChunks.value, { type: 'audio/webm' })
      if (audioBlob.size < 100) return // Çok kısa/boş kayıt
      await uploadAndSendMedia(audioBlob, 'ses_kaydi.webm')
    }
    
    mediaRecorder.value.start()
    isRecording.value = true
    recordingTime.value = 0
    recordInterval = setInterval(() => recordingTime.value++, 1000)
  } catch (err) {
    alert('Mikrofon erişimine izin vermeniz gerekiyor.')
  }
}

function stopRecording() {
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
  }
}

function cancelRecording() {
  audioChunks.value = [] // Önce boşalt, sonra durdur → onstop göndermeyi atlayacak
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
  }
  isRecording.value = false
  clearInterval(recordInterval)
}

function onAudioLoaded(event) {
  const audio = event.target
  if (audio && (audio.duration === Infinity || isNaN(audio.duration) || audio.duration === 0)) {
    audio.currentTime = 1e101
    setTimeout(() => {
      if (audio.duration !== Infinity && !isNaN(audio.duration) && audio.duration > 0) {
        audio.currentTime = 0
      }
    }, 200)
  }
}

function selectChat(id) {
  activeChat.value = id
  showEmojiPicker.value = false
  showScheduler.value = false
  closeContextMenu()
  if (!messages.value[id] || messages.value[id].length === 0) {
    fetchMessageHistory(id)
  }
  scrollToBottom()
}

async function fetchSystemMode() {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/chat/mode', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      const data = await response.json()
      systemMode.value = data.mode || 'standalone'
    }
  } catch (e) {
    systemMode.value = 'standalone'
  }
}

async function fetchMessageHistory(targetId) {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/chat/history/${targetId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      const result = await response.json()
      if (result.success && result.data) {
        messages.value[targetId] = result.data.map(msg => ({
          ...msg,
          senderName: msg.sender?.fullName || msg.sender?.username || 'Bilinmeyen',
        }))
        scrollToBottom()
      }
    }
  } catch (error) {
    // Sessiz hata yakalama
  }
}

async function fetchUsers() {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/chat/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      const data = await response.json()
      if (data.users) {
        users.value = data.users.filter(u => u.id !== currentUserId.value)
      }
    }
  } catch (error) {
    // Sessiz hata yakalama
  }
}

function parseToken() {
  const token = localStorage.getItem('token')
  if (!token) return
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(decodeURIComponent(escape(window.atob(base64))))
    currentUserId.value = payload.id || ''
    currentUserFullName.value = payload.fullName || payload.username || ''
  } catch (e) {
    // Token parse hatası
  }
}

function initSocket() {
  if (systemMode.value === 'standalone') return
  const token = localStorage.getItem('token')
  if (!token) return

  if(!socket.value) {
    socket.value = socketIoClient('/', {
      auth: { token },
      transports: ['websocket']
    })
  }

  socket.value.on('connect', () => {
    isConnected.value = true
    fetchMessageHistory('global')
  })

  socket.value.on('disconnect', () => {
    isConnected.value = false
  })

  // Global oda UUID'si — backend UUID gönderir, frontend 'global' key'i kullanır
  const GLOBAL_ROOM_ID = '00000000-0000-0000-0000-000000000001'

  socket.value.on('receive_message', (data) => {
    let chatId = 'global'
    if (data.room_id) {
      // Global oda UUID'sini 'global' key'ine çevir
      chatId = data.room_id === GLOBAL_ROOM_ID ? 'global' : data.room_id
    } else if (data.receiver_id) {
      chatId = data.sender_id === currentUserId.value ? data.receiver_id : data.sender_id
    }
    
    if (!messages.value[chatId]) messages.value[chatId] = []
    
    // Duplikasyon kontrolü: aynı ID zaten varsa güncelle
    const existingIdx = messages.value[chatId].findIndex(m => m.id === data.id)
    if (existingIdx !== -1) {
      messages.value[chatId].splice(existingIdx, 1, data)
    } else {
      messages.value[chatId].push(data)
    }
    
    if (activeChat.value === chatId) scrollToBottom()
  })

  socket.value.on('receive_reaction', (data) => {
    const { messageId, reactions } = data
    for (const chatKey in messages.value) {
      const msg = messages.value[chatKey].find(m => m.id === messageId)
      if (msg) {
        msg.reactions = reactions
        break
      }
    }
  })

  // Mesaj düzenleme broadcast'i
  socket.value.on('message_edited', (data) => {
    const { messageId, content, is_edited, edited_at } = data
    updateLocalMessage(messageId, { content, is_edited, edited_at })
  })

  // Mesaj silme broadcast'i
  socket.value.on('message_deleted', (data) => {
    const { messageId } = data
    updateLocalMessage(messageId, { is_deleted: true, content: '', media_url: null, media_type: null })
  })
}

// Reactions
async function addReaction(messageId, emoji) {
  if (socket.value && isConnected.value) {
    socket.value.emit('add_reaction', { messageId, emoji })
    return
  }

  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/chat/message/${messageId}/reaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ emoji })
    })

    if (res.ok) {
      const data = await res.json()
      if (data.success && data.reactions) {
        for (const chatKey in messages.value) {
          const msg = messages.value[chatKey].find(m => m.id === messageId)
          if (msg) {
            msg.reactions = data.reactions
            break
          }
        }
      }
    }
  } catch (err) {
    console.error('[REACTION_ERR] Reaksiyon eklenemedi:', err)
  }
}

function aggregateReactions(reactionsArr) {
  if (!reactionsArr) return {}
  let arr = reactionsArr
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr) } catch (e) { return {} }
  }
  if (!Array.isArray(arr)) return {}
  
  const groups = {}
  arr.forEach(r => {
    if (!groups[r.emoji]) groups[r.emoji] = { count: 0, users: [] }
    groups[r.emoji].count++
    if (r.username) groups[r.emoji].users.push(r.username)
  })
  return groups
}

// Scheduled mesaj düzenleme
function startEditScheduled(msg) {
  editingScheduledId.value = msg.id
  editScheduledContent.value = msg.content
  if (msg.scheduled_at) {
    const d = new Date(msg.scheduled_at)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    editScheduledTime.value = `${yyyy}-${mm}-${dd}T${hh}:${min}`
  }
}

async function saveEditScheduled(msgId) {
  if (!editScheduledTime.value) {
    toast.error('Lütfen bir zaman seçin!')
    return
  }
  const dateObj = new Date(editScheduledTime.value)
  if (dateObj <= new Date()) {
    toast.error('Geçmiş bir tarih seçilemez!')
    return
  }

  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/chat/scheduled/${msgId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        content: editScheduledContent.value,
        scheduled_at: dateObj.toISOString()
      })
    })
    
    if (res.ok) {
      const result = await res.json()
      updateLocalMessage(msgId, result.data)
      editingScheduledId.value = null
      toast.success('Zamanlanmış mesaj güncellendi.')
    } else {
      const err = await res.json()
      toast.error(err.error || 'Mesaj güncellenemedi.')
    }
  } catch (error) {
    toast.error('Güncelleme sırasında hata oluştu.')
  }
}

// Zamanlanmış mesaj silme
async function deleteScheduledMessage(msgId) {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/chat/scheduled/${msgId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      const chatId = activeChat.value
      if (messages.value[chatId]) {
        const idx = messages.value[chatId].findIndex(m => m.id === msgId)
        if (idx !== -1) messages.value[chatId].splice(idx, 1)
      }
    }
  } catch (err) {
    // Sessizce yakala
  }
}

// ============================================================
// Mesaj Düzenleme / Silme
// ============================================================
function canEdit(msg) {
  if (!msg.created_at && !msg.createdAt) return false
  const elapsed = Date.now() - new Date(msg.created_at || msg.createdAt).getTime()
  return elapsed < 2 * 60 * 1000 // 2 dakika
}

function startEdit(msg) {
  editingMessageId.value = msg.id
  editContent.value = msg.content || ''
}

function cancelEdit() {
  editingMessageId.value = null
  editContent.value = ''
}

async function saveEdit(messageId) {
  if (!editContent.value.trim()) return
  
  if (socket.value) {
    socket.value.emit('edit_message', { messageId, content: editContent.value.trim() }, (res) => {
      if (res?.success) {
        // Socket handler (message_edited) güncelleyecek
      }
    })
  } else {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/chat/message/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content: editContent.value.trim() })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          updateLocalMessage(messageId, { content: data.data.content, is_edited: true, edited_at: data.data.edited_at })
        }
      }
    } catch (err) {
      // Sessiz hata
    }
  }
  cancelEdit()
}

function confirmDeleteMessage(msg) {
  deleteTargetId.value = msg.id
  showDeleteConfirm.value = true
}

async function executeDeleteMessage() {
  const messageId = deleteTargetId.value
  showDeleteConfirm.value = false
  deleteTargetId.value = null
  if (!messageId) return

  if (socket.value) {
    socket.value.emit('delete_message', { messageId }, (res) => {
      if (res?.success) {
        // Socket handler (message_deleted) güncelleyecek
      }
    })
  } else {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/chat/message/${messageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        updateLocalMessage(messageId, { is_deleted: true, content: '', media_url: null, media_type: null })
      }
    } catch (err) {
      // Sessiz hata
    }
  }
}

function updateLocalMessage(messageId, updates) {
  for (const chatKey in messages.value) {
    const idx = messages.value[chatKey].findIndex(m => m.id === messageId)
    if (idx !== -1) {
      const updated = { ...messages.value[chatKey][idx], ...updates }
      messages.value[chatKey].splice(idx, 1, updated)
      break
    }
  }
}

async function uploadAndSendMedia(fileObj, filenameOverride = null) {
  const token = localStorage.getItem('token')
  const formData = new FormData()
  formData.append('file', fileObj, filenameOverride || fileObj.name)

  isUploading.value = true
  uploadProgress.value = 0
  uploadError.value = ''

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/chat/upload', true)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        uploadProgress.value = Math.round((e.loaded / e.total) * 100)
      }
    }

    xhr.onload = async () => {
      isUploading.value = false
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          if (data.success) {
            await executeSend(newMessage.value.trim(), data.url, data.type, data.name, data.size)
            newMessage.value = ''
            clearMedia()
          } else {
            uploadError.value = data.error || 'Dosya yüklenemedi.'
          }
        } catch (err) {
          uploadError.value = 'Sunucu yanıtı işlenemedi.'
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText)
          uploadError.value = errData.error || `Yükleme hatası (${xhr.status})`
        } catch {
          uploadError.value = `Yükleme başarısız oldu (${xhr.status})`
        }
      }
      resolve()
    }

    xhr.onerror = () => {
      isUploading.value = false
      uploadError.value = 'Ağ hatası: Dosya yüklenemedi.'
      resolve()
    }

    xhr.send(formData)
  })
}

async function handleSend() {
  if (selectedFile.value) {
    const file = selectedFile.value
    await uploadAndSendMedia(file)
  } else if (newMessage.value.trim()) {
    await executeSend(newMessage.value.trim())
  }
}

async function executeSend(content, mediaUrl = null, mediaType = null, fileName = null, fileSize = null) {
  const msgData = {
    content,
    scheduledAt: scheduledTime.value || null,
    mediaUrl,
    mediaType,
    fileName: fileName || (selectedFile.value ? selectedFile.value.name : null),
    fileSize: fileSize || (selectedFile.value ? selectedFile.value.size : null),
    fileUrl: mediaUrl,
    fileType: mediaType
  }

  if (activeChat.value === 'global') {
    msgData.roomId = 'global'
  } else {
    msgData.receiverId = activeChat.value
  }

  if (systemMode.value === 'standalone') {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(msgData)
      })
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          const chatId = activeChat.value
          if (!messages.value[chatId]) messages.value[chatId] = []
          messages.value[chatId].push(result.data)
          scrollToBottom()
        }
      }
    } catch (error) {
      // Not gönderim hatası sessizce yakalandı
    }
  } else {
    if (!socket.value) return
    socket.value.emit('send_message', msgData, (response) => {
      if (response && response.success && response.data) {
        // Gönderenin kendi mesajını callback'ten lokale ekle
        const chatId = msgData.receiverId || msgData.roomId || 'global'
        if (!messages.value[chatId]) messages.value[chatId] = []
        const exists = messages.value[chatId].some(m => m.id === response.data.id)
        if (!exists) {
          messages.value[chatId].push(response.data)
        }
        scrollToBottom()
      }
    })
  }

  newMessage.value = ''
  scheduledTime.value = ''
  showScheduler.value = false
}

async function downloadMedia(url, action = 'download') {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!res.ok) {
      if (res.headers.get('content-type')?.includes('application/json')) {
        const errObj = await res.json()
        throw new Error(errObj.error || `HTTP error! status: ${res.status}`)
      }
      throw new Error(`Dosya bulunamadı veya yetkiniz yok. (Status: ${res.status})`)
    }
    
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    
    if (action === 'view') {
      window.open(blobUrl, '_blank')
      return
    }

    const a = document.createElement('a')
    a.href = blobUrl
    
    const disposition = res.headers.get('content-disposition')
    let downloadName = url.split('/').pop()
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const match = disposition.match(/filename="?([^"]+)"?/)
      if (match && match[1]) {
        downloadName = match[1]
      }
    }
    
    a.download = downloadName
    document.body.appendChild(a)
    a.click()
    a.remove()
    
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
    
  } catch (err) {
    toast.error(`Dosya İndirme Hatası: ${err.message}`)
  }
}

function getAuthMediaUrl(url) {
  if (!url) return ''
  const token = localStorage.getItem('token')
  if (!token) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}token=${token}`
}

function openImage(url) {
  downloadMedia(url, 'view')
}

// Standalone modda her 15 saniyede bir mesajları yenile (polling)
let pollingInterval = null
function startPolling() {
  if (pollingInterval) return
  pollingInterval = setInterval(() => {
    if (props.isOpen && systemMode.value === 'standalone') {
      fetchMessageHistory(activeChat.value)
    }
  }, 15000)
}
function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    parseToken()
    await fetchSystemMode()
    await fetchUsers()

    if (systemMode.value === 'standalone') {
      fetchMessageHistory('global')
      startPolling()
    } else {
      initSocket()
      stopPolling()
    }
    scrollToBottom()
  } else {
    stopPolling()
  }
})

onMounted(async () => {
  parseToken()
  if (props.isOpen) {
    await fetchSystemMode()
    await fetchUsers()
    if (systemMode.value === 'standalone') {
      fetchMessageHistory('global')
      startPolling()
    } else {
      initSocket()
    }
  }
})

onUnmounted(() => {
  stopPolling()
  if (socket.value) {
    socket.value.disconnect()
    socket.value = null
  }
})
</script>

<style scoped>
/* ============================================================
   DMS KURUMSAL CHAT TEMASI — Modern Glassmorphism UX
   ============================================================ */

/* BASE DRAWER */
.chat-drawer-wrapper {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  pointer-events: none; z-index: 9999; display: flex; justify-content: flex-end;
  overflow: hidden; visibility: hidden;
  transition: visibility 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.chat-drawer-wrapper.drawer-open { pointer-events: auto; visibility: visible; }
.drawer-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
  opacity: 0; transition: opacity 0.3s ease;
}
.chat-drawer-wrapper.drawer-open .drawer-overlay { opacity: 1; }
.chat-drawer {
  position: relative; width: 100%; max-width: 920px; height: 100%;
  background: var(--bg-primary); box-shadow: -10px 0 40px rgba(0,0,0,0.5);
  transform: translateX(100%); transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex; flex-direction: column;
}
.chat-drawer-wrapper.drawer-open .chat-drawer { transform: translateX(0); }

/* HEADER */
.drawer-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, var(--accent-primary, var(--color-accent-bg)), var(--accent-secondary, #3b82f6));
  color: white; border-bottom: none;
}
.header-title { display: flex; align-items: center; gap: 0.6rem; }
.header-title h3 { margin: 0; font-size: 1.05rem; font-weight: 700; color: white; letter-spacing: -0.01em; }
.mode-badge {
  font-size: 0.6rem; font-weight: 800; padding: 0.15rem 0.5rem; border-radius: 99px;
  text-transform: uppercase; background: rgba(255,255,255,0.2); letter-spacing: 0.5px;
}
.header-right { display: flex; align-items: center; gap: 0.75rem; }
.connection-badge {
  font-size: 0.7rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 99px;
}
.connection-badge.connected { background: rgba(34, 197, 94, 0.2); color: #bbf7d0; }
.connection-badge.disconnected { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
.btn-chat-theme {
  background: rgba(255,255,255,0.15); border: none; color: white;
  font-size: 1rem; cursor: pointer; transition: all 0.2s;
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.btn-chat-theme:hover { background: rgba(255,255,255,0.3); }
.btn-close-drawer {
  background: rgba(255,255,255,0.15); border: none; color: white;
  font-size: 1rem; cursor: pointer; transition: all 0.2s;
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.btn-close-drawer:hover { background: rgba(255,255,255,0.3); transform: rotate(90deg); }

/* LAYOUT & SIDEBAR */
.chat-layout { display: flex; flex: 1; overflow: hidden; background: var(--bg-primary); }
.chat-sidebar {
  width: 280px; background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
}
.sidebar-search { padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--border); }
.search-wrapper { position: relative; }
.search-icon {
  position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
  font-size: 0.85rem; opacity: 0.5; pointer-events: none;
}
.search-input {
  width: 100%; padding: 0.5rem 0.75rem 0.5rem 2rem; border-radius: 10px;
  border: 1px solid var(--border); background: var(--bg-primary);
  outline: none; font-size: 0.85rem; color: var(--text-primary);
  transition: border-color 0.2s;
}
.search-input:focus { border-color: var(--accent-primary, var(--color-accent-bg)); }
.room-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex: 1; }
.room-item {
  display: flex; align-items: center; gap: 0.75rem; padding: 0.65rem 0.75rem;
  border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer;
  transition: all 0.15s ease;
}
.room-item:hover { background: var(--accent-glow); }
.room-item.active {
  background: var(--accent-glow);
  border-left: 3px solid var(--accent-primary, var(--color-accent-bg));
}
.room-avatar {
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--bg-card, var(--bg-card));
  display: flex; justify-content: center; align-items: center;
  font-size: 1.1rem; font-weight: bold; color: var(--text-secondary);
  position: relative; flex-shrink: 0;
}
.global-avatar {
  background: linear-gradient(135deg, var(--accent-primary, var(--color-accent-bg)), var(--accent-secondary, #3b82f6));
  color: white;
}
.online-dot {
  position: absolute; bottom: 1px; right: 1px;
  width: 11px; height: 11px; background: var(--success, #22c55e);
  border-radius: 50%; border: 2px solid var(--bg-secondary);
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
}
.room-info { display: flex; flex-direction: column; overflow: hidden; }
.room-name { font-weight: 600; color: var(--text-primary); font-size: 0.92rem; }
.room-preview {
  font-size: 0.75rem; color: var(--text-secondary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* MAIN CHAT AREA */
.chat-main {
  flex: 1; display: flex; flex-direction: column;
  background: var(--chat-bg); position: relative;
}
.chat-main::before {
  content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  opacity: 0.02; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23999' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}

.chat-top-bar {
  padding: 0.55rem 1rem; background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 0.75rem; z-index: 2;
}
.chat-top-avatar {
  width: 38px; height: 38px; border-radius: 50%; background: var(--bg-card);
  color: var(--text-secondary);
  display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 1rem;
}
.chat-top-info { display: flex; flex-direction: column; }
.chat-target-name { font-size: 0.95rem; font-weight: 600; color: var(--text-primary); }
.chat-status { font-size: 0.75rem; color: var(--success, #22c55e); }

/* STICKY BANNER */
.scheduled-sticky-banner {
  position: absolute; top: 55px; left: 50%; transform: translateX(-50%); z-index: 10;
  background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25);
  color: var(--text-primary); backdrop-filter: blur(8px);
  padding: 0.4rem 0.8rem; border-radius: 10px; box-shadow: var(--shadow);
  display: flex; align-items: center; gap: 0.75rem; font-size: 0.82rem;
}
.btn-view-scheduled {
  background: var(--accent-primary, var(--color-accent-bg)); border: none; color: white;
  padding: 0.25rem 0.6rem; border-radius: 6px; font-weight: bold;
  cursor: pointer; font-size: 0.75rem; transition: transform 0.15s;
}
.btn-view-scheduled:hover { transform: scale(1.05); }

/* MESSAGES */
.messages-container {
  flex: 1; overflow-y: auto; padding: 1.5rem 1.5rem 1.5rem 1.5rem;
  display: flex; flex-direction: column; gap: 0.35rem; z-index: 2;
  scroll-behavior: smooth;
}
.no-messages {
  flex: 1; display: flex; flex-direction: column; justify-content: center;
  align-items: center; color: var(--text-secondary); font-size: 0.9rem; gap: 0.5rem;
}
.empty-state-icon { font-size: 3rem; opacity: 0.2; }

.message-wrapper {
  display: flex; flex-direction: column; align-items: flex-start;
  max-width: 70%; position: relative;
  animation: msgSlideIn 0.25s ease-out;
}
@keyframes msgSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.message-self { align-self: flex-end; align-items: flex-end; }
.message-deleted .message-bubble { opacity: 0.5; }

/* Hover Actions */
.msg-hover-actions {
  position: absolute;
  top: 50%; transform: translateY(-50%);
  right: -32px;
  opacity: 0; transition: opacity 0.2s, transform 0.2s;
  pointer-events: none;
}
.message-self .msg-hover-actions {
  right: auto; left: -32px;
}
.message-wrapper:hover .msg-hover-actions {
  opacity: 1; pointer-events: auto;
}
.btn-msg-hover {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 50%; width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  font-size: 0.9rem; color: var(--text-primary); transition: transform 0.15s;
}
.btn-msg-hover:hover { transform: scale(1.15); }

.message-bubble {
  background: var(--bubble-in); padding: 0.45rem 0.65rem 0.35rem;
  border-radius: 12px 12px 12px 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
  position: relative; display: flex; flex-direction: column;
  min-width: 80px; color: var(--text-primary);
  transition: box-shadow 0.15s;
}
.message-self .message-bubble {
  background: var(--bubble-out);
  border-radius: 12px 12px 4px 12px;
}
.message-bubble:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.12); }

.message-sender {
  font-size: 0.72rem; color: var(--accent-primary, var(--color-accent-bg));
  font-weight: 700; margin-bottom: 0.15rem;
}
.message-content { font-size: 0.92rem; line-height: 1.35; word-break: break-word; }

/* Deleted message */
.deleted-message-content {
  font-size: 0.85rem; color: var(--text-secondary); font-style: italic;
  display: flex; align-items: center; gap: 0.35rem; padding: 0.15rem 0;
}

/* Edited tag */
.edited-tag { font-size: 0.58rem; color: var(--text-secondary); font-style: italic; margin-left: 0.2rem; }

/* Inline Edit */
.inline-edit-box { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.2rem 0; }
.edit-input {
  width: 100%; padding: 0.4rem 0.6rem; border-radius: 8px; font-size: 0.88rem;
  border: 1.5px solid var(--accent-primary, var(--color-accent-bg)); outline: none;
  background: var(--bg-primary); color: var(--text-primary);
}
.edit-actions { display: flex; gap: 0.3rem; justify-content: flex-end; }
.btn-edit-save {
  background: var(--accent-primary, var(--color-accent-bg)); color: white; border: none;
  padding: 0.25rem 0.55rem; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer;
  transition: transform 0.1s;
}
.btn-edit-save:hover { transform: scale(1.05); }
.btn-edit-cancel {
  background: transparent; color: var(--danger, var(--color-danger-bg)); border: 1px solid var(--danger, var(--color-danger-bg));
  padding: 0.25rem 0.55rem; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer;
}

/* MEDIA */
.message-media { margin-bottom: 0.3rem; max-width: 100%; }
.media-image {
  max-width: 100%; border-radius: 8px; cursor: pointer;
  object-fit: cover; max-height: 250px; transition: transform 0.2s;
}
.media-image:hover { transform: scale(1.02); }
.media-audio { height: 36px; outline: none; width: 240px; border-radius: 20px; }
.media-document {
  display: flex; align-items: center; gap: 0.5rem;
  background: rgba(0,0,0,0.05); padding: 0.6rem; border-radius: 8px;
  text-decoration: none; color: var(--text-primary); font-weight: 500; font-size: 0.88rem;
  transition: background 0.15s;
}
.media-document:hover { background: rgba(0,0,0,0.1); }

.message-meta {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 0.2rem; margin-top: 0.15rem; float: right; margin-left: 0.8rem;
}
.message-time { font-size: 0.62rem; color: var(--text-secondary); }
.read-receipt { color: var(--text-secondary); display: flex; align-items: center; }
.read-receipt.read { color: var(--accent, #38bdf8); }

.message-bubble {
  max-width: 75%; position: relative;
  display: flex; flex-direction: column;
  transition: opacity 0.2s;
  margin-bottom: 0.8rem; /* Make room for reactions */
}

.reactions-display {
  display: flex; flex-wrap: wrap; gap: 0.25rem; position: absolute; bottom: -18px; left: 8px;
  background: var(--bg-secondary); padding: 3px 6px; border-radius: 12px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2); border: 1px solid var(--border);
  z-index: 5; /* Ensure it stays above other messages */
}
.message-self .reactions-display { left: auto; right: 8px; }
.reaction-badge {
  font-size: 0.8rem; cursor: pointer; user-select: none;
  padding: 0 2px; transition: transform 0.15s; display: flex; align-items: center; gap: 0.2rem;
}
.reaction-badge:hover { transform: scale(1.15); }

/* ============================================================
   CONTEXT MENU (Right Click)
   ============================================================ */
.context-menu-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  z-index: 100000; background: transparent;
}
.context-menu {
  position: fixed; z-index: 100001;
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 14px; padding: 0.35rem;
  box-shadow: 0 8px 30px rgba(0,0,0,0.35);
  min-width: 200px;
  backdrop-filter: blur(12px);
  animation: ctxOpen 0.15s ease-out;
}
@keyframes ctxOpen {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}

.ctx-reactions-row {
  display: flex; gap: 0.15rem; padding: 0.35rem 0.25rem;
  justify-content: center;
}
.ctx-reaction-btn {
  font-size: 1.3rem; cursor: pointer; padding: 0.2rem 0.3rem;
  border-radius: 8px; transition: all 0.15s; display: inline-block;
}
.ctx-reaction-btn:hover { background: var(--accent-glow); transform: scale(1.25); }
.ctx-more-emoji { font-size: 1rem; opacity: 0.6; }

.ctx-emoji-picker {
  padding: 0.35rem; max-height: 180px; overflow-y: auto;
  border-top: 1px solid var(--border);
}
.ctx-emoji-grid { display: flex; flex-wrap: wrap; gap: 0.15rem; }
.ctx-emoji-item {
  font-size: 1.2rem; cursor: pointer; padding: 0.2rem 0.25rem;
  border-radius: 6px; transition: all 0.1s;
}
.ctx-emoji-item:hover { background: var(--accent-glow); transform: scale(1.15); }

.ctx-divider { height: 1px; background: var(--border); margin: 0.25rem 0.35rem; }

.ctx-item {
  display: flex; align-items: center; gap: 0.6rem; width: 100%;
  padding: 0.55rem 0.75rem; border: none; background: transparent;
  color: var(--text-primary); font-size: 0.85rem; font-weight: 500;
  cursor: pointer; border-radius: 8px; transition: background 0.12s;
  text-align: left;
}
.ctx-item:hover { background: var(--accent-glow); }
.ctx-item.ctx-danger { color: var(--danger, var(--color-danger-bg)); }
.ctx-item.ctx-danger:hover { background: rgba(239, 68, 68, 0.1); }
.ctx-icon { font-size: 1rem; width: 22px; text-align: center; }

/* BOTTOM INPUT AREA */
.chat-input-area {
  background: var(--bg-secondary); padding: 0.5rem 0.8rem;
  z-index: 2; display: flex; flex-direction: column;
  border-top: 1px solid var(--border);
}
.chat-form { display: flex; align-items: center; gap: 0.5rem; }
.btn-emoji-toggle, .btn-attach, .btn-schedule-toggle {
  background: none; border: none; font-size: 1.3rem;
  color: var(--text-secondary); cursor: pointer; padding: 0.3rem;
  transition: all 0.2s; border-radius: 8px;
}
.btn-emoji-toggle:hover, .btn-attach:hover, .btn-schedule-toggle:hover {
  color: var(--accent-primary, var(--color-accent-bg)); background: var(--accent-glow);
}
.btn-schedule-toggle.active { color: var(--accent-primary, var(--color-accent-bg)); }
.chat-input {
  flex: 1; border: 1px solid var(--border); border-radius: 12px;
  padding: 0.6rem 1rem; font-size: 0.92rem;
  background: var(--bg-primary); outline: none; color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.chat-input:focus {
  border-color: var(--accent-primary, var(--color-accent-bg));
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}
.btn-send, .btn-mic {
  background: var(--accent-primary, var(--color-accent-bg)); border: none; border-radius: 50%;
  width: 42px; height: 42px;
  display: flex; justify-content: center; align-items: center;
  color: white; cursor: pointer; transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
}
.btn-send:hover, .btn-mic:hover { transform: scale(1.08); box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4); }

/* MEDIA PREVIEW & AUDIO RECORDING UI */
.media-preview-box, .audio-recording-box {
  background: var(--bg-secondary); padding: 0.65rem 0.8rem; border-radius: 10px;
  margin-bottom: 0.4rem;
  display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border: 1px solid var(--border);
}
.preview-content { display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary); font-weight: 500; font-size: 0.88rem; }
.btn-clear-media {
  background: var(--bg-card); border: none; border-radius: 50%;
  width: 26px; height: 26px; cursor: pointer; color: var(--text-secondary);
  transition: background 0.15s;
}
.btn-clear-media:hover { background: rgba(239,68,68,0.15); color: var(--danger); }

.recording-pulse {
  width: 12px; height: 12px; background: var(--color-danger-bg); border-radius: 50%;
  animation: pulse 1s infinite; margin-right: 0.75rem;
}
@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}
.recording-text { font-size: 0.88rem; color: var(--text-primary); font-weight: 500; }
.recording-actions { display: flex; gap: 0.4rem; }
.btn-stop-record {
  background: var(--success, #22c55e); color: white; border: none;
  padding: 0.35rem 0.7rem; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.8rem;
  transition: transform 0.1s;
}
.btn-stop-record:hover { transform: scale(1.05); }
.btn-cancel-record {
  background: transparent; color: var(--color-danger-bg); border: 1px solid rgba(239,68,68,0.3);
  padding: 0.35rem 0.6rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.8rem;
}

/* SCHEDULER & EMOJI DRAWER */
.scheduler-drawer {
  background: var(--bg-primary); margin-top: 0.4rem; border-radius: 10px;
  padding: 0.4rem 0.6rem; display: flex; justify-content: space-between;
  align-items: center; border: 1px solid var(--border);
}
.schedule-input {
  border: 1px solid var(--border); border-radius: 8px; padding: 0.35rem 0.5rem;
  outline: none; background: var(--bg-secondary); color: var(--text-primary); font-size: 0.85rem;
}
.btn-schedule-confirm {
  background: var(--accent-primary); color: white; border: none;
  padding: 0.3rem 0.6rem; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.78rem;
}
.emoji-picker-panel {
  background: var(--bg-secondary); padding: 0.5rem;
  border-top: 1px solid var(--border); z-index: 2;
}
.emoji-grid { display: flex; flex-wrap: wrap; gap: 0.15rem; }
.emoji-item {
  font-size: 1.4rem; cursor: pointer; padding: 0.2rem;
  border-radius: 6px; transition: all 0.1s;
}
.emoji-item:hover { background: var(--accent-glow); transform: scale(1.15); }
.schedule-indicator {
  font-size: 0.8rem; color: var(--text-secondary);
  display: flex; align-items: center; gap: 0.4rem;
}
.btn-clear-schedule {
  background: none; border: none; color: var(--danger);
  cursor: pointer; font-size: 0.78rem; font-weight: 700;
}

/* SCHEDULED MODAL */
.scheduled-modal-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.6); z-index: 100;
  display: flex; justify-content: center; align-items: center;
  backdrop-filter: blur(4px);
}
.scheduled-modal {
  background: var(--bg-secondary); width: 400px; border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.35); overflow: hidden;
  display: flex; flex-direction: column; border: 1px solid var(--border);
}
.modal-header {
  background: linear-gradient(135deg, var(--accent-primary, var(--color-accent-bg)), var(--accent-secondary, #3b82f6));
  color: white; padding: 0.8rem 1rem;
  display: flex; justify-content: space-between; align-items: center; font-weight: bold;
}
.modal-header h3 { font-size: 0.95rem; margin: 0; }
.modal-header button {
  background: rgba(255,255,255,0.15); border: none; color: white;
  cursor: pointer; font-size: 1rem; width: 28px; height: 28px;
  border-radius: 6px; display: flex; align-items: center; justify-content: center;
}
.modal-body {
  padding: 0.8rem; max-height: 400px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 0.4rem;
}
.pending-item {
  background: var(--bg-card, var(--bg-primary)); padding: 0.7rem;
  border-radius: 10px; border-left: 4px solid #fb923c;
}
.pending-item-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;
}
.pending-time { font-size: 0.72rem; color: var(--text-secondary); font-weight: 700; }
.pending-content { font-size: 0.88rem; color: var(--text-primary); }
.btn-delete-scheduled {
  background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2);
  color: var(--color-danger-bg); font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.45rem;
  border-radius: 6px; cursor: pointer; transition: all 0.2s;
}
.btn-delete-scheduled:hover { background: rgba(239, 68, 68, 0.2); }
.no-pending {
  text-align: center; color: var(--text-secondary); padding: 1.5rem 0; font-style: italic;
}

/* Chat-specific Independent Themes */
.chat-drawer[data-theme="light"] {
  --bg-primary: #f5f5f7;
  --bg-secondary: #ffffff;
  --bg-card: #ffffff;
  --text-primary: #1d1d1f;
  --text-secondary: #86868b;
  --accent: var(--color-accent-bg, #6366f1);
  --accent-glow: rgba(99, 102, 241, 0.15);
  --border: #d2d2d7;
  --chat-bg: #f5f5f7;
  --bubble-in: #ffffff;
  --bubble-out: #e0e7ff;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(24px) saturate(180%);
}

.chat-drawer[data-theme="dark"] {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-card: #1e293b;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --accent: var(--color-accent-bg, #8b5cf6);
  --accent-glow: rgba(139, 92, 246, 0.15);
  --border: #334155;
  --chat-bg: #0f172a;
  --bubble-in: #1e293b;
  --bubble-out: #1e3a5f;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(24px) saturate(180%);
}
/* DRAG & DROP OVERLAY */
.drag-drop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  animation: fadeIn 0.2s ease;
}
.drag-drop-box {
  border: 3px dashed var(--accent-primary, #8b5cf6);
  border-radius: 16px;
  padding: 2.5rem 3.5rem;
  text-align: center;
  background: var(--bg-card);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}
.drag-drop-icon {
  font-size: 3.5rem;
  margin-bottom: 0.5rem;
  animation: bounce 1s infinite alternate;
}
.drag-drop-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}
.drag-drop-sub {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

@keyframes bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-8px); }
}

/* FILE CARD PREVIEW */
.file-card-preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  background: rgba(0, 0, 0, 0.12);
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  max-width: 280px;
}
.file-card-preview:hover {
  background: rgba(0, 0, 0, 0.2);
  border-color: var(--accent-primary, #8b5cf6);
  transform: translateY(-1px);
}
.file-card-icon {
  font-size: 1.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.file-card-info {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.file-card-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-card-size {
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-top: 0.1rem;
}
.file-card-download-btn {
  background: var(--accent-glow);
  color: var(--accent-primary, #8b5cf6);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}
.file-card-download-btn:hover {
  background: var(--accent-primary, #8b5cf6);
  color: #fff;
}

/* UPLOAD PROGRESS BAR */
.upload-progress-container {
  padding: 0.5rem 1rem;
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.upload-progress-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
}
.upload-progress-bar-bg {
  width: 100%;
  height: 6px;
  background: var(--bg-primary);
  border-radius: 3px;
  overflow: hidden;
}
.upload-progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-primary, #8b5cf6), #3b82f6);
  transition: width 0.2s ease;
  border-radius: 3px;
}

/* UPLOAD ERROR BANNER */
.upload-error-banner {
  padding: 0.5rem 1rem;
  background: rgba(220, 38, 38, 0.15);
  border-top: 1px solid var(--danger);
  color: var(--danger);
  font-size: 0.82rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.btn-close-banner {
  background: none;
  border: none;
  color: var(--danger);
  cursor: pointer;
  font-size: 0.9rem;
}
</style>
