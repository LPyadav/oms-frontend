<script setup>
import { VBtn } from 'vuetify/components/VBtn'
import { aliases } from 'vuetify/iconsets/mdi-svg'

defineProps({
  currentPage: { type: Number, required: true },
  lastPage: { type: Number, required: true },
  label: { type: String, required: true },
  previousLabel: { type: String, default: 'Previous page' },
  nextLabel: { type: String, default: 'Next page' },
  rounded: { type: String, default: undefined },
  disabled: Boolean,
})
const emit = defineEmits(['page-change'])
</script>

<template>
  <nav class="directory-pages" :aria-label="label">
    <VBtn
      type="button"
      :aria-label="previousLabel"
      :icon="aliases.prev"
      size="small"
      :rounded="rounded"
      variant="outlined"
      :disabled="disabled || currentPage <= 1"
      @click="emit('page-change', Math.min(currentPage - 1, lastPage))"
    />
    <slot>
      <span>Page {{ currentPage }} of {{ lastPage }}</span>
    </slot>
    <VBtn
      type="button"
      :aria-label="nextLabel"
      :icon="aliases.next"
      size="small"
      :rounded="rounded"
      variant="outlined"
      :disabled="disabled || currentPage >= lastPage"
      @click="emit('page-change', currentPage + 1)"
    />
  </nav>
</template>

<style scoped>
.directory-pages {
  display: flex;
  align-items: center;
}
</style>
