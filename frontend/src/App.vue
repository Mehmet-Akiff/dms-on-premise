<template>
  <div id="dms-app">
    <!-- Kasa Kilit Ekranı (Overlay) -->
    <KasaLock v-if="isKasaLocked" />

    <template v-else>
      <!-- Header -->
      <header class="dms-header">
        <div class="header-inner">
          <div class="logo">
            <span class="logo-icon">📄</span>
            <h1>DMS</h1>
            <span class="badge">On-Premise</span>
          </div>
          <p class="subtitle">Yapay Zeka Destekli Akıllı Doküman Yönetim Sistemi</p>
        </div>
        <div class="header-actions" style="display:flex; align-items:center; gap:0.75rem">
          <!-- Rol ve İsim Gösterimi -->
          <div v-if="currentUserRole" class="user-role-badge-wrap" style="display: flex; align-items: center; gap: 0.5rem; margin-right: 0.5rem;">
            <span :class="['role-badge', 'role-badge--' + currentUserRole]">
              {{ getRoleLabel(currentUserRole) }}
            </span>
            <span class="header-username" style="font-size: 0.8rem; font-weight: 700; color: #fff; background: rgba(255, 255, 255, 0.05); padding: 0.25rem 0.6rem; border-radius: 6px;">{{ currentUserFullName }}</span>
          </div>

          <button v-if="isCiso" class="btn-audit-toggle" @click="isAuditLogOpen = true" title="Sistem Günlükleri">
            📋 Sistem Günlükleri
          </button>
          <button class="btn-settings-toggle" @click="isNotificationsOpen = true" title="Bildirimler & Onay Talepleri" style="position:relative;">
            🔔 Bildirimler
            <span v-if="pendingApprovalsCount > 0" class="notif-badge" style="position:absolute; top:-5px; right:-5px; background:#ef4444; color:#fff; font-size:0.65rem; font-weight:800; padding:0.15rem 0.35rem; border-radius:999px; border:2px solid var(--bg-secondary); min-width:18px; text-align:center; box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);">
              {{ pendingApprovalsCount }}
            </span>
          </button>
          <button class="btn-settings-toggle" @click="isSettingsOpen = true" title="Kasa Ayarları">
            ⚙️ Kasa Ayarları
          </button>
          <button class="btn-lock-toggle" @click="promptLockKasa" title="Güvenli Çıkış (Sistemi Kilitle)">
            🔒 Güvenli Çıkış
          </button>
          <div class="header-status">
            <span class="status-indicator status-indicator--online"></span>
            <span class="status-text">Sistem Aktif</span>
          </div>
        </div>
      </header>

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
            Doküman Yükle
          </h3>
          <FileUpload @uploaded="onDocumentUploaded" />
          <div class="panel-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Tüm dosyalar yerel sunucuda güvenle işlenir. Veri dışarı çıkmaz.
          </div>
        </section>

        <!-- Sağ Panel: Dashboard + Arama + Doküman Listesi -->
        <section class="panel panel--list">
          <Dashboard ref="dashboardRef" />
          <SearchBar @results="onSearchResults" @clear="onSearchClear" @loading="onSearchLoading" />
          <DocumentList ref="documentListRef" />
        </section>
      </main>

      <!-- CISO Audit Log Modalı -->
      <div v-if="isAuditLogOpen" class="audit-log-modal-overlay" @click.self="isAuditLogOpen = false">
        <div class="audit-log-modal-content">
          <div class="modal-close-header">
            <h3>📋 Sistem Günlükleri (CISO Yetkili Alanı)</h3>
            <button class="btn-close-modal" @click="isAuditLogOpen = false">✕ Kapat</button>
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
            <h3>🔔 Bildirimler ve Onay Talepleri</h3>
            <button class="btn-close-modal" @click="isNotificationsOpen = false">✕ Kapat</button>
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

      <!-- Çıkış Onay Modalı -->
      <div v-if="isLogoutConfirmOpen" class="logout-confirm-overlay" @click.self="isLogoutConfirmOpen = false">
        <div class="logout-confirm-card">
          <h4>🔒 Güvenli Çıkış Onayı</h4>
          <p>Sistemi kilitlemek ve oturumu sonlandırmak istediğinizden emin misiniz?</p>
          <div class="confirm-actions" style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:1.2rem;">
            <button class="btn-confirm-cancel" @click="isLogoutConfirmOpen = false">Vazgeç</button>
            <button 
              class="btn-confirm-logout" 
              :disabled="logoutConfirmTimer > 0"
              @click="confirmLockKasa"
            >
              {{ logoutConfirmTimer > 0 ? `Evet, Çıkış Yap (${logoutConfirmTimer}s)` : 'Evet, Çıkış Yap' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="dms-footer">
        <p>&copy; 2026 DMS On-Premise — Tüm veriler yerel sunucuda işlenmektedir.</p>
      </footer>

      <!-- Ayarlar Paneli (Drawer) -->
      <SettingsPanel :isOpen="isSettingsOpen" @close="isSettingsOpen = false" />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import FileUpload from './components/FileUpload.vue'
import DocumentList from './components/DocumentList.vue'
import SearchBar from './components/SearchBar.vue'
import KasaLock from './components/KasaLock.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import NotificationsPanel from './components/NotificationsPanel.vue'
import Dashboard from './components/Dashboard.vue'
import AuditLog from './components/AuditLog.vue'

const documentListRef = ref(null)
const dashboardRef = ref(null)
const isSettingsOpen = ref(false)
const isAuditLogOpen = ref(false)
const isNotificationsOpen = ref(false)
const isKasaLocked = ref(true)

const isLogoutConfirmOpen = ref(false)
const logoutConfirmTimer = ref(0)
let logoutTimerInterval = null

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
      // pending olanları say (kendi isteği değilse ve onay yetkisi varsa)
      const list = data.approvals || []
      const activePending = list.filter(req => {
        if (req.status !== 'pending') return false
        // Kendi isteği mi?
        const isOwn = req.targetId === currentUserId.value || req.requestData?.requesterId === currentUserId.value
        if (isOwn) return false
        
        // Onay yetkisi var mı?
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

function getRoleLabel(role) {
  if (role === 'ciso') return '🛡️ CISO'
  if (role === 'admin') return '🔑 Yönetici'
  return '👤 Standart'
}

function updateUserInfo() {
  const token = localStorage.getItem('token');
  isKasaLocked.value = !token;
  if (!token) {
    currentUserRole.value = '';
    currentUserFullName.value = '';
    currentUserId.value = '';
    pendingApprovalsCount.value = 0;
    return;
  }
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));
    currentUserRole.value = payload.role || '';
    currentUserFullName.value = payload.fullName || payload.username || '';
    currentUserId.value = payload.id || '';
    
    // Bekleyen onayları getir
    fetchPendingApprovalsCount()
  } catch (e) {
    currentUserRole.value = '';
    currentUserFullName.value = '';
    currentUserId.value = '';
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
  window.dispatchEvent(new Event('kasa-lock'))
}

onMounted(() => {
  updateUserInfo();
  window.addEventListener('kasa-unlocked', updateUserInfo);
  window.addEventListener('kasa-lock', updateUserInfo);
})

onUnmounted(() => {
  window.removeEventListener('kasa-unlocked', updateUserInfo);
  window.removeEventListener('kasa-lock', updateUserInfo);
  if (logoutTimerInterval) clearInterval(logoutTimerInterval);
})

// Admin rol kontrolü (Reaktif)
const isAdmin = computed(() => {
  return currentUserRole.value === 'admin' || currentUserRole.value === 'ciso';
})

// CISO rol kontrolü (Reaktif)
const isCiso = computed(() => {
  return currentUserRole.value === 'ciso';
})

function onDocumentUploaded() {
  // Yükleme başarılı olduğunda doküman listesini ve dashboard'u yenile
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
  if (isLoading) {
    documentListRef.value?.setLoading(true)
  }
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
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* ============================================================
   UYGULAMA LAYOUT
   ============================================================ */
#dms-app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 1.5rem 2rem;
  max-width: 1280px;
  margin: 0 auto;
}

/* ============================================================
   HEADER
   ============================================================ */
.dms-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.header-inner {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.logo-icon {
  font-size: 1.8rem;
}

.logo h1 {
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, var(--accent), #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.badge {
  background: var(--accent-glow);
  color: var(--accent);
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 600;
  border: 1px solid rgba(56, 189, 248, 0.3);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-card);
  padding: 0.5rem 1rem;
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
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
  animation: pulse-glow 2s infinite ease-in-out;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(34, 197, 94, 0.5); }
  50% { box-shadow: 0 0 16px rgba(34, 197, 94, 0.8); }
}

.status-text {
  font-size: 0.78rem;
  font-weight: 500;
  color: #22c55e;
}

/* ============================================================
   ANA İÇERİK (2 Sütun Grid)
   ============================================================ */
.dms-main {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 1.5rem;
  flex: 1;
  align-items: start;
}

.panel--upload {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel--list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-title svg {
  color: var(--accent);
  opacity: 0.8;
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

/* ============================================================
   FOOTER
   ============================================================ */
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

/* ============================================================
   RESPONSIVE
   ============================================================ */
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

.btn-settings-toggle {
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.25);
  color: #a78bfa;
  padding: 0.5rem 1rem;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.05);
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
  padding: 0.5rem 1rem;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.05);
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
  padding: 0.5rem 1rem;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.05);
}

.btn-audit-toggle:hover {
  background: rgba(16, 185, 129, 0.18);
  border-color: #34d399;
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.25);
  transform: translateY(-1px);
}

/* Modallar */
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

/* Rol Rozeti Stilleri */
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

/* =============================
   FADE-IN SAYFA ANİMASYONU
   ============================= */
#dms-app {
  animation: dms-fade-in 0.4s ease both;
}
@keyframes dms-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* =============================
   DMS TOAST BİLDİRİMLERİ STİLLERİ
   ============================= */
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

/* Toast Tip Renkleri */
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
</style>
