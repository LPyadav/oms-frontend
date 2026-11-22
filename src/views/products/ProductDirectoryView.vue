<script setup>
import { computed, nextTick, onMounted, onScopeDispose, shallowRef, useTemplateRef } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { loadProductPage } from '../../api/products'
import CatalogDirectoryFilters from '../../components/directory/CatalogDirectoryFilters.vue'
import CatalogDirectoryShell from '../../components/directory/CatalogDirectoryShell.vue'
import ProductDirectoryTable from '../../components/products/ProductDirectoryTable.vue'
import ProductProfileDialog from '../../components/products/ProductProfileDialog.vue'
import { useCatalogDirectory } from '../../composables/useCatalogDirectory'
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
} = useCatalogDirectory({
  fetchPage: (query, signal) => loadProductPage(auth.request, query, signal),
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

function openProduct(productId, trigger) {
  dialogTrigger = trigger
  dialog.value = { productId }
}

async function closeProduct() {
  dialog.value = null
  const trigger = dialogTrigger
  dialogTrigger = null
  await nextTick()
  const target = trigger?.isConnected ? trigger : heading.value
  target?.focus({ preventScroll: true })
}

async function refreshProducts() {
  const page = await load()
  if (page && page.currentPage > page.lastPage) {
    await load({ ...query.value, page: page.lastPage })
  }
}

onMounted(() => {
  heading.value?.focus({ preventScroll: true })
  if (auth.canViewProducts) void load()
})
onScopeDispose(() => requests.abort())
</script>

<template>
  <section v-if="auth.canViewProducts" class="products-page" aria-labelledby="products-heading">
    <header class="products-header">
      <h1 id="products-heading" ref="heading" tabindex="-1">Products</h1>
      <VBtn
        v-if="auth.canManageProducts"
        type="button"
        color="primary"
        variant="flat"
        rounded="lg"
        :prepend-icon="aliases.plus"
        class="text-none"
        @click="openProduct(null, $event.currentTarget)"
      >
        New product
      </VBtn>
    </header>

    <CatalogDirectoryShell
      item-label="Product"
      :loading="loading"
      :error="error"
      :page="result"
      :item-count="result?.products.length ?? 0"
      :filters-applied="filtersApplied"
      @retry="load()"
      @page-change="changePage"
    >
      <template #filters>
        <CatalogDirectoryFilters
          v-model="search"
          aria-label="Product filters"
          search-label="Search products"
          search-placeholder="Name or SKU"
          :filters-applied="filtersApplied"
          @apply="applyDirectoryFilters"
          @clear="clearFilters"
        />
      </template>

      <ProductDirectoryTable :products="result.products" @open-profile="openProduct" />
    </CatalogDirectoryShell>
    <ProductProfileDialog
      v-if="dialog"
      :product-id="dialog.productId"
      @close="closeProduct"
      @changed="refreshProducts"
    />
  </section>
</template>

<style scoped>
.products-page {
  padding-block: clamp(20px, 2.8vw, 28px) 28px;
}

.products-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.products-header h1 {
  margin: 0;
  font-size: clamp(1.625rem, 3.4vw, 2.125rem);
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.products-header h1:focus {
  outline: none;
}
</style>
