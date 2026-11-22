<script setup>
import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onScopeDispose,
  reactive,
  ref,
  useTemplateRef,
  watch,
} from 'vue'
import { RouterLink } from 'vue-router'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VChip } from 'vuetify/components/VChip'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'
import { VSelect } from 'vuetify/components/VSelect'
import { VTable } from 'vuetify/components/VTable'
import { VTextField } from 'vuetify/components/VTextField'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { loadOrderPage } from '../../api/orders'
import { usePagedDirectory } from '../../composables/usePagedDirectory'
import { FIRST_ORDER_PAGE, ORDER_PRIORITY, ORDER_SORT, ORDER_STATUS } from '../../constants/orders'
import { useAuthStore } from '../../stores/auth'
import { formatOrderDate, formatOrderTotal } from '../../utils/orderDisplay'

const auth = useAuthStore()
const heading = useTemplateRef('heading')
const filters = reactive({ ...FIRST_ORDER_PAGE })
const showFilters = ref(false)
const requests = new AbortController()
const { query, result, error, loading, load } = usePagedDirectory({
  fetchPage: (next, signal) => loadOrderPage(auth.request, next, signal),
  initialQuery: FIRST_ORDER_PAGE,
  signal: requests.signal,
})

const options = (labels) => Object.entries(labels).map(([value, title]) => ({ value, title }))
const statusOptions = [{ title: 'All statuses', value: '' }, ...options(ORDER_STATUS)]
const priorityOptions = [{ title: 'All priorities', value: '' }, ...options(ORDER_PRIORITY)]
const sortOptions = options(ORDER_SORT)
const directionOptions = options({ asc: 'Ascending', desc: 'Descending' })
const statusColors = {
  confirmed: 'primary',
  ready: 'primary',
  completed: 'primary',
  cancelled: 'error',
}
const criteriaFields = ['status', 'priority', 'dateFrom', 'dateTo']
const queryFields = Object.keys(FIRST_ORDER_PAGE).filter((field) => field !== 'page')
let searchTimer

const appliedFilterCount = computed(
  () =>
    criteriaFields.filter((field) => query.value[field]).length +
    Number(
      query.value.sort !== FIRST_ORDER_PAGE.sort ||
        query.value.direction !== FIRST_ORDER_PAGE.direction,
    ),
)
const filtered = computed(
  () => !!query.value.search || criteriaFields.some((field) => !!query.value[field]),
)
const canClear = computed(() =>
  queryFields.some(
    (field) =>
      filters[field] !== FIRST_ORDER_PAGE[field] || query.value[field] !== FIRST_ORDER_PAGE[field],
  ),
)
const dateErrors = computed(() =>
  filters.dateFrom && filters.dateTo && filters.dateTo < filters.dateFrom
    ? ['End date must be on or after the start date.']
    : [],
)
const pageRange = computed(() => {
  if (!result.value?.orders.length) return ''
  const { orders, currentPage, perPage, total } = result.value
  const start = (currentPage - 1) * perPage + 1
  const end = start + orders.length - 1
  const range = start === end ? String(start) : start + '–' + end
  return range + ' of ' + total + (total === 1 ? ' order' : ' orders')
})
const errorMessage = computed(() => {
  if (error.value?.status === 403) return 'You do not have permission to view orders.'
  if (error.value?.status === 422) return 'Check the search and filters, then try again.'
  if (error.value?.status === 429) return 'Too many requests. Try again shortly.'
  return 'Unable to load orders. Try again.'
})

function applyFilters() {
  clearTimeout(searchTimer)
  if (dateErrors.value.length) {
    showFilters.value = true
    return
  }
  return load({ ...filters, page: 1, search: filters.search.trim() })
}

async function clearFilters() {
  Object.assign(filters, FIRST_ORDER_PAGE)
  if (await applyFilters()) heading.value?.focus({ preventScroll: true })
}

async function changePage(page) {
  if (await load({ ...query.value, page })) {
    await nextTick()
    heading.value?.focus()
  }
}

watch(
  () => filters.search,
  (value) => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      const search = value.trim()
      if (search !== query.value.search) void load({ ...query.value, search, page: 1 })
    }, 350)
  },
  { flush: 'sync' },
)
onActivated(() => {
  heading.value?.focus({ preventScroll: true })
  if (!auth.canViewOrders) return

  const search = filters.search.trim()
  const page = search === query.value.search ? query.value.page : 1
  void load({ ...query.value, search, page })
})
onDeactivated(() => clearTimeout(searchTimer))
onScopeDispose(() => {
  clearTimeout(searchTimer)
  requests.abort()
})
</script>

<template>
  <section v-if="auth.canViewOrders" class="orders-page" aria-labelledby="orders-heading">
    <header class="orders-header">
      <h1 id="orders-heading" ref="heading" tabindex="-1">Orders</h1>
      <VChip v-if="!auth.canViewAllOrders" size="small" color="primary" variant="tonal" label>
        Assigned to you
      </VChip>
    </header>

    <VCard color="surface" variant="flat" border class="orders-card">
      <form
        class="orders-toolbar"
        aria-label="Order filters"
        novalidate
        @submit.prevent="applyFilters"
      >
        <div class="orders-search-row">
          <VTextField
            v-model="filters.search"
            class="orders-search"
            label="Search orders"
            placeholder="Order number, customer, product, or assignee"
            :prepend-inner-icon="aliases.search"
            type="search"
            variant="outlined"
            density="comfortable"
            maxlength="255"
            hide-details
          />
          <VBtn
            type="button"
            variant="outlined"
            class="text-none"
            :append-icon="showFilters ? aliases.collapse : aliases.expand"
            :aria-expanded="showFilters"
            aria-controls="order-filter-options"
            @click="showFilters = !showFilters"
          >
            Filters &amp; sort{{ appliedFilterCount ? ` (${appliedFilterCount})` : '' }}
          </VBtn>
          <VBtn type="submit" color="primary" variant="flat" class="text-none">Apply</VBtn>
        </div>

        <div v-show="showFilters" id="order-filter-options" class="orders-filter-options">
          <VSelect
            v-model="filters.status"
            label="Status"
            :items="statusOptions"
            :menu-icon="aliases.dropdown"
            variant="outlined"
            density="comfortable"
            hide-details
          />
          <VSelect
            v-model="filters.priority"
            label="Priority"
            :items="priorityOptions"
            :menu-icon="aliases.dropdown"
            variant="outlined"
            density="comfortable"
            hide-details
          />
          <VTextField
            v-model="filters.dateFrom"
            label="From date"
            type="date"
            min="1000-01-01"
            max="9999-12-31"
            variant="outlined"
            density="comfortable"
            hide-details
          />
          <VTextField
            v-model="filters.dateTo"
            label="To date"
            type="date"
            min="1000-01-01"
            max="9999-12-31"
            variant="outlined"
            density="comfortable"
            :error-messages="dateErrors"
            hide-details="auto"
          />
          <VSelect
            v-model="filters.sort"
            label="Sort by"
            :items="sortOptions"
            :menu-icon="aliases.dropdown"
            variant="outlined"
            density="comfortable"
            hide-details
          />
          <VSelect
            v-model="filters.direction"
            label="Direction"
            :items="directionOptions"
            :menu-icon="aliases.dropdown"
            variant="outlined"
            density="comfortable"
            hide-details
          />
        </div>

        <VBtn
          v-if="canClear"
          type="button"
          variant="text"
          class="text-none orders-clear"
          @click="clearFilters"
        >
          Clear search and filters
        </VBtn>
      </form>

      <div v-if="loading" class="orders-state" role="status">
        <VProgressLinear color="primary" indeterminate aria-hidden="true" />
        <p>Loading orders…</p>
      </div>
      <div v-else-if="error" class="orders-state">
        <VAlert type="error" variant="tonal" :icon="false" role="alert">{{ errorMessage }}</VAlert>
        <VBtn
          v-if="error.status === 403"
          :to="{ name: 'workspace' }"
          variant="outlined"
          class="text-none"
        >
          Back to workspace
        </VBtn>
        <VBtn
          v-else-if="error.status !== 422"
          type="button"
          variant="outlined"
          class="text-none"
          @click="load()"
        >
          Try again
        </VBtn>
      </div>
      <template v-else-if="result">
        <div v-if="result.currentPage > result.lastPage" class="orders-state">
          <p>This order page is no longer available.</p>
          <VBtn
            type="button"
            variant="outlined"
            class="text-none"
            @click="changePage(result.lastPage)"
          >
            Go to last page
          </VBtn>
        </div>
        <div v-else-if="!result.orders.length" class="orders-state" role="status">
          <p v-if="filtered">No orders match these filters.</p>
          <p v-else>
            {{ auth.canViewAllOrders ? 'No orders yet.' : 'No orders are assigned to you.' }}
          </p>
        </div>
        <template v-else>
          <VTable class="orders-table" density="comfortable">
            <caption class="d-sr-only">
              Order directory
            </caption>
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">Order</th>
                <th scope="col" role="columnheader">Customer</th>
                <th scope="col" role="columnheader">Order date</th>
                <th scope="col" role="columnheader">Status</th>
                <th scope="col" role="columnheader">Priority</th>
                <th scope="col" role="columnheader">Assigned to</th>
                <th scope="col" role="columnheader" class="text-end">Total</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              <tr v-for="order in result.orders" :key="order.id" role="row">
                <th scope="row" role="rowheader">
                  <RouterLink
                    class="order-detail-link"
                    :to="{ name: 'order-detail', params: { orderId: order.id } }"
                  >
                    {{ order.order_number }}
                  </RouterLink>
                </th>
                <td role="cell">
                  <span class="order-cell-label" aria-hidden="true">Customer</span>
                  {{ order.customer.name }}
                </td>
                <td role="cell">
                  <span class="order-cell-label" aria-hidden="true">Order date</span>
                  <time :datetime="order.order_date">{{ formatOrderDate(order.order_date) }}</time>
                </td>
                <td role="cell">
                  <span class="order-cell-label" aria-hidden="true">Status</span>
                  <VChip :color="statusColors[order.status]" size="small" variant="tonal" label>
                    {{ ORDER_STATUS[order.status] }}
                  </VChip>
                </td>
                <td role="cell">
                  <span class="order-cell-label" aria-hidden="true">Priority</span>
                  {{ ORDER_PRIORITY[order.priority] }}
                </td>
                <td role="cell">
                  <span class="order-cell-label" aria-hidden="true">Assigned to</span>
                  {{ order.assignee?.name ?? 'Unassigned' }}
                </td>
                <td role="cell" class="order-total">
                  <span class="order-cell-label" aria-hidden="true">Total</span>
                  {{ formatOrderTotal(order.grand_total_minor, order.currency) }}
                </td>
              </tr>
            </tbody>
          </VTable>

          <footer class="orders-footer">
            <span class="order-muted" aria-live="polite">{{ pageRange }}</span>
            <nav v-if="result.lastPage > 1" class="orders-pages" aria-label="Order pages">
              <VBtn
                aria-label="Previous page"
                :icon="aliases.prev"
                size="small"
                rounded="lg"
                variant="outlined"
                :disabled="result.currentPage <= 1"
                @click="changePage(result.currentPage - 1)"
              />
              <span class="order-muted"
                >Page {{ result.currentPage }} of {{ result.lastPage }}</span
              >
              <VBtn
                aria-label="Next page"
                :icon="aliases.next"
                size="small"
                rounded="lg"
                variant="outlined"
                :disabled="result.currentPage >= result.lastPage"
                @click="changePage(result.currentPage + 1)"
              />
            </nav>
          </footer>
        </template>
      </template>
    </VCard>
  </section>
</template>

<style scoped>
.orders-page {
  padding-block: clamp(20px, 2.8vw, 28px) 28px;
}

.orders-header,
.orders-footer,
.orders-pages {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.orders-header,
.orders-footer {
  justify-content: space-between;
}

.orders-header {
  margin-bottom: 20px;
}

.orders-header h1 {
  margin: 0;
  font-size: clamp(1.625rem, 3.4vw, 2.125rem);
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.orders-header h1:focus {
  outline: none;
}

.orders-card {
  border-color: rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 12px;
  box-shadow: 0 2px 7px rgba(var(--v-theme-on-surface), 0.045);
}

.orders-toolbar,
.orders-state {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.orders-search-row,
.orders-filter-options {
  display: grid;
  gap: 12px;
}

.orders-search-row {
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
}

.orders-filter-options {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.orders-clear {
  justify-self: start;
}

.orders-state {
  justify-items: start;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.orders-state p {
  margin: 0;
}

.orders-table thead {
  background: rgba(var(--v-theme-primary), 0.055);
}

.orders-table th[scope='row'],
.orders-table td {
  padding-block: 10px;
  overflow-wrap: anywhere;
}

.order-detail-link {
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
  text-underline-offset: 2px;
}

.order-total {
  text-align: end;
  font-variant-numeric: tabular-nums;
}

.orders-footer {
  padding: 14px 16px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.order-muted {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.77);
}

.order-cell-label {
  display: none;
}

@media (max-width: 760px) {
  .orders-search-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .orders-search {
    grid-column: 1 / -1;
  }

  .orders-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .orders-table tbody tr {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 14px;
    padding: 12px 16px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }

  .orders-table th[scope='row'],
  .orders-table td {
    height: auto;
    padding: 0;
    border: 0;
  }

  .orders-table th[scope='row'] {
    grid-column: 1 / -1;
  }

  .order-total {
    text-align: start;
  }

  .order-cell-label {
    display: block;
    margin-bottom: 3px;
    color: rgba(var(--v-theme-on-surface), 0.77);
    font-size: 0.75rem;
  }
}

@media (max-width: 520px) {
  .orders-filter-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
