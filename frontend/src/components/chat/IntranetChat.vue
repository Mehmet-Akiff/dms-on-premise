<template>
  <div class="chat-drawer-wrapper" :class="{ 'drawer-open': isOpen }">
    <div class="drawer-overlay" @click="closeDrawer"></div>
    <div class="chat-drawer">
      <!-- Header -->
      <div class="drawer-header">
        <div class="header-title">
          <span>{{ systemMode === 'standalone' ? '📝' : '💬' }}</span>
          <h3>{{ systemMode === 'standalone' ? 'Not Panosu' : 'Kurum İçi İletişim' }}</h3>
          <span class="mode-badge" :class="systemMode">{{ systemMode === 'standalone' ? 'Tek PC' : 'Ağ' }}</span>
        </div>
        <button class="btn-close-drawer" @click="closeDrawer">✕</button>
      </div>

      <div class="chat-layout">
        <!-- Sidebar / Kişiler -->
        <div class="chat-sidebar">
          <div class="sidebar-search">
            <input type="text" placeholder="Kişi ara..." v-model="searchQuery" class="search-input" />
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
                <span v-if="user.status === 'active'" class="online-dot"></span>
              </div>
              <div class="room-info">
                <span class="room-name">{{ user.fullName || user.username }}</span>
              </div>
            </li>
          </ul>
        </div>

        <!-- Main Chat Area -->
        <div class="chat-main">
          <!-- Aktif sohbet başlığı -->
          <div class="chat-top-bar">
            <div class="chat-top-avatar" :class="{'global-avatar': activeChat === 'global'}">
               {{ activeChat === 'global' ? '#' : (activeChatLabel.charAt(0).toUpperCase()) }}
            </div>
            <div class="chat-top-info">
              <span class="chat-target-name">{{ activeChatLabel }}</span>
              <span class="chat-status" v-if="activeChat !== 'global'">Çevrimiçi</span>
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
              {{ systemMode === 'standalone' ? 'Henüz not yok. İlk notu siz bırakın.' : 'Henüz mesaj yok. İlk mesajı siz gönderin.' }}
            </div>
            
            <div v-for="(msg, index) in deliveredMessages" :key="msg.id || index" 
                 class="message-wrapper"
                 :class="{ 'message-self': isMine(msg), 'message-deleted': msg.is_deleted }">
              
              <div class="message-bubble">
                <!-- Silinen mesaj gösterimi -->
                <div v-if="msg.is_deleted" class="deleted-message-content">
                  <span class="deleted-icon">🚫</span> Bu mesaj silindi.
                </div>

                <template v-else>
                  <!-- Action Buttons (Hover) -->
                  <div class="message-actions" v-if="isMine(msg)">
                    <div class="quick-reactions" v-if="systemMode === 'network'">
                      <span @click="addReaction(msg.id, '👍')">👍</span>
                      <span @click="addReaction(msg.id, '❤️')">❤️</span>
                      <span @click="addReaction(msg.id, '😂')">😂</span>
                    </div>
                    <button v-if="canEdit(msg)" class="btn-msg-action edit" @click="startEdit(msg)" title="Düzenle">✏️</button>
                    <button class="btn-msg-action delete" @click="confirmDeleteMessage(msg)" title="Sil">🗑️</button>
                  </div>
                  <!-- Others' reaction trigger -->
                  <div class="reaction-trigger" v-else-if="systemMode === 'network'">
                    <div class="quick-reactions">
                      <span @click="addReaction(msg.id, '👍')">👍</span>
                      <span @click="addReaction(msg.id, '❤️')">❤️</span>
                      <span @click="addReaction(msg.id, '😂')">😂</span>
                    </div>
                  </div>

                  <div class="message-sender" v-if="!isMine(msg) && activeChat === 'global'">
                    {{ msg.sender?.fullName || msg.senderName || msg.sender?.username || 'Bilinmeyen' }}
                  </div>
                  
                  <!-- Media Content -->
                  <div v-if="msg.media_url" class="message-media">
                    <img v-if="msg.media_type === 'image'" :src="msg.media_url" class="media-image" alt="Image" @click="openImage(msg.media_url)" />
                    <audio v-else-if="msg.media_type === 'audio'" :src="msg.media_url" controls class="media-audio"></audio>
                    <a v-else :href="msg.media_url" target="_blank" class="media-document">
                      📄 Dosyayı İndir
                    </a>
                  </div>

                  <!-- Inline Edit Mode -->
                  <div v-if="editingMessageId === msg.id" class="inline-edit-box">
                    <input v-model="editContent" class="edit-input" @keyup.enter="saveEdit(msg.id)" @keyup.escape="cancelEdit" />
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
                  <span v-for="(count, emoji) in aggregateReactions(msg.reactions)" :key="emoji" class="reaction-badge" @click="addReaction(msg.id, emoji)">
                    {{ emoji }} {{ count }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Emoji Picker Panel -->
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
            <span>Ses kaydediliyor... ({{ recordingTime }}s)</span>
            <div class="recording-actions">
              <button class="btn-stop-record" @click="stopRecording">Durdur & Gönder</button>
              <button class="btn-cancel-record" @click="cancelRecording">İptal</button>
            </div>
          </div>

          <!-- Input Area -->
          <div class="chat-input-area" v-if="!isRecording">
            <form @submit.prevent="handleSend" class="chat-form">
              <button type="button" class="btn-emoji-toggle" @click="showEmojiPicker = !showEmojiPicker" title="Emoji">😊</button>
              
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
              <button class="btn-delete-scheduled" @click="deleteScheduledMessage(msg.id)" title="Sil / İptal Et">🗑️ Sil</button>
            </div>
            <div class="pending-content">{{ msg.content || (msg.media_type ? `[${msg.media_type} Medyası]` : '') }}</div>
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
import ConfirmModal from '../ConfirmModal.vue'

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

// Emoji & Schedule & Media
const showEmojiPicker = ref(false)
const showScheduler = ref(false)
const scheduledTime = ref('')
const selectedFile = ref(null)
const showScheduledModal = ref(false)

// Edit/Delete state
const editingMessageId = ref(null)
const editContent = ref('')
const showDeleteConfirm = ref(false)
const deleteTargetId = ref(null)

// Audio Recording
const isRecording = ref(false)
const mediaRecorder = ref(null)
const audioChunks = ref([])
const recordingTime = ref(0)
let recordInterval = null

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

// Sadece iletilmiş mesajlar
const deliveredMessages = computed(() => {
  return currentMessages.value.filter(m => m.is_delivered)
})

// Bekleyen zamanlanmış mesajlar
const pendingMessages = computed(() => {
  return currentMessages.value.filter(m => !m.is_delivered && isMine(m))
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
  emit('close')
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
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
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

// Audio Recording
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream)
    audioChunks.value = []
    
    mediaRecorder.value.ondataavailable = e => {
      if (e.data.size > 0) audioChunks.value.push(e.data)
    }
    
    mediaRecorder.value.onstop = async () => {
      const audioBlob = new Blob(audioChunks.value, { type: 'audio/webm' })
      stream.getTracks().forEach(track => track.stop())
      isRecording.value = false
      clearInterval(recordInterval)
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
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
    audioChunks.value = [] // clear so onstop doesn't send
  }
  isRecording.value = false
  clearInterval(recordInterval)
}

function selectChat(id) {
  activeChat.value = id
  showEmojiPicker.value = false
  showScheduler.value = false
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
    // Sessiz hata yakalama — ağ kesintilerinde kullanıcıyı rahatsız etme
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
    // Token parse hatası — oturum geçersiz olabilir
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

  socket.value.on('receive_message', (data) => {
    let chatId = 'global'
    if (data.receiver_id) {
      chatId = data.sender_id === currentUserId.value ? data.receiver_id : data.sender_id
    } else if (data.room_id) {
      chatId = data.room_id
    }
    
    if (!messages.value[chatId]) messages.value[chatId] = []
    
    // Duplikasyon kontrolü: aynı ID zaten varsa güncelle (zamanlanmış mesaj teslimi)
    const existingIdx = messages.value[chatId].findIndex(m => m.id === data.id)
    if (existingIdx !== -1) {
      // Vue reaktivitesi için splice kullan (index ataması reaktif değil)
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
function addReaction(messageId, emoji) {
  if (systemMode.value !== 'network' || !socket.value) return
  socket.value.emit('add_reaction', { messageId, emoji })
}

function aggregateReactions(reactionsArr) {
  if (!reactionsArr) return {}
  const counts = {}
  reactionsArr.forEach(r => {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1
  })
  return counts
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
  
  if (systemMode.value === 'network' && socket.value) {
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

  if (systemMode.value === 'network' && socket.value) {
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

  try {
    const res = await fetch('/api/chat/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    })
    if (res.ok) {
      const data = await res.json()
      if (data.success) {
        await executeSend(newMessage.value.trim(), data.url, data.type)
      }
    }
  } catch (err) {
    // Medya yükleme hatası sessizce yakalandı
  }
}

async function handleSend() {
  if (selectedFile.value) {
    const file = selectedFile.value
    clearMedia()
    await uploadAndSendMedia(file)
  } else if (newMessage.value.trim()) {
    await executeSend(newMessage.value.trim())
  }
}

async function executeSend(content, mediaUrl = null, mediaType = null) {
  const msgData = {
    content,
    scheduledAt: scheduledTime.value || null,
    mediaUrl,
    mediaType
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
        // (backend artık broadcast.to kullanıyor, gönderen broadcast almaz)
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

function openImage(url) {
  window.open(url, '_blank')
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
   DMS KURUMSAL CHAT TEMASI — CSS Değişkenleri ile Tema Uyumlu
   ============================================================ */

/* BASE DRAWER */
.chat-drawer-wrapper {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  pointer-events: none; z-index: 9999; display: flex; justify-content: flex-end;
  overflow: hidden; visibility: hidden;
  transition: visibility 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.chat-drawer-wrapper.drawer-open { pointer-events: auto; visibility: visible; }
.drawer-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); opacity: 0; transition: opacity 0.3s ease; }
.chat-drawer-wrapper.drawer-open .drawer-overlay { opacity: 1; }
.chat-drawer {
  position: relative; width: 100%; max-width: 900px; height: 100%;
  background: var(--bg-primary); box-shadow: -10px 0 30px rgba(0,0,0,0.5);
  transform: translateX(100%); transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex; flex-direction: column;
}
.chat-drawer-wrapper.drawer-open .chat-drawer { transform: translateX(0); }

/* HEADER — Kurumsal gradient */
.drawer-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.8rem 1.5rem;
  background: linear-gradient(135deg, var(--accent-primary, #8b5cf6), var(--accent-secondary, #3b82f6));
  color: white; border-bottom: 1px solid rgba(255,255,255,0.1);
}
.header-title { display: flex; align-items: center; gap: 0.75rem; }
.header-title h3 { margin: 0; font-size: 1.1rem; font-weight: 600; color: white; }
.mode-badge { font-size: 0.65rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 99px; text-transform: uppercase; background: rgba(255,255,255,0.2); }
.btn-close-drawer { background: none; border: none; color: white; font-size: 1.2rem; cursor: pointer; transition: transform 0.2s; }
.btn-close-drawer:hover { transform: rotate(90deg); }

/* LAYOUT & SIDEBAR */
.chat-layout { display: flex; flex: 1; overflow: hidden; background: var(--bg-primary); }
.chat-sidebar {
  width: 300px; background: var(--bg-secondary); border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
}
.sidebar-search { padding: 0.5rem 1rem; border-bottom: 1px solid var(--border); }
.search-input { width: 100%; padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card, var(--bg-primary)); outline: none; font-size: 0.9rem; color: var(--text-primary); }
.room-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex: 1; }
.room-item {
  display: flex; align-items: center; gap: 1rem; padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s;
}
.room-item:hover, .room-item.active { background: var(--accent-glow); }
.room-avatar {
  width: 48px; height: 48px; border-radius: 50%; background: var(--bg-card, #1e293b);
  display: flex; justify-content: center; align-items: center;
  font-size: 1.2rem; font-weight: bold; color: var(--text-secondary); position: relative; flex-shrink:0;
}
.global-avatar { background: var(--accent-primary, #8b5cf6); color: white; }
.online-dot { position: absolute; bottom: 2px; right: 2px; width: 12px; height: 12px; background: var(--success, #22c55e); border-radius: 50%; border: 2px solid var(--bg-secondary); }
.room-info { display: flex; flex-direction: column; overflow: hidden; }
.room-name { font-weight: 500; color: var(--text-primary); font-size: 1rem; }
.room-preview { font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* MAIN CHAT AREA */
.chat-main { flex: 1; display: flex; flex-direction: column; background: var(--chat-bg); position: relative; }
.chat-main::before {
  content: ""; position: absolute; top:0; left:0; width:100%; height:100%;
  opacity: 0.03; pointer-events: none;
  background-image: repeating-linear-gradient(45deg, var(--border) 0, var(--border) 1px, transparent 0, transparent 50%);
  background-size: 16px 16px;
}

.chat-top-bar {
  padding: 0.6rem 1rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 1rem; z-index: 2;
}
.chat-top-avatar {
  width: 40px; height: 40px; border-radius: 50%; background: var(--bg-card); color: var(--text-secondary);
  display: flex; justify-content: center; align-items: center; font-weight: bold;
}
.chat-top-info { display: flex; flex-direction: column; }
.chat-target-name { font-size: 1rem; font-weight: 500; color: var(--text-primary); }
.chat-status { font-size: 0.8rem; color: var(--success, #22c55e); }

/* STICKY BANNER */
.scheduled-sticky-banner {
  position: absolute; top: 60px; left: 50%; transform: translateX(-50%); z-index: 10;
  background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); color: var(--text-primary);
  padding: 0.5rem 1rem; border-radius: 8px; box-shadow: var(--shadow);
  display: flex; align-items: center; gap: 1rem; font-size: 0.85rem;
}
.btn-view-scheduled {
  background: var(--accent-primary, #8b5cf6); border: none; color: white; padding: 0.3rem 0.6rem;
  border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.8rem;
}

/* MESSAGES */
.messages-container { flex: 1; overflow-y: auto; padding: 2rem; display: flex; flex-direction: column; gap: 0.5rem; z-index: 2; }
.no-messages { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; color: var(--text-secondary); font-size: 0.95rem; }
.empty-state-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.3; }

.message-wrapper { display: flex; flex-direction: column; align-items: flex-start; max-width: 65%; position: relative; }
.message-self { align-self: flex-end; align-items: flex-end; }
.message-deleted .message-bubble { opacity: 0.6; }
.message-bubble {
  background: var(--bubble-in); padding: 0.4rem 0.6rem 0.5rem 0.6rem;
  border-radius: 7.5px; box-shadow: 0 1px 0.5px rgba(11,20,26,.13);
  position: relative; display: flex; flex-direction: column;
  min-width: 100px; color: var(--text-primary);
}
.message-self .message-bubble { background: var(--bubble-out); }

/* Message Actions (Edit/Delete on hover) */
.message-actions {
  position: absolute; top: -15px; right: -50px;
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  display: none; align-items: center; padding: 0.15rem 0.25rem; z-index: 10; gap: 0.1rem;
}
.message-self .message-actions { right: auto; left: -50px; }
.message-wrapper:hover .message-actions { display: flex; }
.btn-msg-action {
  background: none; border: none; cursor: pointer; padding: 0.15rem 0.25rem;
  font-size: 0.85rem; border-radius: 4px; transition: background 0.15s;
}
.btn-msg-action:hover { background: var(--accent-glow); }

/* Reactions Trigger */
.reaction-trigger {
  position: absolute; top: -15px; right: -40px; background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  display: none; align-items: center; padding: 0.2rem; z-index: 10;
}
.message-self .reaction-trigger { right: auto; left: -40px; }
.message-wrapper:hover .reaction-trigger { display: flex; }
.quick-reactions span { cursor: pointer; padding: 0.2rem; transition: transform 0.2s; display: inline-block; }
.quick-reactions span:hover { transform: scale(1.3); }

.message-sender { font-size: 0.75rem; color: var(--accent, #38bdf8); font-weight: 500; margin-bottom: 0.2rem; }
.message-content { font-size: 0.95rem; line-height: 1.3; word-break: break-word; }

/* Deleted message */
.deleted-message-content {
  font-size: 0.88rem; color: var(--text-secondary); font-style: italic;
  display: flex; align-items: center; gap: 0.4rem; padding: 0.2rem 0;
}
.deleted-icon { font-size: 0.85rem; }

/* Edited tag */
.edited-tag { font-size: 0.6rem; color: var(--text-secondary); font-style: italic; margin-left: 0.25rem; }

/* Inline Edit */
.inline-edit-box { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.2rem 0; }
.edit-input {
  width: 100%; padding: 0.4rem 0.6rem; border-radius: 6px; font-size: 0.9rem;
  border: 1px solid var(--accent-primary, #8b5cf6); outline: none;
  background: var(--bg-primary); color: var(--text-primary);
}
.edit-actions { display: flex; gap: 0.3rem; justify-content: flex-end; }
.btn-edit-save {
  background: var(--accent-primary, #8b5cf6); color: white; border: none;
  padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.72rem; font-weight: 600; cursor: pointer;
}
.btn-edit-cancel {
  background: transparent; color: var(--danger, #ef4444); border: 1px solid var(--danger, #ef4444);
  padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.72rem; font-weight: 600; cursor: pointer;
}

/* MEDIA */
.message-media { margin-bottom: 0.3rem; max-width: 100%; }
.media-image { max-width: 100%; border-radius: 6px; cursor: pointer; object-fit: cover; max-height: 250px; }
.media-audio { height: 40px; outline: none; width: 250px; }
.media-document {
  display: flex; align-items: center; gap: 0.5rem; background: rgba(0,0,0,0.05);
  padding: 0.7rem; border-radius: 6px; text-decoration: none; color: var(--text-primary); font-weight: 500; font-size: 0.9rem;
}

.message-meta { display: flex; align-items: center; justify-content: flex-end; gap: 0.25rem; margin-top: 0.2rem; margin-bottom: -0.2rem; float: right; margin-left: 1rem;}
.message-time { font-size: 0.65rem; color: var(--text-secondary); }
.read-receipt { color: var(--text-secondary); display: flex; align-items: center; }
.read-receipt.read { color: var(--accent, #38bdf8); }

.reactions-display {
  display: flex; flex-wrap: wrap; gap: 0.2rem; position: absolute; bottom: -12px; left: 10px;
  background: var(--bg-secondary); padding: 2px 6px; border-radius: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.15); border: 1px solid var(--border);
}
.message-self .reactions-display { left: auto; right: 10px; }
.reaction-badge { font-size: 0.75rem; cursor: pointer; user-select: none; }

/* BOTTOM INPUT AREA */
.chat-input-area { background: var(--bg-secondary); padding: 0.6rem 1rem; z-index: 2; display: flex; flex-direction: column; border-top: 1px solid var(--border);}
.chat-form { display: flex; align-items: center; gap: 0.6rem; }
.btn-emoji-toggle, .btn-attach, .btn-schedule-toggle {
  background: none; border: none; font-size: 1.4rem; color: var(--text-secondary); cursor: pointer; padding: 0.3rem; transition: color 0.2s;
}
.btn-schedule-toggle.active { color: var(--accent-primary, #8b5cf6); }
.chat-input {
  flex: 1; border: 1px solid var(--border); border-radius: 8px; padding: 0.7rem 1rem; font-size: 0.95rem;
  background: var(--bg-primary); outline: none; color: var(--text-primary);
}
.chat-input:focus { border-color: var(--accent-primary, #8b5cf6); }
.btn-send, .btn-mic {
  background: var(--accent-primary, #8b5cf6); border: none; border-radius: 50%; width: 44px; height: 44px;
  display: flex; justify-content: center; align-items: center; color: white; cursor: pointer; transition: transform 0.2s;
}
.btn-send:hover, .btn-mic:hover { transform: scale(1.05); }

/* MEDIA PREVIEW & AUDIO RECORDING UI */
.media-preview-box, .audio-recording-box {
  background: var(--bg-secondary); padding: 0.8rem 1rem; border-radius: 8px; margin-bottom: 0.5rem;
  display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border: 1px solid var(--border);
}
.preview-content { display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary); font-weight: 500;}
.btn-clear-media { background: var(--bg-card); border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; color: var(--text-secondary);}

.recording-pulse { width: 12px; height: 12px; background: #ef4444; border-radius: 50%; animation: pulse 1s infinite; margin-right: 1rem;}
@keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
.recording-actions { display: flex; gap: 0.5rem; }
.btn-stop-record { background: var(--accent-primary); color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-weight: bold;}
.btn-cancel-record { background: transparent; color: #ef4444; border: none; padding: 0.4rem; cursor: pointer;}

/* SCHEDULER & EMOJI DRAWER */
.scheduler-drawer { background: var(--bg-secondary); margin-top: 0.5rem; border-radius: 8px; padding: 0.5rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border);}
.schedule-input { border: 1px solid var(--border); border-radius: 6px; padding: 0.4rem; outline: none; background: var(--bg-primary); color: var(--text-primary); }
.btn-schedule-confirm { background: var(--accent-primary); color: white; border: none; padding: 0.35rem 0.7rem; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.8rem; }
.emoji-picker-panel { background: var(--bg-secondary); padding: 0.5rem; border-top: 1px solid var(--border); z-index: 2;}
.emoji-grid { display: flex; flex-wrap: wrap; gap: 0.2rem; }
.emoji-item { font-size: 1.5rem; cursor: pointer; padding: 0.2rem; border-radius: 4px; }
.emoji-item:hover { background: var(--accent-glow); }
.schedule-indicator { font-size: 0.82rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem;}
.btn-clear-schedule { background: none; border: none; color: var(--danger); cursor: pointer; font-size: 0.8rem; font-weight: 600;}

/* SCHEDULED MODAL */
.scheduled-modal-overlay {
  position: absolute; top:0; left:0; width:100%; height:100%;
  background: rgba(0,0,0,0.6); z-index: 100; display: flex; justify-content: center; align-items: center;
}
.scheduled-modal {
  background: var(--bg-secondary); width: 400px; border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.3); overflow: hidden; display: flex; flex-direction: column;
  border: 1px solid var(--border);
}
.modal-header {
  background: linear-gradient(135deg, var(--accent-primary, #8b5cf6), var(--accent-secondary, #3b82f6));
  color: white; padding: 1rem; display: flex; justify-content: space-between; align-items: center; font-weight: bold;
}
.modal-header button { background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem;}
.modal-body { padding: 1rem; max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem;}
.pending-item { background: var(--bg-card, var(--bg-primary)); padding: 0.8rem; border-radius: 8px; border-left: 4px solid #fb923c;}
.pending-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; }
.pending-time { font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;}
.pending-content { font-size: 0.9rem; color: var(--text-primary);}
.btn-delete-scheduled {
  background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444; font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.5rem;
  border-radius: 6px; cursor: pointer; transition: all 0.2s;
}
.btn-delete-scheduled:hover { background: rgba(239, 68, 68, 0.2); }
.no-pending { text-align: center; color: var(--text-secondary); padding: 2rem 0; font-style: italic;}
</style>
