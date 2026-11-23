<script setup>
import { computed, nextTick, onMounted, onScopeDispose, reactive, ref, useTemplateRef } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import { VSelect } from 'vuetify/components/VSelect'
import { VTable } from 'vuetify/components/VTable'
import { VTextField } from 'vuetify/components/VTextField'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { loadOperationalAuditPage } from '../../api/operationalAudit'
import OperationalAuditDetailDialog from '../../components/admin/OperationalAuditDetailDialog.vue'
import CatalogDirectoryShell from '../../components/directory/CatalogDirectoryShell.vue'
import { usePagedDirectory } from '../../composables/usePagedDirectory'
import { useAuthStore } from '../../stores/auth'
import {
  formatOperationalAuditAction,
  formatOperationalAuditTime,
  operationalAuditActions,
} from '../../utils/operationalAudit'

const auth = useAuthStore()
const heading = useTemplateRef('heading')
const requests = new AbortController()
const emptyFilters = {
  action: '',
  actorId: '',
  targetType: '',
  targetId: '',
  dateFrom: '',
  dateTo: '',
}
const filters = reactive({ ...emptyFilters })
const actionOptions = [
  { title: 'All actions', value: '' },
  ...Object.entries(operationalAuditActions).map(([value, title]) => ({ value, title })),
]
const targetOptions = [
  { title: 'All targets', value: '' },
  { title: 'Order', value: 'order' },
  { title: 'Customer', value: 'customer' },
  { title: 'Product', value: 'product' },
]
const auditId = ref(null)
let detailTrigger
const { query, result, error, loading, load } = usePagedDirectory({
  fetchPage: (query, signal) => loadOperationalAuditPage(auth.request, query, signal),
  initialQuery: { page: 1 },
  signal: requests.signal,
})

function parseId(value) {
  const text = value.trim()
  if (!text) return null

  const id = Number(text)
  return /^\d+$/.test(text) && Number.isSafeInteger(id) && id > 0 ? id : NaN
}

const actorId = computed(() => parseId(filters.actorId))
const targetId = computed(() => parseId(filters.targetId))
const invalidDates = computed(
  () => !!filters.dateFrom && !!filters.dateTo && filters.dateFrom > filters.dateTo,
)
const invalidFilters = computed(
  () => invalidDates.value || Number.isNaN(actorId.value) || Number.isNaN(targetId.value),
)
const filtersApplied = computed(() => Object.keys(emptyFilters).some((key) => !!query.value[key]))
const canClear = computed(() => filtersApplied.value || Object.values(filters).some(Boolean))

function applyFilters() {
  if (invalidFilters.value) return
  void load({ ...filters, page: 1, actorId: actorId.value, targetId: targetId.value })
}

function clearFilters() {
  Object.assign(filters, emptyFilters)
  void load({ page: 1 })
}

function changePage(page) {
  void load({ ...query.value, page })
}

function openDetail(id, event) {
  detailTrigger = event.currentTarget
  auditId.value = id
}

async function closeDetail() {
  auditId.value = null
  await nextTick()
  const target = detailTrigger?.isConnected ? detailTrigger : heading.value
  target?.focus({ preventScroll: true })
  detailTrigger = null
}

onMounted(() => {
  heading.value?.focus({ preventScroll: true })
  if (auth.canViewAccessAudit) void load()
})
onScopeDispose(() => requests.abort())
</script>

<template>
  <section
    v-if="auth.canViewAccessAudit"
    class="operational-audit"
    aria-labelledby="operational-audit-heading"
  >
    <header class="audit-header">
      <h1 id="operational-audit-heading" ref="heading" tabindex="-1">Operational audit</h1>
      <p>Review changes to orders, customers, products, and stock.</p>
    </header>

    <CatalogDirectoryShell
      item-label="Audit record"
      :page="result"
      :item-count="result?.logs.length ?? 0"
      :loading="loading"
      :error="error"
      :filters-applied="filtersApplied"
      @retry="load()"
      @page-change="changePage"
    >
      <template #filters>
        <form class="audit-filters" aria-label="Audit filters" @submit.prevent="applyFilters">
          <VSelect
            v-model="filters.action"
            :items="actionOptions"
            :menu-icon="aliases.dropdown"
            label="Action"
            variant="outlined"
            density="compact"
            hide-details="auto"
          />
          <VTextField
            v-model="filters.actorId"
            label="Actor ID"
            inputmode="numeric"
            variant="outlined"
            density="compact"
            hide-details="auto"
            :error-messages="
              Number.isNaN(actorId) ? 'Enter a positive whole number.' : error?.fields?.actor_id
            "
          />
          <VSelect
            v-model="filters.targetType"
            :items="targetOptions"
            :menu-icon="aliases.dropdown"
            label="Target type"
            variant="outlined"
            density="compact"
            hide-details="auto"
          />
          <VTextField
            v-model="filters.targetId"
            label="Target ID"
            inputmode="numeric"
            variant="outlined"
            density="compact"
            hide-details="auto"
            :error-messages="
              Number.isNaN(targetId) ? 'Enter a positive whole number.' : error?.fields?.target_id
            "
          />
          <VTextField
            v-model="filters.dateFrom"
            type="date"
            label="From date (UTC)"
            variant="outlined"
            density="compact"
            hide-details="auto"
            :error-messages="error?.fields?.date_from"
          />
          <VTextField
            v-model="filters.dateTo"
            type="date"
            label="To date (UTC)"
            variant="outlined"
            density="compact"
            hide-details="auto"
            :error-messages="
              invalidDates ? 'End date must be on or after the start date.' : error?.fields?.date_to
            "
          />
          <div class="filter-actions">
            <VBtn
              type="submit"
              color="primary"
              variant="flat"
              class="text-none"
              :disabled="invalidFilters"
            >
              Apply filters
            </VBtn>
            <VBtn
              v-if="canClear"
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

      <VTable class="audit-table" density="compact">
        <caption class="d-sr-only">
          Operational audit history
        </caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">Action</th>
            <th scope="col" role="columnheader">Actor</th>
            <th scope="col" role="columnheader">Target</th>
            <th scope="col" role="columnheader">Occurred</th>
            <th scope="col" role="columnheader"><span class="d-sr-only">Details</span></th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          <tr v-for="log in result.logs" :key="log.id" role="row">
            <th scope="row" role="rowheader">{{ formatOperationalAuditAction(log.action) }}</th>
            <td role="cell">
              <span class="mobile-label" aria-hidden="true">Actor</span>
              {{ log.actor_name ?? 'User' }} #{{ log.actor_id }}
            </td>
            <td role="cell">
              <span class="mobile-label" aria-hidden="true">Target</span>
              <span class="target">{{ log.target_type }} #{{ log.target_id }}</span>
            </td>
            <td role="cell">
              <span class="mobile-label" aria-hidden="true">Occurred</span>
              <time :datetime="log.created_at">{{
                formatOperationalAuditTime(log.created_at)
              }}</time>
            </td>
            <td role="cell" class="audit-action">
              <VBtn
                type="button"
                variant="text"
                color="primary"
                class="text-none"
                :append-icon="aliases.next"
                :aria-label="'View audit record ' + log.id"
                @click="openDetail(log.id, $event)"
              >
                View
              </VBtn>
            </td>
          </tr>
        </tbody>
      </VTable>
    </CatalogDirectoryShell>

    <OperationalAuditDetailDialog v-if="auditId !== null" :id="auditId" @close="closeDetail" />
  </section>
</template>

<style scoped>
.audit-header {
  margin-bottom: 24px;
}

.audit-header h1 {
  margin: 0;
  font-size: clamp(1.9rem, 4vw, 2.5rem);
  letter-spacing: -0.035em;
}

.audit-header h1:focus {
  outline: none;
}

.audit-header p {
  margin: 6px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.76);
}

.audit-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
  padding: 16px;
}

.filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.audit-table :deep(th),
.audit-table :deep(td) {
  overflow-wrap: anywhere;
}

.target {
  text-transform: capitalize;
}

.audit-action {
  text-align: end;
}

.mobile-label {
  display: none;
}

@media (max-width: 800px) {
  .audit-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .audit-table :deep(thead) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .audit-table :deep(tbody tr) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 12px;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }

  .audit-table :deep(tbody th),
  .audit-table :deep(tbody td) {
    height: auto;
    min-width: 0;
    padding: 0;
    border: 0 !important;
  }

  .audit-table :deep(tbody th),
  .audit-action {
    grid-column: 1 / -1;
  }

  .mobile-label {
    display: block;
    color: rgba(var(--v-theme-on-surface), 0.72);
    font-size: 0.8rem;
  }
}

@media (max-width: 460px) {
  .audit-filters {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
