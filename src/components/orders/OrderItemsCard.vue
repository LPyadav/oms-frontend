<script setup>
import { VCard } from 'vuetify/components/VCard'
import { VTable } from 'vuetify/components/VTable'
import { formatOrderTaxRate, formatOrderTotal } from '../../utils/orderDisplay'

defineProps({
  order: { type: Object, required: true },
})
</script>

<template>
  <VCard
    tag="section"
    class="items-card"
    variant="flat"
    border
    aria-labelledby="order-items-heading"
  >
    <h2 id="order-items-heading">Items</h2>
    <p v-if="!order.items.length" class="items-empty">No items on this order.</p>
    <VTable v-else class="items-table" density="comfortable">
      <caption class="d-sr-only">
        Order line items
      </caption>
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col" role="columnheader">Product</th>
          <th scope="col" role="columnheader" class="item-number">Qty</th>
          <th scope="col" role="columnheader" class="item-number">Unit price</th>
          <th scope="col" role="columnheader" class="item-number">Discount</th>
          <th scope="col" role="columnheader" class="item-number">Tax</th>
          <th scope="col" role="columnheader" class="item-number">Line total</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        <tr v-for="item in order.items" :key="item.position" role="row">
          <th scope="row" role="rowheader">
            <span class="item-name">{{ item.product_name }}</span>
            <span class="item-secondary">{{ item.product_sku }}</span>
          </th>
          <td role="cell" class="item-number">
            <span class="item-label" aria-hidden="true">Qty</span>
            {{ item.quantity }}
          </td>
          <td role="cell" class="item-number">
            <span class="item-label" aria-hidden="true">Unit price</span>
            {{ formatOrderTotal(item.unit_price_minor, order.currency) }}
          </td>
          <td role="cell" class="item-number">
            <span class="item-label" aria-hidden="true">Discount</span>
            {{
              formatOrderTotal(
                item.item_discount_minor + item.allocated_order_discount_minor,
                order.currency,
              )
            }}
          </td>
          <td role="cell" class="item-number">
            <span class="item-label" aria-hidden="true">Tax</span>
            {{ formatOrderTotal(item.tax_minor, order.currency) }}
            <span class="item-secondary">{{ formatOrderTaxRate(item.tax_rate_basis_points) }}</span>
          </td>
          <td role="cell" class="item-number item-name">
            <span class="item-label" aria-hidden="true">Line total</span>
            {{ formatOrderTotal(item.line_total_minor, order.currency) }}
          </td>
        </tr>
      </tbody>
    </VTable>
    <dl class="order-totals">
      <div>
        <dt>Subtotal</dt>
        <dd>{{ formatOrderTotal(order.subtotal_minor, order.currency) }}</dd>
      </div>
      <div>
        <dt>Discount</dt>
        <dd>{{ formatOrderTotal(order.discount_total_minor, order.currency) }}</dd>
      </div>
      <div>
        <dt>
          Tax
          <span v-if="order.order_tax_rate_basis_points != null" class="item-secondary">
            {{ formatOrderTaxRate(order.order_tax_rate_basis_points) }} order rate
          </span>
        </dt>
        <dd>{{ formatOrderTotal(order.tax_total_minor, order.currency) }}</dd>
      </div>
      <div class="grand-total">
        <dt>Total</dt>
        <dd>{{ formatOrderTotal(order.grand_total_minor, order.currency) }}</dd>
      </div>
    </dl>
  </VCard>
</template>

<style scoped>
.items-card {
  min-width: 0;
  border-color: rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 12px;
}

.items-card h2 {
  margin: 0;
  padding: 18px 18px 14px;
  font-size: 1.0625rem;
  line-height: 1.4;
}

.items-table thead {
  background: rgba(var(--v-theme-primary), 0.055);
}

.items-table th[scope='row'],
.items-table td {
  padding-block: 10px;
  overflow-wrap: anywhere;
}

.items-empty {
  margin: 0;
  padding: 0 18px 14px;
}

.item-name {
  font-weight: 700;
}

.item-secondary {
  display: block;
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.75rem;
  font-weight: 400;
}

.items-table .item-number {
  text-align: end;
  font-variant-numeric: tabular-nums;
}

.item-label {
  display: none;
}

.order-totals {
  display: grid;
  gap: 7px;
  max-width: 290px;
  margin: 0 0 0 auto;
  padding: 14px 18px 18px;
  font-size: 0.875rem;
}

.order-totals div {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0 16px;
}

.order-totals dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.grand-total {
  margin-top: 3px;
  padding-top: 9px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  font-weight: 700;
}

@media (max-width: 760px) {
  .items-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .items-table tbody tr {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 14px;
    padding: 12px 18px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }

  .items-table th[scope='row'],
  .items-table td {
    height: auto;
    padding: 0;
    border: 0;
  }

  .items-table th[scope='row'] {
    grid-column: 1 / -1;
  }

  .items-table .item-number {
    text-align: start;
  }

  .item-label {
    display: block;
    color: rgba(var(--v-theme-on-surface), 0.77);
    font-size: 0.75rem;
    font-weight: 400;
  }

  .order-totals {
    max-width: none;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }
}
</style>
