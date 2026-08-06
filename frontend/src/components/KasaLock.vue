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
            <input 
              v-model="password" 
              type="password" 
              placeholder="••••••••" 
              required
              autocomplete="current-password"
            />
          </div>

          <div v-if="errorMessage" class="error-msg">
            ⚠️ {{ errorMessage }}
          </div>

          <button type="submit" class="btn-unlock" :disabled="isLoading">
            {{ isLoading ? $t('common.loading') : $t('auth.loginBtn') }}
          </button>
        </form>

        <!-- 2. CISO HIZLI GİRİŞ FORMU -->
        <form v-else-if="activeTab === 'ciso'" @submit.prevent="handleCisoLogin" class="lock-form">
          <div class="ciso-info-banner">
            {{ $t('auth.cisoInfo') }}
          </div>
          <div class="form-group">
            <label>CISO {{ $t('auth.username') || 'Kullanıcı Adı' }}</label>
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
            <input 
              v-model="cisoPassword" 
              type="password" 
              :placeholder="$t('auth.cisoPasswordPlaceholder')" 
              required
            />
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
            <input 
              v-model="regPassword" 
              type="password" 
              placeholder="••••••••" 
              required
            />
          </div>
          <div class="form-group">
            <label>{{ $t('auth.roleSelection') }}</label>
            <select v-model="regRole" class="form-select">
              <option value="user">{{ $t('auth.roleUser') }}</option>
              <option value="admin">{{ $t('auth.roleAdmin') }}</option>
            </select>
          </div>

          <div class="security-policy-banner" style="background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; padding: 0.8rem; border-radius: 4px; margin-bottom: 1rem; font-size: 0.85rem; color: #c4b5fd;">
            <strong>ℹ️ Güvenlik Politikası:</strong> Hem Standart hem de Yönetici (Admin) hesap başvuruları, sistem yöneticilerinin onayından geçmeden aktif hale gelmez.
          </div>

          <div v-if="errorMessage" class="error-msg">
            ⚠️ {{ errorMessage }}
          </div>
          <div v-if="successMessage" class="success-msg">
            ✅ {{ successMessage }}
          </div>

          <button type="submit" class="btn-unlock btn-register" :disabled="isLoading">
            {{ isLoading ? $t('common.loading') : $t('auth.sendRegisterRequest') }}
          </button>
        </form>

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

const cisoUsername = ref('ciso')
const cisoPassword = ref('')

const regUsername = ref('')
const regFullName = ref('')
const regEmail = ref('')
const regPassword = ref('')
const regRole = ref('user')

const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const shouldShake = ref(false)

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
        fullName: regFullName.value,
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
  transition: all 0.3s ease;
}
.slide-up-enter-from, .slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
