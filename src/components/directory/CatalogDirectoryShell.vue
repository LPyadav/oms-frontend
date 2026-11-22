<script setup>
import { computed } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import DirectoryState from './DirectoryState.vue'

const props = defineProps({
  itemLabel: { type: String, required: true },
  loading: Boolean,
  error: { type: Object, default: null },
  page: { type: Object, default: null },
  itemCount: { type: Number, default: 0 },
  filtersApplied: Boolean,
})
const emit = defineEmits(['retry', 'page-change'])
const itemName = computed(() => props.itemLabel.toLowerCase())
const collectionName = computed(() => itemName.value + 's')

const errorMessage = computed(() => {
  if (props.error?.status === 403) {
    return 'You do not have permission to view ' + collectionName.value + '.'
  }
  if (props.error?.status === 429) return 'Too many requests. Try again shortly.'
  return 'Unable to load ' + collectionName.value + '. Try again.'
})

const pageRange = computed(() => {
  if (!props.page || !props.itemCount) return ''

  const { currentPage, perPage, total } = props.page
  const start = (currentPage - 1) * perPage + 1
  const end = start + props.itemCount - 1
  const range = start === end ? String(start) : start + '–' + end
  return range + ' of ' + total + ' ' + (total === 1 ? itemName.value : collectionName.value)
})
</script>

<template>
  <VCard color="surface" variant="flat" border class="catalog-card">
    <slot name="filters" />

    <DirectoryState
      v-if="loading"
      class="catalog-state"
      kind="loading"
      :message="'Loading ' + collectionName + '…'"
    />
    <DirectoryState v-else-if="error" class="catalog-state" kind="error" :message="errorMessage">
      <template #actions>
        <VBtn
          v-if="error.status === 403"
          :to="{ name: 'workspace' }"
          variant="outlined"
          class="text-none"
        >
          Back to workspace
        </VBtn>
        <VBtn v-else type="button" variant="outlined" class="text-none" @click="emit('retry')">
          Try again
        </VBtn>
      </template>
    </DirectoryState>
    <template v-else-if="page">
      <DirectoryState
        v-if="page.currentPage > page.lastPage"
        class="catalog-state"
        kind="empty"
        :message="'This ' + itemName + ' page is no longer available.'"
      >
        <template #actions>
          <VBtn
            type="button"
            variant="outlined"
            class="text-none"
            @click="emit('page-change', page.lastPage)"
          >
            Go to last page
          </VBtn>
        </template>
      </DirectoryState>
      <DirectoryState
        v-else-if="!itemCount"
        class="catalog-state"
        kind="empty"
        :message="
          filtersApplied
            ? 'No ' + collectionName + ' match these filters.'
            : 'No ' + collectionName + ' yet.'
        "
      />
      <template v-else>
        <slot />

        <footer class="catalog-footer">
          <span class="catalog-detail" aria-live="polite">{{ pageRange }}</span>
          <nav v-if="page.lastPage > 1" class="catalog-pages" :aria-label="itemLabel + ' pages'">
            <VBtn
              aria-label="Previous page"
              :icon="aliases.prev"
              size="small"
              rounded="lg"
              variant="outlined"
              :disabled="page.currentPage <= 1"
              @click="emit('page-change', page.currentPage - 1)"
            />
            <span class="catalog-detail">Page {{ page.currentPage }} of {{ page.lastPage }}</span>
            <VBtn
              aria-label="Next page"
              :icon="aliases.next"
              size="small"
              rounded="lg"
              variant="outlined"
              :disabled="page.currentPage >= page.lastPage"
              @click="emit('page-change', page.currentPage + 1)"
            />
          </nav>
        </footer>
      </template>
    </template>
  </VCard>
</template>

<style scoped>
.catalog-card {
  border-color: rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 12px;
  box-shadow: 0 2px 7px rgba(var(--v-theme-on-surface), 0.045);
}

.catalog-state {
  display: grid;
  gap: 12px;
  justify-items: start;
  padding: 16px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.catalog-footer,
.catalog-pages {
  display: flex;
  align-items: center;
  gap: 10px;
}

.catalog-footer {
  flex-wrap: wrap;
  justify-content: space-between;
  padding: 14px 16px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.catalog-detail {
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
}
</style>
