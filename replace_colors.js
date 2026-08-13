const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend/src/components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.vue'));

const colorMap = {
  '#34d399': 'var(--color-success)',
  '#10b981': 'var(--color-success-bg)',
  '#f87171': 'var(--color-danger)',
  '#ef4444': 'var(--color-danger-bg)',
  '#a78bfa': 'var(--color-accent-text)',
  '#8b5cf6': 'var(--color-accent-bg)',
  '#c4b5fd': 'var(--color-accent-light)',
  '#d8b4fe': 'var(--color-accent-light)',
  '#f8fafc': 'var(--text-primary)',
  '#fff': 'var(--text-primary)',
  '#ffffff': 'var(--text-primary)',
  '#cbd5e1': 'var(--text-secondary)',
  '#9ca3af': 'var(--text-secondary)',
  '#94a3b8': 'var(--text-secondary)',
  '#64748b': 'var(--text-secondary)',
  '#111827': 'var(--bg-primary)',
  '#0f172a': 'var(--bg-card)',
  '#1e293b': 'var(--bg-card)',
  '#030712': 'var(--bg-primary)'
};

let count = 0;
files.forEach(f => {
  if (f === 'NativeLangSelector.vue') return; // skipping as I already manually styled it
  const filePath = path.join(dir, f);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  for (const [hex, cssVar] of Object.entries(colorMap)) {
    // regex to match hex colors case-insensitively, optionally followed by semi-colon or quote
    const regex = new RegExp(hex + '(?=[^a-zA-Z0-9])', 'gi');
    content = content.replace(regex, cssVar);
  }
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log('Updated', f);
    count++;
  }
});

// Also do it for KasaLock.vue inside components, which is included above.
console.log('Finished modifying', count, 'files.');
