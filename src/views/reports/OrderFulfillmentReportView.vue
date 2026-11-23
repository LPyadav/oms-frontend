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
import { useReportDirectory } from '../../composables/useReportDirectory'
import { ORDER_STATUS } from '../../constants/orders'
import { useAuthStore } from '../../stores/auth'
import { formatDirectoryPageRange, getDirectoryErrorMessage } from '../../utils/directory'
import { formatOrderDate, formatOrderTimestamp, formatOrderTotal } from '../../utils/orderDisplay'
import { getReportDateErrors } from '../../utils/reportDates'

const auth = useAuthStore()
const heading = useTemplateRef('heading')
const resultsHeading = useTemplateRef('orders-heading')
const requests = new AbortController()
const emptyFields = { dateFrom: '', dateTo: '', status: '', customer: null, assignee: null }
const fields = reactive({ ...emptyFields })
const { query, result, error, loading, load, loadPage } = useReportDirectory({
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

const dateErrors = computed(() => getReportDateErrors(fields.dateFrom, fields.dateTo))
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
  getDirectoryErrorMessage(error.value, 'Unable to load the order status report.', {
    403: 'You do not have permission to view reports.',
    422: 'Check the filters, then apply again.',
  }),
)

function fieldErrors(field, localError = '') {
  if (localError) return [localError]
  return error.value?.fields?.[field] ?? []
}

function applyFilters() {
  if (dateErrors.value.from || dateErrors.value.to) return

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
  if (await loadPage(page)) {
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
  <section v-if="auth.canViewReports" class="report-page" aria-labelledby="fulfillment-title">
    <header class="report-header">
      <h1 id="fulfillment-title" ref="heading" tabindex="-1">Order status report</h1>
      <p>Review fulfillment progress and order totals by business order date.</p>
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
            :error-messages="fieldErrors('date_from', dateErrors.from)"
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
            :error-messages="fieldErrors('date_to', dateErrors.to)"
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
              label="Order status report pagination"
              @page-change="changePage"
            />
          </footer>
        </template>
      </DirectoryPanel>
    </template>
  </section>
</template>

<style scoped src="./report-page.css"></style>
