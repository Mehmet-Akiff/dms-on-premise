import { createI18n } from 'vue-i18n';

const messages = {
  tr: {
    nav: {
      title: 'DMS On-Premise',
      dashboard: 'Dashboard',
      users: 'Kullanýcýlar',
      documents: 'Belgeler',
      settings: 'Ayarlar',
      logout: 'Çýkýþ Yap',
      login: 'Giriþ Yap',
      kasaLock: 'Kasa Kilidi'
    },
    common: {
      save: 'Kaydet',
      cancel: 'Ýptal',
      edit: 'Düzenle',
      delete: 'Sil',
      add: 'Ekle',
      search: 'Ara...',
      loading: 'Yükleniyor...',
      success: 'Baþarýlý',
      error: 'Hata',
      warning: 'Uyarý'
    },
    dashboard: {
      totalDocs: 'Toplam Doküman',
      last24h: 'Son 24 Saat',
      last7d: 'Son 7 Gün',
      trash: 'Çöp Kutusu',
      categoryDist: 'Kategoriye Göre Daðýlým'
    },
    settings: {
      title: 'Sistem Ayarlarý',
      smtpTitle: 'SMTP Mail Ayarlarý',
      kasaTitle: 'Kasa ve Güvenlik Ayarlarý',
      testEmail: 'Test Maili Gönder',
      saveSMTP: 'SMTP Ayarlarýný Kaydet',
      saveKasa: 'Güvenlik Ayarlarýný Kaydet',
      sessionTimeout: 'Oturum Süresi (Dakika)',
      kasaPassword: 'Kasa Þifresi',
      kasaTimeout: 'Kasa Kilidi Süresi (Dakika)',
      cisoEmail: 'CISO (Güvenlik) E-Posta Adresi',
      host: 'SMTP Sunucusu',
      port: 'Port',
      user: 'Kullanýcý Adý',
      pass: 'Þifre',
      secure: 'Güvenli Baðlantý (SSL/TLS)'
    },
    users: {
      title: 'Kullanýcý Yönetimi',
      addUser: 'Yeni Kullanýcý Ekle',
      username: 'Kullanýcý Adý',
      fullName: 'Ad Soyad',
      email: 'E-Posta',
      role: 'Rol',
      status: 'Durum',
      actions: 'Ýþlemler',
      admin: 'Sistem Yöneticisi',
      ciso: 'Güvenlik Yöneticisi',
      user: 'Standart Kullanýcý'
    },
    auth: {
      loginTitle: 'DMS Giriþ',
      username: 'Kullanýcý Adý',
      password: 'Þifre',
      loginBtn: 'Giriþ Yap'
    }
  },
  en: {
    nav: {
      title: 'DMS On-Premise',
      dashboard: 'Dashboard',
      users: 'Users',
      documents: 'Documents',
      settings: 'Settings',
      logout: 'Logout',
      login: 'Login',
      kasaLock: 'Vault Lock'
    },
    common: {
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      add: 'Add',
      search: 'Search...',
      loading: 'Loading...',
      success: 'Success',
      error: 'Error',
      warning: 'Warning'
    },
    dashboard: {
      totalDocs: 'Total Documents',
      last24h: 'Last 24 Hours',
      last7d: 'Last 7 Days',
      trash: 'Trash Can',
      categoryDist: 'Distribution by Category'
    },
    settings: {
      title: 'System Settings',
      smtpTitle: 'SMTP Mail Settings',
      kasaTitle: 'Vault & Security Settings',
      testEmail: 'Send Test Email',
      saveSMTP: 'Save SMTP Settings',
      saveKasa: 'Save Security Settings',
      sessionTimeout: 'Session Timeout (Minutes)',
      kasaPassword: 'Vault Password',
      kasaTimeout: 'Vault Lock Timeout (Minutes)',
      cisoEmail: 'CISO (Security) Email Address',
      host: 'SMTP Host',
      port: 'Port',
      user: 'Username',
      pass: 'Password',
      secure: 'Secure Connection (SSL/TLS)'
    },
    users: {
      title: 'User Management',
      addUser: 'Add New User',
      username: 'Username',
      fullName: 'Full Name',
      email: 'Email',
      role: 'Role',
      status: 'Status',
      actions: 'Actions',
      admin: 'System Administrator',
      ciso: 'Security Administrator',
      user: 'Standard User'
    },
    auth: {
      loginTitle: 'DMS Login',
      username: 'Username',
      password: 'Password',
      loginBtn: 'Login'
    }
  }
};

const savedLocale = localStorage.getItem('dms_locale') || 'tr';

const i18n = createI18n({
  locale: savedLocale,
  fallbackLocale: 'en',
  messages,
});

export default i18n;
