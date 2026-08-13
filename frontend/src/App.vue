<template>
  <div id="dms-app" :class="{ 'app-unlocked': !isKasaLocked }">
    <!-- Kasa Kilit Ekranı (Overlay) -->
    <KasaLock v-if="isKasaLocked" />

    <template v-else>
      <!-- Header -->
      <header class="dms-header">
        <div class="header-inner">
          <div class="logo">
            <span class="logo-icon">🔒</span>
            <h1>DMS</h1>
            <span class="badge">On-Premise</span>
          </div>
          <p class="subtitle">{{ $t('nav.subtitle') || 'Yapay Zeka Destekli Akıllı Doküman Yönetim Sistemi' }}</p>
        </div>
        <div class="header-actions" style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; justify-content:flex-end;">
          <!-- Rol ve İsim Gösterimi -->
          <div v-if="currentUserRole" class="user-role-badge-wrap" style="display: flex; align-items: center; gap: 0.5rem; margin-right: 0.5rem;">
            <span :class="['role-badge', 'role-badge--' + currentUserRole]">
              {{ getRoleLabel(currentUserRole) }}
            </span>
              <span class="header-username" style="font-size: 0.8rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: 6px;">{{ formatFullName(currentUserFullName) }}</span>
          </div>

          <!-- Arama Destekli Dünya Dilleri Menüsü -->
          <NativeLangSelector />

          <button class="btn-settings-toggle" @click="isChatOpen = true" title="Kurum İçi Mesajlar">
            💬 Mesajlar
          </button>

          <button class="btn-theme-toggle" @click="onToggleTheme" :title="currentTheme === 'dark' ? 'Açık Tema' : 'Koyu Tema'">
            {{ currentTheme === 'dark' ? '☀️' : '🌙' }}
          </button>

          <button v-if="isCiso" class="btn-audit-toggle" @click="isAuditLogOpen = true" :title="$t('nav.auditLogs')">
            📜 {{ $t('nav.auditLogs') }}
          </button>
          <button class="btn-settings-toggle" @click="isNotificationsOpen = true" :title="$t('nav.notifications')" style="position:relative;">
            🔔 {{ $t('nav.notifications') }}
            <span v-if="pendingApprovalsCount > 0" class="notif-badge" style="position:absolute; top:-5px; right:-5px; background:#ef4444; color:#fff; font-size:0.65rem; font-weight:800; padding:0.15rem 0.35rem; border-radius:999px; border:2px solid var(--bg-secondary); min-width:18px; text-align:center; box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);">
              {{ pendingApprovalsCount }}
            </span>
          </button>
          <button v-if="currentUserRole === 'admin' || currentUserRole === 'ciso'" class="btn-settings-toggle" @click="isUsersModalOpen = true" :title="$t('nav.users')">
            👥 {{ $t('nav.users') }}
          </button>
          <button class="btn-settings-toggle" @click="isSettingsOpen = true" :title="$t('nav.settings')">
            ⚙️ {{ $t('nav.settings') }}
          </button>
          <button class="btn-lock-toggle" @click="promptLockKasa" :title="$t('nav.logout')">
            🚪 {{ $t('nav.logout') }}
          </button>
          <div class="header-status">
            <span class="status-indicator status-indicator--online"></span>
            <span class="status-text">{{ $t('nav.systemActive') }}</span>
          </div>
        </div>
      </header>

      <!-- E-posta Çakışma Alarmı -->
      <div v-if="hasDuplicateEmailWarning" class="email-collision-alert">
        <span class="alert-icon">⚠️</span>
        <div class="alert-text">
          <strong>{{ $t('nav.emailCollisionWarning') || 'KRİTİK GÜVENLİK UYARISI:' }}</strong> {{ $t('nav.emailCollisionMsg') || 'E-posta adresiniz sistemdeki başka bir hesapla çakışıyor! Lütfen güvenlik nedeniyle e-posta adresinizi Kasa Ayarları\'ndan acilen güncelleyin veya sistem yöneticinizle görüşün.' }}
        </div>
      </div>

      <!-- Ana İçerik -->
      <main class="dms-main">
        <!-- Sol Panel: Dosya Yükleme -->
        <section class="panel panel--upload">
          <h3 class="panel-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {{ $t('upload.title') || 'Doküman Yükle' }}
          </h3>
          <FileUpload @uploaded="onDocumentUploaded" />
          <div class="panel-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            {{ $t('upload.privacyNotice') || 'Tüm dosyalar yerel sunucuda güvenle işlenir. Veri dışarı çıkmaz.' }}
          </div>
        </section>

        <!-- Sağ Panel: Dashboard + Arama + Doküman Listesi -->
        <section class="panel panel--list">
          <Dashboard ref="dashboardRef" @stat-click="onStatClick" />
          <SearchBar @results="onSearchResults" @clear="onSearchClear" @loading="onSearchLoading" />
          <DocumentList ref="documentListRef" />
        </section>
      </main>

      <!-- CISO Audit Log Modalı -->
      <div v-if="isAuditLogOpen" class="audit-log-modal-overlay" @click.self="isAuditLogOpen = false">
        <div class="audit-log-modal-content">
          <div class="modal-close-header">
            <h3>📜 {{ $t('nav.auditLogsTitle') || 'Sistem Günlükleri (CISO Yetkili Alanı)' }}</h3>
            <button class="btn-close-modal" @click="isAuditLogOpen = false">✖ {{ $t('common.close') || 'Kapat' }}</button>
          </div>
          <div class="modal-body-scroll">
            <AuditLog />
          </div>
        </div>
      </div>

      <!-- Bildirimler & Onay Talepleri Modalı -->
      <div v-if="isNotificationsOpen" class="audit-log-modal-overlay" @click.self="isNotificationsOpen = false">
        <div class="audit-log-modal-content" style="max-width: 650px;">
          <div class="modal-close-header">
            <h3>🔔 {{ $t('nav.notificationsTitle') || 'Bildirimler ve Onay Talepleri' }}</h3>
            <button class="btn-close-modal" @click="isNotificationsOpen = false">✖ {{ $t('common.close') || 'Kapat' }}</button>
          </div>
          <div class="modal-body-scroll" style="padding: 1.25rem;">
            <NotificationsPanel 
              :userRole="currentUserRole" 
              :userId="currentUserId" 
              @refresh-count="fetchPendingApprovalsCount"
            />
          </div>
        </div>
      </div>

      <!-- Kullanıcı Listesi Modalı -->
      <div v-if="isUsersModalOpen" class="audit-log-modal-overlay" @click.self="isUsersModalOpen = false">
        <div class="audit-log-modal-content" style="max-width: 800px;">
          <div class="modal-close-header">
            <h3>👥 {{ $t('nav.usersTitle') || 'Sistem Kullanıcıları & Oturum Bilgileri' }}</h3>
            <button class="btn-close-modal" @click="isUsersModalOpen = false">✖ {{ $t('common.close') || 'Kapat' }}</button>
          </div>
          <div class="modal-body-scroll" style="padding: 1.25rem;">
            <UsersPanel :userRole="currentUserRole" />
          </div>
        </div>
      </div>

      <!-- Çıkış Onay Modalı -->
      <div v-if="isLogoutConfirmOpen" class="logout-confirm-overlay" @click.self="isLogoutConfirmOpen = false">
        <div class="logout-confirm-card">
          <h4>🚪 {{ $t('nav.logoutConfirmTitle') || 'Güvenli Çıkış Onayı' }}</h4>
          <p>{{ $t('nav.logoutConfirmMsg') || 'Sistemi kilitlemek ve oturumu sonlandırmak istediğinizden emin misiniz?' }}</p>
          <div class="confirm-actions" style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:1.2rem;">
            <button class="btn-confirm-cancel" @click="isLogoutConfirmOpen = false">{{ $t('common.cancel') || 'Vazgeç' }}</button>
            <button 
              class="btn-confirm-logout" 
              :disabled="logoutConfirmTimer > 0"
              @click="confirmLockKasa"
            >
              {{ logoutConfirmTimer > 0 ? `${$t('nav.confirmLogout') || 'Evet, Çıkış Yap'} (${logoutConfirmTimer}s)` : ($t('nav.confirmLogout') || 'Evet, Çıkış Yap') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="dms-footer">
        <p>{{ $t('nav.footerText') || '© 2026 DMS On-Premise — Tüm veriler yerel sunucuda işlenmektedir.' }}</p>
      </footer>

      <!-- Ayarlar Paneli (Drawer) -->
      <SettingsPanel :isOpen="isSettingsOpen" @close="isSettingsOpen = false" />

      <!-- Sohbet Paneli (Drawer) -->
      <IntranetChat :isOpen="isChatOpen" @close="isChatOpen = false" />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTheme, toggleTheme, initTheme } from './utils/ThemeProvider'
import FileUpload from './components/FileUpload.vue'
import DocumentList from './components/DocumentList.vue'
import SearchBar from './components/SearchBar.vue'
import KasaLock from './components/KasaLock.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import NotificationsPanel from './components/NotificationsPanel.vue'
import UsersPanel from './components/UsersPanel.vue'
import Dashboard from './components/Dashboard.vue'
import AuditLog from './components/AuditLog.vue'
import NativeLangSelector from './components/NativeLangSelector.vue'
import IntranetChat from './components/chat/IntranetChat.vue'

const documentListRef = ref(null)
const dashboardRef = ref(null)
const isSettingsOpen = ref(false)
const isAuditLogOpen = ref(false)
const isUsersModalOpen = ref(false)
const isNotificationsOpen = ref(false)
const isChatOpen = ref(false)
const isKasaLocked = ref(true)

const { locale } = useI18n()

const currentTheme = ref(getTheme())

function onToggleTheme() {
  currentTheme.value = toggleTheme()
}

function formatFullName(name) {
  if (!name) return '';
  return name.replace(/Sistem Y.*neticisi/gi, 'Sistem Yöneticisi')
             .replace(/G.*venlik Y.*neticisi/gi, 'Güvenlik Yöneticisi');
}

const isLogoutConfirmOpen = ref(false)
const logoutConfirmTimer = ref(0)
let logoutTimerInterval = null

const hasDuplicateEmailWarning = ref(false)

const currentUserRole = ref('')
const currentUserFullName = ref('')
const currentUserId = ref('')
const pendingApprovalsCount = ref(0)

async function fetchPendingApprovalsCount() {
  const token = localStorage.getItem('token')
  if (!token) return
  try {
    const response = await fetch('/api/auth/approvals', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      const data = await response.json()
      const seen = JSON.parse(localStorage.getItem('seen_approvals') || '[]')
      const list = data.approvals || []
      const activePending = list.filter(req => {
        if (req.status !== 'pending') return false
        if (seen.includes(req.id)) return false
        const isOwn = req.targetId === currentUserId.value || req.requestData?.requesterId === currentUserId.value
        if (isOwn) return false
        
        if (req.type === 'STANDARD_USER_CREATION' || req.type === 'ADMIN_CREATION') {
          return currentUserRole.value === 'admin'
        }
        if (req.type === 'NAME_CHANGE' || req.type === 'USERNAME_CHANGE') {
          return currentUserRole.value === 'ciso'
        }
        return true
      })
      pendingApprovalsCount.value = activePending.length
    }
  } catch (e) {
    console.warn('[App] Bekleyen onay sayısı alınamadı:', e)
  }
}

function onStatClick(type) {
  if (documentListRef.value) {
    documentListRef.value.filterFromDashboard(type)
  }
}

function getRoleLabel(role) {
  if (role === 'ciso') return '🛡️ CISO'
  if (role === 'admin') return locale.value === 'tr' ? '👑 Yönetici' : '👑 Admin'
  return locale.value === 'tr' ? '👤 Standart' : '👤 Standard'
}

function updateUserInfo() {
  const token = localStorage.getItem('token');
  isKasaLocked.value = !token;
  if (!token) {
    currentUserRole.value = '';
    currentUserFullName.value = '';
    currentUserId.value = '';
    pendingApprovalsCount.value = 0;
    hasDuplicateEmailWarning.value = false;
    return;
  }
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(decodeURIComponent(escape(window.atob(base64))));
    currentUserRole.value = payload.role || '';
    currentUserFullName.value = payload.fullName || payload.username || '';
    currentUserId.value = payload.id || '';
    hasDuplicateEmailWarning.value = !!payload.hasDuplicateEmail;
    
    fetchPendingApprovalsCount()
  } catch (e) {
    currentUserRole.value = '';
    currentUserFullName.value = '';
    currentUserId.value = '';
    hasDuplicateEmailWarning.value = false;
  }
}

function promptLockKasa() {
  isLogoutConfirmOpen.value = true;
  logoutConfirmTimer.value = 2;
  if (logoutTimerInterval) clearInterval(logoutTimerInterval);
  logoutTimerInterval = setInterval(() => {
    if (logoutConfirmTimer.value > 0) {
      logoutConfirmTimer.value--;
    } else {
      clearInterval(logoutTimerInterval);
    }
  }, 1000);
}

function confirmLockKasa() {
  isLogoutConfirmOpen.value = false;
  lockKasa();
}

function lockKasa() {
  localStorage.removeItem('token');
  localStorage.removeItem('kasa_token');
  localStorage.removeItem('currentUser');
  updateUserInfo();
  window.dispatchEvent(new Event('kasa-lock'));
}

onMounted(() => {
  initTheme();
  updateUserInfo();
  window.addEventListener('kasa-unlocked', updateUserInfo);
  window.addEventListener('kasa-lock', updateUserInfo);
  window.addEventListener('profile-updated', updateUserInfo);
})

onUnmounted(() => {
  window.removeEventListener('kasa-unlocked', updateUserInfo);
  window.removeEventListener('kasa-lock', updateUserInfo);
  window.removeEventListener('profile-updated', updateUserInfo);
  if (logoutTimerInterval) clearInterval(logoutTimerInterval);
})

const isCiso = computed(() => currentUserRole.value === 'ciso')

function onDocumentUploaded() {
  documentListRef.value?.refresh()
  dashboardRef.value?.refresh()
}

function onSearchResults(results, term) {
  documentListRef.value?.setSearchResults(results, term)
}

function onSearchClear() {
  documentListRef.value?.clearSearch()
}

function onSearchLoading(isLoading) {
  // search loading
}
</script>

<style>
/* ============================================================
   GLOBAL TASARIM SİSTEMİ (Design Tokens)
   ============================================================ */
:root {
  --bg-primary: #0f172a;
  --bg-secondary: #131c31;
  --bg-card: #1e293b;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --accent: #38bdf8;
  --accent-glow: rgba(56, 189, 248, 0.15);
  --border: #334155;
  --radius: 12px;
  --shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  --accent-primary: #8b5cf6;
  --accent-secondary: #3b82f6;
  --danger: #ef4444;
  --success: #22c55e;
  --color-success: #34d399;
  --color-success-bg: #10b981;
  --color-danger: #f87171;
  --color-danger-bg: #ef4444;
  --color-accent-text: #a78bfa;
  --color-accent-bg: #8b5cf6;
  --color-accent-light: #c4b5fd;
  /* Chat-specific tokens */
  --chat-bg: #0b141a;
  --bubble-in: #1e293b;
  --bubble-out: #1e3a5f;
}

/* ============ AÇIK TEMA ============ */
[data-theme="light"] {
  --bg-primary: #f5f5f7;
  --bg-secondary: #ffffff;
  --bg-card: #ffffff;
  --text-primary: #1d1d1f;
  --text-secondary: #86868b;
  --accent: #007aff;
  --accent-glow: rgba(0, 122, 255, 0.08);
  --accent-primary: #007aff;
  --accent-secondary: #5856d6;
  --border: #d2d2d7;
  --radius: 14px;
  --shadow: 0 4px 14px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.02);
  --danger: #ff3b30;
  --success: #34c759;
  --color-success: #16a34a;
  --color-success-bg: #22c55e;
  --color-danger: #dc2626;
  --color-danger-bg: #ef4444;
  --color-accent-text: #4f46e5;
  --color-accent-bg: #6366f1;
  --color-accent-light: #818cf8;
  --chat-bg: #f5f5f7;
  --bubble-in: #ffffff;
  --bubble-out: #e5f0ff;
}
[data-theme="light"] body {
  background: linear-gradient(-45deg, #fdfbfb, #e4ebf2, #f5f7fa, #dce4ed);
  background-size: 400% 400%;
  animation: appleLightAnim 15s ease infinite;
  color: var(--text-primary);
}

@keyframes appleLightAnim {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* Font Koruması ve Otomatik Çeviri Engelleyici */
html, body, #dms-app, #app, * {
  font-family: 'Inter', 'Outfit', system-ui, -apple-system, sans-serif !important;
}

font {
  font-family: inherit !important;
  background: transparent !important;
  color: inherit !important;
}

#dms-app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.dms-header {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 1.25rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-inner {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.logo-icon {
  font-size: 1.5rem;
}

.logo h1 {
  font-size: 1.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 0.8rem;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.03);
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
  border: 1px solid var(--border);
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-indicator--online {
  background: #22c55e;
  box-shadow: 0 0 10px #22c55e;
}

.dms-main {
  flex: 1;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 1.25rem;
  padding: 1.25rem 1.5rem;
  width: 100%;
  max-width: 100vw;
  margin: 0;
  overflow-x: hidden;
}

.panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.panel-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-primary);
}

.panel-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  opacity: 0.65;
  padding: 0.5rem 0;
}

.panel-hint svg {
  color: #22c55e;
  flex-shrink: 0;
}

.dms-footer {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
  text-align: center;
}

.dms-footer p {
  color: var(--text-secondary);
  font-size: 0.75rem;
  opacity: 0.55;
}

@media (max-width: 900px) {
  .dms-main {
    grid-template-columns: 1fr;
  }

  .dms-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}

.btn-theme-toggle {
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.25);
  color: #38bdf8;
  padding: 0.4rem 0.6rem;
  font-size: 1rem;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
}
.btn-theme-toggle:hover {
  background: rgba(56, 189, 248, 0.18);
  border-color: #38bdf8;
  box-shadow: 0 0 15px rgba(56, 189, 248, 0.25);
  transform: rotate(20deg);
}

.btn-settings-toggle {
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.25);
  color: #a78bfa;
  padding: 0.4rem 0.8rem;
  font-size: 0.74rem;
  font-weight: 600;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.05);
  white-space: nowrap;
}

.btn-settings-toggle:hover {
  background: rgba(139, 92, 246, 0.18);
  border-color: #a78bfa;
  box-shadow: 0 0 15px rgba(139, 92, 246, 0.25);
  transform: translateY(-1px);
}

.btn-lock-toggle {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #f87171;
  padding: 0.4rem 0.8rem;
  font-size: 0.74rem;
  font-weight: 600;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.05);
  white-space: nowrap;
}

.btn-lock-toggle:hover {
  background: rgba(239, 68, 68, 0.18);
  border-color: #f87171;
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.25);
  transform: translateY(-1px);
}

.btn-audit-toggle {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: #34d399;
  padding: 0.4rem 0.8rem;
  font-size: 0.74rem;
  font-weight: 600;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.05);
  white-space: nowrap;
}

.btn-audit-toggle:hover {
  background: rgba(16, 185, 129, 0.18);
  border-color: #34d399;
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.25);
  transform: translateY(-1px);
}

.audit-log-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(3, 7, 18, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.audit-log-modal-content {
  background: #0f172a;
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 12px;
  width: 92%;
  max-width: 1150px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.8);
}

.modal-close-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-close-header h3 {
  color: #34d399;
  font-size: 1.05rem;
  font-weight: 700;
  margin: 0;
}

.btn-close-modal {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #f87171;
  padding: 0.4rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
}

.modal-body-scroll {
  flex-grow: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.logout-confirm-overlay {
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
  z-index: 10000;
}

.logout-confirm-card {
  background: #111827;
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 12px;
  width: 100%;
  max-width: 380px;
  padding: 1.75rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  text-align: center;
}

.logout-confirm-card h4 {
  color: #f87171;
  font-size: 1.05rem;
  margin: 0 0 0.5rem 0;
}

.logout-confirm-card p {
  color: #9ca3af;
  font-size: 0.82rem;
  line-height: 1.4;
  margin: 0 0 1.25rem 0;
}

.btn-confirm-cancel {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #9ca3af;
  padding: 0.5rem 1.25rem;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
}

.btn-confirm-logout {
  background: #ef4444;
  color: #fff;
  border: none;
  padding: 0.5rem 1.25rem;
  font-size: 0.8rem;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
}

.btn-confirm-logout:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.role-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.role-badge--user {
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #60a5fa;
}
.role-badge--admin {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #fbbf24;
}
.role-badge--ciso {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
}

#dms-app.app-unlocked {
  animation: dms-fade-in 0.4s ease both;
}
@keyframes dms-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

:root {
  --toastification-container-top: 1rem;
  --toastification-container-right: 1rem;
}
.dms-toast-container {
  z-index: 99999 !important;
}
.dms-toast {
  font-family: 'Inter', 'Outfit', system-ui, sans-serif !important;
  font-size: 0.82rem !important;
  border-radius: 10px !important;
  backdrop-filter: blur(12px) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
  padding: 0.75rem 1rem !important;
  min-width: 240px !important;
  max-width: 380px !important;
}

.Vue-Toastification__toast--success.dms-toast {
  background: rgba(5, 46, 22, 0.95) !important;
  border-color: rgba(34, 197, 94, 0.3) !important;
  color: #bbf7d0 !important;
}
.Vue-Toastification__toast--error.dms-toast {
  background: rgba(69, 10, 10, 0.95) !important;
  border-color: rgba(239, 68, 68, 0.3) !important;
  color: #fecaca !important;
}
.Vue-Toastification__toast--warning.dms-toast {
  background: rgba(67, 36, 0, 0.95) !important;
  border-color: rgba(245, 158, 11, 0.3) !important;
  color: #fde68a !important;
}
.Vue-Toastification__toast--info.dms-toast {
  background: rgba(8, 47, 73, 0.95) !important;
  border-color: rgba(59, 130, 246, 0.3) !important;
  color: #bfdbfe !important;
}
.Vue-Toastification__progress-bar {
  background: rgba(255, 255, 255, 0.2) !important;
  height: 2px !important;
}
.email-collision-alert {
  background: rgba(239, 68, 68, 0.12);
  border: 1.5px solid rgba(239, 68, 68, 0.4);
  border-radius: 12px;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  color: #fca5a5;
  font-size: 0.85rem;
  line-height: 1.4;
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.15);
  animation: alertPulse 2s infinite ease-in-out;
}
.alert-icon {
  font-size: 1.5rem;
}
.alert-text strong {
  color: #f87171;
}
@keyframes alertPulse {
  0%, 100% {
    border-color: rgba(239, 68, 68, 0.4);
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.15);
  }
  50% {
    border-color: rgba(239, 68, 68, 0.8);
    box-shadow: 0 0 30px rgba(239, 68, 68, 0.35);
  }
}

/* ============================================================
   AÇIK TEMA — Bileşen Override'ları
   ============================================================ */

/* Header */
[data-theme="light"] .dms-header {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
}

/* Logo gradient */
[data-theme="light"] .logo h1 {
  background: linear-gradient(135deg, #6d28d9, #2563eb);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Header butonları */
[data-theme="light"] .btn-settings-toggle {
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  color: #6d28d9;
}
[data-theme="light"] .btn-settings-toggle:hover {
  background: #ede9fe;
  border-color: #a78bfa;
  box-shadow: 0 2px 10px rgba(109, 40, 217, 0.15);
}
[data-theme="light"] .btn-audit-toggle {
  background: #fef3c7;
  border: 1px solid #fde68a;
  color: #92400e;
}
[data-theme="light"] .btn-audit-toggle:hover {
  background: #fde68a;
  border-color: #f59e0b;
}
[data-theme="light"] .btn-theme-toggle {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  color: #0369a1;
}
[data-theme="light"] .btn-theme-toggle:hover {
  background: #e0f2fe;
  border-color: #38bdf8;
}

/* Header status */
[data-theme="light"] .header-status {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}

/* Header rol badge */
[data-theme="light"] .role-badge {
  background: linear-gradient(135deg, #6d28d9, #7c3aed) !important;
  color: #fff !important;
  border: none !important;
}

/* Panel (sol panel + sağ panel + çekmece paneller + lang modal) */
[data-theme="light"] .panel,
[data-theme="light"] .settings-drawer,
[data-theme="light"] .notifications-panel,
  [data-theme="light"] .users-panel,
  [data-theme="light"] .lang-modal-card,
  [data-theme="light"] .kasa-lock-card,
  [data-theme="light"] .confirm-card {
    background: rgba(255, 255, 255, 0.85) !important;
    backdrop-filter: blur(24px) saturate(180%) !important;
    -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
    border: 1px solid rgba(226, 232, 240, 0.8) !important;
    box-shadow: 0 10px 40px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.6) !important;
    color: var(--text-primary) !important;
  }
  
  [data-theme="light"] .header-username {
    color: #1e293b !important;
    background: rgba(0, 0, 0, 0.05) !important;
  }
  
  [data-theme="dark"] .header-username {
    color: #fff !important;
    background: rgba(255, 255, 255, 0.05) !important;
  }

  [data-theme="light"] h4, [data-theme="light"] h3, [data-theme="light"] .panel-desc {
    color: var(--text-primary) !important;
  }

  [data-theme="light"] .role-badge--admin, [data-theme="light"] .role--admin {
    color: #b45309 !important;
    background: rgba(245, 158, 11, 0.1) !important;
    border-color: rgba(245, 158, 11, 0.2) !important;
  }

  [data-theme="light"] .role-badge--user, [data-theme="light"] .role--user {
    color: #1d4ed8 !important;
    background: rgba(59, 130, 246, 0.1) !important;
    border-color: rgba(59, 130, 246, 0.2) !important;
  }

  [data-theme="light"] .role-badge--ciso, [data-theme="light"] .role--ciso {
    color: #047857 !important;
    background: rgba(16, 185, 129, 0.1) !important;
    border-color: rgba(16, 185, 129, 0.2) !important;
  }

  /* Force light mode pastel backgrounds for hardcoded dark inner elements */
  [data-theme="light"] .users-panel th, 
  [data-theme="light"] .users-panel .user-row,
  [data-theme="light"] .users-panel .users-list,
  [data-theme="light"] .notifications-panel .notification-item,
  [data-theme="light"] .notifications-panel .notification-header,
  [data-theme="light"] .settings-panel form,
  [data-theme="light"] .settings-section {
    background: rgba(255, 255, 255, 0.5) !important;
    border-color: rgba(0, 0, 0, 0.05) !important;
    color: var(--text-primary) !important;
  }
  
  [data-theme="light"] .users-panel .user-email,
  [data-theme="light"] .users-panel .last-login {
    color: var(--text-secondary) !important;
  }


[data-theme="light"] .kasa-lock-overlay {
  background: rgba(255, 255, 255, 0.2) !important;
  backdrop-filter: blur(12px) !important;
}

[data-theme="light"] .settings-drawer *,
[data-theme="light"] .notifications-panel *,
[data-theme="light"] .users-panel *,
[data-theme="light"] .lang-modal-card *,
[data-theme="light"] .kasa-lock-card * {
  border-color: var(--border);
}

[data-theme="light"] .lang-modal-header {
  background: transparent !important;
  border-bottom: 1px solid var(--border) !important;
}

[data-theme="light"] .lang-search-box {
  background: rgba(255, 255, 255, 0.5) !important;
}

[data-theme="light"] .lang-search-box input {
  background: transparent !important;
  color: var(--text-primary) !important;
}

[data-theme="light"] .lang-item-card {
  background: rgba(255, 255, 255, 0.5) !important;
}

[data-theme="light"] .lang-item-card.active {
  background: rgba(0, 122, 255, 0.1) !important;
  border-color: var(--accent) !important;
}

[data-theme="light"] .lang-item-card .native-name {
  color: var(--text-primary) !important;
}

[data-theme="light"] .lang-item-card .english-name {
  color: var(--text-secondary) !important;
}

/* Arama inputları */
[data-theme="light"] input,
[data-theme="light"] select,
[data-theme="light"] textarea {
  background: rgba(255, 255, 255, 0.5) !important;
  backdrop-filter: blur(12px) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  color: #0f172a !important;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.02) !important;
}
[data-theme="light"] input::placeholder,
[data-theme="light"] textarea::placeholder {
  color: #94a3b8 !important;
}
[data-theme="light"] input:focus,
[data-theme="light"] select:focus,
[data-theme="light"] textarea:focus {
  border-color: #a78bfa !important;
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.15) !important;
}

/* Doküman tablosu */
[data-theme="light"] table {
  color: #0f172a;
}
[data-theme="light"] th {
  background: #f1f5f9 !important;
  color: #334155 !important;
  border-bottom: 2px solid #e2e8f0 !important;
}
[data-theme="light"] td {
  border-bottom: 1px solid #f1f5f9 !important;
  color: #1e293b !important;
}
[data-theme="light"] tr:hover td {
  background: #f8fafc !important;
}

/* Dashboard stat kartları */
[data-theme="light"] .stat-card,
[data-theme="light"] .dashboard-stat-card {
  background: rgba(255, 255, 255, 0.5) !important;
  backdrop-filter: blur(16px) saturate(150%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(150%) !important;
  border: 1px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.03) !important;
  color: #0f172a !important;
}
[data-theme="light"] .stat-card:hover,
[data-theme="light"] .dashboard-stat-card:hover {
  background: rgba(255, 255, 255, 0.8) !important;
  box-shadow: 0 12px 32px rgba(0,0,0,0.06) !important;
  transform: translateY(-2px);
}
[data-theme="light"] .stat-card .stat-value,
[data-theme="light"] .stat-card h2,
[data-theme="light"] .stat-card h3 {
  color: #0f172a !important;
}
[data-theme="light"] .stat-card .stat-label,
[data-theme="light"] .stat-card p {
  color: #64748b !important;
}

/* Yükleme alanı */
[data-theme="light"] .upload-zone,
[data-theme="light"] .dropzone {
  background: #fafbfc !important;
  border-color: #cbd5e1 !important;
  color: #475569 !important;
}
[data-theme="light"] .upload-zone:hover,
[data-theme="light"] .dropzone:hover {
  border-color: #a78bfa !important;
  background: #f5f3ff !important;
}

/* Butonlar (Genel) */
[data-theme="light"] .btn-primary,
[data-theme="light"] button[type="submit"] {
  background: linear-gradient(135deg, #6d28d9, #4f46e5) !important;
  color: #fff !important;
  border: none !important;
}
[data-theme="light"] .btn-primary:hover {
  box-shadow: 0 4px 16px rgba(109, 40, 217, 0.3) !important;
}

/* Etiketler / Badge'ler */
[data-theme="light"] .badge,
[data-theme="light"] .tag {
  border: 1px solid #e2e8f0;
  color: #334155;
}

/* Footer */
[data-theme="light"] .dms-footer p {
  color: #94a3b8;
}

/* Scrollbar light */
[data-theme="light"] ::-webkit-scrollbar-track {
  background: #f1f5f9;
}
[data-theme="light"] ::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
[data-theme="light"] ::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Alert paneli */
[data-theme="light"] .email-collision-alert {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #991b1b;
}
[data-theme="light"] .alert-text strong {
  color: #dc2626;
}

/* Select / Dropdown */
[data-theme="light"] select option {
  background: #ffffff !important;
  color: #0f172a !important;
}

/* Filtreleme & Arama barı */
[data-theme="light"] .search-container,
[data-theme="light"] .filter-bar {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
}

/* Kategori dağılım çubuğu */
[data-theme="light"] .category-bar,
[data-theme="light"] .chart-container,
[data-theme="light"] .category-section {
  background: rgba(255, 255, 255, 0.6) !important;
  backdrop-filter: blur(20px) !important;
  border: 1px solid rgba(255, 255, 255, 0.9) !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.03) !important;
}
</style>
