<template>
  <div id="dms-app">
    <header class="dms-header">
      <div class="logo">
        <span class="logo-icon">📄</span>
        <h1>DMS</h1>
        <span class="badge">On-Premise</span>
      </div>
      <p class="subtitle">Yapay Zeka Destekli Akıllı Doküman Yönetim Sistemi</p>
    </header>

    <main class="dms-main">
      <div class="status-card">
        <h2>🚀 Sistem Durumu</h2>
        <p>Frontend iskeleti başarıyla yüklendi.</p>
        <ul>
          <li>✅ Vue 3 + Vite — Aktif</li>
          <li>⏳ Backend API Bağlantısı — Beklemede</li>
          <li>⏳ AI Servisi Bağlantısı — Beklemede</li>
          <li>⏳ PostgreSQL Bağlantısı — Beklemede</li>
        </ul>
      </div>
    </main>

    <footer class="dms-footer">
      <p>&copy; 2026 DMS On-Premise — Tüm veriler yerel sunucuda işlenmektedir.</p>
    </footer>
  </div>
</template>

<script setup>
// Gün 9'da dashboard bileşenleri ve Pinia state yönetimi eklenecek
</script>

<style>
:root {
  --bg-primary: #0f172a;
  --bg-card: #1e293b;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --accent: #38bdf8;
  --accent-glow: rgba(56, 189, 248, 0.15);
  --border: #334155;
  --radius: 12px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
}

#dms-app {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  padding: 2rem;
}

.dms-header {
  text-align: center;
  margin-bottom: 3rem;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.logo-icon {
  font-size: 2.5rem;
}

.logo h1 {
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, var(--accent), #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.badge {
  background: var(--accent-glow);
  color: var(--accent);
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid var(--accent);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 1.1rem;
  margin-top: 0.5rem;
}

.status-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 2rem 2.5rem;
  max-width: 520px;
  width: 100%;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

.status-card h2 {
  font-size: 1.3rem;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.status-card p {
  color: var(--text-secondary);
  margin-bottom: 1.25rem;
  line-height: 1.6;
}

.status-card ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.status-card li {
  color: var(--text-secondary);
  font-size: 0.95rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-primary);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.dms-footer {
  margin-top: auto;
  padding-top: 3rem;
  text-align: center;
}

.dms-footer p {
  color: var(--text-secondary);
  font-size: 0.8rem;
  opacity: 0.7;
}
</style>
