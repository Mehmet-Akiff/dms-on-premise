/**
 * DMS On-Premise — Tema Yönetim Modülü (ThemeProvider)
 * localStorage üzerinden açık/koyu tema + accent renk paleti yönetimi.
 */

const THEME_KEY = 'dms-theme';
const CHAT_THEME_KEY = 'dms-chat-theme';
const ACCENT_KEY = 'dms-accent';

// Accent paletleri
export const ACCENT_PALETTES = {
  violet: { primary: '#8b5cf6', secondary: '#3b82f6', label: 'Violet' },
  blue: { primary: '#3b82f6', secondary: '#06b6d4', label: 'Mavi' },
  emerald: { primary: '#10b981', secondary: '#14b8a6', label: 'Zümrüt' },
  rose: { primary: '#f43f5e', secondary: '#ec4899', label: 'Gül' },
  amber: { primary: '#f59e0b', secondary: '#f97316', label: 'Amber' },
  slate: { primary: '#64748b', secondary: '#475569', label: 'Gri' },
};

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

export function getChatTheme() {
  return localStorage.getItem(CHAT_THEME_KEY) || getTheme();
}

export function getAccent() {
  return localStorage.getItem(ACCENT_KEY) || 'violet';
}

export function setTheme(mode) {
  const validMode = mode === 'light' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, validMode);
  applyTheme(validMode);
}

export function setChatTheme(mode) {
  const validMode = mode === 'light' ? 'light' : 'dark';
  localStorage.setItem(CHAT_THEME_KEY, validMode);
}

export function setAccent(palette) {
  const valid = ACCENT_PALETTES[palette] ? palette : 'violet';
  localStorage.setItem(ACCENT_KEY, valid);
  applyAccent(valid);
}

export function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode || getTheme());
}

export function applyAccent(palette) {
  const p = ACCENT_PALETTES[palette] || ACCENT_PALETTES.violet;
  document.documentElement.style.setProperty('--accent', p.primary);
  document.documentElement.style.setProperty('--accent-primary', p.primary);
  document.documentElement.style.setProperty('--accent-secondary', p.secondary);
  document.documentElement.style.setProperty('--color-accent-bg', p.primary);
  document.documentElement.style.setProperty('--color-accent-text', p.primary);
  document.documentElement.style.setProperty('--accent-hover', p.secondary);
  
  // Create an rgba glow color based on palette
  let glow = 'rgba(139, 92, 246, 0.25)';
  if (palette === 'blue') glow = 'rgba(59, 130, 246, 0.25)';
  if (palette === 'emerald') glow = 'rgba(16, 185, 129, 0.25)';
  if (palette === 'rose') glow = 'rgba(244, 63, 94, 0.25)';
  if (palette === 'amber') glow = 'rgba(245, 158, 11, 0.25)';
  if (palette === 'slate') glow = 'rgba(100, 116, 139, 0.25)';
  
  document.documentElement.style.setProperty('--accent-glow', glow);
  document.documentElement.setAttribute('data-accent', palette || 'violet');
}

const SIDEBAR_MODE_KEY = 'dms_sidebar_mode';

export function getSidebarMode() {
  return localStorage.getItem(SIDEBAR_MODE_KEY) || 'hover';
}

export function setSidebarMode(mode) {
  const valid = mode === 'pinned' ? 'pinned' : 'hover';
  localStorage.setItem(SIDEBAR_MODE_KEY, valid);
  applySidebarMode(valid);
}

export function applySidebarMode(mode) {
  const current = mode || getSidebarMode();
  document.documentElement.setAttribute('data-sidebar-mode', current);
  window.dispatchEvent(new CustomEvent('sidebar-mode-changed', { detail: current }));
}

export function initTheme() {
  applyTheme(getTheme());
  applyAccent(getAccent());
  applySidebarMode(getSidebarMode());
}
