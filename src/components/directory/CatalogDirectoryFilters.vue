<script setup>
import { computed, ref } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import { VSelect } from 'vuetify/components/VSelect'
import { VTextField } from 'vuetify/components/VTextField'
import { aliases } from 'vuetify/iconsets/mdi-svg'

const props = defineProps({
  searchLabel: { type: String, required: true },
  searchPlaceholder: { type: String, required: true },
  filtersApplied: Boolean,
})
const emit = defineEmits(['apply', 'clear'])
const search = defineModel({ type: [String, null], required: true })
const status = ref('all')
const statusOptions = [
  { title: 'All statuses', value: 'all', isActive: null },
  { title: 'Active', value: 'active', isActive: true },
  { title: 'Inactive', value: 'inactive', isActive: false },
]
const filtersPresent = computed(
  () => props.filtersApplied || !!search.value?.trim() || status.value !== 'all',
)

function applyFilters() {
  const selectedStatus = statusOptions.find((option) => option.value === status.value)
  emit('apply', selectedStatus?.isActive ?? null)
}

function clearFilters() {
  search.value = ''
  status.value = 'all'
  emit('clear')
}
</script>

<template>
  <form class="catalog-filters" @submit.prevent="applyFilters">
    <VTextField
      v-model="search"
      :label="searchLabel"
      :placeholder="searchPlaceholder"
      :prepend-inner-icon="aliases.search"
      type="search"
      variant="outlined"
      density="comfortable"
      maxlength="255"
      hide-details
    />
    <VSelect
      v-model="status"
      label="Status"
      :items="statusOptions"
      :menu-icon="aliases.dropdown"
      variant="outlined"
      density="comfortable"
      hide-details
    />
    <div class="catalog-filter-actions">
      <VBtn type="submit" color="primary" variant="flat" class="text-none">Apply filters</VBtn>
      <VBtn
        v-if="filtersPresent"
        type="button"
        variant="text"
        class="text-none"
        @click="clearFilters"
      >
        Clear
      </VBtn>
    </div>
  </form>
</template>

<style scoped>
.catalog-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(145px, 0.36fr) auto;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.catalog-filter-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

@media (max-width: 700px) {
  .catalog-filters {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
