<script setup>
import { computed, nextTick, onMounted, onScopeDispose, reactive, ref, useTemplateRef } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import { VSelect } from 'vuetify/components/VSelect'
import { VTable } from 'vuetify/components/VTable'
import { VTextField } from 'vuetify/components/VTextField'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { loadAccessAuditPage } from '../../api/accessAudit'
import AccessAuditDetailDialog from '../../components/admin/AccessAuditDetailDialog.vue'
import CatalogDirectoryShell from '../../components/directory/CatalogDirectoryShell.vue'
import { usePagedDirectory } from '../../composables/usePagedDirectory'
import { useAuthStore } from '../../stores/auth'
import { formatAccessAuditAction, formatAccessAuditTime } from '../../utils/accessAudit'

const auth = useAuthStore()
const heading = useTemplateRef('heading')
const requests = new AbortController()
const initialFilters = { action: '', actorId: '', targetType: '', targetId: '' }
const filters = reactive({ ...initialFilters })
const auditId = ref(null)
const targetOptions = [
  { title: 'All targets', value: '' },
  { title: 'User', value: 'user' },
  { title: 'Role', value: 'role' },
]
let detailTrigger
const { query, result, error, loading, load } = usePagedDirectory({
  fetchPage: (page, signal) => loadAccessAuditPage(auth.request, page, signal),
  signal: requests.signal,
  initialQuery: { page: 1, ...initialFilters },
})

function parseFilterId(value) {
  const text = (value ?? '').trim()
  if (!text) return null

  const id = Number(text)
  return /^\d+$/.test(text) && Number.isSafeInteger(id) && id > 0 ? id : NaN
}

const actorId = computed(() => parseFilterId(filters.actorId))
const targetId = computed(() => parseFilterId(filters.targetId))
const filtersApplied = computed(
  () =>
    !!(query.value.action || query.value.actorId || query.value.targetType || query.value.targetId),
)
const canClear = computed(() => Object.values(filters).some(Boolean) || filtersApplied.value)
const invalidIds = computed(() => Number.isNaN(actorId.value) || Number.isNaN(targetId.value))

function applyFilters() {
  if (invalidIds.value) return

  void load({
    page: 1,
    action: (filters.action ?? '').trim(),
    actorId: actorId.value,
    targetType: filters.targetType,
    targetId: targetId.value,
  })
}

function clearFilters() {
  Object.assign(filters, initialFilters)
  void load({ page: 1, ...initialFilters })
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
  if (detailTrigger?.isConnected) detailTrigger.focus({ preventScroll: true })
  else heading.value?.focus({ preventScroll: true })
  detailTrigger = null
}

onMounted(() => {
  heading.value?.focus({ preventScroll: true })
  void load()
})
onScopeDispose(() => requests.abort())
</script>

<template>
  <section v-if="auth.canViewAccessAudit" class="audit-page" aria-labelledby="access-audit-heading">
    <header class="audit-header">
      <h1 id="access-audit-heading" ref="heading" tabindex="-1">Access audit</h1>
      <p>Review changes to user accounts, roles, and permissions.</p>
    </header>

    <CatalogDirectoryShell
      item-label="Access audit record"
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
          <VTextField
            v-model="filters.action"
            label="Action"
            :prepend-inner-icon="aliases.search"
            variant="outlined"
            density="compact"
            maxlength="64"
            hide-details="auto"
            clearable
          />
          <VTextField
            v-model="filters.actorId"
            label="Actor ID"
            inputmode="numeric"
            variant="outlined"
            density="compact"
            hide-details="auto"
            :error-messages="Number.isNaN(actorId) ? 'Enter a positive whole number.' : []"
          />
          <VSelect
            v-model="filters.targetType"
            :items="targetOptions"
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
            :error-messages="Number.isNaN(targetId) ? 'Enter a positive whole number.' : []"
          />
          <div class="filter-actions">
            <VBtn
              type="submit"
              color="primary"
              variant="flat"
              class="text-none"
              :disabled="invalidIds"
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

      <VTable class="audit-table" density="compact" aria-label="Access audit history">
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">Actor</th>
            <th scope="col">Target</th>
            <th scope="col">Occurred</th>
            <th scope="col"><span class="d-sr-only">Details</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in result.logs" :key="log.id">
            <th scope="row">{{ formatAccessAuditAction(log.action) }}</th>
            <td>
              <span class="mobile-label" aria-hidden="true">Actor</span> User #{{ log.actor_id }}
            </td>
            <td>
              <span class="mobile-label" aria-hidden="true">Target</span>
              {{ log.target_type === 'user' ? 'User' : 'Role' }} #{{ log.target_id }}
            </td>
            <td>
              <span class="mobile-label" aria-hidden="true">Occurred</span>
              <time :datetime="log.created_at">{{ formatAccessAuditTime(log.created_at) }}</time>
            </td>
            <td class="audit-row-action">
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

    <AccessAuditDetailDialog v-if="auditId !== null" :id="auditId" @close="closeDetail" />
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

.audit-header p {
  margin: 6px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.76);
}

.audit-filters {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(7rem, 1fr) minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 16px;
}

.filter-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.audit-table :deep(thead) {
  background: rgba(var(--v-theme-primary), 0.07);
}

.audit-table :deep(th),
.audit-table :deep(td) {
  padding-block: 12px;
  overflow-wrap: anywhere;
}

.audit-row-action {
  text-align: right;
}

.mobile-label {
  display: none;
}

.audit-header h1:focus {
  outline: none;
}

@media (max-width: 960px) {
  .audit-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.audit-header h1:focus {
  outline: none;
}

@media (max-width: 600px) {
  .audit-filters {
    grid-template-columns: minmax(0, 1fr);
  }

  .audit-table thead {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .audit-table tbody tr {
    display: grid;
    padding: 12px 16px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }

  .audit-table tbody tr :is(th, td) {
    display: block;
    height: auto;
    padding: 4px 0;
    border: 0;
  }

  .mobile-label {
    display: inline-block;
    min-width: 4.5rem;
    color: rgba(var(--v-theme-on-surface), 0.74);
  }

  .audit-row-action {
    text-align: left;
  }
}
</style>
