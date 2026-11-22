<script setup>
import { VCard } from 'vuetify/components/VCard'
</script>

<template>
  <VCard color="surface" variant="flat" border class="directory-panel">
    <slot />
  </VCard>
</template>

<style scoped>
.directory-panel {
  border-color: rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 12px;
  box-shadow: 0 2px 7px rgba(var(--v-theme-on-surface), 0.045);
}
</style>
