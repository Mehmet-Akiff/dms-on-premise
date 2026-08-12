<template>
  <div class="chat-drawer-wrapper" :class="{ 'drawer-open': isOpen }">
    <div class="drawer-overlay" @click="closeDrawer"></div>
    <div class="chat-drawer">
      <!-- Header -->
      <div class="drawer-header">
        <div class="header-title">
          <span>{{ systemMode === 'standalone' ? '📝' : '💬' }}</span>
          <h3>{{ systemMode === 'standalone' ? 'Not Panosu' : 'Kurum İçi Mesajlaşma' }}</h3>
          <span class="mode-badge" :class="systemMode">{{ systemMode === 'standalone' ? 'Tek PC' : 'Ağ' }}</span>
        </div>
        <button class="btn-close-drawer" @click="closeDrawer">✕</button>
      </div>

      <div class="chat-layout">
        <!-- Sidebar / Kişiler -->
        <div class="chat-sidebar">
          <div class="sidebar-header">
            <h4>Kişiler &amp; Odalar</h4>
          </div>
          <ul class="room-list">
            <li class="room-item" :class="{ active: activeChat === 'global' }" @click="selectChat('global')">
              <span class="room-icon">#</span>
              <span class="room-name">Sistem Odası</span>
            </li>
            <li v-for="user in users" :key="user.id" class="room-item" :class="{ active: activeChat === user.id }" @click="selectChat(user.id)">
              <span class="room-icon">👤</span>
              <span class="room-name">{{ user.fullName || user.username }}</span>
              <span v-if="user.status === 'active'" class="online-dot"></span>
            </li>
          </ul>
        </div>

        <!-- Main Chat Area -->
        <div class="chat-main">
          <!-- Aktif sohbet başlığı -->
          <div class="chat-top-bar">
            <span class="chat-target-name">{{ activeChatLabel }}</span>
          </div>

          <!-- Messages -->
          <div class="messages-container" ref="messagesContainer">
            <div v-if="currentMessages.length === 0" class="no-messages">
              {{ systemMode === 'standalone' ? 'Henüz not yok. İlk notu siz bırakın.' : 'Henüz mesaj yok. İlk mesajı siz gönderin.' }}
            </div>
            
            <div v-for="(msg, index) in currentMessages" :key="msg.id || index" 
                 class="message-wrapper"
                 :class="{ 'message-self': isMine(msg) }">
              
              <div class="message-bubble" :class="{ 'scheduled-msg': msg.scheduled_at && !msg.is_delivered }">
                <div class="message-sender" v-if="!isMine(msg)">
                  {{ msg.sender?.fullName || msg.senderName || msg.sender?.username || 'Bilinmeyen' }}
                </div>
                <div class="message-content">
                  {{ msg.content }}
                </div>
                <div class="message-meta">
                  <span class="message-time">{{ formatTime(msg.created_at || msg.createdAt || msg.timestamp) }}</span>
                  <span v-if="msg.scheduled_at" class="scheduled-icon" title="Zamanlanmış mesaj">⏰</span>
                  <span v-if="msg.type === 'note'" class="note-icon" title="Not">📌</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Emoji Picker -->
          <div v-if="showEmojiPicker" class="emoji-picker-panel">
            <div class="emoji-grid">
              <span v-for="emoji in emojis" :key="emoji" class="emoji-item" @click="insertEmoji(emoji)">{{ emoji }}</span>
            </div>
          </div>

          <!-- Zamanlama Paneli -->
          <div v-if="showScheduler" class="scheduler-panel">
            <label>📅 Gönderim Zamanı:</label>
            <input type="datetime-local" v-model="scheduledTime" class="schedule-input" :min="minScheduleTime" />
            <div class="scheduler-actions">
              <button class="btn-schedule-confirm" @click="confirmSchedule">✓ Onayla</button>
              <button class="btn-schedule-cancel" @click="cancelSchedule">✕ İptal</button>
            </div>
          </div>

          <!-- Input Area -->
          <div class="chat-input-area">
            <form @submit.prevent="sendMessage" class="chat-form">
              <button type="button" class="btn-emoji-toggle" @click="showEmojiPicker = !showEmojiPicker" title="Emoji">
                😊
              </button>
              <input 
                v-model="newMessage" 
                type="text" 
                :placeholder="systemMode === 'standalone' ? 'Notunuzu yazın...' : 'Mesajınızı yazın...'" 
                class="chat-input"
                ref="chatInput"
              />
              <button type="button" class="btn-schedule-toggle" @click="toggleScheduler" title="Zamanlanmış Gönderim" :class="{ active: scheduledTime }">
                ⏰
              </button>
              <button type="submit" class="btn-send" :disabled="!newMessage.trim()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
            <div v-if="scheduledTime" class="schedule-indicator">
              ⏰ Zamanlanmış: {{ formatScheduleDisplay(scheduledTime) }}
              <button @click="cancelSchedule" class="btn-clear-schedule">✕</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import { io as socketIoClient } from 'socket.io-client'

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

const currentUserId = ref('')
const currentUserFullName = ref('')

const users = ref([])
const activeChat = ref('global')
const systemMode = ref('standalone')

// Emoji & Zamanlama
const showEmojiPicker = ref(false)
const showScheduler = ref(false)
const scheduledTime = ref('')

const emojis = [
  '😊','😂','❤️','👍','🎉','🔥','😎','🤔','👋','✅',
  '⚠️','📌','💡','📎','📁','🔒','🔑','📊','📝','💬',
  '✨','🚀','💪','👏','🙏','😄','😢','😡','🤝','👀',
  '❌','⭐','🎯','📢','🔔','💻','📱','🌐','⏰','📅'
]

const minScheduleTime = computed(() => {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 1)
  return d.toISOString().slice(0, 16)
})

const currentMessages = computed(() => {
  return messages.value[activeChat.value] || []
})

const activeChatLabel = computed(() => {
  if (activeChat.value === 'global') return '# Sistem Odası'
  const user = users.value.find(u => u.id === activeChat.value)
  return user ? (user.fullName || user.username) : 'Sohbet'
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

function confirmSchedule() {
  showScheduler.value = false
}

function cancelSchedule() {
  scheduledTime.value = ''
  showScheduler.value = false
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
    console.error(`Sohbet geçmişi alınamadı (${targetId}):`, error)
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
    console.error('Kullanıcılar alınamadı', error)
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
    console.warn('Token parse error in chat', e)
  }
}

function initSocket() {
  if (systemMode.value === 'standalone') return

  const token = localStorage.getItem('token')
  if (!token) return

  socket.value = socketIoClient('/', {
    auth: { token },
    transports: ['websocket']
  })

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
    
    if (!messages.value[chatId]) {
      messages.value[chatId] = []
    }

    // Duplikasyonu önle
    const exists = messages.value[chatId].some(m => m.id === data.id)
    if (!exists) {
      messages.value[chatId].push(data)
    }
    
    if (activeChat.value === chatId) {
      scrollToBottom()
    }
  })
}

async function sendMessage() {
  if (!newMessage.value.trim()) return

  const msgData = {
    content: newMessage.value.trim(),
    scheduledAt: scheduledTime.value || null,
  }

  if (activeChat.value === 'global') {
    msgData.roomId = 'global'
  } else {
    msgData.receiverId = activeChat.value
  }

  if (systemMode.value === 'standalone') {
    // Tek PC modu: HTTP API ile not gönder
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
      console.error('Not gönderilemedi:', error)
    }
  } else {
    // Ağ modu: Socket.io ile gerçek zamanlı mesaj
    if (!socket.value) return
    socket.value.emit('send_message', msgData, (response) => {
      if (response && response.success && response.data) {
        // Global odada io.to('global') ile herkese gönderildiği için
        // callback'ten gelen veriyi eklemiyoruz (receive_message'da gelecek).
        // Ancak birebir mesajlarda gönderenin kendisi receive almaz.
        if (msgData.receiverId) {
          const chatId = msgData.receiverId
          if (!messages.value[chatId]) messages.value[chatId] = []
          const exists = messages.value[chatId].some(m => m.id === response.data.id)
          if (!exists) {
            messages.value[chatId].push(response.data)
          }
          scrollToBottom()
        }
      }
    })
  }

  newMessage.value = ''
  scheduledTime.value = ''
  showScheduler.value = false
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
      if (!socket.value) {
        initSocket()
      }
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
/* DRAWER BASE */
.chat-drawer-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
  display: flex;
  justify-content: flex-end;
  overflow: hidden;
  visibility: hidden;
  transition: visibility 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.chat-drawer-wrapper.drawer-open {
  pointer-events: auto;
  visibility: visible;
}

.drawer-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(3, 7, 18, 0.4);
  backdrop-filter: blur(4px);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.chat-drawer-wrapper.drawer-open .drawer-overlay {
  opacity: 1;
}

.chat-drawer {
  position: relative;
  width: 100%;
  max-width: 850px;
  height: 100%;
  background: var(--bg-primary);
  border-left: 1px solid var(--border);
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
  transform: translateX(100%);
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
}

.chat-drawer-wrapper.drawer-open .chat-drawer {
  transform: translateX(0);
}

/* HEADER */
.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-title span:first-child {
  font-size: 1.25rem;
}

.header-title h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
}

.mode-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 99px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.mode-badge.standalone {
  background: rgba(251, 146, 60, 0.15);
  color: #fb923c;
  border: 1px solid rgba(251, 146, 60, 0.3);
}

.mode-badge.network {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
  border: 1px solid rgba(52, 211, 153, 0.3);
}

.btn-close-drawer {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-close-drawer:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
  transform: rotate(90deg);
}

/* CHAT LAYOUT */
.chat-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* SIDEBAR */
.chat-sidebar {
  width: 220px;
  background: rgba(19, 28, 49, 0.4);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.sidebar-header h4 {
  margin: 0;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 1px;
}

.room-list {
  list-style: none;
  padding: 0.5rem;
  margin: 0;
}

.room-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.room-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.room-item.active {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  font-weight: 600;
}

.online-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34d399;
  margin-left: auto;
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.5);
}

.room-icon {
  font-size: 1rem;
  opacity: 0.7;
}

/* CHAT TOP BAR */
.chat-top-bar {
  padding: 0.6rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: rgba(19, 28, 49, 0.3);
}

.chat-target-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

/* MAIN CHAT AREA */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.no-messages {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--text-secondary);
  font-style: italic;
  font-size: 0.9rem;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 80%;
}

.message-self {
  align-self: flex-end;
  align-items: flex-end;
}

.message-bubble {
  background: var(--bg-card);
  padding: 0.6rem 0.9rem;
  border-radius: 12px;
  border-top-left-radius: 4px;
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.message-self .message-bubble {
  background: rgba(56, 189, 248, 0.1);
  border-color: rgba(56, 189, 248, 0.2);
  border-top-left-radius: 12px;
  border-top-right-radius: 4px;
}

.scheduled-msg {
  border-color: rgba(251, 146, 60, 0.3) !important;
  background: rgba(251, 146, 60, 0.05) !important;
}

.message-sender {
  font-size: 0.72rem;
  color: var(--accent);
  margin-bottom: 0.15rem;
  font-weight: 600;
}

.message-content {
  font-size: 0.88rem;
  line-height: 1.4;
  color: var(--text-primary);
  word-break: break-word;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.3rem;
  justify-content: flex-end;
}

.message-time {
  font-size: 0.6rem;
  color: var(--text-secondary);
  opacity: 0.7;
}

.scheduled-icon, .note-icon {
  font-size: 0.65rem;
}

/* EMOJI PICKER */
.emoji-picker-panel {
  padding: 0.5rem;
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
  max-height: 180px;
  overflow-y: auto;
}

.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.emoji-item {
  font-size: 1.3rem;
  cursor: pointer;
  padding: 0.3rem;
  border-radius: 6px;
  transition: background 0.15s;
  user-select: none;
}

.emoji-item:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.15);
}

/* SCHEDULER */
.scheduler-panel {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border);
  background: rgba(251, 146, 60, 0.05);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.scheduler-panel label {
  font-size: 0.8rem;
  color: #fb923c;
  font-weight: 600;
  white-space: nowrap;
}

.schedule-input {
  background: var(--bg-primary);
  border: 1px solid rgba(251, 146, 60, 0.3);
  color: var(--text-primary);
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  font-size: 0.8rem;
  outline: none;
}

.scheduler-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-schedule-confirm, .btn-schedule-cancel {
  border: none;
  padding: 0.35rem 0.7rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-schedule-confirm {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}

.btn-schedule-cancel {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* INPUT AREA */
.chat-input-area {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
}

.chat-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.btn-emoji-toggle, .btn-schedule-toggle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
  font-size: 1.1rem;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-emoji-toggle:hover, .btn-schedule-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
}

.btn-schedule-toggle.active {
  background: rgba(251, 146, 60, 0.15);
  border-color: rgba(251, 146, 60, 0.3);
  color: #fb923c;
}

.chat-input {
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  padding: 0.65rem 1rem;
  border-radius: 99px;
  color: var(--text-primary);
  font-size: 0.88rem;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input:focus {
  border-color: var(--accent);
}

.btn-send {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  border: none;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;
  flex-shrink: 0;
}

.btn-send:hover:not(:disabled) {
  transform: scale(1.05);
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--border);
}

/* SCHEDULE INDICATOR */
.schedule-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
  font-size: 0.75rem;
  color: #fb923c;
  font-weight: 600;
}

.btn-clear-schedule {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0;
}

@media (max-width: 600px) {
  .chat-layout {
    flex-direction: column;
  }
  .chat-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border);
    max-height: 150px;
  }
  .room-list {
    display: flex;
    overflow-x: auto;
  }
  .room-item {
    white-space: nowrap;
  }
}
</style>
