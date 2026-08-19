<template>
  <div class="chat-page">
    <IntranetChat :isOpen="true" />
  </div>
</template>

<script setup>
import IntranetChat from '../components/chat/IntranetChat.vue'
</script>

<style scoped>
.chat-page {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  display: flex;
  background: var(--bg-primary);
}

/* Make it full screen, no max-width, no border radius */
:deep(.chat-drawer-wrapper) {
  position: static !important;
  visibility: visible !important;
  pointer-events: auto !important;
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  background: transparent !important;
}

:deep(.drawer-overlay) {
  display: none !important;
}

:deep(.chat-drawer) {
  position: static !important;
  width: 100% !important;
  max-width: none !important; /* Full width! */
  height: 100% !important;
  transform: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  border: none !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden;
}

:deep(.drawer-header) {
  padding: 1rem 1.5rem !important;
  background: var(--bg-secondary) !important;
  backdrop-filter: blur(10px) !important;
  border-bottom: 1px solid rgba(255,255,255,0.05) !important;
  flex: none;
}

:deep(.btn-close-drawer) {
  display: none !important;
}
</style>
