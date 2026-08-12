<template>
  <div class="native-lang-wrapper">
    <!-- Kompakt Dil Butonu (Orijinal Tema ve Font) -->
    <button 
      type="button" 
      class="btn-lang-selector notranslate" 
      translate="no"
      @click="isOpen = true"
      title="Dili Değiştir / Change Language"
    >
      <span class="flag-emoji">{{ currentFlag }}</span>
      <span class="lang-text">{{ currentCode.toUpperCase() }}</span>
      <span class="arrow">▼</span>
    </button>

    <!-- Dil Seçim Modalı (Arama Barı Destekli Bütün Dünya Dilleri) -->
    <div v-if="isOpen" class="lang-modal-overlay" @click.self="isOpen = false">
      <div class="lang-modal-card">
        <div class="lang-modal-header">
          <div class="header-title-box">
            <span class="globe-icon">🌐</span>
            <div>
              <h3>Languages / Diller</h3>
              <p class="subtitle">Select your language / Dilinizi seçin (Dünya Dilleri)</p>
            </div>
          </div>
          <button class="btn-close-modal" @click="isOpen = false">✖</button>
        </div>

        <!-- Dil Arama Çubuğu -->
        <div class="lang-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search language / Dil ara (e.g. English, Türkçe, Deutsch, Español, Русский)..." 
          />
          <span v-if="searchQuery" class="clear-icon" @click="searchQuery = ''">✖</span>
        </div>

        <!-- Diller Listesi Grid -->
        <div class="lang-grid-scroll">
          <div 
            v-for="lang in filteredLanguages" 
            :key="lang.code"
            :class="['lang-item-card', { active: currentCode === lang.code }]"
            @click="selectLanguage(lang.code)"
          >
            <span class="item-flag">{{ lang.flag }}</span>
            <div class="item-info">
              <span class="native-name">{{ lang.nativeName }}</span>
              <span class="english-name">{{ lang.name }}</span>
            </div>
            <span v-if="currentCode === lang.code" class="check-mark">✓</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import i18n from '../i18n.js'
import { loadDynamicTranslations } from '../TranslationService.js'

const isOpen = ref(false)
const searchQuery = ref('')

const languages = [
  { code: 'tr', flag: '🇹🇷', nativeName: 'Türkçe', name: 'Turkish' },
  { code: 'en', flag: '🇬🇧', nativeName: 'English', name: 'English' },
  { code: 'de', flag: '🇩🇪', nativeName: 'Deutsch', name: 'German' },
  { code: 'fr', flag: '🇫🇷', nativeName: 'Français', name: 'French' },
  { code: 'es', flag: '🇪🇸', nativeName: 'Español', name: 'Spanish' },
  { code: 'it', flag: '🇮🇹', nativeName: 'Italiano', name: 'Italian' },
  { code: 'ru', flag: '🇷🇺', nativeName: 'Русский', name: 'Russian' },
  { code: 'ar', flag: '🇸🇦', nativeName: 'العربية', name: 'Arabic' },
  { code: 'zh-CN', flag: '🇨🇳', nativeName: '中文 (简体)', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', flag: '🇹🇼', nativeName: '中文 (繁體)', name: 'Chinese (Traditional)' },
  { code: 'ja', flag: '🇯🇵', nativeName: '日本語', name: 'Japanese' },
  { code: 'ko', flag: '🇰🇷', nativeName: '한국어', name: 'Korean' },
  { code: 'pt', flag: '🇵🇹', nativeName: 'Português', name: 'Portuguese' },
  { code: 'nl', flag: '🇳🇱', nativeName: 'Nederlands', name: 'Dutch' },
  { code: 'hi', flag: '🇮🇳', nativeName: 'हिन्दी', name: 'Hindi' },
  { code: 'pl', flag: '🇵🇱', nativeName: 'Polski', name: 'Polish' },
  { code: 'sv', flag: '🇸🇪', nativeName: 'Svenska', name: 'Swedish' },
  { code: 'el', flag: '🇬🇷', nativeName: 'Ελληνικά', name: 'Greek' },
  { code: 'fa', flag: '🇮🇷', nativeName: 'فارسی', name: 'Persian' },
  { code: 'id', flag: '🇮🇩', nativeName: 'Bahasa Indonesia', name: 'Indonesian' },
  { code: 'vi', flag: '🇻🇳', nativeName: 'Tiếng Việt', name: 'Vietnamese' },
  { code: 'uk', flag: '🇺🇦', nativeName: 'Українська', name: 'Ukrainian' },
  { code: 'ro', flag: '🇷🇴', nativeName: 'Română', name: 'Romanian' },
  { code: 'hu', flag: '🇭🇺', nativeName: 'Magyar', name: 'Hungarian' },
  { code: 'cs', flag: '🇨🇿', nativeName: 'Čeština', name: 'Czech' },
  { code: 'sk', flag: '🇸🇰', nativeName: 'Slovenčina', name: 'Slovak' },
  { code: 'bg', flag: '🇧🇬', nativeName: 'Български', name: 'Bulgarian' },
  { code: 'da', flag: '🇩🇰', nativeName: 'Dansk', name: 'Danish' },
  { code: 'fi', flag: '🇫🇮', nativeName: 'Suomi', name: 'Finnish' },
  { code: 'no', flag: '🇳🇴', nativeName: 'Norsk', name: 'Norwegian' },
  { code: 'az', flag: '🇦🇿', nativeName: 'Azərbaycan', name: 'Azerbaijani' },
  { code: 'kk', flag: '🇰🇿', nativeName: 'Қазақ тілі', name: 'Kazakh' },
  { code: 'uz', flag: '🇺🇿', nativeName: 'O\'zbek', name: 'Uzbek' },
  { code: 'ky', flag: '🇰🇬', nativeName: 'Кыргызча', name: 'Kyrgyz' },
  { code: 'tk', flag: '🇹🇲', nativeName: 'Türkmençe', name: 'Turkmen' },
  { code: 'th', flag: '🇹🇭', nativeName: 'ไทย', name: 'Thai' },
  { code: 'ms', flag: '🇲🇾', nativeName: 'Bahasa Melayu', name: 'Malay' },
  { code: 'tl', flag: '🇵🇭', nativeName: 'Filipino', name: 'Filipino' },
  { code: 'bn', flag: '🇧🇩', nativeName: 'বাংলা', name: 'Bengali' },
  { code: 'ur', flag: '🇵🇰', nativeName: 'اردو', name: 'Urdu' },
  { code: 'he', flag: '🇮🇱', nativeName: 'עברית', name: 'Hebrew' },
  { code: 'sq', flag: '🇦🇱', nativeName: 'Shqip', name: 'Albanian' },
  { code: 'bs', flag: '🇧🇦', nativeName: 'Bosanski', name: 'Bosnian' },
  { code: 'hr', flag: '🇭🇷', nativeName: 'Hrvatski', name: 'Croatian' },
  { code: 'sr', flag: '🇷🇸', nativeName: 'Српски', name: 'Serbian' },
  { code: 'mk', flag: '🇲🇰', nativeName: 'Македонски', name: 'Macedonian' },
  { code: 'ka', flag: '🇬🇪', nativeName: 'ქართული', name: 'Georgian' },
  { code: 'hy', flag: '🇦🇲', nativeName: 'Հայերեն', name: 'Armenian' },
  { code: 'sw', flag: '🇰🇪', nativeName: 'Kiswahili', name: 'Swahili' },
  { code: 'af', flag: '🇿🇦', nativeName: 'Afrikaans', name: 'Afrikaans' },
  { code: 'am', flag: '🇪🇹', nativeName: 'አማርኛ', name: 'Amharic' },
  { code: 'be', flag: '🇧🇾', nativeName: 'Беларуская', name: 'Belarusian' },
  { code: 'ca', flag: '🇦🇩', nativeName: 'Català', name: 'Catalan' },
  { code: 'ceb', flag: '🇵🇭', nativeName: 'Cebuano', name: 'Cebuano' },
  { code: 'co', flag: '🇫🇷', nativeName: 'Corsu', name: 'Corsican' },
  { code: 'cy', flag: '🇬🇧', nativeName: 'Cymraeg', name: 'Welsh' },
  { code: 'eo', flag: '🌍', nativeName: 'Esperanto', name: 'Esperanto' },
  { code: 'et', flag: '🇪🇪', nativeName: 'Eesti', name: 'Estonian' },
  { code: 'eu', flag: '🇪🇸', nativeName: 'Euskara', name: 'Basque' },
  { code: 'fy', flag: '🇳🇱', nativeName: 'Frysk', name: 'Frisian' },
  { code: 'ga', flag: '🇮🇪', nativeName: 'Gaeilge', name: 'Irish' },
  { code: 'gd', flag: '🇬🇧', nativeName: 'Gàidhlig', name: 'Scots Gaelic' },
  { code: 'gl', flag: '🇪🇸', nativeName: 'Galego', name: 'Galician' },
  { code: 'gu', flag: '🇮🇳', nativeName: 'ગુજરાતી', name: 'Gujarati' },
  { code: 'ha', flag: '🇳🇬', nativeName: 'Hausa', name: 'Hausa' },
  { code: 'haw', flag: '🇺🇸', nativeName: 'Hawaiʻi', name: 'Hawaiian' },
  { code: 'hmn', flag: '🇱🇦', nativeName: 'Hmong', name: 'Hmong' },
  { code: 'ht', flag: '🇭🇹', nativeName: 'Kreyòl Ayisyen', name: 'Haitian Creole' },
  { code: 'ig', flag: '🇳🇬', nativeName: 'Igbo', name: 'Igbo' },
  { code: 'is', flag: '🇮🇸', nativeName: 'Íslenska', name: 'Icelandic' },
  { code: 'jw', flag: '🇮🇩', nativeName: 'Jawa', name: 'Javanese' },
  { code: 'kn', flag: '🇮🇳', nativeName: 'ಕನ್ನಡ', name: 'Kannada' },
  { code: 'km', flag: '🇰🇭', nativeName: 'ខ្មែរ', name: 'Khmer' },
  { code: 'ku', flag: '🇹🇷', nativeName: 'Kurdî', name: 'Kurdish' },
  { code: 'la', flag: '🇻🇦', nativeName: 'Latina', name: 'Latin' },
  { code: 'lb', flag: '🇱🇺', nativeName: 'Lëtzebuergesch', name: 'Luxembourgish' },
  { code: 'lo', flag: '🇱🇦', nativeName: 'ລາວ', name: 'Lao' },
  { code: 'lt', flag: '🇱🇹', nativeName: 'Lietuvių', name: 'Lithuanian' },
  { code: 'lv', flag: '🇱🇻', nativeName: 'Latviešu', name: 'Latvian' },
  { code: 'mg', flag: '🇲🇬', nativeName: 'Malagasy', name: 'Malagasy' },
  { code: 'mi', flag: '🇳🇿', nativeName: 'Māori', name: 'Maori' },
  { code: 'ml', flag: '🇮🇳', nativeName: 'മലയാളം', name: 'Malayalam' },
  { code: 'mr', flag: '🇮🇳', nativeName: 'मराठी', name: 'Marathi' },
  { code: 'mt', flag: '🇲🇹', nativeName: 'Malti', name: 'Maltese' },
  { code: 'my', flag: '🇲🇲', nativeName: 'မြန်မာ', name: 'Burmese' },
  { code: 'ne', flag: '🇳🇵', nativeName: 'नेपाली', name: 'Nepali' },
  { code: 'ny', flag: '🇲🇼', nativeName: 'Chichewa', name: 'Chichewa' },
  { code: 'or', flag: '🇮🇳', nativeName: 'ଓଡ଼ିଆ', name: 'Odia' },
  { code: 'pa', flag: '🇮🇳', nativeName: 'ਪੰਜਾਬੀ', name: 'Punjabi' },
  { code: 'ps', flag: '🇦🇫', nativeName: 'پښتو', name: 'Pashto' },
  { code: 'rw', flag: '🇷🇼', nativeName: 'Kinyarwanda', name: 'Kinyarwanda' },
  { code: 'sd', flag: '🇵🇰', nativeName: 'سنڌي', name: 'Sindhi' },
  { code: 'si', flag: '🇱🇰', nativeName: 'සිංහල', name: 'Sinhala' },
  { code: 'sm', flag: '🇼🇸', nativeName: 'Samoan', name: 'Samoan' },
  { code: 'sn', flag: '🇿🇼', nativeName: 'Shona', name: 'Shona' },
  { code: 'so', flag: '🇸🇴', nativeName: 'Soomaali', name: 'Somali' },
  { code: 'st', flag: '🇱🇸', nativeName: 'Sesotho', name: 'Sesotho' },
  { code: 'su', flag: '🇮🇩', nativeName: 'Basa Sunda', name: 'Sundanese' },
  { code: 'ta', flag: '🇮🇳', nativeName: 'தமிழ்', name: 'Tamil' },
  { code: 'te', flag: '🇮🇳', nativeName: 'తెలుగు', name: 'Telugu' },
  { code: 'tg', flag: '🇹🇯', nativeName: 'Тоҷикӣ', name: 'Tajik' },
  { code: 'xh', flag: '🇿🇦', nativeName: 'isiXhosa', name: 'Xhosa' },
  { code: 'yi', flag: '🇮🇱', nativeName: 'ייִדיש', name: 'Yiddish' },
  { code: 'yo', flag: '🇳🇬', nativeName: 'Yorùbá', name: 'Yoruba' },
  { code: 'zu', flag: '🇿🇦', nativeName: 'isiZulu', name: 'Zulu' },
  { code: 'tt', flag: '🇷🇺', nativeName: 'Татар', name: 'Tatar' },
  { code: 'ug', flag: '🇨🇳', nativeName: 'ئۇيغۇرچە', name: 'Uyghur' }
]

const currentCodeValue = ref(localStorage.getItem('dms_locale') || 'tr')

function clearGoogleTranslateCookies() {
  const domain = window.location.hostname;
  document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain}`;
}

onMounted(async () => {
  clearGoogleTranslateCookies();
  const saved = localStorage.getItem('dms_locale') || 'tr';
  if (i18n && i18n.global) {
    i18n.global.locale.value = saved;
  }
  currentCodeValue.value = saved;
  await loadDynamicTranslations(saved);
})

const currentCode = computed(() => currentCodeValue.value)

const currentFlag = computed(() => {
  const match = languages.find(l => l.code === currentCodeValue.value)
  return match ? match.flag : '🇹🇷'
})

const filteredLanguages = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return languages
  return languages.filter(l => 
    l.name.toLowerCase().includes(q) || 
    l.nativeName.toLowerCase().includes(q) || 
    l.code.toLowerCase().includes(q)
  )
})

async function selectLanguage(code) {
  isOpen.value = false
  currentCodeValue.value = code
  localStorage.setItem('dms_locale', code)

  await loadDynamicTranslations(code)

  if (i18n && i18n.global) {
    i18n.global.locale.value = code
  }
}
</script>

<style scoped>
.native-lang-wrapper {
  display: inline-block;
  font-family: inherit !important;
}

.btn-lang-selector {
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.25);
  color: #a78bfa;
  padding: 0.4rem 0.8rem;
  font-size: 0.74rem;
  font-weight: 600;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.05);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: inherit !important;
}

.btn-lang-selector:hover {
  background: rgba(139, 92, 246, 0.18);
  border-color: #a78bfa;
  box-shadow: 0 0 15px rgba(139, 92, 246, 0.25);
  transform: translateY(-1px);
}

.flag-emoji {
  font-size: 0.95rem;
}

.arrow {
  font-size: 0.55rem;
  opacity: 0.6;
}

/* Modal Overlay */
.lang-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(3, 7, 18, 0.75);
  backdrop-filter: blur(8px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  font-family: inherit !important;
}

.lang-modal-card {
  background: #0f172a;
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 16px;
  width: 100%;
  max-width: 620px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.8);
  overflow: hidden;
}

.lang-modal-header {
  padding: 1.25rem 1.5rem;
  background: #0f172a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.globe-icon {
  font-size: 1.8rem;
}

.header-title-box h3 {
  color: #a78bfa;
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
}

.header-title-box .subtitle {
  color: #94a3b8;
  font-size: 0.78rem;
  margin: 0.2rem 0 0 0;
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

.lang-search-box {
  padding: 0.85rem 1.25rem;
  background: #1e293b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: #94a3b8;
  position: relative;
}

.lang-search-box input {
  width: 100%;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  padding: 0.6rem 0.85rem;
  border-radius: 8px;
  font-size: 0.88rem;
  outline: none;
  font-family: inherit !important;
}

.lang-search-box input:focus {
  border-color: #a78bfa;
  box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.2);
}

.clear-icon {
  position: absolute;
  right: 1.8rem;
  cursor: pointer;
  color: #64748b;
  font-size: 0.85rem;
}

.lang-grid-scroll {
  padding: 1.25rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.65rem;
  overflow-y: auto;
  max-height: 55vh;
}

.lang-item-card {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.85rem;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.lang-item-card:hover {
  background: rgba(139, 92, 246, 0.18);
  border-color: #a78bfa;
  transform: translateY(-1px);
}

.lang-item-card.active {
  background: rgba(139, 92, 246, 0.25);
  border-color: #a78bfa;
}

.item-flag {
  font-size: 1.3rem;
}

.item-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.native-name {
  color: #f8fafc;
  font-weight: 700;
  font-size: 0.82rem;
}

.english-name {
  color: #64748b;
  font-size: 0.72rem;
}

.check-mark {
  color: #a78bfa;
  font-weight: bold;
}
</style>
