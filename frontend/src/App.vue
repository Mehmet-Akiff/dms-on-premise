<template>
  <div id="dms-app" :class="{ 'app-unlocked': !isKasaLocked }">
    <!-- Kasa Kilit Ekranı (Overlay) -->
    <KasaLock v-if="isKasaLocked" />

    <template v-else>
      <!-- Üst Header Bar -->
      <header class="dms-header">
        <div class="header-inner">
          <div class="logo">
            <span class="logo-icon">🔒</span>
            <h1>DMS</h1>
            <span class="badge">On-Premise</span>
          </div>
          <p class="subtitle">{{ $t('nav.subtitle') || 'Yapay Zeka Destekli Akıllı Doküman Yönetim Sistemi' }}</p>
        </div>

        <div class="header-actions">
          <!-- Rol ve İsim Gösterimi -->
          <div v-if="currentUserRole" class="user-role-badge-wrap">
            <span :class="['role-badge', 'role-badge--' + currentUserRole]">
              {{ getRoleLabel(currentUserRole) }}
            </span>
            <span class="header-username">{{ formatFullName(currentUserFullName) }}</span>
          </div>

          <!-- Dil Seçici -->
          <NativeLangSelector />

          <!-- Tema Değiştirici -->
          <button class="btn-theme-toggle" @click="onToggleTheme" :title="currentTheme === 'dark' ? 'Açık Tema' : 'Koyu Tema'">
            {{ currentTheme === 'dark' ? '☀️' : '🌙' }}
          </button>

          <!-- Bildirimler Dropdown Butonu -->
          <div class="notif-dropdown-wrapper">
            <button class="btn-header-action" @click="isNotificationsOpen = !isNotificationsOpen" :title="$t('nav.notifications')">
              🔔 {{ $t('nav.notifications') || 'Bildirimler' }}
              <span v-if="pendingApprovalsCount > 0" class="notif-badge">
                {{ pendingApprovalsCount }}
              </span>
            </button>

            <!-- Bildirimler Dropdown Popover -->
            <div v-if="isNotificationsOpen" class="notif-popover-overlay" @click.self="isNotificationsOpen = false">
              <div class="notif-popover-card">
                <div class="notif-popover-header">
                  <h4>🔔 {{ $t('nav.notificationsTitle') || 'Bildirimler ve Onay Talepleri' }}</h4>
                  <button class="btn-close-popover" @click="isNotificationsOpen = false">✕</button>
                </div>
                <div class="notif-popover-body">
                  <NotificationsPanel 
                    :userRole="currentUserRole" 
                    :userId="currentUserId" 
                    @refresh-count="fetchPendingApprovalsCount"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Güvenli Çıkış -->
          <button class="btn-lock-toggle" @click="promptLockKasa" :title="$t('nav.logout')">
            🚪 {{ $t('nav.logout') || 'Çıkış Yap' }}
          </button>
        </div>
      </header>

      <!-- E-posta Çakışma Alarmı -->
      <div v-if="hasDuplicateEmailWarning" class="email-collision-alert">
        <span class="alert-icon">⚠️</span>
        <div class="alert-text">
          <strong>{{ $t('nav.emailCollisionWarning') || 'KRİTİK GÜVENLİK UYARISI:' }}</strong> {{ $t('nav.emailCollisionMsg') || 'E-posta adresiniz sistemdeki başka bir hesapla çakışıyor! Lütfen güvenlik nedeniyle e-posta adresinizi Ayarlar\'dan acilen güncelleyin.' }}
        </div>
      </div>

      <!-- Segmentasyon Ana Shell (Sol Sidebar + Router View) -->
      <div class="dms-layout-shell">
        <!-- Avast Tarzı Sol Ana Navigasyon Çubuğu -->
        <aside class="app-sidebar-nav">
          <router-link to="/vault" class="app-nav-link" active-class="active">
            <span class="app-nav-icon">🗄️</span>
            <span class="app-nav-label">Belge Kasası</span>
          </router-link>

          <router-link to="/chat" class="app-nav-link" active-class="active">
            <span class="app-nav-icon">💬</span>
            <span class="app-nav-label">Kurum İçi Sohbet</span>
          </router-link>

          <router-link v-if="isCiso" to="/audit" class="app-nav-link" active-class="active">
            <span class="app-nav-icon">📜</span>
            <span class="app-nav-label">Denetim Günlüğü</span>
          </router-link>

          <router-link v-if="currentUserRole === 'admin' || currentUserRole === 'ciso'" to="/users" class="app-nav-link" active-class="active">
            <span class="app-nav-icon">👥</span>
            <span class="app-nav-label">Kullanıcılar</span>
          </router-link>

          <router-link to="/settings" class="app-nav-link" active-class="active">
            <span class="app-nav-icon">⚙️</span>
            <span class="app-nav-label">Sistem Ayarları</span>
          </router-link>
        </aside>

        <!-- Router View Portu -->
        <div class="app-router-viewport">
          <router-view />
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
        <p>{{ $t('nav.footerText') || '© 2026 DMS On-Premise — %100 Yerel Kaynaklı ve Güvenli Doküman Yönetim Sistemi.' }}</p>
      </footer>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTheme, toggleTheme, initTheme } from './utils/ThemeProvider'
import KasaLock from './components/KasaLock.vue'
import NotificationsPanel from './components/NotificationsPanel.vue'
import NativeLangSelector from './components/NativeLangSelector.vue'

const isKasaLocked = ref(true)
const isNotificationsOpen = ref(false)
const isLogoutConfirmOpen = ref(false)
const logoutConfirmTimer = ref(0)
let logoutTimerInterval = null

const hasDuplicateEmailWarning = ref(false)
const currentUserRole = ref('')
const currentUserFullName = ref('')
const currentUserId = ref('')
const pendingApprovalsCount = ref(0)

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

function getRoleLabel(role) {
  if (role === 'ciso') return '🛡️ CISO'
  if (role === 'admin') return locale.value === 'tr' ? '👑 Yönetici' : '👑 Admin'
  return locale.value === 'tr' ? '👤 Standart' : '👤 Standard'
}

const isCiso = computed(() => currentUserRole.value === 'ciso')

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
  --color-success: #34d399;
  --color-danger: #f87171;
  --color-danger-bg: #ef4444;
  --color-accent-text: #a78bfa;
}

[data-theme="light"] {
  --bg-primary: #f8fafc;
  --bg-secondary: #f1f5f9;
  --bg-card: #ffffff;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --border: #cbd5e1;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
}

#dms-app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header */
.dms-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.5rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  position: sticky;
  top: 0;
  z-index: 100;
}
.header-inner {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.logo-icon {
  font-size: 1.4rem;
}
.logo h1 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  border: 1px solid rgba(99, 102, 241, 0.3);
}
.subtitle {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.user-role-badge-wrap {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(255, 255, 255, 0.04);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--border);
}
.role-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}
.role-badge--admin { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
.role-badge--ciso { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.role-badge--user { background: rgba(99, 102, 241, 0.2); color: #818cf8; }
.header-username {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-primary);
}

.btn-header-action, .btn-theme-toggle, .btn-lock-toggle {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 0.45rem 0.85rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  transition: all 0.2s;
  position: relative;
}
.btn-header-action:hover, .btn-theme-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
}
.btn-lock-toggle {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}
.btn-lock-toggle:hover {
  background: rgba(239, 68, 68, 0.3);
}
.notif-badge {
  background: #ef4444;
  color: #fff;
  font-size: 0.62rem;
  font-weight: 800;
  padding: 0.1rem 0.35rem;
  border-radius: 999px;
  margin-left: 0.35rem;
}

/* Bildirimler Popover */
.notif-dropdown-wrapper {
  position: relative;
}
.notif-popover-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: flex;
  justify-content: flex-end;
  padding: 60px 20px 0 0;
}
.notif-popover-card {
  background: #1e293b;
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 580px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}
.notif-popover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
}
.notif-popover-header h4 {
  margin: 0;
  font-size: 1rem;
  color: #fff;
}
.btn-close-popover {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.1rem;
  cursor: pointer;
}
.notif-popover-body {
  padding: 1.25rem;
  overflow-y: auto;
}

/* E-posta Çakışma Uyarısı */
.email-collision-alert {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  padding: 0.75rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.82rem;
}

/* Segmentasyon Ana Shell */
.dms-layout-shell {
  display: flex;
  flex: 1;
  min-height: calc(100vh - 120px);
}

/* Sol Navigasyon Sidebar */
.app-sidebar-nav {
  width: 70px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  padding: 1.25rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-sizing: border-box;
  transition: width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  overflow-x: hidden;
  z-index: 50;
  white-space: nowrap;
}
.app-sidebar-nav:hover {
  width: 240px;
  box-shadow: 10px 0 30px rgba(0,0,0,0.1);
}
.app-nav-link {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: 8px;
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.9rem;
  transition: all 0.2s;
  overflow: hidden;
}
.app-nav-icon {
  font-size: 1.25rem;
  min-width: 1.25rem;
  display: flex;
  justify-content: center;
}
.app-nav-label {
  opacity: 0;
  transition: opacity 0.3s ease;
}
.app-sidebar-nav:hover .app-nav-label {
  opacity: 1;
}
.app-nav-link:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
}
.app-nav-link.active {
  background: rgba(99, 102, 241, 0.15);
  color: var(--color-accent-text, #a78bfa);
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.1);
}
.app-nav-icon {
  font-size: 1.2rem;
}
.app-router-viewport {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow-x: hidden;
}

/* Çıkış Onay Modalı */
.logout-confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}
.logout-confirm-card {
  background: #1e293b;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 12px;
  padding: 1.5rem;
  width: 90%;
  max-width: 440px;
}
.logout-confirm-card h4 {
  margin: 0 0 0.5rem 0;
  color: #ef4444;
  font-size: 1.1rem;
}
.logout-confirm-card p {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
  line-height: 1.5;
}
.btn-confirm-cancel {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  color: #94a3b8;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
}
.btn-confirm-logout {
  background: #ef4444;
  color: #fff;
  border: none;
  padding: 0.5rem 1.2rem;
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
}
.btn-confirm-logout:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Footer */
.dms-footer {
  text-align: center;
  padding: 0.75rem;
  font-size: 0.72rem;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
}

@media (max-width: 900px) {
  .dms-layout-shell {
    flex-direction: column;
  }
  .app-sidebar-nav {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  .subtitle {
    display: none;
  }
}
</style>

