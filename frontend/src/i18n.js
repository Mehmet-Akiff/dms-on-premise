import { createI18n } from 'vue-i18n';
import tr from './locales/tr.json';
import en from './locales/en.json';

const messages = {
  tr,
  en
};

const savedLocale = localStorage.getItem('dms_locale') || 'tr';

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: savedLocale,
  fallbackLocale: 'tr',
  messages,
});

export default i18n;
