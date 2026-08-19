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
  justify-content: center;
  align-items: center;
  padding: 1.5rem;
  box-sizing: border-box;
}

/* Override the Drawer styles to make it a centered, full-blown page component */
:deep(.chat-drawer-wrapper) {
  position: static !important;
  visibility: visible !important;
  pointer-events: auto !important;
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  justify-content: center !important;
  background: transparent !important;
}

:deep(.drawer-overlay) {
  display: none !important;
}

:deep(.chat-drawer) {
  position: static !important;
  width: 100% !important;
  max-width: 1400px !important;
  height: 100% !important;
  transform: none !important;
  border-radius: 12px !important;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2) !important;
  border: 1px solid var(--border);
  overflow: hidden;
}

:deep(.btn-close-drawer) {
  display: none !important;
}
</style>
