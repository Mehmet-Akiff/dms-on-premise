<template>
  <div class="users-panel">
    <div class="users-header">
      <h3>👥 {{ $t('users.panelTitle') || 'Sistem Kullanıcıları & Oturum Bilgileri' }}</h3>
      <p class="panel-desc">
        {{ $t('users.panelDesc') || 'Sistemde kayıtlı olan tüm kullanıcıların durumunu ve son aktiflik zamanlarını izleyin.' }}
      </p>
    </div>

    <!-- Yükleniyor -->
    <div v-if="isLoading" class="loading-state">
      <span class="spinner-sm"></span>
      <p>{{ $t('common.loading') }}</p>
    </div>

    <!-- Kullanıcı Tablosu -->
    <div v-else class="users-table-wrap">
      <table class="users-table">
        <thead>
          <tr>
            <th>{{ $t('users.thUser') || 'Kullanıcı' }}</th>
            <th>{{ $t('users.thRole') || 'Rol' }}</th>
            <th>{{ $t('users.thStatus') || 'Durum' }}</th>
            <th>{{ $t('users.thOnlineStatus') || 'Çevrimiçi Durumu' }}</th>
            <th>{{ $t('users.thLastSeen') || 'Son Çevrimiçi' }}</th>
            <th v-if="userRole === 'admin' || userRole === 'ciso'" style="text-align: center;">{{ $t('users.thAction') || 'İşlem' }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in sortedUsers" :key="user.id" class="user-row">
            <td class="user-cell">
              <div class="user-avatar">{{ user.fullName ? user.fullName[0].toUpperCase() : 'U' }}</div>
              <div class="user-names">
                <span class="user-fullname">{{ user.fullName }}</span>
                <span class="user-username">@{{ user.username }} &bull; {{ user.email }}</span>
              </div>
            </td>
            <td>
              <span class="role-badge" :class="'role--' + user.role">
                {{ getRoleLabel(user.role) }}
              </span>
            </td>
            <td>
              <span class="status-badge" :class="'status--' + user.status">
                {{ user.status === 'active' ? ($t('users.statusActive') || 'Aktif') : ($t('users.statusPending') || 'Onay Bekliyor') }}
              </span>
            </td>
            <td>
              <span v-if="isOnline(user.lastActive)" class="online-tag">
                <span class="online-dot"></span>
                {{ $t('users.online') || 'Çevrimiçi' }}
              </span>
              <span v-else class="offline-tag">
                {{ $t('users.offline') || 'Çevrimdışı' }}
              </span>
            </td>
            <td class="last-seen-cell">
              {{ formatLastSeen(user.lastActive || user.lastLogin) }}
            </td>
            <td v-if="userRole === 'admin' || userRole === 'ciso'" style="text-align: center;">
              <div style="display: flex; gap: 0.5rem; justify-content: center; align-items: center;">
                <button 
                  v-if="userRole === 'ciso'"
                  class="btn-detail" 
                  @click="openUserDetail(user)"
                  :title="$t('users.btnDetail')"
                  style="padding: 0.25rem 0.6rem; font-size: 0.68rem;"
                >
                  🔎 {{ $t('users.btnDetail') || 'Detay Gör' }}
                </button>
                <button 
                  v-if="userRole === 'admin' && user.role !== 'ciso' && user.id !== currentUserId"
                  class="btn-delete-user" 
                  @click="deleteUser(user)"
                  :title="$t('common.delete')"
                  style="padding: 0.25rem 0.6rem; font-size: 0.68rem; background: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); color: #fff; border-radius: 6px; cursor: pointer; font-weight: 700; transition: all 0.2s;"
                  onmouseover="this.style.background='#dc2626'"
                  onmouseout="this.style.background='#ef4444'"
                >
                  🗑 {{ $t('common.delete') || 'Sil' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- CISO Detay Modalı (Sadece CISO Görebilir) -->
    <div v-if="userDetailModalOpen && userRole === 'ciso'" class="detail-modal-overlay" @click.self="userDetailModalOpen = false">
      <div class="detail-modal-card">
        <div class="modal-header">
          <div>
            <h4>{{ selectedUser?.fullName }} {{ $t('users.userDetailTitle') || 'Kullanıcı Detayı' }}</h4>
            <p>@{{ selectedUser?.username }} &bull; {{ selectedUser?.email }}</p>
          </div>
          <button @click="userDetailModalOpen = false" class="btn-close">✕</button>
        </div>

        <div class="modal-body">
          <!-- Temel Bilgiler -->
          <div class="detail-info-grid">
            <div class="info-item">
              <span class="info-label">{{ $t('users.thRole') || 'Rol' }}</span>
              <span class="info-val role-text">{{ getRoleLabel(selectedUser?.role) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ $t('users.accountStatus') || 'Hesap Durumu' }}</span>
              <span class="info-val" :class="'status--' + selectedUser?.status">
                {{ selectedUser?.status === 'active' ? ($t('users.statusActive') || 'Aktif') : ($t('users.statusPending') || 'Onay Bekliyor') }}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ $t('users.createdAt') || 'Kayıt Tarihi' }}</span>
              <span class="info-val">{{ formatDate(selectedUser?.createdAt) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ $t('users.thLastSeen') || 'Son Çevrimiçi' }}</span>
              <span class="info-val">{{ formatLastSeen(selectedUser?.lastActive) }}</span>
            </div>
          </div>

          <!-- Audit Logları -->
          <div class="detail-logs-section">
            <h5>📋 {{ $t('users.actionHistory') || 'SON 50 İŞLEM GEÇMİŞİ' }}</h5>
            <div v-if="isLoadingLogs" class="logs-loading">
              <span class="spinner-xs"></span> {{ $t('common.loading') }}
            </div>
            <div v-else-if="userLogs.length === 0" class="logs-empty">
              Bu kullanıcıya ait işlem geçmişi bulunmamaktadır.
            </div>
            <div v-else class="logs-list">
              <div v-for="log in userLogs" :key="log.id" class="log-card">
                <span class="log-icon">{{ getActionIcon(log.action) }}</span>
                <div class="log-content">
                  <span class="log-action">{{ getActionLabel(log.action) }}</span>
                  <span class="log-desc">{{ log.details || 'Açıklama yok' }}</span>
                </div>
                <span class="log-time">{{ formatDate(log.createdAt || log.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'

const toast = useToast()
const currentUserId = computed(() => {
  const token = localStorage.getItem('token')
  if (!token) return ''
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(window.atob(base64))
    return payload.id || ''
  } catch {
    return ''
  }
})

async function deleteUser(user) {
  const confirmMsg = `"${user.fullName} (${user.username})" isimli kullanıcıyı sistemden silmek istediğinize emin misiniz?\n\nBu işlem sistemdeki TÜM adminlerin ortak onayına gönderilecektir.`
  if (!confirm(confirmMsg)) return;

  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/auth/users/${user.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    const data = await response.json()
    if (response.status === 202) {
      toast.info(data.message || 'Silme onay talebi oluşturuldu.')
    } else if (response.ok) {
      toast.success('Kullanıcı başarıyla silindi.')
      fetchUsers()
    } else {
      toast.error(data.error || 'Silme işlemi başlatılamadı.')
    }
  } catch (error) {
    console.error('[UsersPanel] Silme hatası:', error)
    toast.error('Bağlantı hatası.')
  }
}
const usersList = ref([])
const isLoading = ref(true)

const selectedUser = ref(null)
const userLogs = ref([])
const isLoadingLogs = ref(false)
const userDetailModalOpen = ref(false)

const props = defineProps({
  userRole: {
    type: String,
    required: true
  }
})

// Kullanıcıları çevrimiçi olanlar en üstte olacak şekilde sırala
const sortedUsers = computed(() => {
  return [...usersList.value].sort((a, b) => {
    const aOnline = isOnline(a.lastActive) ? 1 : 0
    const bOnline = isOnline(b.lastActive) ? 1 : 0
    if (aOnline !== bOnline) return bOnline - aOnline
    
    // İkinci kriter: son aktiflik tarihi
    const aTime = new Date(a.lastActive || a.lastLogin || 0).getTime()
    const bTime = new Date(b.lastActive || b.lastLogin || 0).getTime()
    return bTime - aTime
  })
})

async function fetchUsers() {
  isLoading.value = true
  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/auth/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      const data = await response.json()
      usersList.value = data.users || []
    } else {
      toast.error('Kullanıcı listesi alınamadı.')
    }
  } catch (error) {
    console.error('[UsersPanel] Yükleme hatası:', error)
  } finally {
    isLoading.value = false
  }
}

async function openUserDetail(user) {
  selectedUser.value = user
  userDetailModalOpen.value = true
  isLoadingLogs.value = true
  userLogs.value = []
  
  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/auth/users/${user.id}/detail`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      const data = await response.json()
      userLogs.value = data.logs || []
    } else {
      toast.error('Kullanıcı log detayları alınamadı.')
    }
  } catch (error) {
    console.error('[UsersPanel] Log getirme hatası:', error)
  } finally {
    isLoadingLogs.value = false
  }
}

function isOnline(lastActiveStr) {
  if (!lastActiveStr) return false
  const lastActive = new Date(lastActiveStr).getTime()
  const diffMinutes = (Date.now() - lastActive) / 1000 / 60
  return diffMinutes <= 2 // Son 2 dakika içinde istek atmışsa online sayılır
}

function getRoleLabel(role) {
  if (role === 'ciso') return '🛡️ CISO'
  if (role === 'admin') return '🔑 Yönetici'
  return '👤 Standart'
}

function formatLastSeen(dateStr) {
  if (!dateStr) return 'Çevrimdışı (Giriş Yapılmadı)'
  const d = new Date(dateStr)
  if (isOnline(dateStr)) return 'Şimdi Aktif'
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getActionIcon(action) {
  const icons = {
    UPLOAD: '📤', UPDATE: '📝', DELETE: '🗑️', FORCE_DELETE: '❌',
    RESTORE: '♻️', BULK_DELETE: '📦', LOGIN: '🔑', LOGOUT: '🔒',
    PASSWORD_UPDATE: '🔐', EMAIL_UPDATE: '📧', USERNAME_UPDATE: '👤',
    NAME_CHANGE: '📛', SMTP_VERIFICATION: '⚙️'
  }
  return icons[action] || '⚡'
}

function getActionLabel(action) {
  const labels = {
    UPLOAD: 'Yükleme', UPDATE: 'Güncelleme', DELETE: 'Silme (Çöp)',
    FORCE_DELETE: 'Kalıcı Silme', RESTORE: 'Geri Yükleme',
    BULK_DELETE: 'Toplu Silme', LOGIN: 'Giriş Yapma', LOGOUT: 'Çıkış Yapma',
    PASSWORD_UPDATE: 'Şifre Değişimi', EMAIL_UPDATE: 'E-posta Değişimi',
    USERNAME_UPDATE: 'Kullanıcı Adı Değişimi', NAME_CHANGE: 'İsim Değişimi',
    SMTP_VERIFICATION: 'SMTP Doğrulama'
  }
  return labels[action] || action
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.users-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem;
}

.users-header {
  margin-bottom: 0.5rem;
}

.users-header h3 {
  font-size: 1.15rem;
  font-weight: 800;
  color: #fff;
}

.panel-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  text-align: center;
  background: rgba(30, 41, 59, 0.3);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
}

.users-table-wrap {
  overflow-x: auto;
  background: rgba(30, 41, 59, 0.25);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.users-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.82rem;
}

.users-table th {
  padding: 0.75rem 1rem;
  background: rgba(15, 23, 42, 0.6);
  color: var(--text-secondary);
  font-weight: 700;
  border-bottom: 1px solid var(--border);
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.5px;
}

.users-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  vertical-align: middle;
}

.user-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(139, 92, 246, 0.15);
  border: 1.5px solid rgba(139, 92, 246, 0.3);
  color: #a78bfa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
}

.user-names {
  display: flex;
  flex-direction: column;
}

.user-fullname {
  color: #fff;
  font-weight: 600;
}

.user-username {
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-top: 0.1rem;
}

.role-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
}

.role--ciso { background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25); }
.role--admin { background: rgba(245, 158, 11, 0.12); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.25); }
.role--user { background: rgba(59, 130, 246, 0.12); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.25); }

.status-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.status--active { background: rgba(34, 197, 94, 0.1); color: #4ade80; }
.status--pending_approval { background: rgba(245, 158, 11, 0.1); color: #fbbf24; }

.online-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #4ade80;
  font-weight: 700;
  font-size: 0.75rem;
}

.online-dot {
  width: 6px;
  height: 6px;
  background-color: #22c55e;
  border-radius: 50%;
  box-shadow: 0 0 8px #22c55e;
}

.offline-tag {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.last-seen-cell {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.btn-detail {
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: #a78bfa;
  padding: 0.3rem 0.75rem;
  font-size: 0.72rem;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-detail:hover {
  background: #6366f1;
  color: #fff;
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.4);
}

/* Modal Stilleri */
.detail-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(3, 7, 18, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 15000;
}

.detail-modal-card {
  background: #111827;
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 14px;
  width: 100%;
  max-width: 680px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px rgba(0,0,0,0.7);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-header h4 {
  margin: 0;
  color: #a78bfa;
  font-size: 1rem;
}

.modal-header p {
  margin: 0.2rem 0 0;
  font-size: 0.75rem;
  color: #6b7280;
}

.btn-close {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #9ca3af;
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
}

.modal-body {
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.detail-info-grid {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 1rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.info-item {
  display: flex;
  flex-direction: column;
}

.info-label {
  font-size: 0.68rem;
  color: #6b7280;
  text-transform: uppercase;
}

.info-val {
  margin-top: 0.15rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: #fff;
}

.role-text {
  color: #a78bfa;
}

.detail-logs-section h5 {
  margin: 0 0 0.6rem;
  font-size: 0.78rem;
  color: #9ca3af;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.logs-loading, .logs-empty {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
  font-size: 0.8rem;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 280px;
  overflow-y: auto;
}

.log-card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  padding: 0.6rem 0.85rem;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.75rem;
  align-items: center;
}

.log-icon {
  font-size: 1rem;
}

.log-content {
  display: flex;
  flex-direction: column;
}

.log-action {
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
}

.log-desc {
  font-size: 0.68rem;
  color: var(--text-secondary);
  margin-top: 0.1rem;
}

.log-time {
  font-size: 0.64rem;
  color: #6b7280;
  white-space: nowrap;
}
</style>
