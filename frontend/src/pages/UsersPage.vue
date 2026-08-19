<template>
  <div class="users-page">
    <div class="users-card">
      <div class="users-header">
        <div>
          <h2>👥 {{ $t('users.panelTitle') || 'Sistem Kullanıcıları & Oturum Bilgileri' }}</h2>
          <p class="panel-desc">
            {{ $t('users.panelDesc') || 'Sistemde kayıtlı olan tüm kullanıcıların durumunu, rollerini ve son aktiflik zamanlarını izleyin.' }}
          </p>
        </div>
        <button class="btn-refresh" @click="fetchUsers" :disabled="isLoading" title="Yenile">
          🔄 Yenile
        </button>
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
                    style="padding: 0.3rem 0.7rem; font-size: 0.72rem;"
                  >
                    🔎 {{ $t('users.btnDetail') || 'Detay Gör' }}
                  </button>
                  <button 
                    v-if="userRole === 'admin' && user.role !== 'ciso' && user.id !== currentUserId"
                    class="btn-delete-user" 
                    @click="deleteUser(user)"
                    :title="$t('common.delete')"
                    style="padding: 0.3rem 0.7rem; font-size: 0.72rem; background: var(--color-danger-bg, #ef4444); border: 1px solid rgba(239, 68, 68, 0.4); color: #fff; border-radius: 6px; cursor: pointer; font-weight: 700; transition: all 0.2s;"
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'

const toast = useToast()

function parseJwt() {
  try {
    const token = localStorage.getItem('token')
    if (!token) return {}
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(window.atob(base64))
  } catch { return {} }
}

const currentUserId = computed(() => parseJwt().id || '')
const userRole = computed(() => parseJwt().role || 'user')

const usersList = ref([])
const isLoading = ref(true)
const selectedUser = ref(null)
const userLogs = ref([])
const isLoadingLogs = ref(false)
const userDetailModalOpen = ref(false)

const sortedUsers = computed(() => {
  return [...usersList.value].sort((a, b) => {
    const aOnline = isOnline(a.lastActive) ? 1 : 0
    const bOnline = isOnline(b.lastActive) ? 1 : 0
    if (aOnline !== bOnline) return bOnline - aOnline
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
    console.error('[UsersPage] Yükleme hatası:', error)
  } finally {
    isLoading.value = false
  }
}

async function deleteUser(user) {
  const confirmMsg = `"${user.fullName} (${user.username})" isimli kullanıcıyı sistemden silmek istediğinize emin misiniz?`
  if (!confirm(confirmMsg)) return;

  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/auth/users/${user.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    const data = await response.json()
    if (response.status === 202) {
      toast.info(data.message || 'Silme onay talebi oluşturuldu. Diğer yöneticilerin onayı bekleniyor.')
    } else if (response.ok) {
      toast.success(data.message || 'Kullanıcı başarıyla silindi.')
      fetchUsers()
    } else {
      toast.error(data.error || 'Silme işlemi başlatılamadı.')
    }
  } catch (error) {
    console.error('[UsersPage] Silme hatası:', error)
    toast.error('Bağlantı hatası.')
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
    }
  } catch (err) {
    console.error('[UsersPage] Detay yükleme hatası:', err)
  } finally {
    isLoadingLogs.value = false
  }
}

function isOnline(lastActiveStr) {
  if (!lastActiveStr) return false
  const diff = Date.now() - new Date(lastActiveStr).getTime()
  return diff < 5 * 60 * 1000
}

function formatLastSeen(dateStr) {
  if (!dateStr) return 'Hiç giriş yapmadı'
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'Az önce'
  if (diff < 3600) return `${Math.floor(diff / 60)} dakika önce`
  if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getRoleLabel(role) {
  const labels = { admin: 'Yönetici (Admin)', user: 'Standart Kullanıcı', ciso: 'CISO' }
  return labels[role] || role
}

function getActionIcon(action) {
  const icons = {
    LOGIN: '🔑', LOGOUT: '🚪', UPLOAD: '📤', UPDATE: '✏️', DELETE: '🗑️',
    VIEW: '👁️', DOWNLOAD: '📥', PERMISSION_CHANGE: '🛡️', ROLE_CHANGE: '👑'
  }
  return icons[action] || '⚡'
}

function getActionLabel(action) {
  const labels = {
    LOGIN: 'Giriş Yaptı', LOGOUT: 'Çıkış Yaptı', UPLOAD: 'Belge Yükledi',
    UPDATE: 'Belge Güncelledi', DELETE: 'Belge Sildi', VIEW: 'Belge Görüntüledi',
    DOWNLOAD: 'Belge İndirdi', PERMISSION_CHANGE: 'İzin Değiştirildi', ROLE_CHANGE: 'Rol Değiştirildi'
  }
  return labels[action] || action
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.users-page {
  padding: 1.5rem;
  width: 100%;
  box-sizing: border-box;
}
.users-card {
  background: var(--bg-secondary, #1e293b);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  padding: 1.5rem;
}
.users-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
}
.users-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary, #f8fafc);
}
.panel-desc {
  margin: 0.35rem 0 0 0;
  font-size: 0.8rem;
  color: var(--text-secondary, #94a3b8);
}
.btn-refresh {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  color: var(--text-primary, #f8fafc);
  padding: 0.45rem 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
  transition: all 0.2s;
}
.btn-refresh:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}
.users-table-wrap {
  overflow-x: auto;
}
.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.users-table th {
  text-align: left;
  padding: 0.75rem 1rem;
  background: rgba(15, 23, 42, 0.5);
  color: var(--text-secondary, #94a3b8);
  font-weight: 600;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
}
.users-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  color: var(--text-primary, #f8fafc);
}
.user-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
}
.user-names {
  display: flex;
  flex-direction: column;
}
.user-fullname {
  font-weight: 600;
  color: var(--text-primary, #f8fafc);
}
.user-username {
  font-size: 0.72rem;
  color: var(--text-secondary, #94a3b8);
}
.role-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 700;
}
.role--admin {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
}
.role--user {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  border: 1px solid rgba(99, 102, 241, 0.3);
}
.role--ciso {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}
.status-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 700;
}
.status--active {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}
.status--pending_approval {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}
.online-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #10b981;
  font-weight: 600;
}
.online-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}
.offline-tag {
  color: #64748b;
}
.last-seen-cell {
  font-size: 0.75rem;
  color: var(--text-secondary, #94a3b8);
}
.btn-detail {
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: var(--color-accent-text, #a78bfa);
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}
.btn-detail:hover {
  background: rgba(99, 102, 241, 0.25);
}
.detail-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}
.detail-modal-card {
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  width: 90%;
  max-width: 650px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.modal-header h4 {
  margin: 0;
  font-size: 1.1rem;
  color: #fff;
}
.modal-header p {
  margin: 0.2rem 0 0 0;
  font-size: 0.78rem;
  color: #94a3b8;
}
.btn-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.2rem;
  cursor: pointer;
}
.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
}
.detail-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  background: rgba(15, 23, 42, 0.6);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.info-label {
  font-size: 0.72rem;
  color: #94a3b8;
}
.info-val {
  font-size: 0.85rem;
  font-weight: 600;
  color: #f8fafc;
}
.detail-logs-section {
  margin-top: 1.5rem;
}
.detail-logs-section h5 {
  margin: 0 0 0.75rem 0;
  font-size: 0.82rem;
  color: #a78bfa;
}
.logs-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 240px;
  overflow-y: auto;
}
.log-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.8rem;
  background: rgba(15, 23, 42, 0.4);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.03);
}
.log-icon {
  font-size: 1.1rem;
}
.log-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.log-action {
  font-size: 0.78rem;
  font-weight: 600;
  color: #f8fafc;
}
.log-desc {
  font-size: 0.7rem;
  color: #94a3b8;
}
.log-time {
  font-size: 0.68rem;
  color: #64748b;
  white-space: nowrap;
}
</style>
