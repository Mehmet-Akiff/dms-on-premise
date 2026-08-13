<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div v-if="visible" class="confirm-overlay" @click.self="handleCancel">
        <div class="confirm-card" :class="variant">
          <div class="confirm-icon">
            <span v-if="variant === 'danger'">⚠️</span>
            <span v-else-if="variant === 'warning'">🔔</span>
            <span v-else>ℹ️</span>
          </div>
          <h3 class="confirm-title">{{ title }}</h3>
          <p class="confirm-message">{{ message }}</p>
          <div class="confirm-actions">
            <button class="btn-cancel" @click="handleCancel">{{ cancelText }}</button>
            <button class="btn-confirm" :class="variant" @click="handleConfirm">{{ confirmText }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: 'Emin misiniz?' },
  message: { type: String, default: 'Bu işlem geri alınamaz.' },
  confirmText: { type: String, default: 'Onayla' },
  cancelText: { type: String, default: 'İptal' },
  variant: { type: String, default: 'danger' } // 'danger' | 'warning' | 'info'
})

const emit = defineEmits(['confirm', 'cancel'])

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  emit('cancel')
}

function onKeydown(e) {
  if (e.key === 'Escape' && props.visible) {
    handleCancel()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(3, 7, 18, 0.75);
  backdrop-filter: blur(6px);
  display: flex; justify-content: center; align-items: center;
  z-index: 99999;
}

.confirm-card {
  background: var(--bg-secondary, #131c31);
  border: 1px solid var(--border, #334155);
  border-radius: 16px;
  width: 100%; max-width: 400px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
  animation: cardPop 0.25s ease-out;
}

.confirm-card.danger {
  border-color: rgba(239, 68, 68, 0.3);
}
.confirm-card.warning {
  border-color: rgba(245, 158, 11, 0.3);
}
.confirm-card.info {
  border-color: rgba(59, 130, 246, 0.3);
}

@keyframes cardPop {
  from { transform: scale(0.9); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}

.confirm-icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
}

.confirm-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary, #f1f5f9);
  margin: 0 0 0.5rem 0;
}

.confirm-message {
  font-size: 0.85rem;
  color: var(--text-secondary, var(--text-secondary));
  line-height: 1.5;
  margin: 0 0 1.5rem 0;
}

.confirm-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.btn-cancel {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary, var(--text-secondary));
  padding: 0.55rem 1.25rem;
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}

.btn-confirm {
  padding: 0.55rem 1.25rem;
  font-size: 0.82rem;
  font-weight: 700;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  color: white;
}
.btn-confirm.danger {
  background: var(--color-danger-bg);
}
.btn-confirm.danger:hover {
  background: #dc2626;
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.3);
}
.btn-confirm.warning {
  background: #f59e0b;
}
.btn-confirm.warning:hover {
  background: #d97706;
  box-shadow: 0 0 15px rgba(245, 158, 11, 0.3);
}
.btn-confirm.info {
  background: #3b82f6;
}
.btn-confirm.info:hover {
  background: #2563eb;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
}

/* Transition */
.confirm-fade-enter-active { transition: opacity 0.2s ease; }
.confirm-fade-leave-active { transition: opacity 0.15s ease; }
.confirm-fade-enter-from,
.confirm-fade-leave-to { opacity: 0; }
</style>
