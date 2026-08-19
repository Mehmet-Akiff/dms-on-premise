import { createApp } from 'vue'
import App from './App.vue'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import i18n from './i18n'

// Google Translate Defensive Node Patch for Vue 3
if (typeof Node !== 'undefined' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child && child.parentNode !== this) {
      if (console) console.warn('Cannot remove child, parent mismatch', child, this);
      return child;
    }
    return originalRemoveChild.apply(this, arguments);
  };
  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console) console.warn('Cannot insert child, parent mismatch', referenceNode, this);
      return newNode;
    }
    return originalInsertBefore.apply(this, arguments);
  };
}

// LocalStorage Ezici (Güvenlik Modları İçin)
const originalGetItem = localStorage.getItem.bind(localStorage);
const originalSetItem = localStorage.setItem.bind(localStorage);
const originalRemoveItem = localStorage.removeItem.bind(localStorage);

localStorage.getItem = function(key) {
  if (key === 'token' || key === 'kasa_token') {
    const mode = originalGetItem('rememberDevice') || 'always';
    if (mode === 'always') return originalGetItem(key);
    if (mode === 'session') return sessionStorage.getItem(key);
    if (mode === 'never') return window.dmsToken || null;
  }
  return originalGetItem(key);
};

localStorage.setItem = function(key, value) {
  if (key === 'token' || key === 'kasa_token') {
    const mode = originalGetItem('rememberDevice') || 'always';
    if (mode === 'always') {
      originalSetItem(key, value);
    } else if (mode === 'session') {
      sessionStorage.setItem(key, value);
    } else {
      window.dmsToken = value;
    }
    return;
  }
  originalSetItem(key, value);
};

localStorage.removeItem = function(key) {
  if (key === 'token' || key === 'kasa_token') {
    originalRemoveItem(key);
    sessionStorage.removeItem(key);
    delete window.dmsToken;
    return;
  }
  originalRemoveItem(key);
};

// Global Fetch Interceptor for 401 Unauthorized
const originalFetch = window.fetch;
window.fetch = async function () {
  const response = await originalFetch.apply(this, arguments);
  
  if (response.status === 401) {
    const url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0]?.url || '');
    
    // Login isteklerinde 401 dönmesi normaldir (yanlış şifre vb), bunları atla.
    if (!url.includes('/api/auth/login')) {
      console.warn('[DMS Interceptor] 401 Unauthorized. Forcing logout and redirecting to /login');
      
      // Temizlik işlemleri
      localStorage.removeItem('token');
      localStorage.removeItem('kasa_token');
      
      // Hemen login'e zorla
      window.location.href = '/login';
      
      // Asıl isteği yapan kodun (App.vue vb) çalışmaya devam edip ekrana "veriler alınamadı"
      // gibi anlamsız Toast/Snackbar hataları basmasını engellemek için,
      // asla çözümlenmeyen (pending) bir Promise döndürüyoruz.
      // Böylece fetch() çağrısı asılı kalır ve alt satırlardaki try/catch/then blokları çalışmaz.
      return new Promise(() => {});
    }
  }
  return response;
};

import router from './router'

const app = createApp(App)

app.use(router)
app.use(i18n)
app.use(Toast, {
  position: 'top-right',
  timeout: 3500,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: 'button',
  icon: true,
  rtl: false,
  transition: 'Vue-Toastification__fade',
  maxToasts: 5,
  newestOnTop: true,
  containerClassName: 'dms-toast-container',
  toastClassName: 'dms-toast',
})

app.mount('#app')
