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
          <p class="lock-desc">Sisteme erişebilmek için kasa kimlik bilgilerini girin.</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleLogin" class="lock-form">
          <div class="input-group">
            <label>Kasa Kullanıcı Adı</label>
            <input 
              v-model="username" 
              type="text" 
              placeholder="kasa kullanıcı adı..." 
              required 
              :disabled="lockoutSeconds > 0 || isLoading"
            />
          </div>

          <div class="input-group">
            <label>Kasa Şifresi</label>
            <input 
              v-model="password" 
              type="password" 
              placeholder="••••••••" 
              required
              :disabled="lockoutSeconds > 0 || isLoading"
            />
          </div>

          <!-- Kalan Hak ve Hata Mesajı -->
          <div v-if="errorMessage" class="error-banner">
            {{ errorMessage }}
          </div>

          <div class="status-row" v-if="lockoutSeconds === 0">
            <span class="status-label">Giriş Durumu:</span>
            <span class="status-chip" :class="remainingAttempts <= 1 ? 'chip--danger' : 'chip--warning'">
              Kalan Hak: {{ remainingAttempts }}
            </span>
          </div>

          <!-- Kilit Durumu Sayacı -->
          <div v-else class="lockout-banner">
            🚨 Çok fazla hatalı deneme! <br />
            <strong>{{ formatTime(lockoutSeconds) }}</strong> saniye sonra tekrar deneyin.
          </div>

          <!-- Gönder Butonu -->
          <button 
            type="submit" 
            class="btn-unlock" 
            :disabled="lockoutSeconds > 0 || isLoading"
          >
            <span v-if="isLoading" class="spinner-xs"></span>
            {{ isLoading ? 'Kilit Açılıyor...' : 'Kasa Kilidini Aç' }}
          </button>
        </form>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isLocked = ref(true)
const username = ref('')
const password = ref('')
const remainingAttempts = ref(3)
const lockoutSeconds = ref(0)
const isLoading = ref(false)
const shouldShake = ref(false)
const errorMessage = ref('')
let timer = null

// Kasa Durumunu Sorgula
async function checkKasaStatus() {
  try {
    const response = await fetch('/api/auth/kasa-status')
    if (response.ok) {
      const data = await response.json()
      remainingAttempts.value = data.remainingAttempts
      if (data.lockoutSecondsLeft > 0) {
        startCountdown(data.lockoutSecondsLeft)
      }
    }
  } catch (error) {
    console.error('[KasaLock] Durum sorgulama hatası:', error)
  }
}

// Geri sayım sayacını başlat
function startCountdown(seconds) {
  lockoutSeconds.value = seconds
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    lockoutSeconds.value--
    if (lockoutSeconds.value <= 0) {
      clearInterval(timer)
      timer = null
      checkKasaStatus()
      errorMessage.value = ''
    }
  }, 1000)
}

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

async function handleLogin() {
  if (lockoutSeconds.value > 0 || isLoading.value) return

  isLoading.value = true
  errorMessage.value = ''
  shouldShake.value = false

  try {
    const response = await fetch('/api/auth/kasa-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username.value,
        password: password.value
      })
    })

    const data = await response.json()

    if (response.ok) {
      // Başarılı: Token'ı kaydet ve kilidi kaldır
      localStorage.setItem('kasa_token', data.token)
      isLocked.value = false
      // Parent bileşene haber ver
      window.dispatchEvent(new Event('kasa-unlocked'))
    } else {
      // Hatalı Giriş: Sallanma animasyonunu tetikle
      shouldShake.value = true
      setTimeout(() => { shouldShake.value = false }, 500)
      
      remainingAttempts.value = data.remainingAttempts || 0
      errorMessage.value = data.message || data.error

      if (response.status === 423 && data.lockoutSecondsLeft > 0) {
        startCountdown(data.lockoutSecondsLeft)
      }
    }
  } catch (error) {
    errorMessage.value = 'Sunucuyla bağlantı kurulamadı.'
  } finally {
    isLoading.value = false
  }
}

// Sayfa yüklendiğinde token doğrulaması yap
onMounted(() => {
  const token = localStorage.getItem('kasa_token')
  if (token) {
    // Şimdilik sadece token varlığına güveniyoruz, geçersizse backend API'leri zaten hata döner
    isLocked.value = false
  } else {
    checkKasaStatus()
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
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
  width: 100%;
  max-width: 440px;
  background: rgba(17, 24, 39, 0.7);
  border: 1px solid rgba(139, 92, 246, 0.25);
  box-shadow: 0 0 50px rgba(139, 92, 246, 0.15), inset 0 0 20px rgba(139, 92, 246, 0.05);
  border-radius: 16px;
  padding: 2.5rem;
  backdrop-filter: blur(12px);
}

.lock-header {
  text-align: center;
  margin-bottom: 2rem;
}

.lock-icon-wrapper {
  width: 64px;
  height: 64px;
  background: rgba(139, 92, 246, 0.1);
  border: 1.5px solid rgba(139, 92, 246, 0.4);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto 1rem;
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.2);
}

.lock-svg {
  width: 28px;
  height: 28px;
  color: #a78bfa;
}

.lock-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 2px;
  margin-bottom: 0.5rem;
}

.lock-desc {
  font-size: 0.78rem;
  color: #9ca3af;
  opacity: 0.85;
}

.lock-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.input-group label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #a78bfa;
  letter-spacing: 0.5px;
}

.input-group input {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 0.7rem 1rem;
  color: #fff;
  font-size: 0.85rem;
  outline: none;
  transition: all 0.25s ease;
}

.input-group input:focus {
  border-color: #8b5cf6;
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.3);
  background: rgba(15, 23, 42, 0.8);
}

.error-banner {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
  font-size: 0.78rem;
  padding: 0.6rem 0.85rem;
  border-radius: 6px;
  text-align: center;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.78rem;
}

.status-label {
  color: #9ca3af;
}

.status-chip {
  padding: 0.2rem 0.6rem;
  border-radius: 5px;
  font-size: 0.72rem;
  font-weight: 700;
}

.chip--warning {
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #fbbf24;
}

.chip--danger {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
}

.lockout-banner {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #f87171;
  font-size: 0.82rem;
  padding: 0.8rem;
  border-radius: 8px;
  text-align: center;
  line-height: 1.5;
}

.lockout-banner strong {
  font-size: 1.1rem;
  color: #fff;
  letter-spacing: 1px;
}

.btn-unlock {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #a78bfa, #8b5cf6);
  color: #fff;
  border: none;
  padding: 0.75rem;
  font-size: 0.85rem;
  font-weight: 700;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 4px 15px rgba(139, 92, 246, 0.25);
  margin-top: 0.5rem;
}

.btn-unlock:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);
  background: linear-gradient(135deg, #c4b5fd, #7c3aed);
}

.btn-unlock:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Shake Animation */
.shake-anim {
  animation: shake 0.45s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
}

/* Slide Up Transition */
.slide-up-leave-active {
  transition: all 0.45s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-up-leave-to {
  transform: translateY(-100vh);
  opacity: 0;
}
</style>
