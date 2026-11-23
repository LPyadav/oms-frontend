<script setup>
import { computed, nextTick, onMounted, onScopeDispose, reactive, useTemplateRef } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import { VSelect } from 'vuetify/components/VSelect'
import { VTextField } from 'vuetify/components/VTextField'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { loadOrderFilterPartyPage } from '../../api/orders'
import { loadOrderFulfillmentReport } from '../../api/reports'
import DirectoryPagination from '../../components/directory/DirectoryPagination.vue'
import DirectoryPanel from '../../components/directory/DirectoryPanel.vue'
import DirectoryState from '../../components/directory/DirectoryState.vue'
import OrderLookupField from '../../components/orders/OrderLookupField.vue'
import OrderFulfillmentTable from '../../components/reports/OrderFulfillmentTable.vue'
import { usePagedDirectory } from '../../composables/usePagedDirectory'
import { ORDER_STATUS } from '../../constants/orders'
import { useAuthStore } from '../../stores/auth'
import { formatDirectoryPageRange, getDirectoryErrorMessage } from '../../utils/directory'
import { formatOrderDate, formatOrderTimestamp, formatOrderTotal } from '../../utils/orderDisplay'

const auth = useAuthStore()
const heading = useTemplateRef('heading')
const resultsHeading = useTemplateRef('orders-heading')
const requests = new AbortController()
const emptyFields = { dateFrom: '', dateTo: '', status: '', customer: null, assignee: null }
const fields = reactive({ ...emptyFields })
const { query, result, error, loading, load } = usePagedDirectory({
  fetchPage: (query, signal) => loadOrderFulfillmentReport(auth.request, query, signal),
  initialQuery: { page: 1 },
  signal: requests.signal,
})

const statusOptions = [
  { title: 'All statuses', value: '' },
  ...Object.entries(ORDER_STATUS).map(([value, title]) => ({ value, title })),
]
const customerPage = (query, signal) =>
  loadOrderFilterPartyPage(auth.request, 'customer', query, signal)
const assigneePage = (query, signal) =>
  loadOrderFilterPartyPage(auth.request, 'assignee', query, signal)
const partyName = (party) => party.name
const partySubtitle = (party) => 'ID ' + party.id
const numberFormatter = new Intl.NumberFormat()
const number = (value) => numberFormatter.format(value)

const localFromError = computed(() =>
  !fields.dateFrom && fields.dateTo ? 'Enter a start date.' : '',
)
const localToError = computed(() => {
  if (fields.dateFrom && !fields.dateTo) return 'Enter an end date.'
  if (fields.dateFrom && fields.dateTo < fields.dateFrom) {
    return 'End date must be on or after the start date.'
  }

  return ''
})
const canReset = computed(
  () =>
    Object.keys(emptyFields).some((field) => fields[field] !== emptyFields[field]) ||
    ['dateFrom', 'dateTo', 'status', 'customerId', 'assigneeId'].some(
      (field) => !!query.value[field],
    ),
)
const pageRange = computed(() =>
  formatDirectoryPageRange(result.value, result.value?.orders.length ?? 0, 'order', 'orders'),
)
const errorMessage = computed(() =>
  getDirectoryErrorMessage(error.value, 'Unable to load the Order Fulfillment report.', {
    403: 'You do not have permission to view reports.',
    422: 'Check the filters, then apply again.',
  }),
)

function fieldErrors(field, localError = '') {
  if (localError) return [localError]
  return error.value?.fields?.[field] ?? []
}

function applyFilters() {
  if (localFromError.value || localToError.value) return

  void load({
    page: 1,
    dateFrom: fields.dateFrom,
    dateTo: fields.dateTo,
    status: fields.status,
    customerId: fields.customer?.id ?? null,
    assigneeId: fields.assignee?.id ?? null,
  })
}

function resetFilters() {
  Object.assign(fields, emptyFields)
  void load({ page: 1 })
}

async function changePage(page) {
  if (await load({ ...query.value, page })) {
    await nextTick()
    resultsHeading.value?.focus()
  }
}

onMounted(() => {
  heading.value?.focus({ preventScroll: true })
  if (auth.canViewReports) void load()
})
onScopeDispose(() => requests.abort())
</script>

<template>
  <section
    v-if="auth.canViewReports"
    class="fulfillment-report"
    aria-labelledby="fulfillment-title"
  >
    <header class="report-header">
      <h1 id="fulfillment-title" ref="heading" tabindex="-1">Order Fulfillment</h1>
      <p>Orders and totals by business order date.</p>
    </header>

    <DirectoryPanel>
      <form
        class="report-filters"
        aria-labelledby="filters-title"
        novalidate
        @submit.prevent="applyFilters"
      >
        <header>
          <h2 id="filters-title">Filters</h2>
          <p>Leave both dates blank to use the default range.</p>
        </header>

        <div class="filter-fields">
          <VTextField
            v-model="fields.dateFrom"
            label="From date"
            type="date"
            min="1000-01-01"
            max="9999-12-31"
            variant="outlined"
            density="comfortable"
            :error-messages="fieldErrors('date_from', localFromError)"
            hide-details="auto"
          />
          <VTextField
            v-model="fields.dateTo"
            label="To date"
            type="date"
            min="1000-01-01"
            max="9999-12-31"
            variant="outlined"
            density="comfortable"
            :error-messages="fieldErrors('date_to', localToError)"
            hide-details="auto"
          />
          <VSelect
            v-model="fields.status"
            label="Status"
            :items="statusOptions"
            :menu-icon="aliases.dropdown"
            variant="outlined"
            density="comfortable"
            :error-messages="fieldErrors('status')"
            hide-details="auto"
          />
          <OrderLookupField
            v-model="fields.customer"
            label="Customer"
            resource="parties"
            :load-page="customerPage"
            :item-title="partyName"
            :item-subtitle="partySubtitle"
            :error-messages="fieldErrors('customer_id')"
          />
          <OrderLookupField
            v-model="fields.assignee"
            label="Assigned employee"
            resource="parties"
            :load-page="assigneePage"
            :item-title="partyName"
            :item-subtitle="partySubtitle"
            :error-messages="fieldErrors('assignee_id')"
          />
        </div>

        <div class="filter-actions">
          <VBtn type="submit" color="primary" variant="flat" class="text-none">Apply filters</VBtn>
          <VBtn
            type="button"
            variant="text"
            class="text-none"
            :disabled="!canReset"
            @click="resetFilters"
          >
            Reset filters
          </VBtn>
        </div>
      </form>
    </DirectoryPanel>

    <DirectoryPanel v-if="loading || error" class="report-state">
      <DirectoryState v-if="loading" kind="loading" message="Loading report…" />
      <DirectoryState v-else kind="error" :message="errorMessage">
        <template v-if="![403, 422].includes(error.status)" #actions>
          <VBtn type="button" variant="outlined" class="text-none report-retry" @click="load()">
            Try again
          </VBtn>
        </template>
      </DirectoryState>
    </DirectoryPanel>

    <template v-else-if="result">
      <DirectoryPanel tag="section" class="report-totals" aria-labelledby="totals-title">
        <div class="totals-heading">
          <div>
            <h2 id="totals-title">Filtered totals</h2>
            <p class="report-context">
              {{ formatOrderDate(result.dateFrom) }} – {{ formatOrderDate(result.dateTo) }}
            </p>
          </div>
          <p class="report-context">
            Snapshot
            <time :datetime="result.snapshotAt">{{ formatOrderTimestamp(result.snapshotAt) }}</time>
          </p>
        </div>

        <dl class="totals-grid">
          <div class="total-card">
            <dt>Matching orders</dt>
            <dd>{{ number(result.totals.order_count) }}</dd>
          </div>
          <div
            v-for="currency in result.totals.by_currency"
            :key="currency.currency"
            class="total-card"
          >
            <dt>Order total · {{ currency.currency }}</dt>
            <dd>{{ formatOrderTotal(currency.grand_total_minor, currency.currency) }}</dd>
            <dd class="currency-count">
              {{ number(currency.order_count) }}
              {{ currency.order_count === 1 ? 'order' : 'orders' }}
            </dd>
          </div>
        </dl>
      </DirectoryPanel>

      <DirectoryPanel tag="section" aria-labelledby="report-orders-title">
        <header class="orders-heading">
          <h2 id="report-orders-title" ref="orders-heading" tabindex="-1">Orders</h2>
        </header>

        <DirectoryState
          v-if="result.currentPage > result.lastPage"
          class="report-state"
          kind="empty"
          message="This page is no longer available."
        >
          <template #actions>
            <VBtn
              type="button"
              class="text-none report-retry"
              variant="outlined"
              @click="changePage(result.lastPage)"
            >
              Go to last page
            </VBtn>
          </template>
        </DirectoryState>
        <DirectoryState
          v-else-if="!result.orders.length"
          class="report-state"
          kind="empty"
          message="No orders match these filters."
        />
        <template v-else>
          <OrderFulfillmentTable :orders="result.orders" />
          <footer class="report-footer">
            <span>{{ pageRange }}</span>
            <DirectoryPagination
              v-if="result.lastPage > 1"
              :current-page="result.currentPage"
              :last-page="result.lastPage"
              label="Order Fulfillment pagination"
              @page-change="changePage"
            />
          </footer>
        </template>
      </DirectoryPanel>
    </template>
  </section>
</template>

<style scoped>
.fulfillment-report {
  display: grid;
  min-width: 0;
  gap: 16px;
  padding-block: clamp(17px, 2.8vw, 30px) 30px;
}

.report-header h1 {
  margin: 0;
  font-size: clamp(1.625rem, 3.4vw, 2.125rem);
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.report-header h1:focus,
.orders-heading h2:focus {
  outline: none;
}

.report-header p,
.report-filters header p,
.report-context {
  margin: 5px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.76);
  font-size: 0.875rem;
}

.report-filters,
.report-totals,
.report-state,
.orders-heading,
.report-footer {
  padding: clamp(14px, 2vw, 20px);
}

.report-filters h2,
.totals-heading h2,
.orders-heading h2 {
  margin: 0;
  font-size: 1.125rem;
}

.filter-fields {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: start;
  gap: 12px;
  margin-top: 14px;
}

.filter-actions,
.totals-heading,
.report-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.filter-actions {
  margin-top: 14px;
}

.totals-heading,
.report-footer {
  justify-content: space-between;
}

.report-retry {
  margin-top: 10px;
}

.totals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: 10px;
  margin: 14px 0 0;
}

.total-card {
  min-width: 0;
  padding: 14px;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.07);
}

.total-card dt,
.total-card .currency-count {
  color: rgba(var(--v-theme-on-surface), 0.76);
  font-size: 0.8125rem;
}

.total-card dd {
  margin: 4px 0 0;
  font-size: clamp(1.1rem, 1.85vw, 1.55rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.total-card .currency-count {
  font-weight: 400;
}

.report-footer {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  color: rgba(var(--v-theme-on-surface), 0.76);
  font-size: 0.875rem;
}

.report-footer :deep(nav) {
  gap: 8px;
}

@media (max-width: 1050px) {
  .filter-fields {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .filter-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-fields > :nth-child(n + 3) {
    grid-column: 1 / -1;
  }

  .totals-heading {
    align-items: start;
    gap: 4px;
  }
}
</style>
