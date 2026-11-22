<script setup>
import { VChip } from 'vuetify/components/VChip'
import { VTable } from 'vuetify/components/VTable'

defineProps({
  products: { type: Array, required: true },
})
const emit = defineEmits(['open-profile'])
</script>

<template>
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
      <tr v-for="product in products" :key="product.id" role="row">
        <th scope="row" role="rowheader">
          <div class="product-name">
            <button
              type="button"
              class="product-name-button"
              :aria-label="`View ${product.name}`"
              @click="emit('open-profile', product.id, $event.currentTarget)"
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
</template>

<style scoped>
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
