<template>
  <div class="settings-section-page">
    <div class="section-header">
      <h2>👤 Profil & Görünüm Ayarları</h2>
      <p class="section-desc">Kişisel hesap bilgilerinizi, sistem temasını ve vurgu rengi tercihlerinizi yönetin.</p>
    </div>

    <!-- Profil Bilgi Kartı -->
    <div class="profile-card">
      <div class="profile-avatar">{{ userFullName ? userFullName[0].toUpperCase() : 'U' }}</div>
      <div class="profile-details">
        <div class="profile-name-row">
          <h3>{{ userFullName || 'Kullanıcı' }}</h3>
          <span :class="['role-badge', 'role--' + currentUserRole]">{{ getRoleLabel(currentUserRole) }}</span>
        </div>
        <p class="profile-meta">@{{ currentUsername }} &bull; {{ currentUserEmail || 'E-posta tanımlanmamış' }}</p>
      </div>
    </div>

    <!-- Görünüm & Tema Seçimi -->
    <div class="setting-block">
      <h4>🎨 Görünüm & Vurgu Rengi</h4>
      <p class="block-desc">Arayüz temasını ve panel vurgu rengini kişiselleştirin.</p>
      
      <div class="theme-accent-grid">
        <div class="form-group">
          <label>Tema Modu</label>
          <div class="theme-buttons">
            <button 
              type="button" 
              class="btn-theme-choice" 
              :class="{ active: currentTheme === 'dark' }"
              @click="setAppTheme('dark')"
            >
              🌙 Koyu Tema
            </button>
            <button 
              type="button" 
              class="btn-theme-choice" 
              :class="{ active: currentTheme === 'light' }"
              @click="setAppTheme('light')"
            >
              ☀️ Açık Tema
            </button>
          </div>
        </div>

        <div class="form-group">
          <label>Vurgu Rengi Paleti</label>
          <div class="palette-options">
            <button 
              v-for="p in paletteList" 
              :key="p.id"
              type="button"
              class="palette-btn"
              :class="{ active: currentAccent === p.id }"
              :style="{ background: p.color }"
              :title="p.name"
              @click="setAppAccent(p.id)"
            ></button>
          </div>
        </div>
      </div>
    </div>

    <!-- Form A: Ad Soyad Güncelleme -->
    <div class="setting-block">
      <h4>📝 Ad Soyad Değişikliği</h4>
      <p class="block-desc">Ad ve soyad güncellemeleri CISO onayına gönderilir.</p>
      <form @submit.prevent="saveFullName" class="settings-form">
        <div class="form-row">
          <div class="form-group flex-1">
            <label>Yeni Ad Soyad</label>
            <input v-model="formFullName" type="text" placeholder="Ad Soyad" required />
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-save" :disabled="isSavingName || formFullName === userFullName">
            {{ isSavingName ? 'Kaydediliyor...' : '💾 Değişiklikleri Kaydet' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Form B: Kullanıcı Adı Güncelleme -->
    <div class="setting-block">
      <h4>🛡️ Kullanıcı Adı Değişikliği</h4>
      <p class="block-desc">Giriş yaparken kullandığınız sistem kullanıcı adı.</p>
      <form @submit.prevent="saveUsername" class="settings-form">
        <div class="form-row">
          <div class="form-group flex-1">
            <label>Yeni Kullanıcı Adı</label>
            <input v-model="formUsername" type="text" placeholder="yeni_kullanici_adi" required />
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-save" :disabled="isSavingUsername || formUsername === currentUsername">
            {{ isSavingUsername ? 'Kaydediliyor...' : '💾 Değişiklikleri Kaydet' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Form C: Şifre Değişikliği -->
    <div class="setting-block">
      <h4>🔐 Parola Güncelleme</h4>
      <p class="block-desc">Hesap güvenliğiniz için güçlü bir parola belirleyin.</p>
      <form @submit.prevent="savePassword" class="settings-form">
        <div class="form-grid-3">
          <div class="form-group">
            <label>Mevcut Parola</label>
            <input v-model="oldPassword" type="password" placeholder="••••••••" required />
          </div>
          <div class="form-group">
            <label>Yeni Parola</label>
            <input v-model="newPassword" type="password" placeholder="••••••••" required />
          </div>
          <div class="form-group">
            <label>Yeni Parola Tekrarı</label>
            <input v-model="newPasswordConfirm" type="password" placeholder="••••••••" required />
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-save" :disabled="isSavingPassword || !newPassword">
            {{ isSavingPassword ? 'Kaydediliyor...' : '💾 Parolayı Güncelle' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Form D: E-posta Güncelleme (OTP ile) -->
    <div class="setting-block">
      <h4>📧 E-posta Adresi Güncelleme</h4>
      <p class="block-desc">Alarm bildirimleri ve şifre sıfırlama için kullanılan e-posta adresiniz.</p>
      
      <div v-if="!emailOtpSent" class="settings-form">
        <div class="form-row">
          <div class="form-group flex-1">
            <label>Yeni E-posta Adresi</label>
            <input v-model="formEmail" type="email" placeholder="yeni_posta@dms.com" required />
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-save" :disabled="isSendingOtp || !formEmail" @click="sendEmailOtp">
            {{ isSendingOtp ? 'Kod Gönderiliyor...' : '📩 Doğrulama Kodu Gönder' }}
          </button>
        </div>
      </div>

      <div v-else class="settings-form otp-box">
        <p class="otp-hint">ℹ️ <strong>{{ formEmail }}</strong> adresine 6 haneli bir onay kodu gönderildi.</p>
        <div class="form-row">
          <div class="form-group flex-1">
            <label>6 Haneli Güvenlik Kodu</label>
            <input v-model="emailOtpCode" type="text" maxlength="6" placeholder="123456" class="otp-input" />
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-cancel" @click="emailOtpSent = false">İptal</button>
          <button type="button" class="btn-save" :disabled="isVerifyingOtp || !emailOtpCode" @click="verifyEmailOtp">
            {{ isVerifyingOtp ? 'Doğrulanıyor...' : '✅ Kodu Doğrula ve Kaydet' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { getTheme, setTheme, ACCENT_PALETTES, getAccent, setAccent } from '../../utils/ThemeProvider'

const toast = useToast()

const paletteList = computed(() => {
  return Object.entries(ACCENT_PALETTES).map(([id, val]) => ({
    id,
    name: val.label || id,
    color: val.primary
  }))
})

function parseJwt() {
  try {
    const token = localStorage.getItem('token')
    if (!token) return {}
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(window.atob(base64))
  } catch { return {} }
}

const payload = computed(() => parseJwt())
const currentUserRole = computed(() => payload.value.role || 'user')
const currentUsername = computed(() => payload.value.username || '')
const currentUserEmail = computed(() => payload.value.email || '')
const userFullName = ref(payload.value.fullName || payload.value.username || '')

const currentTheme = ref(getTheme() || 'dark')
const currentAccent = ref(getAccent() || 'violet')

function setAppTheme(mode) {
  setTheme(mode)
  currentTheme.value = mode
  toast.success(`Tema ${mode === 'dark' ? 'Koyu' : 'Açık'} olarak ayarlandı.`)
}

function setAppAccent(id) {
  setAccent(id)
  currentAccent.value = id
  toast.success('Vurgu rengi güncellendi.')
}

const formFullName = ref(userFullName.value)
const isSavingName = ref(false)

async function saveFullName() {
  isSavingName.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ fullName: formFullName.value })
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(data.message || 'Ad soyad güncelleme talebi alındı. Ayarlar başarıyla güncellendi.')
      userFullName.value = formFullName.value
    } else {
      toast.error(data.error || 'Güncelleme başarısız.')
    }
  } catch {
    toast.error('Bağlantı hatası.')
  } finally {
    isSavingName.value = false
  }
}

const formUsername = ref(currentUsername.value)
const isSavingUsername = ref(false)

async function saveUsername() {
  isSavingUsername.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ username: formUsername.value })
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('Kullanıcı adı güncellendi. Ayarlar başarıyla kaydedildi.')
    } else {
      toast.error(data.error || 'Kullanıcı adı güncellenemedi.')
    }
  } catch {
    toast.error('Bağlantı hatası.')
  } finally {
    isSavingUsername.value = false
  }
}

const oldPassword = ref('')
const newPassword = ref('')
const newPasswordConfirm = ref('')
const isSavingPassword = ref(false)

async function savePassword() {
  if (newPassword.value !== newPasswordConfirm.value) {
    toast.warning('Yeni parolalar birbiriyle eşleşmiyor!')
    return
  }
  isSavingPassword.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ oldPassword: oldPassword.value, password: newPassword.value })
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('Parolanız başarıyla güncellendi.')
      oldPassword.value = ''
      newPassword.value = ''
      newPasswordConfirm.value = ''
    } else {
      toast.error(data.error || 'Parola güncellenemedi.')
    }
  } catch {
    toast.error('Bağlantı hatası.')
  } finally {
    isSavingPassword.value = false
  }
}

const formEmail = ref(currentUserEmail.value)
const emailOtpSent = ref(false)
const emailOtpCode = ref('')
const isSendingOtp = ref(false)
const isVerifyingOtp = ref(false)

async function sendEmailOtp() {
  isSendingOtp.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ email: formEmail.value })
    })
    const data = await res.json()
    if (res.ok) {
      emailOtpSent.value = true
      toast.info('Doğrulama kodu e-posta adresinize gönderildi.')
    } else {
      toast.error(data.error || 'Kod gönderilemedi.')
    }
  } catch {
    toast.error('Bağlantı hatası.')
  } finally {
    isSendingOtp.value = false
  }
}

async function verifyEmailOtp() {
  isVerifyingOtp.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ email: formEmail.value, emailOtp: emailOtpCode.value })
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('E-posta adresiniz başarıyla güncellendi. Ayarlar kaydedildi.')
      emailOtpSent.value = false
      emailOtpCode.value = ''
    } else {
      toast.error(data.error || 'Kod doğrulanamadı.')
    }
  } catch {
    toast.error('Bağlantı hatası.')
  } finally {
    isVerifyingOtp.value = false
  }
}

function getRoleLabel(r) {
  const map = { admin: 'Yönetici (Admin)', user: 'Standart Kullanıcı', ciso: 'CISO' }
  return map[r] || r
}
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
.profile-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 10px;
  padding: 1.25rem;
}
.profile-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 800;
}
.profile-name-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.profile-name-row h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-primary, #f8fafc);
}
.profile-meta {
  margin: 0.25rem 0 0 0;
  font-size: 0.75rem;
  color: var(--text-secondary, #94a3b8);
}
.role-badge {
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
}
.role--admin { background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4); }
.role--user { background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.4); }
.role--ciso { background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4); }

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
.theme-accent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
}
.theme-buttons {
  display: flex;
  gap: 0.5rem;
}
.btn-theme-choice {
  flex: 1;
  padding: 0.55rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: 6px;
  color: var(--text-primary, #f8fafc);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-theme-choice.active {
  background: rgba(99, 102, 241, 0.25);
  border-color: #818cf8;
  color: #818cf8;
  font-weight: 700;
}
.palette-options {
  display: flex;
  gap: 0.5rem;
}
.palette-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.2s;
}
.palette-btn.active {
  transform: scale(1.2);
  border-color: #fff;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
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
.form-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
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
  gap: 0.5rem;
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
.btn-cancel {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  color: var(--text-secondary, #94a3b8);
  padding: 0.55rem 1rem;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
}
.otp-box {
  background: rgba(99, 102, 241, 0.08);
  border: 1px dashed rgba(99, 102, 241, 0.3);
  padding: 1rem;
  border-radius: 8px;
}
.otp-hint {
  margin: 0 0 0.75rem 0;
  font-size: 0.78rem;
  color: var(--color-accent-text, #a78bfa);
}
.otp-input {
  text-align: center;
  letter-spacing: 4px;
  font-weight: 800;
  font-size: 1rem !important;
}
@media (max-width: 768px) {
  .form-grid-3 {
    grid-template-columns: 1fr;
  }
}
</style>
