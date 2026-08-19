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
  padding: 2rem;
  box-sizing: border-box;
  background: var(--bg-primary); /* Blend with the shell */
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
  max-width: 1600px !important; /* WIDER! */
  height: 100% !important;
  transform: none !important;
  border-radius: 20px !important;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255,255,255,0.05) !important;
  border: none !important;
  overflow: hidden;
  backdrop-filter: blur(40px) saturate(200%);
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

:deep(.drawer-header) {
  padding: 1.25rem 2rem !important;
  background: rgba(15, 23, 42, 0.7) !important;
  backdrop-filter: blur(20px) !important;
  border-bottom: 1px solid rgba(255,255,255,0.05) !important;
}

:deep(.btn-close-drawer) {
  display: none !important;
}
</style>
