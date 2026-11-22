<script setup>
import { computed, nextTick, onMounted, onScopeDispose, shallowRef, useTemplateRef } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import { VChip } from 'vuetify/components/VChip'
import { VTable } from 'vuetify/components/VTable'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { loadProductPage } from '../../api/products'
import CatalogDirectoryFilters from '../../components/directory/CatalogDirectoryFilters.vue'
import CatalogDirectoryShell from '../../components/directory/CatalogDirectoryShell.vue'
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

function openProduct(productId, event) {
  dialogTrigger = event.currentTarget
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
        @click="openProduct(null, $event)"
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

      <VTable class="products-table" density="comfortable">
        <caption class="d-sr-only">
          Product directory
        </caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">Product</th>
            <th scope="col" role="columnheader">Unit price</th>
            <th scope="col" role="columnheader">Tax rate</th>
            <th scope="col" role="columnheader">Stock</th>
            <th scope="col" role="columnheader">Status</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          <tr v-for="product in result.products" :key="product.id" role="row">
            <th scope="row" role="rowheader">
              <div class="product-name">
                <button
                  type="button"
                  class="product-name-button"
                  :aria-label="`View ${product.name}`"
                  @click="openProduct(product.id, $event)"
                >
                  {{ product.name }}
                </button>
                <span class="product-detail">{{ product.sku }}</span>
              </div>
            </th>
            <td role="cell" class="product-number">
              <span class="product-cell-label" aria-hidden="true">Unit price</span>
              {{ product.price }}
            </td>
            <td role="cell" class="product-number">
              <span class="product-cell-label" aria-hidden="true">Tax rate</span>
              {{ product.tax_rate }}%
            </td>
            <td role="cell" class="product-number">
              <span class="product-cell-label" aria-hidden="true">Stock</span>
              {{ product.stock_quantity }}
            </td>
            <td role="cell">
              <span class="product-cell-label" aria-hidden="true">Status</span>
              <VChip
                :color="product.is_active ? 'primary' : undefined"
                size="small"
                variant="tonal"
                label
              >
                {{ product.is_active ? 'Active' : 'Inactive' }}
              </VChip>
            </td>
          </tr>
        </tbody>
      </VTable>
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

.products-table thead {
  background: rgba(var(--v-theme-primary), 0.055);
}

.products-table th[scope='row'],
.products-table td {
  padding-block: 10px;
}

.product-name {
  display: grid;
  min-inline-size: 0;
  gap: 2px;
  font-weight: 400;
}

.product-number {
  font-variant-numeric: tabular-nums;
}

.product-name-button {
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

.product-name span,
.products-table td {
  overflow-wrap: anywhere;
}

.product-detail {
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
}

.product-cell-label {
  display: none;
}

@media (max-width: 599px) {
  .products-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .products-table tbody tr {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 10px;
    padding: 12px 16px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }

  .products-table th[scope='row'],
  .products-table td {
    height: auto;
    padding: 0;
    border: 0;
  }

  .products-table th[scope='row'] {
    grid-column: 1 / -1;
  }

  .product-cell-label {
    display: block;
    margin-bottom: 3px;
    color: rgba(var(--v-theme-on-surface), 0.77);
    font-size: 0.75rem;
  }
}
</style>
