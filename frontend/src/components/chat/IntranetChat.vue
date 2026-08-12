<template>
  <div class="chat-drawer-wrapper" :class="{ 'drawer-open': isOpen }">
    <div class="drawer-overlay" @click="closeDrawer"></div>
    <div class="chat-drawer">
      <!-- Header -->
      <div class="drawer-header">
        <div class="header-title">
          <span>💬</span>
          <h3>{{ $t('chat.title') || 'Kurum İçi Haberleşme' }}</h3>
        </div>
        <button class="btn-close-drawer" @click="closeDrawer">✕</button>
      </div>

      <div class="chat-layout">
        <!-- Sidebar / Rooms -->
        <div class="chat-sidebar">
          <div class="sidebar-header">
            <h4>Kişiler & Odalar</h4>
          </div>
          <ul class="room-list">
            <li class="room-item" :class="{ active: activeChat === 'global' }" @click="selectChat('global')">
              <span class="room-icon">#</span>
              <span class="room-name">Sistem Odası</span>
            </li>
            <li v-for="user in users" :key="user.id" class="room-item" :class="{ active: activeChat === user.id }" @click="selectChat(user.id)">
              <span class="room-icon">👤</span>
              <span class="room-name">{{ user.fullName || user.username }}</span>
            </li>
          </ul>
        </div>

        <!-- Main Chat Area -->
        <div class="chat-main">
          <!-- Messages -->
          <div class="messages-container" ref="messagesContainer">
            <div v-if="currentMessages.length === 0" class="no-messages">
              Henüz mesaj yok. İlk mesajı siz gönderin.
            </div>
            
            <div v-for="(msg, index) in currentMessages" :key="index" 
                 class="message-wrapper"
                 :class="{ 'message-self': msg.sender_id === currentUserId || msg.senderId === currentUserId }">
              
              <div class="message-bubble">
                <div class="message-sender" v-if="msg.sender_id !== currentUserId && msg.senderId !== currentUserId">
                  {{ msg.sender?.fullName || msg.senderName || msg.sender?.username || 'Bilinmeyen' }}
                </div>
                <div class="message-content">
                  {{ msg.content }}
                </div>
                <div class="message-time">
                  {{ formatTime(msg.timestamp || msg.createdAt) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Input Area -->
          <div class="chat-input-area">
            <form @submit.prevent="sendMessage" class="chat-form">
              <input 
                v-model="newMessage" 
                type="text" 
                placeholder="Mesajınızı yazın..." 
                class="chat-input"
                :disabled="!isConnected"
              />
              <button type="submit" class="btn-send" :disabled="!newMessage.trim() || !isConnected">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import { io } from 'socket.io-client'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const socket = ref(null)
const isConnected = ref(false)
const messages = ref({ global: [] })
const newMessage = ref('')
const messagesContainer = ref(null)

const currentUserId = ref('')
const currentUserFullName = ref('')

// Yeni durumlar
const users = ref([])
const activeChat = ref('global')

const currentMessages = computed(() => {
  return messages.value[activeChat.value] || []
})

function closeDrawer() {
  emit('close')
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

function selectChat(id) {
  activeChat.value = id
  if (!messages.value[id] || messages.value[id].length === 0) {
    fetchMessageHistory(id)
  }
  scrollToBottom()
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
          text: msg.content,
          senderName: msg.sender?.fullName || msg.sender?.username || 'Bilinmeyen',
          isMine: msg.sender_id === currentUserId.value,
          createdAt: msg.created_at
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
    const response = await fetch('/api/auth/chat-users', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      const data = await response.json()
      // Kendimizi listeden çıkartıyoruz
      if (data.users) {
        users.value = data.users.filter(u => u.id !== currentUserId.value)
      }
    }
  } catch (error) {
    console.error('Kullanıcılar alınamadı', error)
  }
}

function initSocket() {
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

  // Connect to socket server via NGINX proxy (which handles /socket.io/)
  // and force websocket to avoid polling which exhausts browser connection limits
  socket.value = io('/', {
    auth: { token },
    transports: ['websocket']
  })

  socket.value.on('connect', () => {
    isConnected.value = true
    // Genel odaya katıl
    socket.value.emit('join_room', 'global')
    // Geçmiş mesajları çek
    fetchMessageHistory('global')
  })

  socket.value.on('disconnect', () => {
    isConnected.value = false
  })

  socket.value.on('receive_message', (data) => {
    let chatId = 'global'
    if (data.receiver_id) {
      // Eğer mesaj birebir ise, chatId karşı tarafın id'si olmalı
      chatId = data.sender_id === currentUserId.value ? data.receiver_id : data.sender_id
    } else if (data.room_id) {
      chatId = data.room_id
    }
    
    if (!messages.value[chatId]) {
      messages.value[chatId] = []
    }
    messages.value[chatId].push(data)
    
    // Eğer o an açık olan chat'e geldiyse kaydır
    if (activeChat.value === chatId) {
      scrollToBottom()
    }
  })
}

function sendMessage() {
  if (!newMessage.value.trim() || !socket.value) return

  const msgData = {
    content: newMessage.value.trim(),
    timestamp: new Date().toISOString()
  }

  if (activeChat.value === 'global') {
    msgData.roomId = 'global'
  } else {
    msgData.receiverId = activeChat.value
  }

  socket.value.emit('send_message', msgData, (response) => {
    if (response && response.success) {
      const data = response.data
      let chatId = 'global'
      if (data.receiver_id) {
        chatId = data.sender_id === currentUserId.value ? data.receiver_id : data.sender_id
      } else if (data.room_id) {
        chatId = data.room_id
      }
      if (!messages.value[chatId]) messages.value[chatId] = []
      messages.value[chatId].push(data)
      
      if (activeChat.value === chatId) {
        scrollToBottom()
      }
    }
  })
  newMessage.value = ''
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (!socket.value) {
      initSocket()
    }
    if (users.value.length === 0) {
      fetchUsers()
    }
    scrollToBottom()
  }
})

onMounted(() => {
  if (props.isOpen) {
    initSocket()
    fetchUsers()
  }
})

onUnmounted(() => {
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
  max-width: 800px;
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
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-title span {
  font-size: 1.25rem;
}

.header-title h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
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

.room-icon {
  font-size: 1rem;
  opacity: 0.7;
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
  gap: 1rem;
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
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border-top-left-radius: 4px;
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  position: relative;
}

.message-self .message-bubble {
  background: rgba(56, 189, 248, 0.1);
  border-color: rgba(56, 189, 248, 0.2);
  border-top-left-radius: 12px;
  border-top-right-radius: 4px;
}

.message-sender {
  font-size: 0.75rem;
  color: var(--accent);
  margin-bottom: 0.25rem;
  font-weight: 600;
}

.message-content {
  font-size: 0.9rem;
  line-height: 1.4;
  color: var(--text-primary);
  word-break: break-word;
}

.message-time {
  font-size: 0.65rem;
  color: var(--text-secondary);
  margin-top: 0.4rem;
  text-align: right;
  opacity: 0.7;
}

/* INPUT AREA */
.chat-input-area {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
}

.chat-form {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.chat-input {
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  padding: 0.75rem 1rem;
  border-radius: 99px;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input:focus {
  border-color: var(--accent);
}

.chat-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-send {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  border: none;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;
}

.btn-send:hover:not(:disabled) {
  transform: scale(1.05);
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--border);
}

@media (max-width: 600px) {
  .chat-layout {
    flex-direction: column;
  }
  .chat-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border);
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
