<template>
  <div class="notifications-panel">
    <div class="notifications-header">
      <h3>🔔 Bildirimler & Onay Talepleri</h3>
      <p class="panel-desc">
        {{ isAdminOrCiso ? 'Sistem genelindeki onay bekleyen veya sonuçlanmış talepleri yönetin.' : 'Gönderdiğiniz profil ve sistem değişikliği taleplerinin durumunu takip edin.' }}
      </p>
    </div>

    <!-- Yükleniyor -->
    <div v-if="isLoading" class="loading-state">
      <span class="spinner-sm"></span>
      <p>Talepler yükleniyor...</p>
    </div>

    <!-- Boş Durum -->
    <div v-else-if="approvals.length === 0" class="empty-state">
      <div class="empty-icon">📭</div>
      <h5>Bildirim Bulunmuyor</h5>
      <p>{{ isAdminOrCiso ? 'Şu anda onay bekleyen herhangi bir aktif talep bulunmamaktadır.' : 'Henüz bir onay talebi göndermediniz.' }}</p>
    </div>

    <!-- Bildirim Listesi -->
    <div v-else class="notifications-list">
      <div 
        v-for="req in approvals" 
        :key="req.id" 
        class="notification-card"
        :class="{ 'card--pending': req.status === 'pending', 'card--approved': req.status === 'approved', 'card--rejected': req.status === 'rejected' || req.status === 'expired' }"
      >
        <div class="card-header" style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; width:100%;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span class="type-badge" :class="'type--' + req.type.toLowerCase()">
              {{ getRequestTypeLabel(req.type) }}
            </span>
            <span v-if="unreadIds.includes(req.id)" class="new-alert-dot" style="background:var(--color-success-bg); color:var(--text-primary); font-size:0.6rem; font-weight:800; padding:0.15rem 0.4rem; border-radius:4px; box-shadow:0 0 8px var(--color-success-bg); animation: blink 1s infinite; text-transform:uppercase; letter-spacing:0.5px;">YENİ</span>
          </div>
          <span class="status-badge" :class="'status--' + req.status">
            {{ getStatusLabel(req.status) }}
          </span>
        </div>

        <div class="card-body">
          <p class="req-description">{{ getRequestDescription(req) }}</p>
          <div class="req-meta">
            <span>📅 {{ formatDate(req.createdAt) }}</span>
            <span v-if="req.approvalsRequired > 1" class="approvals-count">
              ✅ Onay Durumu: {{ req.approvalsReceived?.length || 0 }}/{{ req.approvalsRequired }}
            </span>
          </div>

          <!-- Onay Verenler / Detaylar -->
          <div v-if="req.approvalsReceived?.length > 0" class="received-approvals">
            <strong>Onay Verenler:</strong> {{ req.approvalsReceived.join(', ') }}
          </div>
        </div>

        <!-- Aksiyon Butonları (Sadece Admin veya CISO için ve talep beklemedeyse) -->
        <div v-if="isAdminOrCiso && req.status === 'pending' && !isOwnRequest(req)" class="card-actions-wrapper" style="display:flex; flex-direction:column; gap:0.6rem; padding:0.5rem 0.75rem; background:rgba(15,23,42,0.4); border-radius:8px; margin-top:0.75rem; border:1px solid rgba(255,255,255,0.03);">
          
          <!-- Reddetme Butonu (Ortak) -->
          <div style="display:flex; justify-content:flex-end;">
            <button 
              class="btn-action btn-action--reject" 
              :disabled="isProcessing[req.id]"
              @click="handleApprovalAction(req.id, 'reject')"
              style="padding:0.35rem 0.85rem; font-size:0.72rem; border-radius:6px; cursor:pointer;"
            >
              ❌ Talebi Reddet
            </button>
          </div>

          <!-- Onay Seçenekleri -->
          <div v-if="canApprove(req)" style="display:flex; flex-direction:column; gap:0.5rem; border-top:1px dashed rgba(255,255,255,0.06); padding-top:0.5rem;">
            
            <!-- ÇİFT ONAY AÇIKSA veya CISO Profil Talebi ise -->
            <template v-if="doubleApprovalEnabled || req.type === 'NAME_CHANGE' || req.type === 'USERNAME_CHANGE'">
              
              <!-- Arayüz İmzası Eksikse -->
              <div v-if="!(req.approvalsReceived || []).some(s => s.includes('Arayüz'))" style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.02); padding:0.4rem; border-radius:6px;">
                <span style="font-size:0.72rem; color:var(--text-secondary);">🖥️ 1. Aşama: Sistem Arayüzü Onayı</span>
                <button 
                  class="btn-action btn-action--approve" 
                  :disabled="isProcessing[req.id]"
                  @click="handleApprovalAction(req.id, 'approve')"
                  style="padding:0.3rem 0.75rem; font-size:0.7rem; border-radius:4px; font-weight:700;"
                >
                  Arayüzden Onayla
                </button>
              </div>
              <div v-else style="font-size:0.7rem; color:var(--color-success-bg); display:flex; align-items:center; gap:0.25rem; background:rgba(16,185,129,0.05); padding:0.4rem; border-radius:6px;">
                <span>✅ Arayüz Onayı Tamamlandı</span>
              </div>

              <!-- E-posta İmzası Eksikse (OTP Kodu Giriş Alanı) -->
              <div v-if="!(req.approvalsReceived || []).some(s => s.includes('E-posta'))" style="display:flex; flex-direction:column; gap:0.4rem; background:rgba(255,255,255,0.02); padding:0.5rem; border-radius:6px; border:1px solid rgba(139,92,246,0.15);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:0.72rem; color:var(--text-secondary);">📧 2. Aşama: E-posta Onay Kodu</span>
                  <span style="font-size:0.65rem; color:var(--color-accent-bg);">(Kod e-postanıza gönderilmiştir)</span>
                </div>
                <div style="display:flex; gap:0.4rem; align-items:center;">
                  <input 
                    v-model="approvalCodes[req.id]" 
                    type="text" 
                    placeholder="6 Haneli Güvenlik Kodu"
                    maxlength="6"
                    style="flex:1; height:32px; font-size:0.75rem; background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); text-align:center; font-weight:700; outline:none;"
                  />
                  <button 
                    class="btn-action btn-action--approve" 
                    :disabled="isProcessing[req.id] || !approvalCodes[req.id]"
                    @click="handleApprovalAction(req.id, 'approve', approvalCodes[req.id])"
                    style="padding:0.35rem 0.75rem; font-size:0.7rem; border-radius:4px; font-weight:700;"
                  >
                    Kodu Doğrula
                  </button>
                </div>
              </div>
              <div v-else style="font-size:0.7rem; color:var(--color-success-bg); display:flex; align-items:center; gap:0.25rem; background:rgba(16,185,129,0.05); padding:0.4rem; border-radius:6px;">
                <span>✅ E-posta Güvenlik Kodu Doğrulandı</span>
              </div>

            </template>

            <!-- TEK ONAY YETİYORSA (Normal Akış) -->
            <template v-else>
              <div style="display:flex; justify-content:flex-end;">
                <button 
                  class="btn-action btn-action--approve" 
                  :disabled="isProcessing[req.id]"
                  @click="handleApprovalAction(req.id, 'approve')"
                  style="padding:0.4rem 1.2rem; font-size:0.75rem; border-radius:6px; font-weight:700;"
                >
                  {{ isProcessing[req.id] ? 'İşleniyor...' : '✅ Doğrudan Onayla' }}
                </button>
              </div>
            </template>

          </div>
        </div>
        <div v-else-if="isOwnRequest(req) && req.status === 'pending'" class="own-req-badge" style="margin-top:0.75rem;">
          ⏳ Kendi talebiniz (Onay bekleniyor)
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'

const toast = useToast()
const approvals = ref([])
const isLoading = ref(true)
const isProcessing = ref({})
const doubleApprovalEnabled = ref(false)
const approvalCodes = ref({})
const unreadIds = ref([])

const props = defineProps({
  userRole: {
    type: String,
    required: true
  },
  userId: {
    type: [String, Number],
    required: true
  }
})

const emit = defineEmits(['refresh-count'])
const seenApprovals = ref(JSON.parse(localStorage.getItem('seen_approvals') || '[]'))

function isSeen(id) {
  return seenApprovals.value.includes(id)
}

function markAllAsSeen(list) {
  const currentSeen = JSON.parse(localStorage.getItem('seen_approvals') || '[]')
  let changed = false
  list.forEach(req => {
    if (req.status === 'pending' && !currentSeen.includes(req.id)) {
      currentSeen.push(req.id)
      changed = true
    }
  })
  if (changed) {
    localStorage.setItem('seen_approvals', JSON.stringify(currentSeen))
    seenApprovals.value = currentSeen
    emit('refresh-count')
  }
}

const isAdminOrCiso = computed(() => {
  return props.userRole === 'admin' || props.userRole === 'ciso'
})

async function fetchApprovals() {
  isLoading.value = true
  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/auth/approvals', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      const data = await response.json()
      const list = data.approvals || []
      
      const seen = JSON.parse(localStorage.getItem('seen_approvals') || '[]')
      unreadIds.value = list.filter(req => req.status === 'pending' && !seen.includes(req.id)).map(r => r.id)

      approvals.value = list
      doubleApprovalEnabled.value = data.doubleApprovalEnabled || false
      
      // 1.5 saniye sonra okundu yap ve yeni ikonunu kaldır
      setTimeout(() => {
        markAllAsSeen(list)
        unreadIds.value = []
      }, 1500)
    } else {
      toast.error('Talepler yüklenemedi.')
    }
  } catch (error) {
    console.error('[NotificationsPanel] Yükleme hatası:', error)
  } finally {
    isLoading.value = false
  }
}

async function handleApprovalAction(id, action, code = null) {
  isProcessing.value[id] = true
  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/auth/approvals/${id}/${action}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ code })
    })
    const data = await response.json()

    if (response.ok) {
      toast.success(action === 'approve' ? 'Talep onaylandı.' : 'Talep reddedildi.')
      if (approvalCodes.value[id]) {
        approvalCodes.value[id] = ''
      }
      await fetchApprovals()
      // Kasa token'ı güncelleme durumu varsa tetikleyelim
      if (data.token) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('kasa_token', data.token)
        window.dispatchEvent(new Event('kasa-unlocked'))
      }
    } else {
      toast.error(data.error || 'İşlem başarısız oldu.')
    }
  } catch (error) {
    toast.error('İşlem sırasında bağlantı hatası oluştu.')
  } finally {
    isProcessing.value[id] = false
  }
}

function isOwnRequest(req) {
  return req.targetId === props.userId || req.requestData?.requesterId === props.userId
}

function canApprove(req) {
  // Yeni kullanıcı onayını ve silme onayını sadece admin yapabilir, CISO yapamaz
  if (req.type === 'STANDARD_USER_CREATION' || req.type === 'ADMIN_CREATION' || req.type === 'USER_DELETION') {
    return props.userRole === 'admin'
  }
  // İsim ve Kullanıcı adı değişikliklerini sadece CISO onaylayabilir
  if (req.type === 'NAME_CHANGE' || req.type === 'USERNAME_CHANGE') {
    return props.userRole === 'ciso'
  }
  // Mod değişikliğini hem admin hem CISO onaylayabilir
  return true
}

function getRequestTypeLabel(type) {
  const labels = {
    STANDARD_USER_CREATION: '👤 Yeni Standart Kullanıcı',
    ADMIN_CREATION: '🔑 Yeni Yönetici Talebi',
    NAME_CHANGE: '📝 İsim Değişikliği',
    USERNAME_CHANGE: '🛡️ Kullanıcı Adı Değişikliği',
    MODE_CHANGE: '⚙️ Sistem Modu Değişikliği',
    USER_DELETION: '🗑 Kullanıcı Silme Talebi'
  }
  return labels[type] || type
}

function getStatusLabel(status) {
  const labels = {
    pending: 'Beklemede',
    approved: 'Onaylandı',
    rejected: 'Reddedildi',
    expired: 'Süresi Doldu'
  }
  return labels[status] || status
}

function getRequestDescription(req) {
  const d = req.requestData || {}
  if (req.type === 'STANDARD_USER_CREATION') {
    return `Kayıt Başvurusu: ${d.fullName} (@${d.username}) standart kullanıcı olarak sisteme kaydolmak istiyor.`
  }
  if (req.type === 'ADMIN_CREATION') {
    return `Yönetici Başvurusu: ${d.fullName} (@${d.username}) yönetici yetkisi ile kaydolmak istiyor.`
  }
  if (req.type === 'NAME_CHANGE') {
    return `İsim Güncelleme: Eski İsim: "${d.oldFullName}" -> Yeni İsim: "${d.fullName}"`
  }
  if (req.type === 'USERNAME_CHANGE') {
    return `Kullanıcı Adı Güncelleme: Eski: "@${d.oldUsername}" -> Yeni: "@${d.username}"`
  }
  if (req.type === 'MODE_CHANGE') {
    return `Sistem Modu Değişikliği: "${d.mode}" moduna geçiş talep ediliyor.`
  }
  if (req.type === 'USER_DELETION') {
    return `Kullanıcı Silme: "${d.fullName} (@${d.username})" kullanıcısının silinmesi talep ediliyor. (Talebi Başlatan: ${d.requesterName || 'Bilinmiyor'})`
  }
  return 'Detay belirtilmemiş talep.'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  fetchApprovals()
})
</script>

<style scoped>
.notifications-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem;
}

.notifications-header {
  margin-bottom: 0.5rem;
}

.notifications-header h3 {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-primary);
}

.panel-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  text-align: center;
  background: var(--bg-card);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.empty-state h5 {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.empty-state p {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.notifications-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.notification-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: all 0.2s ease;
}

.notification-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.card--pending {
  border-left: 4px solid #f59e0b;
}

.card--approved {
  border-left: 4px solid var(--color-success-bg);
  background: rgba(16, 185, 129, 0.03);
}

.card--rejected {
  border-left: 4px solid var(--color-danger-bg);
  background: rgba(239, 68, 68, 0.03);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.type-badge {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.06);
  padding: 0.25rem 0.55rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.type--standard_user_creation { color: #38bdf8; }
.type--admin_creation { color: #f472b6; }
.type--name_change { color: var(--color-accent-text); }
.type--username_change { color: #fbbf24; }
.type--mode_change { color: var(--color-success); }

.status-badge {
  font-size: 0.68rem;
  font-weight: 800;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  text-transform: uppercase;
}

.status--pending {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.status--approved {
  background: rgba(16, 185, 129, 0.15);
  color: var(--color-success);
}

.status--rejected {
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-danger);
}

.status--expired {
  background: rgba(156, 163, 175, 0.15);
  color: var(--text-secondary);
}

.req-description {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.45;
}

.req-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.received-approvals {
  font-size: 0.72rem;
  background: rgba(15, 23, 42, 0.4);
  padding: 0.45rem 0.65rem;
  border-radius: 6px;
  color: var(--text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.03);
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 0.4rem;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  padding-top: 0.75rem;
}

.btn-action {
  padding: 0.4rem 0.85rem;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-action--reject {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: var(--color-danger);
}

.btn-action--reject:hover:not(:disabled) {
  background: var(--color-danger-bg);
  color: var(--text-primary);
}

.btn-action--approve {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: var(--color-success);
}

.btn-action--approve:hover:not(:disabled) {
  background: var(--color-success-bg);
  color: var(--text-primary);
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.own-req-badge {
  font-size: 0.72rem;
  font-style: italic;
  color: #f59e0b;
  text-align: right;
  margin-top: 0.25rem;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
</style>
