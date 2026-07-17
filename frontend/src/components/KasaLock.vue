<template>
  <Transition name="slide-up">
    <div v-if="isLocked" class="kasa-lock-overlay">
      <div class="kasa-lock-card" :class="{ 'shake-anim': shouldShake }">
        <!-- Logo ve Başlık -->
        <div class="lock-header">
          <div class="lock-icon-wrapper">
            <svg class="lock-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2>DMS GÜVENLİK DUVARI</h2>
          <p class="lock-desc">Sisteme erişebilmek için giriş yapın veya kayıt olun.</p>
        </div>

        <!-- Sekme Seçimi -->
        <div class="lock-tabs">
          <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: activeTab === 'login' }"
            @click="switchTab('login')"
          >
            👤 Giriş Yap
          </button>
          <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: activeTab === 'ciso' }"
            @click="switchTab('ciso')"
          >
            🛡️ CISO
          </button>
          <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: activeTab === 'register' }"
            @click="switchTab('register')"
          >
            📝 Kayıt Ol
          </button>
        </div>

        <!-- 1. GİRİŞ YAP FORMU -->
        <form v-if="activeTab === 'login'" @submit.prevent="handleLogin" class="lock-form">
          <div class="input-group">
            <label>Kullanıcı Adı</label>
            <input 
              v-model="loginUsername" 
              type="text" 
              placeholder="kullanıcı adı..." 
              required 
              :disabled="isLoading"
            />
          </div>

          <div class="input-group">
            <label>Şifre</label>
            <div class="password-input-wrapper">
              <input 
                v-model="loginPassword" 
                :type="isLoginPassVisible ? 'text' : 'password'" 
                placeholder="••••••••" 
                required
                :disabled="isLoading"
              />
              <button 
                type="button" 
                class="btn-eye" 
                @mousedown="isLoginPassVisible = true" 
                @mouseup="isLoginPassVisible = false"
                @mouseleave="isLoginPassVisible = false"
                @touchstart="isLoginPassVisible = true" 
                @touchend="isLoginPassVisible = false"
                title="Şifreyi görmek için basılı tutun"
              >
                👁️
              </button>
            </div>
          </div>

          <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>

          <button type="submit" class="btn-unlock" :disabled="isLoading">
            <span v-if="isLoading" class="spinner-xs"></span>
            {{ isLoading ? 'Giriş Yapılıyor...' : 'Giriş Yap' }}
          </button>
        </form>

        <!-- 2. CISO GİRİŞİ FORMU -->
        <form v-if="activeTab === 'ciso'" @submit.prevent="handleCisoLogin" class="lock-form">
          <div class="input-group">
            <label>CISO Kullanıcı Adı</label>
            <input 
              v-model="cisoUsername" 
              type="text" 
              placeholder="ciso..." 
              required 
              :disabled="isLoading"
            />
          </div>

          <div class="input-group">
            <label>CISO Güvenlik Şifresi</label>
            <div class="password-input-wrapper">
              <input 
                v-model="cisoPassword" 
                :type="isCisoPassVisible ? 'text' : 'password'" 
                placeholder="••••••••" 
                required
                :disabled="isLoading"
              />
              <button 
                type="button" 
                class="btn-eye" 
                @mousedown="isCisoPassVisible = true" 
                @mouseup="isCisoPassVisible = false"
                @mouseleave="isCisoPassVisible = false"
                @touchstart="isCisoPassVisible = true" 
                @touchend="isCisoPassVisible = false"
                title="Şifreyi görmek için basılı tutun"
              >
                👁️
              </button>
            </div>
          </div>

          <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>

          <button type="submit" class="btn-unlock btn-unlock--ciso" :disabled="isLoading">
            <span v-if="isLoading" class="spinner-xs"></span>
            {{ isLoading ? 'Doğrulanıyor...' : 'CISO Girişi Yap' }}
          </button>
        </form>

        <!-- 3. KAYIT OL FORMU (E-posta OTP Doğrulamalı) -->
        <form v-if="activeTab === 'register'" @submit.prevent="handleRegister" class="lock-form">
          <div class="input-group">
            <label>Gerçek Ad Soyad</label>
            <input 
              v-model="regFullName" 
              type="text" 
              placeholder="Örn: Mehmet Akif Ürey" 
              required 
              :disabled="isLoading"
            />
          </div>

          <div class="input-group">
            <label>Kullanıcı Adı</label>
            <input 
              v-model="regUsername" 
              type="text" 
              placeholder="Örn: akif_urey" 
              required 
              :disabled="isLoading"
            />
          </div>

          <div class="input-group">
            <label>E-posta Adresi</label>
            <div class="email-input-group" style="display:flex; gap:0.5rem">
              <input 
                v-model="regEmail" 
                type="email" 
                placeholder="Örn: guvenlik@sirketiniz.com" 
                required 
                :disabled="isLoading || isRegEmailVerified"
              />
              <button 
                type="button" 
                class="btn-send-code" 
                style="padding: 0.55rem 0.85rem; font-size: 0.75rem; border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 6px; background: rgba(139, 92, 246, 0.08); color: #a78bfa; font-weight: 600; cursor: pointer; white-space: nowrap;"
                :disabled="isLoading || isRegSendingCode || isRegEmailVerified || regTimer > 0" 
                @click="sendRegVerificationCode"
              >
                {{ isRegSendingCode ? '...' : (isRegEmailVerified ? '✓ Doğrulandı' : (regTimer > 0 ? `Yeniden Gönder (${formatTime(regTimer)})` : 'Kod Gönder')) }}
              </button>
            </div>
          </div>

          <!-- Kayıt OTP Giriş Alanı -->
          <div v-if="isRegVerifying && !isRegEmailVerified" class="otp-verification-section" style="background: rgba(139, 92, 246, 0.03); border: 1px dashed rgba(139, 92, 246, 0.25); border-radius: 8px; padding: 0.85rem; margin-top:0.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
            <p style="font-size: 0.7rem; color: #9ca3af; line-height: 1.4; margin: 0;">E-posta adresinize gönderilen 6 haneli doğrulama kodunu girin.</p>
            <div class="otp-input-container" style="display: flex; gap: 0.4rem; justify-content: space-between;">
              <input 
                v-for="(digit, idx) in regOtpDigits" 
                :key="idx"
                :id="'reg-otp-' + idx"
                v-model="regOtpDigits[idx]"
                type="text"
                maxLength="1"
                style="width: 36px; height: 36px; background: rgba(15, 23, 42, 0.7); border: 1.5px solid rgba(255, 255, 255, 0.1); border-radius: 6px; text-align: center; color: #fff; font-size: 1.1rem; font-weight: 700; outline: none;"
                @input="handleRegOtpInput($event, idx)"
                @keydown.delete="handleRegOtpDelete($event, idx)"
              />
            </div>
            <div v-if="regOtpError" style="color: #f87171; font-size: 0.72rem; text-align: center;">{{ regOtpError }}</div>
            <div style="display:flex; justify-content:flex-end; gap:0.5rem">
              <button type="button" style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.1); color: #9ca3af; padding: 0.35rem 0.75rem; font-size: 0.72rem; border-radius: 6px; cursor: pointer;" @click="isRegVerifying = false">Vazgeç</button>
              <button type="button" style="background: #8b5cf6; border: none; color: #fff; padding: 0.35rem 1rem; font-size: 0.72rem; font-weight: 700; border-radius: 6px; cursor: pointer;" @click="verifyRegCode">Doğrula</button>
            </div>
          </div>

          <div class="input-group">
            <label>Şifre</label>
            <div class="password-input-wrapper">
              <input 
                v-model="regPassword" 
                :type="isRegPassVisible ? 'text' : 'password'" 
                placeholder="Şifre belirleyin..." 
                required
                :disabled="isLoading"
                :style="regPassword ? { borderColor: isRegPasswordValid ? '#22c55e' : '#ef4444' } : {}"
              />
              <button 
                type="button" 
                class="btn-eye" 
                @mousedown="isRegPassVisible = true" 
                @mouseup="isRegPassVisible = false"
                @mouseleave="isRegPassVisible = false"
                @touchstart="isRegPassVisible = true" 
                @touchend="isRegPassVisible = false"
                title="Şifreyi görmek için basılı tutun"
              >
                👁️
              </button>
            </div>
            <!-- Dinamik Şifre Gereksinimleri -->
            <div v-if="regPassword && regPasswordErrors.length > 0" class="password-requirements" style="font-size:0.68rem; color:#f87171; margin-top:0.25rem; display:flex; flex-direction:column; gap:0.15rem;">
              <span v-for="err in regPasswordErrors" :key="err">⚠️ {{ err }}</span>
            </div>
          </div>

          <div class="input-group">
            <label>Talep Edilen Rol</label>
            <select v-model="regRole" class="role-select" required :disabled="isLoading">
              <option value="user">Standart Kullanıcı (Oturum)</option>
              <option value="admin">Yönetici (Admin)</option>
            </select>
          </div>

          <div v-if="successMessage" class="success-banner">{{ successMessage }}</div>
          <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>

          <button type="submit" class="btn-unlock btn-unlock--register" :disabled="isLoading || !isRegEmailVerified || !isRegPasswordValid">
            <span v-if="isLoading" class="spinner-xs"></span>
            {{ isLoading ? 'İstek Gönderiliyor...' : (isRegEmailVerified ? (isRegPasswordValid ? 'Kayıt Başvurusu Yap' : 'Lütfen Şifre Kurallarını Sağlayın') : 'Lütfen Önce Mail Doğrulayın') }}
          </button>
        </form>

      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const isLocked = ref(true)
const activeTab = ref('login')
const isLoading = ref(false)
const shouldShake = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Login Form Fields
const loginUsername = ref('')
const loginPassword = ref('')
const isLoginPassVisible = ref(false)

// CISO Form Fields
const cisoUsername = ref('ciso')
const cisoPassword = ref('')
const isCisoPassVisible = ref(false)

// Register Form Fields
const regFullName = ref('')
const regUsername = ref('')
const regEmail = ref('')
const regPassword = ref('')
const regRole = ref('user')
const isRegPassVisible = ref(false)

// Dinamik Şifre Validasyonu
const regPasswordErrors = computed(() => {
  const p = regPassword.value || '';
  const errors = [];
  if (p.length < 8) {
    errors.push('En az 8 karakter olmalı');
  }
  if (!/[a-zA-Z]/.test(p)) {
    errors.push('En az bir harf içermeli');
  }
  if (!/[0-9]/.test(p)) {
    errors.push('En az bir rakam içermeli');
  }
  return errors;
})

const isRegPasswordValid = computed(() => {
  return regPassword.value && regPasswordErrors.value.length === 0;
})

// Kayıt Mail OTP Kontrolleri
const isRegEmailVerified = ref(false)
const isRegSendingCode = ref(false)
const isRegVerifying = ref(false)
const regOtpDigits = ref(['', '', '', '', '', ''])
const regOtpError = ref('')

const regTimer = ref(0)
let regInterval = null

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function startRegTimer() {
  if (regInterval) clearInterval(regInterval);
  regTimer.value = 300;
  regInterval = setInterval(() => {
    if (regTimer.value > 0) {
      regTimer.value--;
    } else {
      clearInterval(regInterval);
    }
  }, 1000);
}

function switchTab(tab) {
  activeTab.value = tab
  errorMessage.value = ''
  successMessage.value = ''
}

function triggerFormShake() {
  shouldShake.value = true
  setTimeout(() => { shouldShake.value = false }, 500)
}

// 1. Genel Giriş İşlemi
async function handleLogin() {
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: loginUsername.value,
        password: loginPassword.value,
        isCiso: false
      })
    })

    const data = await response.json()

    if (response.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('kasa_token', data.token);
      isLocked.value = false;
      window.dispatchEvent(new Event('kasa-unlocked'))
    } else {
      triggerFormShake()
      errorMessage.value = data.error || 'Giriş yapılamadı.'
    }
  } catch (error) {
    errorMessage.value = 'Sunucuyla bağlantı kurulamadı.'
  } finally {
    isLoading.value = false
  }
}

// 2. CISO Giriş İşlemi
async function handleCisoLogin() {
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cisoUsername.value,
        password: cisoPassword.value,
        isCiso: true
      })
    })

    const data = await response.json()

    if (response.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('kasa_token', data.token);
      isLocked.value = false;
      window.dispatchEvent(new Event('kasa-unlocked'))
    } else {
      triggerFormShake()
      errorMessage.value = data.error || 'CISO şifresi geçersiz.'
    }
  } catch (error) {
    errorMessage.value = 'Sunucuyla bağlantı kurulamadı.'
  } finally {
    isLoading.value = false
  }
}

// Kayıt OTP Mail Gönderimi
async function sendRegVerificationCode() {
  if (!regEmail.value) {
    errorMessage.value = 'Lütfen geçerli bir e-posta adresi yazın.'
    return
  }
  isRegSendingCode.value = true
  errorMessage.value = ''
  successMessage.value = ''
  regOtpError.value = ''

  try {
    const response = await fetch('/api/auth/register-send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: regEmail.value, role: regRole.value })
    })

    const data = await response.json()

    if (response.ok) {
      isRegVerifying.value = true
      regOtpDigits.value = ['', '', '', '', '', '']
      successMessage.value = 'Doğrulama kodu gönderildi.'
      startRegTimer()
    } else {
      errorMessage.value = data.error || data.message || 'Kod gönderilemedi.'
    }
  } catch (err) {
    errorMessage.value = 'Sunucu bağlantı hatası.'
  } finally {
    isRegSendingCode.value = false
  }
}

// Kayıt OTP Doğrulama
async function verifyRegCode() {
  const code = regOtpDigits.value.join('')
  if (code.length !== 6) {
    regOtpError.value = 'Lütfen 6 haneli kodu eksiksiz girin.'
    return
  }
  regOtpError.value = ''

  try {
    const response = await fetch('/api/auth/register-verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: regEmail.value, code })
    })

    if (response.ok) {
      isRegEmailVerified.value = true
      isRegVerifying.value = false
      if (regInterval) clearInterval(regInterval);
      regTimer.value = 0;
      successMessage.value = 'E-posta doğrulama başarılı! Artık kayıt başvurusunu tamamlayabilirsiniz.'
    } else {
      const data = await response.json()
      regOtpError.value = data.error || 'Doğrulama kodu geçersiz.'
    }
  } catch (err) {
    regOtpError.value = 'Doğrulama hatası.'
  }
}

function handleRegOtpInput(event, index) {
  const value = event.target.value
  if (!/^[0-9]$/.test(value)) {
    regOtpDigits.value[index] = ''
    return
  }
  if (index < 5 && value) {
    const nextInput = document.getElementById(`reg-otp-${index + 1}`)
    if (nextInput) nextInput.focus()
  }
}

function handleRegOtpDelete(event, index) {
  if (index > 0 && !regOtpDigits.value[index]) {
    regOtpDigits.value[index - 1] = ''
    const prevInput = document.getElementById(`reg-otp-${index - 1}`)
    if (prevInput) prevInput.focus()
  }
}

// 3. Kullanıcı Kayıt Başvurusu
async function handleRegister() {
  if (!isRegPasswordValid.value) {
    errorMessage.value = 'Şifreniz kurallara uygun değil.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: regFullName.value,
        username: regUsername.value,
        email: regEmail.value,
        password: regPassword.value,
        role: regRole.value
      })
    })

    const data = await response.json()

    if (response.ok) {
      successMessage.value = data.message || 'Kayıt talebi başarıyla iletildi.'
      // Temizle
      regFullName.value = ''
      regUsername.value = ''
      regEmail.value = ''
      regPassword.value = ''
      isRegEmailVerified.value = false
    } else {
      errorMessage.value = data.error || 'Kayıt işlemi başarısız.'
    }
  } catch (error) {
    errorMessage.value = 'Sunucuyla bağlantı kurulamadı.'
  } finally {
    isLoading.value = false
  }
}

async function handleLockEvent() {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      console.warn('Logout log could not be synced:', e.message);
    }
  }
  localStorage.removeItem('token');
  localStorage.removeItem('kasa_token');
  isLocked.value = true;
  loginUsername.value = '';
  loginPassword.value = '';
  cisoPassword.value = '';
  isRegEmailVerified.value = false;
  isRegVerifying.value = false;
}

onMounted(() => {
  window.addEventListener('kasa-lock', handleLockEvent);
  const token = localStorage.getItem('token');
  if (token) {
    isLocked.value = false;
  }
})

onUnmounted(() => {
  window.removeEventListener('kasa-lock', handleLockEvent);
  if (regInterval) clearInterval(regInterval);
})
</script>

<style scoped>
.kasa-lock-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: radial-gradient(circle at center, #0b0f19 0%, #030712 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99999;
}

.kasa-lock-card {
  background: rgba(17, 24, 39, 0.85);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  padding: 2.5rem;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 40px rgba(139, 92, 246, 0.1);
  backdrop-filter: blur(20px);
}

.lock-header {
  text-align: center;
  margin-bottom: 2rem;
}

.lock-icon-wrapper {
  background: rgba(139, 92, 246, 0.1);
  border: 1.5px solid rgba(139, 92, 246, 0.3);
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto 1rem auto;
  color: #a78bfa;
}

.lock-svg {
  width: 28px;
  height: 28px;
}

.lock-header h2 {
  font-size: 1.25rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: 1px;
}

.lock-desc {
  font-size: 0.8rem;
  color: #9ca3af;
  margin-top: 0.35rem;
}

.lock-tabs {
  display: flex;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 0.25rem;
  margin-bottom: 1.75rem;
}

.tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: #9ca3af;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: #fff;
}

.tab-btn.active {
  background: #8b5cf6;
  color: #fff;
  box-shadow: 0 4px 10px rgba(139, 92, 246, 0.25);
}

.lock-form {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.input-group label {
  font-size: 0.72rem;
  font-weight: 700;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.input-group input, .role-select {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 0.7rem 1rem;
  color: #fff;
  font-size: 0.85rem;
  outline: none;
  width: 100%;
}

.input-group input:focus, .role-select:focus {
  border-color: #8b5cf6;
  background: rgba(15, 23, 42, 0.9);
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrapper input {
  padding-right: 2.75rem !important;
}

.btn-eye {
  position: absolute;
  right: 12px;
  background: transparent;
  border: none;
  color: #a78bfa;
  font-size: 1rem;
  cursor: pointer;
  padding: 4px;
  opacity: 0.65;
  user-select: none;
}

.btn-eye:hover {
  opacity: 1;
}

.error-banner {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #f87171;
  font-size: 0.78rem;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  text-align: center;
}

.success-banner {
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.25);
  color: #4ade80;
  font-size: 0.78rem;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  text-align: center;
}

.btn-unlock {
  background: linear-gradient(135deg, #a78bfa, #8b5cf6);
  color: #fff;
  border: none;
  padding: 0.75rem;
  font-size: 0.85rem;
  font-weight: 800;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(139, 92, 246, 0.2);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
}

.btn-unlock:hover:not(:disabled) {
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.35);
}

.btn-unlock:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-unlock--ciso {
  background: linear-gradient(135deg, #10b981, #059669);
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2);
}

.btn-unlock--ciso:hover:not(:disabled) {
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35);
}

.shake-anim {
  animation: shake 0.4s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}

.slide-up-enter-active, .slide-up-leave-active {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
}
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(30px);
  opacity: 0;
}
</style>
