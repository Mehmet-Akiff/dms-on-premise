<template>
  <div class="dashboard-container">
    <!-- Ana İstatistik Kartları -->
    <div class="stats-grid">
      <div class="stat-card stat-card--total">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.totalDocuments }}</span>
          <span class="stat-label">Toplam Doküman</span>
        </div>
        <div class="stat-glow stat-glow--blue"></div>
      </div>

      <div class="stat-card stat-card--recent">
        <div class="stat-icon">⏱️</div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.last24h }}</span>
          <span class="stat-label">Son 24 Saat</span>
        </div>
        <div class="stat-glow stat-glow--green"></div>
      </div>

      <div class="stat-card stat-card--weekly">
        <div class="stat-icon">📅</div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.last7d }}</span>
          <span class="stat-label">Son 7 Gün</span>
        </div>
        <div class="stat-glow stat-glow--purple"></div>
      </div>

      <div class="stat-card stat-card--trash">
        <div class="stat-icon">🗑️</div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.trashCount }}</span>
          <span class="stat-label">Çöp Kutusu</span>
        </div>
        <div class="stat-glow stat-glow--red"></div>
      </div>
    </div>

    <!-- Kategori Dağılımı -->
    <div class="category-section" v-if="stats.categoryDistribution.length > 0">
      <h4 class="section-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
        Kategoriye Göre Dağılım
      </h4>
      <div class="category-bars">
        <div 
          v-for="cat in stats.categoryDistribution" 
          :key="cat.category" 
          class="category-bar-item"
        >
          <div class="category-bar-header">
            <span class="category-name">
              {{ getCategoryIcon(cat.category) }} {{ cat.category }}
            </span>
            <span class="category-count">{{ cat.count }}</span>
          </div>
          <div class="category-bar-track">
            <div 
              class="category-bar-fill" 
              :style="{ 
                width: getBarWidth(cat.count) + '%',
                background: getCategoryColor(cat.category)
              }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const stats = ref({
  totalDocuments: 0,
  last24h: 0,
  last7d: 0,
  trashCount: 0,
  statusDistribution: {},
  categoryDistribution: [],
})

const isLoading = ref(true)

async function fetchStats() {
  try {
    const response = await fetch('/api/documents/stats')
    if (response.ok) {
      const data = await response.json()
      stats.value = data
    }
  } catch (error) {
    console.error('[Dashboard] İstatistik çekme hatası:', error)
  } finally {
    isLoading.value = false
  }
}

function getBarWidth(count) {
  const maxCount = Math.max(...stats.value.categoryDistribution.map(c => c.count), 1)
  return (count / maxCount) * 100
}

const categoryColors = {
  'Fatura': 'linear-gradient(90deg, #38bdf8, #0ea5e9)',
  'Sözleşme': 'linear-gradient(90deg, #a78bfa, #7c3aed)',
  'Dilekçe': 'linear-gradient(90deg, #34d399, #10b981)',
  'Rapor': 'linear-gradient(90deg, #fbbf24, #f59e0b)',
  'Resmi Yazı': 'linear-gradient(90deg, #f472b6, #ec4899)',
  'Kimlik/Belge': 'linear-gradient(90deg, #fb923c, #f97316)',
  'Mektup': 'linear-gradient(90deg, #818cf8, #6366f1)',
  'Diger': 'linear-gradient(90deg, #94a3b8, #64748b)',
}

const categoryIcons = {
  'Fatura': '🧾',
  'Sözleşme': '📑',
  'Dilekçe': '📝',
  'Rapor': '📈',
  'Resmi Yazı': '📜',
  'Kimlik/Belge': '🪪',
  'Mektup': '✉️',
  'Diger': '📂',
}

function getCategoryColor(cat) {
  return categoryColors[cat] || categoryColors['Diger']
}

function getCategoryIcon(cat) {
  return categoryIcons[cat] || '📄'
}

// Public method: Dışarıdan yenilemek için
function refresh() {
  fetchStats()
}

defineExpose({ refresh })

onMounted(() => {
  fetchStats()
})
</script>

<style scoped>
.dashboard-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

/* ==================== STATS GRID ==================== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.85rem;
}

.stat-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 1rem 1.1rem;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  backdrop-filter: blur(12px);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.stat-icon {
  font-size: 1.6rem;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  z-index: 1;
}

.stat-value {
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--text-primary);
  line-height: 1;
}

.stat-label {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Glow Efektleri */
.stat-glow {
  position: absolute;
  top: -20px;
  right: -20px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  filter: blur(30px);
  opacity: 0.15;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.stat-card:hover .stat-glow {
  opacity: 0.25;
}

.stat-glow--blue { background: #38bdf8; }
.stat-glow--green { background: #22c55e; }
.stat-glow--purple { background: #a78bfa; }
.stat-glow--red { background: #ef4444; }

/* ==================== KATEGORİ BÖLÜMÜ ==================== */
.category-section {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 1rem 1.25rem;
  backdrop-filter: blur(12px);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.85rem;
}

.section-title svg {
  color: var(--accent);
  opacity: 0.75;
}

.category-bars {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.category-bar-item {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.category-bar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-name {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.category-count {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.05);
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  min-width: 28px;
  text-align: center;
}

.category-bar-track {
  height: 6px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 999px;
  overflow: hidden;
}

.category-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 4px;
}

/* ==================== RESPONSIVE ==================== */
@media (max-width: 900px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 500px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
