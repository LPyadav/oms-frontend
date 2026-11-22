<script setup>
import { computed, nextTick, onMounted, onScopeDispose, shallowRef, useTemplateRef } from 'vue'
import { VAvatar } from 'vuetify/components/VAvatar'
import { VBtn } from 'vuetify/components/VBtn'
import { VChip } from 'vuetify/components/VChip'
import { VTable } from 'vuetify/components/VTable'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import CatalogDirectoryFilters from '../../components/directory/CatalogDirectoryFilters.vue'
import CatalogDirectoryShell from '../../components/directory/CatalogDirectoryShell.vue'
import CustomerProfileDialog from '../../components/customers/CustomerProfileDialog.vue'
import { useCustomerDirectory } from '../../composables/useCustomerDirectory'
import { useAuthStore } from '../../stores/auth'
import { getAccountInitials } from '../../utils/accountInitials'

const auth = useAuthStore()
const heading = useTemplateRef('heading')
const dialog = shallowRef(null)
let dialogTrigger
const requests = new AbortController()
const {
  search,
  query,
  result,
  error,
  loading,
  load,
  applyFilters: applyDirectoryFilters,
} = useCustomerDirectory({
  request: auth.request,
  signal: requests.signal,
})
const filtersApplied = computed(() => !!query.value.search || query.value.isActive !== null)

async function clearFilters() {
  if (await applyDirectoryFilters(null)) heading.value?.focus({ preventScroll: true })
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

    <CatalogDirectoryShell
      item-label="Customer"
      :loading="loading"
      :error="error"
      :page="result"
      :item-count="result?.customers.length ?? 0"
      :filters-applied="filtersApplied"
      @retry="load()"
      @page-change="changePage"
    >
      <template #filters>
        <CatalogDirectoryFilters
          v-model="search"
          aria-label="Customer filters"
          search-label="Search customers"
          search-placeholder="Name, email, or phone"
          :filters-applied="filtersApplied"
          @apply="applyDirectoryFilters"
          @clear="clearFilters"
        />
      </template>

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
    </CatalogDirectoryShell>

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

.customer-identity {
  display: flex;
  align-items: center;
  gap: 10px;
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

.customer-cell-label {
  display: none;
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
