<template>
  <Transition name="slide-up">
    <div v-if="isLocked" class="kasa-lock-overlay">
      
      <!-- Sağ Üst Dil Seçim Menüsü (Kartın dışına alındı, kaymayı önler) -->
      <div class="kasa-top-bar" style="position: absolute; top: 1.5rem; right: 2rem;">
        <NativeLangSelector />
      </div>

      <div class="kasa-lock-card" :class="{ 'shake-anim': shouldShake }">

        <!-- Logo ve Başlık -->
        <div class="lock-header">
          <div class="lock-icon-wrapper">
            <svg class="lock-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2>{{ $t('auth.loginTitle') }}</h2>
          <p class="lock-desc">{{ $t('auth.lockDesc') }}</p>
        </div>

        <!-- Sekme Seçimi -->
        <div class="lock-tabs">
          <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: activeTab === 'login' }"
            @click="switchTab('login')"
          >
            👤 {{ $t('nav.login') }}
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
            📝 {{ $t('auth.register') }}
          </button>
        </div>

        <!-- 1. STANDART GİRİŞ FORMU -->
        <form v-if="activeTab === 'login'" @submit.prevent="handleLogin" class="lock-form">
          <div class="form-group">
            <label>{{ $t('auth.username') }}</label>
            <input 
              v-model="username" 
              type="text" 
              placeholder="kullanici_adi" 
              required
              autocomplete="username"
            />
          </div>
          <div class="form-group">
            <label>{{ $t('auth.password') }}</label>
            <div class="password-input-wrapper">
              <input 
                v-model="password" 
                :type="isLoginPassVisible ? 'text' : 'password'" 
                placeholder="••••••••" 
                required
                autocomplete="current-password"
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

          <div v-if="errorMessage" class="error-msg">
            ⚠️ {{ errorMessage }}
          </div>

          <div style="text-align: right; margin-top: -0.5rem; margin-bottom: 1rem; width: 100%;">
            <button type="button" @click="openForgotPassword" style="background: transparent; border: none; color: #a78bfa; font-size: 0.8rem; font-weight: 700; cursor: pointer; text-decoration: underline; white-space: nowrap; text-align: right; max-width: 100%; line-height: 1.4;">
              <span>{{ $t('auth.forgotPassword') || 'Şifremi Unuttum?' }}</span>
            </button>
          </div>

          <button type="submit" class="btn-unlock" :disabled="isLoading">
            {{ isLoading ? $t('common.loading') : $t('auth.loginBtn') }}
          </button>
        </form>

        <!-- 2. CISO HIZLI GİRİŞ FORMU -->
        <form v-else-if="activeTab === 'ciso'" @submit.prevent="handleCisoLogin" class="lock-form">
          <div class="form-group">
            <label>{{ $t('auth.username') || 'Kullanıcı Adı' }}</label>
            <input 
              v-model="cisoUsername" 
              type="text" 
              :placeholder="$t('auth.usernamePlaceholder') || 'ciso'" 
              required
              autocomplete="username"
            />
          </div>
          <div class="form-group">
            <label>CISO {{ $t('auth.password') }}</label>
            <div class="password-input-wrapper">
              <input 
                v-model="cisoPassword" 
                :type="isCisoPassVisible ? 'text' : 'password'" 
                :placeholder="$t('auth.cisoPasswordPlaceholder')" 
                required
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

          <div v-if="errorMessage" class="error-msg">
            ⚠️ {{ errorMessage }}
          </div>

          <button type="submit" class="btn-unlock btn-ciso" :disabled="isLoading">
            {{ isLoading ? $t('common.loading') : $t('auth.cisoLoginBtn') }}
          </button>
        </form>

        <!-- 3. KAYIT OL FORMU -->
        <form v-else-if="activeTab === 'register'" @submit.prevent="handleRegister" class="lock-form">
          <div class="form-group">
            <label>{{ $t('auth.username') }}</label>
            <input 
              v-model="regUsername" 
              type="text" 
              placeholder="yeni_kullanici" 
              required
            />
          </div>
          <div class="form-group">
            <label>{{ $t('auth.fullName') }}</label>
            <input 
              v-model="regFullName" 
              type="text" 
              placeholder="Ahmet Yılmaz" 
              required
            />
          </div>
          <div class="form-group">
            <label>{{ $t('auth.email') }}</label>
            <input 
              v-model="regEmail" 
              type="email" 
              placeholder="ornek@dms.com" 
              required
            />
          </div>
          <div class="form-group">
            <label>{{ $t('auth.password') }}</label>
            <div class="password-input-wrapper">
              <input 
                v-model="regPassword" 
                :type="isRegPassVisible ? 'text' : 'password'" 
                placeholder="••••••••" 
                required
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
          </div>
          <div class="form-group">
            <label>{{ $t('auth.roleSelection') }}</label>
            <select v-model="regRole" class="form-select">
              <option value="user">{{ $t('auth.roleUser') }}</option>
              <option value="admin">{{ $t('auth.roleAdmin') }}</option>
            </select>
          </div>

          <div v-if="errorMessage" class="error-msg">
            ⚠️ {{ errorMessage }}
          </div>
          <div v-if="successMessage" class="success-msg">
            ✅ {{ successMessage }}
          </div>

          <div class="security-policy-info" style="font-size: 0.82rem; color: #c4b5fd; line-height: 1.4; margin-top: 0.5rem; margin-bottom: 0.8rem; background: rgba(139, 92, 246, 0.1); border-left: 3px solid #8b5cf6; padding: 0.6rem 0.8rem; border-radius: 4px;">
            ℹ️ Güvenlik Politikası: Hem Standart hem de Yönetici (Admin) hesap başvuruları, sistem yöneticilerinin onayından geçmeden aktif hale gelmez.
          </div>

          <button type="submit" class="btn-unlock btn-register" :disabled="isLoading">
            {{ isLoading ? $t('common.loading') : $t('auth.sendRegisterRequest') }}
          </button>
        </form>

      </div>

      <!-- Şifremi Unuttum Modalı -->
      <div v-if="isForgotModalOpen" class="forgot-modal-overlay" @click.self="isForgotModalOpen = false">
        <div class="forgot-modal-card">
          <div class="forgot-header">
            <h4>🔑 {{ $t('auth.forgotPassword') || 'Şifremi Unuttum' }}</h4>
            <button type="button" @click="isForgotModalOpen = false" class="btn-close-forgot">✕</button>
          </div>

          <div class="forgot-body">
            <div class="input-group">
              <label>{{ $t('auth.registeredEmail') || 'Kayıtlı E-posta Adresiniz' }}</label>
              <input 
                v-model="forgotEmail" 
                type="email" 
                :placeholder="$t('auth.emailPlaceholder') || 'guvenlik@sirketiniz.com'"
                required
                style="width:100%; box-sizing:border-box;"
              />
            </div>

            <div v-if="forgotHint" class="hint-display-box">
              <strong>💡 {{ $t('auth.passwordHint') || 'Şifre İpucunuz:' }}</strong>
              <p>{{ forgotHint }}</p>
            </div>

            <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>
            <div v-if="successMessage" class="success-banner">{{ successMessage }}</div>

            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
              <button type="button" class="btn-forgot-action" @click="getForgotPasswordHint" :disabled="isForgotLoading" style="flex: 1 1 auto; min-width: 120px; white-space: normal; min-height: 2.5rem; line-height: 1.2;">
                <span>{{ isForgotLoading ? '...' : ($t('auth.getHintBtn') || 'İpucu Göster') }}</span>
              </button>
              <button type="button" class="btn-forgot-action btn-forgot-action--email" @click="sendForgotPasswordEmail" :disabled="isForgotLoading" style="flex: 1 1 auto; min-width: 140px; white-space: normal; min-height: 2.5rem; line-height: 1.2;">
                <span>{{ isForgotLoading ? '...' : ($t('auth.sendResetEmailBtn') || 'Sıfırlama Maili Gönder') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref } from 'vue'
import NativeLangSelector from './NativeLangSelector.vue'

const isLocked = ref(true)
const activeTab = ref('login')
const username = ref('admin')
const password = ref('')
const isLoginPassVisible = ref(false)

const cisoUsername = ref('ciso')
const cisoPassword = ref('')
const isCisoPassVisible = ref(false)

const regUsername = ref('')
const regFullName = ref('')
const regEmail = ref('')
const regPassword = ref('')
const regRole = ref('user')
const isRegPassVisible = ref(false)

const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const shouldShake = ref(false)

// Şifremi Unuttum Modalı State'leri
const isForgotModalOpen = ref(false)
const forgotEmail = ref('')
const forgotHint = ref('')
const isForgotLoading = ref(false)

function switchTab(tab) {
  activeTab.value = tab
  errorMessage.value = ''
  successMessage.value = ''
}

function triggerShake() {
  shouldShake.value = true
  setTimeout(() => {
    shouldShake.value = false
  }, 600)
}

async function handleLogin() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value,
        password: password.value
      })
    })

    const data = await res.json()

    if (!res.ok) {
      errorMessage.value = data.error || 'Giriş başarısız.'
      triggerShake()
      return
    }

    localStorage.setItem('token', data.token)
    isLocked.value = false
    window.location.reload()
  } catch (err) {
    errorMessage.value = 'Sunucuya bağlanılamadı.'
    triggerShake()
  } finally {
    isLoading.value = false
  }
}

async function handleCisoLogin() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cisoUsername.value,
        password: cisoPassword.value,
        isCiso: true
      })
    })

    const data = await res.json()

    if (!res.ok) {
      errorMessage.value = data.error || 'CISO şifresi hatalı.'
      triggerShake()
      return
    }

    localStorage.setItem('token', data.token)
    isLocked.value = false
    window.location.reload()
  } catch (err) {
    errorMessage.value = 'Sunucuya bağlanılamadı.'
    triggerShake()
  } finally {
    isLoading.value = false
  }
}

async function handleRegister() {
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: regUsername.value,
        full_name: regFullName.value,
        email: regEmail.value,
        password: regPassword.value,
        role: regRole.value
      })
    })

    const data = await res.json()

    if (!res.ok) {
      errorMessage.value = data.error || 'Kayıt işlemi başarısız.'
      triggerShake()
      return
    }

    successMessage.value = data.message || 'Kayıt talebiniz alındı! Yönetici onayı bekleniyor.'
    setTimeout(() => {
      switchTab('login')
    }, 2000)
  } catch (err) {
    errorMessage.value = 'Sunucuya bağlanılamadı.'
    triggerShake()
  } finally {
    isLoading.value = false
  }
}

function openForgotPassword() {
  forgotEmail.value = ''
  forgotHint.value = ''
  errorMessage.value = ''
  successMessage.value = ''
  isForgotModalOpen.value = true
}

async function getForgotPasswordHint() {
  if (!forgotEmail.value) {
    forgotHint.value = 'Lütfen önce e-posta adresinizi girin.'
    return
  }
  isForgotLoading.value = true
  forgotHint.value = ''
  try {
    const response = await fetch('/api/auth/forgot-password-hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail.value })
    })
    const data = await response.json()
    if (response.ok) {
      forgotHint.value = data.hint
    } else {
      forgotHint.value = data.error || 'İpucu sorgulanırken bir hata oluştu.'
    }
  } catch (err) {
    forgotHint.value = 'Bağlantı hatası oluştu.'
  } finally {
    isForgotLoading.value = false
  }
}

async function sendForgotPasswordEmail() {
  if (!forgotEmail.value) {
    forgotHint.value = 'Lütfen önce e-posta adresinizi girin.'
    return
  }
  isForgotLoading.value = true
  try {
    const response = await fetch('/api/auth/forgot-password-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail.value })
    })
    const data = await response.json()
    if (response.ok) {
      successMessage.value = data.message || 'Sıfırlama e-postası başarıyla gönderildi.'
      errorMessage.value = ''
    } else {
      errorMessage.value = data.error || 'Sıfırlama e-postası gönderilemedi.'
    }
  } catch (err) {
    errorMessage.value = 'Bağlantı hatası oluştu.'
  } finally {
    isForgotLoading.value = false
  }
}
</script>

<style scoped>
.kasa-lock-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  overflow-y: auto;
}

.kasa-lock-card {
  background: rgba(30, 41, 59, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
  border-radius: 20px;
  padding: 2.2rem;
  width: 100%;
  max-width: 440px;
  max-height: 88vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  position: relative;
}

.kasa-top-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.lock-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.lock-icon-wrapper {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2));
  border: 1px solid rgba(168, 85, 247, 0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem auto;
  color: #a855f7;
}

.lock-svg {
  width: 28px;
  height: 28px;
}

.lock-header h2 {
  color: #f8fafc;
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0 0 0.4rem 0;
}

.lock-desc {
  color: #94a3b8;
  font-size: 0.85rem;
  margin: 0;
}

.lock-tabs {
  display: flex;
  gap: 0.5rem;
  background: #0f172a;
  padding: 0.3rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 0.55rem 0.4rem;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: #fff;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.lock-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group label {
  color: #cbd5e1;
  font-size: 0.82rem;
  font-weight: 600;
}

.form-group input, .form-select {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 0.7rem 0.9rem;
  border-radius: 10px;
  font-size: 0.9rem;
  outline: none;
  transition: all 0.2s ease;
}

.form-group input:focus, .form-select:focus {
  border-color: #818cf8;
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.15);
}

.ciso-info-banner {
  background: rgba(168, 85, 247, 0.1);
  border: 1px solid rgba(168, 85, 247, 0.25);
  color: #d8b4fe;
  padding: 0.75rem;
  border-radius: 10px;
  font-size: 0.78rem;
  line-height: 1.4;
}

.error-msg {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  font-size: 0.82rem;
}

.success-msg {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #86efac;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  font-size: 0.82rem;
}

.btn-unlock {
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: #fff;
  border: none;
  padding: 0.8rem;
  border-radius: 10px;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 0.5rem;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
  white-space: normal;
  word-break: break-word;
  line-height: 1.2;
}

.btn-unlock:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
}

.btn-ciso {
  background: linear-gradient(135deg, #a855f7, #ec4899);
}

.btn-register {
  background: linear-gradient(135deg, #10b981, #06b6d4);
}

.shake-anim {
  animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
}

.slide-up-enter-active, .slide-up-leave-active {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
}
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(30px);
  opacity: 0;
}

/* Şifremi Unuttum Modalı Stilleri */
.forgot-modal-overlay {
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
.forgot-modal-card {
  background: #111827;
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 14px;
  width: 100%;
  max-width: 380px;
  padding: 1.5rem;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.7);
}
.forgot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 0.75rem;
}
.forgot-header h4 {
  margin: 0;
  color: #a78bfa;
  font-size: 1.05rem;
}
.btn-close-forgot {
  background: transparent;
  border: none;
  color: #9ca3af;
  font-size: 1rem;
  cursor: pointer;
}
.forgot-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.hint-display-box {
  background: rgba(139, 92, 246, 0.06);
  border: 1px dashed rgba(139, 92, 246, 0.25);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  text-align: left;
  font-size: 0.8rem;
}
.hint-display-box strong {
  color: #a78bfa;
  display: block;
  margin-bottom: 0.25rem;
}
.hint-display-box p {
  margin: 0;
  color: #fff;
  font-weight: 500;
}
.btn-forgot-action {
  background: rgba(139, 92, 246, 0.12);
  border: 1px solid rgba(139, 92, 246, 0.25);
  color: #a78bfa;
  padding: 0.65rem;
  font-weight: 700;
  font-size: 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-forgot-action:hover {
  background: #8b5cf6;
  color: #fff;
}
.btn-forgot-action--email {
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.25);
  color: #cbd5e1;
}
.btn-forgot-action--email:hover {
  background: #6366f1;
  color: #fff;
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.password-input-wrapper input {
  padding-right: 2.75rem !important;
  width: 100%;
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
  z-index: 2;
}

.btn-eye:hover {
  opacity: 1;
}
</style>
