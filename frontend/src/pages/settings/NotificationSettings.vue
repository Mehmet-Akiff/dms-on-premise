<template>
  <div class="settings-section-page">
    <div class="section-header">
      <h2>🚨 Alarm & Yetkilendirme Ayarları</h2>
      <p class="section-desc">Brute-force kilit alarmlarını ve kritik işlemler için çoklu yönetici mutabakatını yapılandırın.</p>
    </div>

    <!-- 1. Yetkisiz Erişim Alarmı -->
    <div class="setting-block">
      <h4>⚠️ Yetkisiz Erişim & Brute-Force Alarmı</h4>
      <p class="block-desc">Belirlenen sayıda ardışık hatalı giriş denemesinde CISO ve yöneticilere acil e-posta alarmı gönderilir.</p>
      
      <form @submit.prevent="saveAlarmSettings" class="settings-form">
        <div class="form-row">
          <div class="form-group flex-1">
            <label>Hatalı Giriş Alarm Eşiği</label>
            <select v-model="alertThreshold" class="form-select">
              <option :value="2">2 Hatalı Deneme (Yüksek Hassasiyet)</option>
              <option :value="3">3 Hatalı Deneme (Varsayılan)</option>
              <option :value="5">5 Hatalı Deneme</option>
              <option :value="10">10 Hatalı Deneme (Düşük Hassasiyet)</option>
            </select>
          </div>
          <div class="form-group flex-1">
            <label>Alarm Bildirim E-postası</label>
            <input v-model="alertEmail" type="email" placeholder="ciso-alarm@sirketiniz.com" />
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-save" :disabled="isSavingAlarm">
            {{ isSavingAlarm ? 'Kaydediliyor...' : '💾 Değişiklikleri Kaydet' }}
          </button>
        </div>
      </form>
    </div>

    <!-- 2. Çift Onay Yetkilendirmesi -->
    <div class="setting-block">
      <h4>🛡️ Çift Onay Yetkilendirmesi (Dual Authorization)</h4>
      <p class="block-desc">
        Kritik işlemler (yeni kullanıcı kaydı, profil güncellemeleri, sistem modu değişimi) için hem web arayüzü onayı hem de 6 haneli e-posta güvenlik kodu gerektirir.
      </p>

      <div class="double-approval-box">
        <label class="double-approval-label">
          <input 
            type="checkbox" 
            v-model="doubleApprovalEnabled" 
            :disabled="currentUserRole === 'ciso'"
            class="toggle-checkbox"
          />
          <div class="toggle-text">
            <span class="toggle-title">Çift Onay Protokolünü Aktif Et</span>
            <span class="toggle-sub">
              {{ currentUserRole === 'ciso' ? 'CISO profilinde çift onay güvenlik politikası gereği zorunludur ve kapatılamaz.' : 'Tüm onay talepleri için E-posta OTP + Web Arayüzü onayı zorunlu olur.' }}
            </span>
          </div>
        </label>
      </div>

      <div class="form-actions" style="margin-top: 1rem;">
        <button 
          type="button" 
          class="btn-save" 
          :disabled="isSavingDoubleApproval || currentUserRole === 'ciso'"
          @click="saveDoubleApproval"
        >
          {{ isSavingDoubleApproval ? 'Kaydediliyor...' : '💾 Değişiklikleri Kaydet' }}
        </button>
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

const currentUserRole = computed(() => parseJwt().role || 'user')

const alertThreshold = ref(3)
const alertEmail = ref('')
const isSavingAlarm = ref(false)

const doubleApprovalEnabled = ref(false)
const isSavingDoubleApproval = ref(false)

async function fetchSettings() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      if (data.settings?.failedLoginThreshold) {
        alertThreshold.value = data.settings.failedLoginThreshold
      }
      if (data.settings?.alertEmail) {
        alertEmail.value = data.settings.alertEmail
      }
      doubleApprovalEnabled.value = data.settings?.doubleApprovalEnabled || false
    }
  } catch {}
}

async function saveAlarmSettings() {
  isSavingAlarm.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        failedLoginThreshold: alertThreshold.value,
        alertEmail: alertEmail.value
      })
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('Yetkisiz erişim alarm ayarları güncellendi. Ayarlar başarıyla kaydedildi. ✅')
    } else {
      toast.error(data.error || 'Ayarlar kaydedilemedi.')
    }
  } catch {
    toast.error('Bağlantı hatası.')
  } finally {
    isSavingAlarm.value = false
  }
}

async function saveDoubleApproval() {
  isSavingDoubleApproval.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        doubleApprovalEnabled: doubleApprovalEnabled.value
      })
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(`Çift onay protokolü ${doubleApprovalEnabled.value ? 'aktif edildi' : 'devre dışı bırakıldı'}. Ayarlar kaydedildi. ✅`)
    } else {
      toast.error(data.error || 'Çift onay ayarı kaydedilemedi.')
    }
  } catch {
    toast.error('Bağlantı hatası.')
  } finally {
    isSavingDoubleApproval.value = false
  }
}

onMounted(() => {
  fetchSettings()
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
.form-group input, .form-select {
  width: 100%;
  padding: 0.55rem 0.75rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  border-radius: 6px;
  color: var(--text-primary, #f8fafc);
  font-size: 0.82rem;
  box-sizing: border-box;
}
.double-approval-box {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 1rem;
}
.double-approval-label {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  cursor: pointer;
}
.toggle-checkbox {
  width: 18px;
  height: 18px;
  margin-top: 0.15rem;
  accent-color: #818cf8;
  cursor: pointer;
}
.toggle-text {
  display: flex;
  flex-direction: column;
}
.toggle-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary, #f8fafc);
}
.toggle-sub {
  font-size: 0.72rem;
  color: var(--text-secondary, #94a3b8);
  margin-top: 0.2rem;
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
