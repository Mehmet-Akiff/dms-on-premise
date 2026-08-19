<template>
  <div class="settings-section-page">
    <div class="section-header">
      <h2>🛡️ Güvenlik & Kasa Ayarları</h2>
      <p class="section-desc">Oturum hatırlama modlarını ve sistem kasası yönetici şifrelerini yapılandırın.</p>
    </div>

    <!-- 1. Oturum Tercihleri (Remember Device) -->
    <div class="setting-block">
      <h4>🔒 Güvenlik & Oturum Tercihleri</h4>
      <p class="block-desc">Tarayıcı kapatıldığında veya sayfa yenilendiğinde oturumunuzun nasıl saklanacağını belirleyin.</p>
      
      <div class="remember-options">
        <label class="remember-radio-card" :class="{ active: selectedRemember === 'always' }">
          <input type="radio" value="always" v-model="selectedRemember" />
          <div class="radio-content">
            <span class="radio-title">🔐 Bu Cihazı Güvenli Olarak Hatırla</span>
            <span class="radio-sub">Tarayıcı kapatılsa bile oturumunuz açık kalır.</span>
          </div>
        </label>

        <label class="remember-radio-card" :class="{ active: selectedRemember === 'session' }">
          <input type="radio" value="session" v-model="selectedRemember" />
          <div class="radio-content">
            <span class="radio-title">⏱️ Sadece Sekme Açıkken Koru</span>
            <span class="radio-sub">Sekme veya tarayıcı kapatıldığında kasa otomatik kilitlenir.</span>
          </div>
        </label>

        <label class="remember-radio-card" :class="{ active: selectedRemember === 'never' }">
          <input type="radio" value="never" v-model="selectedRemember" />
          <div class="radio-content">
            <span class="radio-title">🛡️ Sıfır İz Modu (Her Seferinde Sor)</span>
            <span class="radio-sub">Sayfa her yenilendiğinde şifre tekrar istenir.</span>
          </div>
        </label>
      </div>

      <div class="form-actions" style="margin-top: 1rem;">
        <button type="button" class="btn-save" @click="saveRememberMode">
          💾 Değişiklikleri Kaydet
        </button>
      </div>
    </div>

    <!-- 2. Kasa Yönetici Şifresi (Sadece Admin) -->
    <div v-if="currentUserRole === 'admin'" class="setting-block">
      <h4>🔑 Kasa Yönetici Parolası</h4>
      <p class="block-desc">Sistem kilit ekranı için kullanılan ana yönetici kullanıcı adı ve şifresi.</p>
      
      <form @submit.prevent="saveKasaCredentials" class="settings-form">
        <div class="form-row">
          <div class="form-group flex-1">
            <label>Kasa Kullanıcı Adı</label>
            <input v-model="kasaUsername" type="text" placeholder="admin" required />
          </div>
          <div class="form-group flex-1">
            <label>Yeni Kasa Parolası</label>
            <input v-model="kasaPassword" type="password" placeholder="••••••••" />
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-save" :disabled="isSavingKasa">
            {{ isSavingKasa ? 'Kaydediliyor...' : '💾 Değişiklikleri Kaydet' }}
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

const currentUserRole = computed(() => parseJwt().role || 'user')

const selectedRemember = ref(localStorage.getItem('rememberDevice') || 'always')

function saveRememberMode() {
  localStorage.setItem('rememberDevice', selectedRemember.value)
  toast.success('Oturum hatırlama modu güncellendi. Ayarlar başarıyla kaydedildi. ✅')
}

const kasaUsername = ref('admin')
const kasaPassword = ref('')
const isSavingKasa = ref(false)

async function fetchKasaSettings() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      if (data.settings?.masterUsername) {
        kasaUsername.value = data.settings.masterUsername
      }
    }
  } catch {}
}

async function saveKasaCredentials() {
  isSavingKasa.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        masterUsername: kasaUsername.value,
        masterPassword: kasaPassword.value || undefined
      })
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(data.message || 'Kasa parolası güncellendi. Ayarlar başarıyla kaydedildi. ✅')
      kasaPassword.value = ''
    } else {
      toast.error(data.error || 'Kasa ayarları kaydedilemedi.')
    }
  } catch {
    toast.error('Bağlantı hatası.')
  } finally {
    isSavingKasa.value = false
  }
}

onMounted(() => {
  if (currentUserRole.value === 'admin') {
    fetchKasaSettings()
  }
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
.remember-options {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.remember-radio-card {
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
.remember-radio-card:hover {
  background: rgba(15, 23, 42, 0.9);
  border-color: rgba(99, 102, 241, 0.3);
}
.remember-radio-card.active {
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
.form-group input:focus {
  outline: none;
  border-color: #818cf8;
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
@media (max-width: 600px) {
  .form-row {
    flex-direction: column;
  }
}
</style>
