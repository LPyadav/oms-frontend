<script setup>
import { computed, nextTick, onMounted, onScopeDispose, reactive, useTemplateRef } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import { VTextField } from 'vuetify/components/VTextField'
import { loadOrderFilterPartyPage } from '../../api/orders'
import { loadProductPage } from '../../api/products'
import { loadSalesTaxReport } from '../../api/reports'
import DirectoryPagination from '../../components/directory/DirectoryPagination.vue'
import DirectoryPanel from '../../components/directory/DirectoryPanel.vue'
import DirectoryLoadingState from '../../components/directory/DirectoryLoadingState.vue'
import DirectoryState from '../../components/directory/DirectoryState.vue'
import OrderLookupField from '../../components/orders/OrderLookupField.vue'
import SalesTaxTable from '../../components/reports/SalesTaxTable.vue'
import { useReportDirectory } from '../../composables/useReportDirectory'
import { REPORT_TITLE, SALES_TAX_AMOUNTS } from '../../constants/reports'
import { useAuthStore } from '../../stores/auth'
import { formatDirectoryPageRange, getDirectoryErrorMessage } from '../../utils/directory'
import { formatOrderDate, formatOrderTotal } from '../../utils/orderDisplay'
import { formatReportTimestamp, getReportDateErrors } from '../../utils/reportDates'

const auth = useAuthStore()
const heading = useTemplateRef('heading')
const resultsHeading = useTemplateRef('orders-heading')
const requests = new AbortController()
const emptyFields = { dateFrom: '', dateTo: '', customer: null, product: null, productId: '' }
const fields = reactive({ ...emptyFields })
const { query, result, error, loading, load, loadPage } = useReportDirectory({
  fetchPage: (query, signal) => loadSalesTaxReport(auth.request, query, signal),
  initialQuery: { page: 1 },
  signal: requests.signal,
})
const customerPage = (query, signal) =>
  loadOrderFilterPartyPage(auth.request, 'customer', query, signal)
const productPage = (query, signal) =>
  loadProductPage(auth.request, { ...query, isActive: null }, signal)
const partyName = (party) => party.name
const customerSubtitle = (customer) => 'ID ' + customer.id
const productSubtitle = (product) => product.sku
const countFormatter = new Intl.NumberFormat()
const amountBreakdown = Object.entries(SALES_TAX_AMOUNTS).filter(
  ([key]) => key !== 'grand_total_minor',
)
const dateErrors = computed(() => getReportDateErrors(fields.dateFrom, fields.dateTo))

const productId = computed(() => {
  if (auth.canViewProducts) return fields.product?.id ?? null
  const input = fields.productId.trim()
  const id = Number(input)
  return /^\d+$/.test(input) && Number.isSafeInteger(id) && id > 0 ? id : null
})
const localProductError = computed(() =>
  !auth.canViewProducts && fields.productId.trim() && productId.value === null
    ? 'Enter a positive whole-number product ID.'
    : '',
)
const canReset = computed(
  () =>
    Object.keys(emptyFields).some((field) => fields[field] !== emptyFields[field]) ||
    ['dateFrom', 'dateTo', 'customerId', 'productId'].some((field) => !!query.value[field]),
)
const pageRange = computed(() =>
  formatDirectoryPageRange(result.value, result.value?.orders.length ?? 0, 'order', 'orders'),
)
const errorMessage = computed(() =>
  getDirectoryErrorMessage(error.value, `Unable to load the ${REPORT_TITLE.SALES_TAX}.`, {
    403: 'You do not have permission to view reports.',
    422: 'Check the filters, then apply again.',
  }),
)

function orderCount(value) {
  return countFormatter.format(value) + (value === 1 ? ' order' : ' orders')
}

function fieldErrors(field, localError = '') {
  if (localError) return [localError]
  return error.value?.fields?.[field] ?? []
}

function applyFilters() {
  if (dateErrors.value.from || dateErrors.value.to || localProductError.value) return

  void load({
    page: 1,
    dateFrom: fields.dateFrom,
    dateTo: fields.dateTo,
    customerId: fields.customer?.id ?? null,
    productId: productId.value,
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
  <section
    v-if="auth.canViewReports"
    class="report-page sales-report"
    aria-labelledby="sales-title"
  >
    <header class="report-header">
      <h1 id="sales-title" ref="heading" tabindex="-1">{{ REPORT_TITLE.SALES_TAX }}</h1>
      <p>Realized sales and tax by completion date.</p>
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
          <p>Leave both dates blank to use the default completion-date range.</p>
        </header>

        <div class="filter-fields">
          <VTextField
            v-model="fields.dateFrom"
            label="Completed from"
            type="date"
            min="1000-01-02"
            max="9999-12-30"
            variant="outlined"
            density="comfortable"
            :error-messages="fieldErrors('date_from', dateErrors.from)"
            hide-details="auto"
          />
          <VTextField
            v-model="fields.dateTo"
            label="Completed to"
            type="date"
            min="1000-01-02"
            max="9999-12-30"
            variant="outlined"
            density="comfortable"
            :error-messages="fieldErrors('date_to', dateErrors.to)"
            hide-details="auto"
          />
          <OrderLookupField
            v-model="fields.customer"
            label="Customer"
            resource="parties"
            :load-page="customerPage"
            :item-title="partyName"
            :item-subtitle="customerSubtitle"
            :error-messages="fieldErrors('customer_id')"
          />
          <OrderLookupField
            v-if="auth.canViewProducts"
            v-model="fields.product"
            label="Orders containing product"
            resource="products"
            :load-page="productPage"
            :item-title="partyName"
            :item-subtitle="productSubtitle"
            :error-messages="fieldErrors('product_id')"
          />
          <VTextField
            v-else
            v-model="fields.productId"
            label="Product ID"
            inputmode="numeric"
            maxlength="16"
            variant="outlined"
            density="comfortable"
            :error-messages="fieldErrors('product_id', localProductError)"
            hide-details="auto"
          />
        </div>

        <p class="report-context product-scope">
          Product filters include the full totals of orders containing that product.
        </p>

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
      <DirectoryLoadingState v-if="loading" message="Loading report…" />
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
              {{ formatOrderDate(result.dateFrom) }} – {{ formatOrderDate(result.dateTo) }} ·
              {{ result.timezone }}
            </p>
          </div>
          <p class="report-context">
            Snapshot
            <time :datetime="result.snapshotAt">
              {{ formatReportTimestamp(result.snapshotAt, result.timezone) }}
            </time>
          </p>
        </div>
        <p class="matching-count">{{ orderCount(result.totals.order_count) }} matched</p>

        <div v-if="result.totals.by_currency.length" class="totals-grid sales-totals-grid">
          <article
            v-for="total in result.totals.by_currency"
            :key="total.currency"
            class="total-card sales-currency-card"
          >
            <header class="sales-card-heading">
              <h3>{{ total.currency }}</h3>
              <span>{{ orderCount(total.order_count) }}</span>
            </header>
            <dl class="sales-money-values">
              <div class="realized-total">
                <dt>{{ SALES_TAX_AMOUNTS.grand_total_minor }}</dt>
                <dd>{{ formatOrderTotal(total.grand_total_minor, total.currency) }}</dd>
              </div>
              <div v-for="[field, label] in amountBreakdown" :key="field">
                <dt>{{ label }}</dt>
                <dd>{{ formatOrderTotal(total[field], total.currency) }}</dd>
              </div>
            </dl>
          </article>
        </div>
      </DirectoryPanel>

      <DirectoryPanel tag="section" aria-labelledby="report-orders-title">
        <header class="orders-heading">
          <h2 id="report-orders-title" ref="orders-heading" tabindex="-1">Completed orders</h2>
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
          message="No completed orders match these filters."
        />
        <template v-else>
          <SalesTaxTable :orders="result.orders" :timezone="result.timezone" />
          <footer class="report-footer">
            <span>{{ pageRange }}</span>
            <DirectoryPagination
              v-if="result.lastPage > 1"
              :current-page="result.currentPage"
              :last-page="result.lastPage"
              :label="`${REPORT_TITLE.SALES_TAX} pagination`"
              @page-change="changePage"
            />
          </footer>
        </template>
      </DirectoryPanel>
    </template>
  </section>
</template>

<style scoped src="./report-page.css"></style>

<style scoped>
.sales-report {
  --report-filter-columns: 4;
}

.product-scope {
  margin-top: 9px;
}

.matching-count {
  margin: 10px 0 0;
  font-size: 0.875rem;
  font-weight: 600;
}

.sales-totals-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 315px), 1fr));
}

.sales-card-heading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
}

.sales-card-heading h3 {
  margin: 0;
  font-size: 1rem;
}

.sales-card-heading span {
  color: rgba(var(--v-theme-on-surface), 0.76);
  font-size: 0.8125rem;
}

.sales-money-values {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
  margin: 0;
}

.sales-money-values dd {
  font-size: 0.925rem;
}

.sales-money-values .realized-total {
  grid-column: 1 / -1;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.14);
}

.realized-total dd {
  font-size: 1.35rem;
}
</style>
