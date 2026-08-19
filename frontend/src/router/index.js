import { createRouter, createWebHistory } from 'vue-router'

// Page components (lazy-loaded)
const VaultPage = () => import('../pages/VaultPage.vue')
const ChatPage = () => import('../pages/ChatPage.vue')
const AuditPage = () => import('../pages/AuditPage.vue')
const UsersPage = () => import('../pages/UsersPage.vue')
const SettingsLayout = () => import('../pages/settings/SettingsLayout.vue')
const ProfileSettings = () => import('../pages/settings/ProfileSettings.vue')
const SecuritySettings = () => import('../pages/settings/SecuritySettings.vue')
const SystemSettings = () => import('../pages/settings/SystemSettings.vue')
const NotificationSettings = () => import('../pages/settings/NotificationSettings.vue')
const SmtpSettings = () => import('../pages/settings/SmtpSettings.vue')

function parseJwt() {
  try {
    const token = localStorage.getItem('token')
    if (!token) return null
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(window.atob(base64))
  } catch { return null }
}

const routes = [
  { path: '/', redirect: '/vault' },
  { path: '/login', redirect: '/vault' },
  { path: '/vault', name: 'Vault', component: VaultPage, meta: { title: 'Belge Kasası' } },
  { path: '/chat', name: 'Chat', component: ChatPage, meta: { title: 'Kurum İçi Sohbet' } },
  { path: '/audit', name: 'Audit', component: AuditPage, meta: { title: 'Denetim Günlüğü', roles: ['ciso'] } },
  { path: '/users', name: 'Users', component: UsersPage, meta: { title: 'Kullanıcı Yönetimi', roles: ['admin', 'ciso'] } },
  {
    path: '/settings',
    component: SettingsLayout,
    meta: { title: 'Ayarlar' },
    redirect: '/settings/profile',
    children: [
      { path: 'profile', name: 'SettingsProfile', component: ProfileSettings, meta: { title: 'Profil & Görünüm' } },
      { path: 'security', name: 'SettingsSecurity', component: SecuritySettings, meta: { title: 'Güvenlik' } },
      { path: 'system', name: 'SettingsSystem', component: SystemSettings, meta: { title: 'Sistem Yönetimi', roles: ['admin', 'ciso'] } },
      { path: 'notifications', name: 'SettingsNotifications', component: NotificationSettings, meta: { title: 'Alarm & Bildirimler', roles: ['admin', 'ciso'] } },
      { path: 'smtp', name: 'SettingsSmtp', component: SmtpSettings, meta: { title: 'SMTP & Log', roles: ['ciso'] } }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/vault' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard — rol kontrolü
router.beforeEach((to, from, next) => {
  const payload = parseJwt()

  // Rol bazlı erişim kısıtlaması (token varsa ve rol yetmiyorsa)
  if (to.meta.roles && payload) {
    if (!to.meta.roles.includes(payload.role)) {
      return next('/vault')
    }
  }

  // Sayfa başlığı
  if (to.meta.title) {
    document.title = `DMS - ${to.meta.title}`
  }

  next()
})

export default router
