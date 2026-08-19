<template>
  <div class="settings-section-page">
    <div class="section-header">
      <h2>🖥️ Sistem & İzin Ayarları</h2>
      <p class="section-desc">Sistem dağıtım mimarisini, kullanıcı izinlerini (RBAC) ve mesai saatlerini yapılandırın.</p>
    </div>

    <!-- 1. Sistem Dağıtım Modu -->
    <div class="setting-block">
      <h4>⚙️ Dağıtım ve Çalışma Modu</h4>
      <p class="block-desc">DMS'in tek bir bilgisayarda mı yoksa yerel ağ üzerinde mi çalışacağını belirleyin.</p>
      
      <div class="mode-options">
        <label class="mode-radio-card" :class="{ active: selectedMode === 'single_pc' }">
          <input type="radio" value="single_pc" v-model="selectedMode" />
          <div class="radio-content">
            <span class="radio-title">💻 Tek Bilgisayar (Standalone / Air-Gapped)</span>
            <span class="radio-sub">Veriler sadece bu cihazda saklanır ve yerel olarak işlenir.</span>
          </div>
        </label>

        <label class="mode-radio-card" :class="{ active: selectedMode === 'network_sync' }">
          <input type="radio" value="network_sync" v-model="selectedMode" />
          <div class="radio-content">
            <span class="radio-title">🌐 Yerel Ağ İstemci/Sunucu (Intranet Sync)</span>
            <span class="radio-sub">Ağdaki diğer istemciler sisteme bağlanabilir ve mesajlaşabilir.</span>
          </div>
        </label>
      </div>

      <div class="form-actions" style="margin-top: 1rem;">
        <button type="button" class="btn-save" :disabled="isSavingMode" @click="saveSystemMode">
          {{ isSavingMode ? 'Kaydediliyor...' : '💾 Değişiklikleri Kaydet' }}
        </button>
      </div>
    </div>

    <!-- 2. Kullanıcı Rolleri & İzin Yönetimi (RBAC) -->
    <div class="setting-block">
      <h4>👥 Kullanıcı Yönetimi & Dinamik İzinler</h4>
      <p class="block-desc">Kullanıcıların okuma (`canRead`) ve yazma/yükleme (`canWrite`) yetkilerini belirleyin.</p>

      <div v-if="isLoadingUsers" class="loading-state">
        <span class="spinner-sm"></span>
        <p>Kullanıcılar yükleniyor...</p>
      </div>

      <div v-else class="users-list-wrapper">
        <div v-for="user in usersList" :key="user.id" class="user-row-card">
          <div class="user-info-brief">
            <strong>{{ user.fullName || user.username }}</strong>
            <span class="user-meta-sub">@{{ user.username }} &bull; {{ user.email }}</span>
          </div>

          <div class="user-permissions-grid">
            <label class="perm-checkbox">
              <input 
                type="checkbox" 
                v-model="user.permissions.canRead" 
                :disabled="user.role === 'admin' || user.role === 'ciso'" 
              />
              <span>Okuma (Read)</span>
            </label>
            <label class="perm-checkbox">
              <input 
                type="checkbox" 
                v-model="user.permissions.canWrite" 
                :disabled="user.role === 'admin' || user.role === 'ciso'" 
              />
              <span>Yazma (Write)</span>
            </label>
          </div>

          <div class="user-role-actions">
            <select 
              v-model="user.role" 
              class="user-role-select" 
              :disabled="user.role === 'ciso' || (user.id === currentUserId && user.role === 'admin')"
            >
              <option value="user">Standart</option>
              <option value="admin">Yönetici</option>
              <option v-if="user.role === 'ciso'" value="ciso">CISO</option>
            </select>
          </div>
        </div>

        <div class="form-actions" style="margin-top: 1.25rem;">
          <button type="button" class="btn-save" :disabled="isSavingUsers" @click="saveUserPermissions">
            {{ isSavingUsers ? 'Kaydediliyor...' : '💾 İzin Değişikliklerini Kaydet' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 3. Mesai Saatleri (Sadece Admin) -->
    <div v-if="currentUserRole === 'admin'" class="setting-block">
      <h4>🕒 CISO Onay Talebi Mesai Saatleri</h4>
      <p class="block-desc">CISO onay bekleyen taleplerin 3 iş günü geri sayım takibinde kullanılan günlük mesai saatlerini belirleyin.</p>
      
      <form @submit.prevent="saveWorkingHours" class="settings-form">
        <div class="form-row">
          <div class="form-group flex-1">
            <label>Mesai Başlangıcı</label>
            <input v-model="workingHoursStart" type="time" required />
          </div>
          <div class="form-group flex-1">
            <label>Mesai Bitişi</label>
            <input v-model="workingHoursEnd" type="time" required />
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-save" :disabled="isSavingHours">
            {{ isSavingHours ? 'Kaydediliyor...' : '💾 Değişiklikleri Kaydet' }}
          </button>
        </div>
      </form>
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
const currentUserRole = computed(() => parseJwt().role || 'user')

const selectedMode = ref('single_pc')
const isSavingMode = ref(false)

async function fetchSettings() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      if (data.settings?.deploymentMode) {
        selectedMode.value = data.settings.deploymentMode
      }
      if (data.settings?.workingHours) {
        workingHoursStart.value = data.settings.workingHours.start || '09:00'
        workingHoursEnd.value = data.settings.workingHours.end || '18:00'
      }
    }
  } catch {}
}

async function saveSystemMode() {
  isSavingMode.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ deploymentMode: selectedMode.value })
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(data.message || 'Sistem dağıtım modu güncellendi. Ayarlar başarıyla kaydedildi. ✅')
    } else {
      toast.error(data.error || 'Mod güncellenemedi.')
    }
  } catch {
    toast.error('Bağlantı hatası.')
  } finally {
    isSavingMode.value = false
  }
}

const usersList = ref([])
const isLoadingUsers = ref(true)
const isSavingUsers = ref(false)

async function fetchUsers() {
  isLoadingUsers.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      usersList.value = (data.users || []).map(u => ({
        ...u,
        permissions: u.permissions || { canRead: true, canWrite: u.role === 'admin' }
      }))
    }
  } catch {
    toast.error('Kullanıcı listesi alınamadı.')
  } finally {
    isLoadingUsers.value = false
  }
}

async function saveUserPermissions() {
  isSavingUsers.value = true
  try {
    const token = localStorage.getItem('token')
    let successCount = 0
    for (const user of usersList.value) {
      // İzin güncellemesi
      await fetch(`/api/auth/users/${user.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          canRead: user.permissions.canRead,
          canWrite: user.permissions.canWrite
        })
      })
      // Rol güncellemesi
      await fetch(`/api/auth/users/${user.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ role: user.role })
      })
      successCount++
    }
    toast.success(`Kullanıcı izinleri ve rolleri güncellendi (${successCount} kullanıcı). Ayarlar kaydedildi. ✅`)
    await fetchUsers()
  } catch {
    toast.error('İzinler kaydedilirken hata oluştu.')
  } finally {
    isSavingUsers.value = false
  }
}

const workingHoursStart = ref('09:00')
const workingHoursEnd = ref('18:00')
const isSavingHours = ref(false)

async function saveWorkingHours() {
  isSavingHours.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        workingHours: { start: workingHoursStart.value, end: workingHoursEnd.value }
      })
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('Mesai saatleri güncellendi. Ayarlar başarıyla kaydedildi. ✅')
    } else {
      toast.error(data.error || 'Mesai saatleri kaydedilemedi.')
    }
  } catch {
    toast.error('Bağlantı hatası.')
  } finally {
    isSavingHours.value = false
  }
}

onMounted(() => {
  fetchSettings()
  fetchUsers()
})
</script>

<style scoped>
.settings-section-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.section-header {
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  padding-bottom: 1rem;
}
.section-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary, #f8fafc);
}
.section-desc {
  margin: 0.35rem 0 0 0;
  font-size: 0.8rem;
  color: var(--text-secondary, #94a3b8);
}
.setting-block {
  background: rgba(15, 23, 42, 0.35);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  border-radius: 10px;
  padding: 1.25rem;
}
.setting-block h4 {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text-primary, #f8fafc);
}
.block-desc {
  margin: 0.25rem 0 1rem 0;
  font-size: 0.75rem;
  color: var(--text-secondary, #94a3b8);
}
.mode-options {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.mode-radio-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.mode-radio-card:hover {
  background: rgba(15, 23, 42, 0.9);
  border-color: rgba(99, 102, 241, 0.3);
}
.mode-radio-card.active {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.4);
}
.radio-content {
  display: flex;
  flex-direction: column;
}
.radio-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary, #f8fafc);
}
.radio-sub {
  font-size: 0.72rem;
  color: var(--text-secondary, #94a3b8);
  margin-top: 0.15rem;
}
.users-list-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.user-row-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.04));
  border-radius: 8px;
}
.user-info-brief {
  display: flex;
  flex-direction: column;
  min-width: 180px;
}
.user-info-brief strong {
  font-size: 0.85rem;
  color: var(--text-primary, #f8fafc);
}
.user-meta-sub {
  font-size: 0.7rem;
  color: var(--text-secondary, #94a3b8);
}
.user-permissions-grid {
  display: flex;
  gap: 1rem;
}
.perm-checkbox {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: var(--text-primary, #f8fafc);
  cursor: pointer;
}
.user-role-select {
  padding: 0.35rem 0.6rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  border-radius: 6px;
  color: var(--text-primary, #f8fafc);
  font-size: 0.75rem;
}
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.form-row {
  display: flex;
  gap: 1rem;
}
.flex-1 { flex: 1; }
.form-group label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary, #94a3b8);
  margin-bottom: 0.35rem;
}
.form-group input {
  width: 100%;
  padding: 0.55rem 0.75rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  border-radius: 6px;
  color: var(--text-primary, #f8fafc);
  font-size: 0.82rem;
  box-sizing: border-box;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
}
.btn-save {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  border: none;
  padding: 0.55rem 1.2rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-save:hover:not(:disabled) {
  opacity: 0.9;
}
.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
@media (max-width: 768px) {
  .user-row-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
