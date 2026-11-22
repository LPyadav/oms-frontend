<script setup>
import { computed } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import { formatDirectoryPageRange, getDirectoryErrorMessage } from '../../utils/directory'
import DirectoryPagination from './DirectoryPagination.vue'
import DirectoryPanel from './DirectoryPanel.vue'
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

const errorMessage = computed(() =>
  getDirectoryErrorMessage(props.error, 'Unable to load ' + collectionName.value + '. Try again.', {
    403: 'You do not have permission to view ' + collectionName.value + '.',
  }),
)

const pageRange = computed(() =>
  formatDirectoryPageRange(props.page, props.itemCount, itemName.value, collectionName.value),
)
</script>

<template>
  <DirectoryPanel>
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
          <DirectoryPagination
            v-if="page.lastPage > 1"
            class="catalog-pages"
            :label="itemLabel + ' pages'"
            :current-page="page.currentPage"
            :last-page="page.lastPage"
            rounded="lg"
            @page-change="emit('page-change', $event)"
          >
            <span class="catalog-detail">Page {{ page.currentPage }} of {{ page.lastPage }}</span>
          </DirectoryPagination>
        </footer>
      </template>
    </template>
  </DirectoryPanel>
</template>

<style scoped>
.catalog-state {
  display: grid;
  gap: 12px;
  justify-items: start;
  padding: 16px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.catalog-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: space-between;
  padding: 14px 16px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.catalog-pages {
  gap: 10px;
}

.catalog-detail {
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
}
</style>
