<template>
  <div class="settings-drawer-wrapper" :class="{ 'drawer-open': isOpen }">
    <div class="drawer-overlay" @click="closeDrawer"></div>
    <div class="settings-drawer">
      <!-- Header -->
      <div class="drawer-header">
        <div class="header-title">
          <span>⚙️</span>
          <h3>Kasa Ayarları</h3>
        </div>
        <button class="btn-close-drawer" @click="closeDrawer">✕</button>
      </div>

      <!-- Scrollable Content -->
      <div class="drawer-body">
        <!-- 1. KASA KIMLIK BILGILERI -->
        <div class="settings-section">
          <h4>🔐 Kasa Kimlik Bilgileri</h4>
          <p class="section-desc">Kasa kilidini açmak için kullanılan yönetici adı ve şifresini güncelleyin.</p>
          
          <form @submit.prevent="updateKasaCredentials" class="settings-form">
            <div class="form-group">
              <label>Kullanıcı Adı</label>
              <input v-model="kasaUsername" type="text" placeholder="admin" required />
            </div>
            <div class="form-group">
              <label>Yeni Şifre</label>
              <input v-model="kasaNewPassword" type="password" placeholder="Yeni şifre girin..." />
            </div>
            <button type="submit" class="btn-settings-save" :disabled="isSavingCreds">
              {{ isSavingCreds ? 'Kaydediliyor...' : 'Kimliği Güncelle' }}
            </button>
          </form>
        </div>

        <hr class="section-divider" />

        <!-- 2. E-POSTA BILDIRIM AYARLARI -->
        <div class="settings-section">
          <h4>📧 Yetkisiz Erişim Alarmı</h4>
          <p class="section-desc">Ardışık hatalı denemelerde güvenlik uyarısı gönderilecek doğrulanmış e-postayı ayarlayın.</p>

          <!-- Alarm Eşiği -->
          <div class="form-group" style="margin-bottom:1rem">
            <label>Hatalı Deneme Limiti (Alarm Eşiği)</label>
            <div class="threshold-selector">
              <select v-model="alertThreshold" @change="updateThreshold">
                <option :value="2">2 Deneme</option>
                <option :value="3">3 Deneme (Varsayılan)</option>
                <option :value="5">5 Deneme</option>
                <option :value="10">10 Deneme</option>
              </select>
            </div>
          </div>

          <div class="verification-status-box" :class="isEmailVerified ? 'status--verified' : 'status--unverified'">
            <span class="status-dot"></span>
            <strong>{{ isEmailVerified ? 'E-posta Doğrulandı' : 'E-posta Doğrulanmadı' }}</strong>
            <p v-if="verifiedEmail && isEmailVerified" class="status-detail">Doğrulanmış Alıcı: {{ verifiedEmail }}</p>
          </div>

          <form @submit.prevent="sendVerificationCode" class="settings-form" style="margin-top:1rem">
            <div class="form-group">
              <label>Bildirim E-posta Adresi</label>
              <div class="email-input-group">
                <input 
                  v-model="alertEmail" 
                  type="email" 
                  placeholder="orn: guvenlik@sirket.com" 
                  required 
                  :disabled="isVerifying"
                />
                <button type="submit" class="btn-send-code" :disabled="isSendingCode || isVerifying">
                  {{ isSendingCode ? '...' : 'Kod Gönder' }}
                </button>
              </div>
            </div>
          </form>

          <!-- OTP DOĞRULAMA ALANI -->
          <Transition name="fade-slide">
            <div v-if="isVerifying" class="otp-verification-section">
              <div class="otp-header">
                <h5>Doğrulama Kodunu Girin</h5>
                <p><strong>{{ alertEmail }}</strong> adresine 6 haneli bir doğrulama kodu gönderildi. (Geri sayım: {{ formatCountdown(otpCountdown) }})</p>
              </div>

              <!-- OTP Kod Girişi (6 Kutu) -->
              <div class="otp-input-container">
                <input 
                  v-for="(digit, idx) in otpDigits" 
                  :key="idx"
                  :id="'otp-' + idx"
                  v-model="otpDigits[idx]"
                  type="text"
                  maxLength="1"
                  class="otp-digit-input"
                  @input="handleOtpInput($event, idx)"
                  @keydown.delete="handleOtpDelete($event, idx)"
                />
              </div>

              <div v-if="otpError" class="otp-error-message">
                {{ otpError }}
              </div>

              <div class="otp-actions">
                <button class="btn-otp-cancel" @click="cancelVerification">Vazgeç</button>
                <button class="btn-otp-verify" @click="verifyCode" :disabled="isCheckingCode">
                  {{ isCheckingCode ? 'Doğrulanıyor...' : 'Kodu Doğrula' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <hr class="section-divider" />

        <!-- 3. SMTP GÖNDERİCİ AYARLARI -->
        <div class="settings-section">
          <h4>📨 SMTP Gönderici Ayarları</h4>
          <p class="section-desc">E-postaların gönderileceği Gmail veya SMTP sunucu bilgilerini girin. Gmail için "Google Uygulama Şifresi" girilmelidir.</p>
          
          <form @submit.prevent="updateSmtpConfig" class="settings-form">
            <div class="form-group">
              <label>SMTP Sunucu Adresi</label>
              <input v-model="smtpHost" type="text" placeholder="smtp.gmail.com" required />
            </div>
            
            <div class="form-row-custom">
              <div class="form-group custom-flex-1">
                <label>Port</label>
                <input v-model="smtpPort" type="number" placeholder="465" required />
              </div>
              <div class="form-group custom-flex-1 checkbox-flex">
                <label class="smtp-checkbox-label">
                  <input type="checkbox" v-model="smtpSecure" />
                  <span>SSL/TLS Güvenli</span>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label>Gönderici E-posta (User)</label>
              <input v-model="smtpUser" type="email" placeholder="security@gmail.com" required />
            </div>

            <div class="form-group">
              <label>Google Uygulama Şifresi (Pass)</label>
              <input v-model="smtpPass" type="password" placeholder="16 haneli uygulama şifresi..." />
            </div>

            <button type="submit" class="btn-settings-save" :disabled="isSavingSmtp">
              {{ isSavingSmtp ? 'Kaydediliyor...' : 'SMTP Ayarlarını Kaydet' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const kasaUsername = ref('')
const kasaNewPassword = ref('')
const alertEmail = ref('')
const verifiedEmail = ref('')
const alertThreshold = ref(3)
const isEmailVerified = ref(false)

const smtpHost = ref('smtp.gmail.com')
const smtpPort = ref(465)
const smtpSecure = ref(true)
const smtpUser = ref('security@gmail.com')
const smtpPass = ref('')

const isSavingCreds = ref(false)
const isSendingCode = ref(false)
const isVerifying = ref(false)
const isCheckingCode = ref(false)
const isSavingSmtp = ref(false)

const otpDigits = ref(['', '', '', '', '', ''])
const otpError = ref('')
const otpCountdown = ref(300) // 5 dakika
let countdownTimer = null

// Ayarları Çek
async function fetchSettings() {
  try {
    const response = await fetch('/api/auth/settings', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('kasa_token')}`
      }
    })
    if (response.ok) {
      const data = await response.json()
      kasaUsername.value = data.settings.masterUsername
      alertEmail.value = data.settings.alertEmail || ''
      verifiedEmail.value = data.settings.verifiedAlertEmail || ''
      alertThreshold.value = data.settings.alertThreshold || 3
      isEmailVerified.value = data.settings.isEmailVerified || false

      // SMTP Ayarlarını yükle
      if (data.settings.smtpConfig) {
        smtpHost.value = data.settings.smtpConfig.host || 'smtp.gmail.com'
        smtpPort.value = data.settings.smtpConfig.port || 465
        smtpSecure.value = data.settings.smtpConfig.secure !== undefined ? data.settings.smtpConfig.secure : true
        smtpUser.value = data.settings.smtpConfig.auth?.user || 'security@gmail.com'
        smtpPass.value = data.settings.smtpConfig.auth?.pass || ''
      }
    }
  } catch (error) {
    console.error('[Settings] Ayar çekme hatası:', error)
  }
}

// Eşik Ayarını Güncelle
async function updateThreshold() {
  try {
    await fetch('/api/auth/settings', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('kasa_token')}`
      },
      body: JSON.stringify({ alertThreshold: alertThreshold.value })
    })
  } catch (error) {
    console.error('[Settings] Eşik güncelleme hatası:', error)
  }
}

// Kimlik Bilgilerini Güncelle
async function updateKasaCredentials() {
  isSavingCreds.value = true
  try {
    const response = await fetch('/api/auth/settings', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('kasa_token')}`
      },
      body: JSON.stringify({
        masterUsername: kasaUsername.value,
        newPassword: kasaNewPassword.value ? kasaNewPassword.value : undefined
      })
    })

    if (response.ok) {
      kasaNewPassword.value = ''
      alert('Kasa yönetici kimlik bilgileri başarıyla güncellendi!')
    }
  } catch (error) {
    console.error('[Settings] Kimlik güncelleme hatası:', error)
  } finally {
    isSavingCreds.value = false
  }
}

// SMTP Ayarlarını Güncelle
async function updateSmtpConfig() {
  isSavingSmtp.value = true
  try {
    const response = await fetch('/api/auth/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('kasa_token')}`
      },
      body: JSON.stringify({
        smtpConfig: {
          host: smtpHost.value,
          port: smtpPort.value,
          secure: smtpSecure.value,
          auth: {
            user: smtpUser.value,
            pass: smtpPass.value
          }
        }
      })
    })

    if (response.ok) {
      alert('SMTP Gönderici Ayarları başarıyla kaydedildi!')
      fetchSettings() // Maskeli halini tekrar çek
    }
  } catch (error) {
    console.error('[Settings] SMTP güncelleme hatası:', error)
  } finally {
    isSavingSmtp.value = false
  }
}

// Doğrulama Kodu Gönder
async function sendVerificationCode() {
  if (!alertEmail.value) return
  isSendingCode.value = true

  try {
    const response = await fetch('/api/auth/send-verification', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('kasa_token')}`
      },
      body: JSON.stringify({ email: alertEmail.value })
    })

    if (response.ok) {
      isVerifying.value = true
      otpDigits.value = ['', '', '', '', '', '']
      otpError.value = ''
      startCountdown()
    }
  } catch (error) {
    console.error('[Settings] Kod gönderme hatası:', error)
  } finally {
    isSendingCode.value = false
  }
}

// Doğrulama Kodunu Gönder
async function verifyCode() {
  const code = otpDigits.value.join('')
  if (code.length !== 6) {
    otpError.value = 'Lütfen 6 haneli kodun tamamını girin.'
    return
  }

  isCheckingCode.value = true
  otpError.value = ''

  try {
    const response = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('kasa_token')}`
      },
      body: JSON.stringify({ code })
    })

    const data = await response.json()

    if (response.ok) {
      isEmailVerified.value = true
      verifiedEmail.value = data.verifiedAlertEmail
      isVerifying.value = false
      stopCountdown()
      alert('E-posta adresi başarıyla doğrulandı ve alarma bağlandı!');
      fetchSettings(); // Ayarları tekrar yenile
    } else {
      otpError.value = data.error || 'Geçersiz doğrulama kodu.'
    }
  } catch (error) {
    otpError.value = 'Doğrulama sırasında hata oluştu.'
  } finally {
    isCheckingCode.value = false
  }
}

// OTP Kutu Yönetimleri (Word Tarzı Akıcı OTP Girişi)
function handleOtpInput(event, index) {
  const value = event.target.value
  if (!/^[0-9]$/.test(value)) {
    otpDigits.value[index] = ''
    return
  }

  // Sonraki kutuya geç
  if (index < 5 && value) {
    const nextInput = document.getElementById(`otp-${index + 1}`)
    if (nextInput) nextInput.focus()
  }
}

function handleOtpDelete(event, index) {
  // Geri silmede önceki kutuya geç
  if (index > 0 && !otpDigits.value[index]) {
    otpDigits.value[index - 1] = ''
    const prevInput = document.getElementById(`otp-${index - 1}`)
    if (prevInput) prevInput.focus()
  }
}

// Sayaç Fonksiyonları
function startCountdown() {
  otpCountdown.value = 300
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    otpCountdown.value--
    if (otpCountdown.value <= 0) {
      cancelVerification()
    }
  }, 1000)
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function formatCountdown(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function cancelVerification() {
  isVerifying.value = false
  stopCountdown()
  otpDigits.value = ['', '', '', '', '', '']
  otpError.value = ''
  fetchSettings()
}

function closeDrawer() {
  emit('close')
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    fetchSettings()
  } else {
    cancelVerification()
  }
})

onMounted(() => {
  if (props.isOpen) fetchSettings()
})

onUnmounted(() => {
  stopCountdown()
})
</script>

<style scoped>
.settings-drawer-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
}

.settings-drawer-wrapper.drawer-open {
  pointer-events: auto;
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
  pointer-events: none;
}

.drawer-open .drawer-overlay {
  opacity: 1;
  pointer-events: auto;
}

.settings-drawer {
  position: absolute;
  top: 0;
  right: -420px;
  width: 100%;
  max-width: 400px;
  height: 100%;
  background: rgba(17, 24, 39, 0.92);
  border-left: 1px solid rgba(139, 92, 246, 0.2);
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5), -5px 0 15px rgba(139, 92, 246, 0.05);
  display: flex;
  flex-direction: column;
  transition: right 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  backdrop-filter: blur(16px);
}

.drawer-open .settings-drawer {
  right: 0;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.header-title span {
  font-size: 1.25rem;
}

.header-title h3 {
  font-size: 1.05rem;
  font-weight: 700;
  color: #fff;
}

.btn-close-drawer {
  background: transparent;
  border: none;
  color: #9ca3af;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.btn-close-drawer:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

.drawer-body {
  flex-grow: 1;
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.settings-section h4 {
  font-size: 0.9rem;
  font-weight: 700;
  color: #a78bfa;
}

.section-desc {
  font-size: 0.74rem;
  color: #9ca3af;
  line-height: 1.4;
  margin-bottom: 0.5rem;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-group label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #9ca3af;
}

.form-group input, .threshold-selector select {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 0.55rem 0.85rem;
  color: #fff;
  font-size: 0.8rem;
  outline: none;
  width: 100%;
}

.form-group input:focus, .threshold-selector select:focus {
  border-color: #8b5cf6;
  background: rgba(15, 23, 42, 0.8);
}

.threshold-selector select {
  cursor: pointer;
}

.email-input-group {
  display: flex;
  gap: 0.5rem;
}

.btn-send-code {
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.3);
  color: #a78bfa;
  padding: 0.5rem 1rem;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-send-code:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.2);
  border-color: #a78bfa;
}

.btn-settings-save {
  background: linear-gradient(135deg, #a78bfa, #8b5cf6);
  color: #fff;
  border: none;
  padding: 0.6rem;
  font-size: 0.78rem;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(139, 92, 246, 0.15);
  transition: all 0.2s ease;
}

.btn-settings-save:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 15px rgba(139, 92, 246, 0.25);
}

.section-divider {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  margin: 0.25rem 0;
}

/* Doğrulama Durumu Kutusu */
.verification-status-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  border-radius: 6px;
  font-size: 0.75rem;
  flex-wrap: wrap;
}

.verification-status-box.status--verified {
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.verification-status-box.status--unverified {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-detail {
  width: 100%;
  margin: 0.25rem 0 0 0;
  font-size: 0.7rem;
  opacity: 0.8;
}

/* OTP Alanı */
.otp-verification-section {
  background: rgba(139, 92, 246, 0.03);
  border: 1px dashed rgba(139, 92, 246, 0.25);
  border-radius: 10px;
  padding: 1.25rem;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.otp-header h5 {
  font-size: 0.82rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 0.25rem;
}

.otp-header p {
  font-size: 0.7rem;
  color: #9ca3af;
  line-height: 1.4;
}

.otp-input-container {
  display: flex;
  justify-content: space-between;
  gap: 0.4rem;
}

.otp-digit-input {
  width: 42px;
  height: 42px;
  background: rgba(15, 23, 42, 0.7);
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  text-align: center;
  color: #fff;
  font-size: 1.1rem;
  font-weight: 700;
  outline: none;
  transition: all 0.25s ease;
}

.otp-digit-input:focus {
  border-color: #8b5cf6;
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.25);
}

.otp-error-message {
  color: #f87171;
  font-size: 0.72rem;
  text-align: center;
}

.otp-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.btn-otp-cancel {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #9ca3af;
  padding: 0.4rem 0.85rem;
  font-size: 0.74rem;
  border-radius: 6px;
  cursor: pointer;
}

.btn-otp-cancel:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.btn-otp-verify {
  background: #8b5cf6;
  color: #fff;
  border: none;
  padding: 0.4rem 1.1rem;
  font-size: 0.74rem;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(139, 92, 246, 0.2);
}

.btn-otp-verify:hover:not(:disabled) {
  background: #7c3aed;
}

.btn-otp-verify:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Custom SMTP Layout */
.form-row-custom {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.custom-flex-1 {
  flex: 1;
  min-width: 0;
}

.checkbox-flex {
  justify-content: center;
  padding-bottom: 0.6rem;
}

.smtp-checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.74rem;
  color: #9ca3af;
  cursor: pointer;
  user-select: none;
}

.smtp-checkbox-label input {
  accent-color: #8b5cf6;
  cursor: pointer;
}

/* Transitions */
.fade-slide-enter-active, .fade-slide-leave-active {
  transition: all 0.3s ease;
}
.fade-slide-enter-from, .fade-slide-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
