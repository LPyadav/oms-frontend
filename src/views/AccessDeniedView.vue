<script setup>
import { onMounted, useTemplateRef } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
const heading = useTemplateRef('heading')

onMounted(() => heading.value?.focus({ preventScroll: true }))
</script>

<template>
  <main class="access-denied">
    <VCard class="pa-6" rounded="xl" variant="outlined">
      <h1 ref="heading" class="text-h4 font-weight-bold mb-3" tabindex="-1">Access denied</h1>
      <p class="mb-5">Your account does not have access to this page.</p>
      <VBtn class="text-none" :to="{ name: 'workspace' }" color="primary" variant="flat">
        Back to workspace
      </VBtn>
    </VCard>
  </main>
</template>

<style scoped>
h1:focus {
  outline: none;
}

.access-denied {
  display: grid;
  width: min(100%, 500px);
  min-height: 100dvh;
  margin-inline: auto;
  padding: 24px;
  place-content: center;
}
</style>
