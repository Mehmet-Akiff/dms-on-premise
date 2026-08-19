<template>
  <div class="settings-section-page">
    <div class="section-header">
      <h2>📧 SMTP & Log Yönetimi (CISO)</h2>
      <p class="section-desc">E-posta bildirim sunucusunu yapılandırın ve sistem işlem denetim (audit) loglarını yönetin.</p>
    </div>

    <!-- 1. SMTP Sunucu Yapılandırması -->
    <div class="setting-block">
      <h4>📬 SMTP Sunucu Ayarları</h4>
      <p class="block-desc">Alarm bildirimleri ve güvenlik OTP kodlarının gönderileceği SMTP e-posta sunucusu.</p>
      
      <form @submit.prevent="saveSmtpConfig" class="settings-form">
        <div class="form-grid-2">
          <div class="form-group">
            <label>SMTP Sunucu Adresi (Host)</label>
            <input v-model="smtpHost" type="text" placeholder="smtp.sirketiniz.com" required />
          </div>
          <div class="form-group">
            <label>SMTP Port</label>
            <input v-model.number="smtpPort" type="number" placeholder="587 veya 465" required />
          </div>
          <div class="form-group">
            <label>Gönderici E-posta (Username / From)</label>
            <input v-model="smtpUser" type="email" placeholder="security@dms.com" required />
          </div>
          <div class="form-group">
            <label>SMTP Parolası (Password)</label>
            <input v-model="smtpPass" type="password" placeholder="••••••••" />
          </div>
        </div>

        <div class="form-actions-split">
          <button type="button" class="btn-test" :disabled="isTestingSmtp" @click="testSmtpConnection">
            {{ isTestingSmtp ? 'Test Ediliyor...' : '⚡ Bağlantıyı Test Et' }}
          </button>
          <button type="submit" class="btn-save" :disabled="isSavingSmtp">
            {{ isSavingSmtp ? 'Kaydediliyor...' : '💾 Değişiklikleri Kaydet' }}
          </button>
        </div>
      </form>
    </div>

    <!-- 2. Log Dosyası Yönetimi -->
    <div class="setting-block">
      <h4>📁 Fiziksel Log Dosyası Yönetimi</h4>
      <p class="block-desc">Tüm sistem işlem günlüklerinin yazıldığı disk üzerindeki kalıcı JSONL log dosyasını yönetin.</p>

      <div class="log-status-card">
        <div class="log-status-header">
          <div>
            <span class="log-label">Aktif Log Dosyası (Konteyner İçi):</span>
            <code class="log-path">{{ logFilePath || '/app/uploads/dms-audit.jsonl' }}</code>
            <p class="log-info-note">
              ℹ️ Bu yol Docker konteyneri içindeki dahili yoldur. Dosyayı bilgisayarınıza indirmek için aşağıdaki butonu kullanın.
            </p>
          </div>
          <div class="log-badge-group">
            <span class="log-status-badge" :class="{ 'connected': logFileExists, 'not-found': !logFileExists }">
              {{ logFileExists ? '● BAĞLI' : '● DOSYA BULUNAMADI' }}
            </span>
            <span v-if="logFileSize > 0" class="log-size-text">{{ formatFileSize(logFileSize) }}</span>
          </div>
        </div>

        <div v-if="logFileExists" class="log-card-actions">
          <button type="button" class="btn-download" @click="downloadLogFile">
            📥 Log Dosyasını İndir (.jsonl)
          </button>
          <span class="download-hint">Tüm geçmiş audit logları tek dosya halinde bilgisayarınıza iner.</span>
        </div>

        <div v-if="!logFileExists" class="log-missing-actions">
          <p class="missing-text">⚠️ Log dosyası disk üzerinde bulunamadı! Yeni bir kayıt dosyası oluşturmak ister misiniz?</p>
          <button type="button" class="btn-save" @click="createLogFile">
            ✨ Evet, Yeni Dosya Oluştur
          </button>
        </div>
      </div>

      <!-- Log İçe Aktarma Formu -->
      <form @submit.prevent="importLogFile" class="settings-form" style="margin-top: 1.25rem;">
        <div class="form-group">
          <label>Önceki Log Dosya Yolunu Belirt (İçe Aktar)</label>
          <div style="display: flex; gap: 0.5rem;">
            <input v-model="importFilePath" type="text" placeholder="Örn: /app/uploads/eski-audit.jsonl" required style="flex: 1;" />
            <button type="submit" class="btn-save" :disabled="isImportingLog">
              {{ isImportingLog ? 'İçe Aktarılıyor...' : '📥 Dosyayı Yükle' }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'

const toast = useToast()

const smtpHost = ref('smtp.gmail.com')
const smtpPort = ref(587)
const smtpUser = ref('')
const smtpPass = ref('')
const isSavingSmtp = ref(false)
const isTestingSmtp = ref(false)

const logFileExists = ref(true)
const logFilePath = ref('')
const logFileSize = ref(0)
const importFilePath = ref('')
const isImportingLog = ref(false)

async function fetchSettings() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      const smtp = data.settings?.smtpConfig || {}
      smtpHost.value = smtp.host || 'smtp.gmail.com'
      smtpPort.value = smtp.port || 587
      smtpUser.value = smtp.auth?.user || ''
    }
  } catch {}
}

async function saveSmtpConfig() {
  isSavingSmtp.value = true
  try {
    const token = localStorage.getItem('token')
    const payload = {
      smtpConfig: {
        host: smtpHost.value,
        port: smtpPort.value,
        secure: smtpPort.value === 465,
        auth: {
          user: smtpUser.value,
          pass: smtpPass.value || undefined
        }
      }
    }
    const res = await fetch('/api/auth/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('SMTP sunucu yapılandırması güncellendi. Ayarlar başarıyla kaydedildi. ✅')
      smtpPass.value = ''
    } else {
      toast.error(data.error || 'SMTP ayarları kaydedilemedi.')
    }
  } catch {
    toast.error('Bağlantı hatası.')
  } finally {
    isSavingSmtp.value = false
  }
}

async function testSmtpConnection() {
  isTestingSmtp.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ email: smtpUser.value || 'test@dms.local' })
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('SMTP bağlantısı ve e-posta gönderimi başarılı! ✅')
    } else {
      toast.error(data.error || 'SMTP testi başarısız oldu.')
    }
  } catch {
    toast.error('SMTP test bağlantı hatası.')
  } finally {
    isTestingSmtp.value = false
  }
}

async function checkLogFileStatus() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/log-file-status', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      logFileExists.value = data.exists
      logFilePath.value = data.path
      logFileSize.value = data.fileSize || 0
    }
  } catch {}
}

async function downloadLogFile() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/log-file-download', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) {
      toast.error('Log dosyası indirilemedi.')
      return
    }
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dms-audit.jsonl'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success('Log dosyası indirildi.')
  } catch {
    toast.error('İndirme hatası.')
  }
}

async function createLogFile() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/create-log-file', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      toast.success('Yeni log dosyası oluşturuldu. ✅')
      await checkLogFileStatus()
    } else {
      toast.error('Dosya oluşturulamadı.')
    }
  } catch {
    toast.error('Hata oluştu.')
  }
}

async function importLogFile() {
  isImportingLog.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/auth/import-log-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ filePath: importFilePath.value })
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(data.message || 'Log dosyası başarıyla içe aktarıldı. ✅')
      importFilePath.value = ''
      await checkLogFileStatus()
    } else {
      toast.error(data.error || 'İçe aktarma başarısız.')
    }
  } catch {
    toast.error('Bağlantı hatası.')
  } finally {
    isImportingLog.value = false
  }
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i]
}

onMounted(() => {
  fetchSettings()
  checkLogFileStatus()
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
.form-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
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
.form-actions-split {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.25rem;
}
.btn-test {
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: #a78bfa;
  padding: 0.55rem 1.1rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-test:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.25);
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
.log-status-card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 1.25rem;
}
.log-status-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}
.log-label {
  display: block;
  font-size: 0.78rem;
  color: var(--text-secondary, #94a3b8);
  margin-bottom: 0.25rem;
}
.log-path {
  font-size: 0.78rem;
  color: #10b981;
  font-weight: 700;
  background: rgba(16, 185, 129, 0.1);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}
.log-info-note {
  margin: 0.5rem 0 0 0;
  font-size: 0.7rem;
  color: #64748b;
  line-height: 1.4;
}
.log-badge-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
}
.log-status-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
}
.log-status-badge.connected {
  background: #065f46;
  color: #34d399;
}
.log-status-badge.not-found {
  background: #991b1b;
  color: #f87171;
}
.log-size-text {
  font-size: 0.68rem;
  color: #94a3b8;
}
.log-card-actions {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px dashed rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.btn-download {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
  padding: 0.45rem 0.9rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-download:hover {
  background: rgba(16, 185, 129, 0.25);
}
.download-hint {
  font-size: 0.7rem;
  color: #64748b;
}
.log-missing-actions {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px dashed rgba(255, 255, 255, 0.08);
}
.missing-text {
  font-size: 0.75rem;
  color: #ef4444;
  margin: 0 0 0.5rem 0;
}
@media (max-width: 768px) {
  .form-grid-2 {
    grid-template-columns: 1fr;
  }
}
</style>
