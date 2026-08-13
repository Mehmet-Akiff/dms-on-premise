/**
 * DMS On-Premise — Tema Yönetim Modülü (ThemeProvider)
 * localStorage üzerinden açık/koyu tema yönetimi sağlar.
 * Chat ve genel sistem için ayrı çalışabilir.
 */

const THEME_KEY = 'dms-theme';
const CHAT_THEME_KEY = 'dms-chat-theme';

/**
 * Genel sistem temasını döndürür
 */
export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

/**
 * Chat temasını döndürür (bağımsız çalışabilir)
 */
export function getChatTheme() {
  return localStorage.getItem(CHAT_THEME_KEY) || getTheme();
}

/**
 * Genel sistem temasını ayarlar
 */
export function setTheme(mode) {
  const validMode = mode === 'light' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, validMode);
  applyTheme(validMode);
}

/**
 * Chat temasını bağımsız ayarlar
 */
export function setChatTheme(mode) {
  const validMode = mode === 'light' ? 'light' : 'dark';
  localStorage.setItem(CHAT_THEME_KEY, validMode);
}

/**
 * Genel sistem temasını tersine çevirir
 */
export function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/**
 * Temayı DOM'a uygular
 */
export function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode || getTheme());
}

/**
 * Uygulama başlangıcında çağrılır
 */
export function initTheme() {
  applyTheme(getTheme());
}
