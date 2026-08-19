<template>
  <div class="settings-layout">
    <!-- Sol Menü: En sola yaslı, hover ile açılan -->
    <aside class="settings-sidebar">
      <div class="sidebar-header">
        <span class="settings-icon">⚙️</span>
        <h3 class="sidebar-title">{{ $t('settings.panelTitle') || 'Sistem Ayarları' }}</h3>
      </div>
      <nav class="settings-nav">
        <router-link to="/settings/profile" class="nav-item" active-class="active">
          <span class="nav-icon">👤</span>
          <div class="nav-text">
            <span class="nav-title">Profil & Görünüm</span>
            <span class="nav-sub">Kişisel bilgiler, tema ve renkler</span>
          </div>
        </router-link>

        <router-link to="/settings/security" class="nav-item" active-class="active">
          <span class="nav-icon">🛡️</span>
          <div class="nav-text">
            <span class="nav-title">Güvenlik & Kasa</span>
            <span class="nav-sub">Oturum tercihleri ve kasa şifresi</span>
          </div>
        </router-link>

        <router-link v-if="isAdminOrCiso" to="/settings/system" class="nav-item" active-class="active">
          <span class="nav-icon">🖥️</span>
          <div class="nav-text">
            <span class="nav-title">Sistem & İzinler</span>
            <span class="nav-sub">Dağıtım modu, roller ve mesai</span>
          </div>
        </router-link>

        <router-link v-if="isAdminOrCiso" to="/settings/notifications" class="nav-item" active-class="active">
          <span class="nav-icon">🚨</span>
          <div class="nav-text">
            <span class="nav-title">Alarm & Onaylar</span>
            <span class="nav-sub">Yetkisiz erişim alarmı ve çift onay</span>
          </div>
        </router-link>

        <router-link v-if="isCiso" to="/settings/smtp" class="nav-item" active-class="active">
          <span class="nav-icon">📧</span>
          <div class="nav-text">
            <span class="nav-title">SMTP & Loglar</span>
            <span class="nav-sub">E-posta sunucusu ve audit dosyası</span>
          </div>
        </router-link>
      </nav>
    </aside>

    <!-- Sağ İçerik Alanı: Sağa ve Sola tam yayılan (fluid full-width) -->
    <main class="settings-content">
      <div class="settings-content-inner">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'

function parseJwt() {
  try {
    const token = localStorage.getItem('token')
    if (!token) return {}
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(window.atob(base64))
  } catch { return {} }
}

const role = computed(() => parseJwt().role || 'user')
const isAdminOrCiso = computed(() => role.value === 'admin' || role.value === 'ciso')
const isCiso = computed(() => role.value === 'ciso')
</script>

<style scoped>
.settings-layout {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 70px);
  padding: 0;
  margin: 0;
  box-sizing: border-box;
  background: var(--bg-primary);
  overflow: hidden;
  position: relative;
}

.settings-sidebar {
  background: var(--bg-secondary, #1e293b);
  border-right: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  padding: 1.25rem 0.5rem;
  height: 100%;
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
  width: 72px;
  transition: width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  overflow-x: hidden;
  white-space: nowrap;
  flex-shrink: 0;
  z-index: 20;
}

.settings-sidebar:hover {
  width: 260px;
  padding: 1.25rem 1rem;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.5rem 0.6rem 1.25rem;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  margin-bottom: 0.75rem;
}

.settings-icon {
  font-size: 1.35rem;
  min-width: 1.35rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary, #f8fafc);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.settings-sidebar:hover .sidebar-title {
  opacity: 1;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-secondary, #94a3b8);
  border: 1px solid transparent;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.nav-item .nav-icon {
  font-size: 1.25rem;
  min-width: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-item .nav-text {
  opacity: 0;
  transition: opacity 0.3s ease;
  display: flex;
  flex-direction: column;
}

.settings-sidebar:hover .nav-item .nav-text {
  opacity: 1;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary, #f8fafc);
}

.nav-item.active {
  background: rgba(99, 102, 241, 0.15);
  color: var(--color-accent-text, #a78bfa);
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.1);
}

.nav-title {
  font-size: 0.85rem;
  font-weight: 600;
}

.nav-sub {
  font-size: 0.68rem;
  opacity: 0.7;
}

.settings-content {
  flex: 1;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 2rem 3rem;
  background: var(--bg-primary);
  box-sizing: border-box;
}

.settings-content-inner {
  width: 100%;
  max-width: 1400px;
}

@media (max-width: 768px) {
  .settings-content {
    padding: 1rem;
  }
}
</style>
