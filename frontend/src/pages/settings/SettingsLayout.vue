<template>
  <div class="settings-layout">
    <div class="settings-container">
      <!-- Avast Tarzı Sol Menü -->
      <aside class="settings-sidebar">
        <div class="sidebar-header">
          <span class="settings-icon">⚙️</span>
          <h3>{{ $t('settings.panelTitle') || 'Sistem Ayarları' }}</h3>
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

      <!-- Sağ İçerik Alanı (Nested Route View) -->
      <main class="settings-content">
        <router-view />
      </main>
    </div>
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
  padding: 1.5rem;
  width: 100%;
  box-sizing: border-box;
  min-height: calc(100vh - 80px);
}
.settings-container {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1.5rem;
  max-width: 1300px;
  margin: 0 auto;
}
.settings-sidebar {
  background: var(--bg-secondary, #1e293b);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  padding: 1.25rem;
  height: fit-content;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}
.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
}
.settings-icon {
  font-size: 1.3rem;
}
.sidebar-header h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary, #f8fafc);
}
.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-secondary, #94a3b8);
  border: 1px solid transparent;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.nav-item:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary, #f8fafc);
}
.nav-item.active {
  background: rgba(99, 102, 241, 0.12);
  color: var(--color-accent-text, #a78bfa);
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.1);
}
.nav-icon {
  font-size: 1.2rem;
}
.nav-text {
  display: flex;
  flex-direction: column;
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
  background: var(--bg-secondary, #1e293b);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  padding: 1.75rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}
@media (max-width: 900px) {
  .settings-container {
    grid-template-columns: 1fr;
  }
}
</style>
