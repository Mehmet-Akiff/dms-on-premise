import { createApp } from 'vue'
import App from './App.vue'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import i18n from './i18n'

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

const app = createApp(App)

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
