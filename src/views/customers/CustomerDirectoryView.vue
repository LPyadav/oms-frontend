<script setup>
import { computed, nextTick, onMounted, onScopeDispose, shallowRef, useTemplateRef } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import CatalogDirectoryFilters from '../../components/directory/CatalogDirectoryFilters.vue'
import CatalogDirectoryShell from '../../components/directory/CatalogDirectoryShell.vue'
import CustomerDirectoryTable from '../../components/customers/CustomerDirectoryTable.vue'
import CustomerProfileDialog from '../../components/customers/CustomerProfileDialog.vue'
import { useCustomerDirectory } from '../../composables/useCustomerDirectory'
import { useAuthStore } from '../../stores/auth'

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

function openCustomer(customerId, trigger) {
  dialogTrigger = trigger
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
        @click="openCustomer(null, $event.currentTarget)"
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

      <CustomerDirectoryTable :customers="result.customers" @open-profile="openCustomer" />
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
</style>
