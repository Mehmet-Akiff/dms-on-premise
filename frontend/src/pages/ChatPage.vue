<template>
  <div class="chat-page">
    <IntranetChat :isOpen="true" :isFullPage="true" />
  </div>
</template>

<script setup>
import IntranetChat from '../components/chat/IntranetChat.vue'
</script>

<style scoped>
.chat-page {
  width: 100%;
  height: calc(100vh - 70px);
  position: relative;
  overflow: hidden;
}
:deep(.chat-drawer-wrapper) {
  position: static !important;
  visibility: visible !important;
  pointer-events: auto !important;
  width: 100% !important;
  height: 100% !important;
}
:deep(.drawer-overlay) {
  display: none !important;
}
:deep(.chat-drawer) {
  position: static !important;
  width: 100% !important;
  height: 100% !important;
  transform: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
:deep(.btn-close-drawer) {
  display: none !important;
}
</style>
