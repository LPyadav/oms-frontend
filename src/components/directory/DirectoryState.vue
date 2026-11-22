<script setup>
import { VAlert } from 'vuetify/components/VAlert'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'

defineProps({
  kind: { type: String, required: true },
  message: { type: String, required: true },
})
</script>

<template>
  <div :role="kind === 'error' ? undefined : 'status'">
    <VProgressLinear v-if="kind === 'loading'" color="primary" indeterminate aria-hidden="true" />
    <VAlert v-if="kind === 'error'" type="error" variant="tonal" :icon="false" role="alert">
      {{ message }}
    </VAlert>
    <p v-else>{{ message }}</p>
    <slot name="actions" />
  </div>
</template>

<style scoped>
p {
  margin: 0;
}
</style>
