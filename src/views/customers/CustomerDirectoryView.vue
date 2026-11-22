<script setup>
import { computed, nextTick, onMounted, onScopeDispose, ref, shallowRef, useTemplateRef } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VAvatar } from 'vuetify/components/VAvatar'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VChip } from 'vuetify/components/VChip'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'
import { VSelect } from 'vuetify/components/VSelect'
import { VTable } from 'vuetify/components/VTable'
import { VTextField } from 'vuetify/components/VTextField'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import CustomerProfileDialog from '../../components/customers/CustomerProfileDialog.vue'
import { useCustomerDirectory } from '../../composables/useCustomerDirectory'
import { useAuthStore } from '../../stores/auth'
import { getAccountInitials } from '../../utils/accountInitials'

const auth = useAuthStore()
const heading = useTemplateRef('heading')
const dialog = shallowRef(null)
let dialogTrigger
const search = ref('')
const status = ref('all')
const statusOptions = [
  { title: 'All statuses', value: 'all' },
  { title: 'Active', value: 'active' },
  { title: 'Inactive', value: 'inactive' },
]
const statusFilters = { all: null, active: true, inactive: false }
const requests = new AbortController()
const { query, result, error, loading, load } = useCustomerDirectory({
  request: auth.request,
  signal: requests.signal,
})
const filtersApplied = computed(() => !!query.value.search || query.value.isActive !== null)
const filtersPresent = computed(
  () => filtersApplied.value || !!search.value.trim() || status.value !== 'all',
)
const pageRange = computed(() => {
  if (!result.value?.customers.length) return ''

  const { customers, currentPage, perPage, total } = result.value
  const start = (currentPage - 1) * perPage + 1
  const end = start + customers.length - 1
  const range = start === end ? String(start) : start + '–' + end
  return range + ' of ' + total + (total === 1 ? ' customer' : ' customers')
})
const errorMessage = computed(() => {
  if (error.value?.status === 403) return 'You do not have permission to view customers.'
  if (error.value?.status === 429) return 'Too many requests. Try again shortly.'
  return 'Unable to load customers. Try again.'
})

function applyFilters() {
  return load({
    page: 1,
    search: search.value.trim(),
    isActive: statusFilters[status.value] ?? null,
  })
}

async function clearFilters() {
  search.value = ''
  status.value = 'all'
  if (await applyFilters()) heading.value?.focus({ preventScroll: true })
}

async function changePage(page) {
  if (await load({ ...query.value, page })) {
    await nextTick()
    heading.value?.focus()
  }
}

function openCustomer(customerId, event) {
  dialogTrigger = event.currentTarget
  dialog.value = { customerId }
}

async function closeCustomer() {
  dialog.value = null
  const trigger = dialogTrigger
  dialogTrigger = null
  await nextTick()
  const target = trigger?.isConnected ? trigger : heading.value
  target?.focus({ preventScroll: true })
}

async function refreshCustomers() {
  const page = await load()
  if (page && page.currentPage > page.lastPage) {
    await load({ ...query.value, page: page.lastPage })
  }
}

onMounted(() => {
  heading.value?.focus({ preventScroll: true })
  if (auth.canViewCustomers) void load()
})
onScopeDispose(() => requests.abort())
</script>

<template>
  <section v-if="auth.canViewCustomers" class="customers-page" aria-labelledby="customers-heading">
    <header class="customers-header">
      <h1 id="customers-heading" ref="heading" tabindex="-1">Customers</h1>
      <VBtn
        v-if="auth.canManageCustomers"
        type="button"
        color="primary"
        variant="flat"
        rounded="lg"
        :prepend-icon="aliases.plus"
        class="text-none"
        @click="openCustomer(null, $event)"
      >
        New customer
      </VBtn>
    </header>

    <VCard color="surface" variant="flat" border class="customers-card">
      <form class="customer-filters" aria-label="Customer filters" @submit.prevent="applyFilters">
        <VTextField
          v-model="search"
          label="Search customers"
          placeholder="Name, email, or phone"
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
        <div class="customer-filter-actions">
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

      <div v-if="loading" class="customers-state" role="status">
        <VProgressLinear color="primary" indeterminate aria-hidden="true" />
        <p>Loading customers…</p>
      </div>
      <div v-else-if="error" class="customers-state">
        <VAlert type="error" variant="tonal" :icon="false" role="alert">{{ errorMessage }}</VAlert>
        <VBtn
          v-if="error.status === 403"
          :to="{ name: 'workspace' }"
          variant="outlined"
          class="text-none"
        >
          Back to workspace
        </VBtn>
        <VBtn v-else type="button" variant="outlined" class="text-none" @click="load()">
          Try again
        </VBtn>
      </div>
      <template v-else-if="result">
        <div v-if="result.currentPage > result.lastPage" class="customers-state">
          <p>This customer page is no longer available.</p>
          <VBtn
            type="button"
            variant="outlined"
            class="text-none"
            @click="changePage(result.lastPage)"
          >
            Go to last page
          </VBtn>
        </div>
        <div v-else-if="!result.customers.length" class="customers-state" role="status">
          <p>{{ filtersApplied ? 'No customers match these filters.' : 'No customers yet.' }}</p>
        </div>
        <template v-else>
          <VTable class="customers-table" density="comfortable">
            <caption class="d-sr-only">
              Customer directory
            </caption>
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">Customer</th>
                <th scope="col" role="columnheader">Phone</th>
                <th scope="col" role="columnheader">Status</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              <tr v-for="customer in result.customers" :key="customer.id" role="row">
                <th scope="row" role="rowheader">
                  <div class="customer-identity">
                    <VAvatar size="34" color="primary" variant="tonal" aria-hidden="true">
                      {{ getAccountInitials(customer.name) }}
                    </VAvatar>
                    <div class="customer-name">
                      <button
                        type="button"
                        class="customer-name-button"
                        :aria-label="`View ${customer.name}`"
                        @click="openCustomer(customer.id, $event)"
                      >
                        {{ customer.name }}
                      </button>
                      <span class="customer-detail">{{ customer.email || 'No email' }}</span>
                    </div>
                  </div>
                </th>
                <td role="cell">
                  <span class="customer-cell-label" aria-hidden="true">Phone</span>
                  {{ customer.phone || '—' }}
                </td>
                <td role="cell">
                  <span class="customer-cell-label" aria-hidden="true">Status</span>
                  <VChip
                    :color="customer.is_active ? 'primary' : undefined"
                    size="small"
                    variant="tonal"
                    label
                  >
                    {{ customer.is_active ? 'Active' : 'Inactive' }}
                  </VChip>
                </td>
              </tr>
            </tbody>
          </VTable>

          <footer class="customers-footer">
            <span class="customer-detail" aria-live="polite">{{ pageRange }}</span>
            <nav v-if="result.lastPage > 1" class="customer-pages" aria-label="Customer pages">
              <VBtn
                aria-label="Previous page"
                :icon="aliases.prev"
                size="small"
                rounded="lg"
                variant="outlined"
                :disabled="result.currentPage <= 1"
                @click="changePage(result.currentPage - 1)"
              />
              <span class="customer-detail"
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

    <CustomerProfileDialog
      v-if="dialog"
      :customer-id="dialog.customerId"
      @close="closeCustomer"
      @changed="refreshCustomers"
    />
  </section>
</template>

<style scoped>
.customers-page {
  padding-block: clamp(20px, 2.8vw, 28px) 28px;
}

.customers-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.customers-header h1 {
  margin: 0;
  font-size: clamp(1.625rem, 3.4vw, 2.125rem);
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.customers-header h1:focus {
  outline: none;
}

.customers-card {
  border-color: rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 12px;
  box-shadow: 0 2px 7px rgba(var(--v-theme-on-surface), 0.045);
}

.customer-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(145px, 0.36fr) auto;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.customer-filter-actions,
.customer-pages,
.customers-footer,
.customer-identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.customer-filter-actions,
.customers-footer {
  flex-wrap: wrap;
}

.customers-state {
  display: grid;
  gap: 12px;
  justify-items: start;
  padding: 16px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.customers-state p {
  margin: 0;
}

.customers-table thead {
  background: rgba(var(--v-theme-primary), 0.055);
}

.customers-table th[scope='row'],
.customers-table td {
  padding-block: 10px;
}

.customer-name {
  display: grid;
  min-inline-size: 0;
  gap: 2px;
  font-weight: 400;
}

.customer-name-button {
  justify-self: start;
  min-width: 0;
  padding: 0;
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
  text-align: start;
  text-decoration: underline;
  text-underline-offset: 2px;
  overflow-wrap: anywhere;
}

.customer-name span,
.customers-table td {
  overflow-wrap: anywhere;
}

.customer-detail {
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
}

.customers-footer {
  justify-content: space-between;
  padding: 14px 16px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.customer-cell-label {
  display: none;
}

@media (max-width: 700px) {
  .customer-filters {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 599px) {
  .customers-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .customers-table tbody tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 10px;
    padding: 12px 16px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }

  .customers-table th[scope='row'],
  .customers-table td {
    height: auto;
    padding: 0;
    border: 0;
  }

  .customers-table th[scope='row'] {
    grid-column: 1 / -1;
  }

  .customer-cell-label {
    display: block;
    margin-bottom: 3px;
    color: rgba(var(--v-theme-on-surface), 0.77);
    font-size: 0.75rem;
  }
}
</style>
