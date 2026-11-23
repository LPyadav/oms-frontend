<script setup>
import { RouterLink } from 'vue-router'
import { VTable } from 'vuetify/components/VTable'
import { SALES_TAX_AMOUNTS } from '../../constants/reports'
import { formatOrderTotal } from '../../utils/orderDisplay'
import { formatReportTimestamp } from '../../utils/reportDates'

defineProps({
  orders: { type: Array, required: true },
  timezone: { type: String, required: true },
})
</script>

<template>
  <VTable class="sales-tax-table" density="comfortable">
    <caption class="d-sr-only">
      Sales and tax report rows
    </caption>
    <thead role="rowgroup">
      <tr role="row">
        <th scope="col" role="columnheader" class="sales-tax-order-column">Order</th>
        <th scope="col" role="columnheader" class="sales-tax-completion-column">Completed</th>
        <th scope="col" role="columnheader" class="sales-tax-customer-column">Customer</th>
        <th
          v-for="(label, field) in SALES_TAX_AMOUNTS"
          :key="field"
          scope="col"
          role="columnheader"
          class="sales-tax-amount"
        >
          {{ label }}
        </th>
      </tr>
    </thead>
    <tbody role="rowgroup">
      <tr v-for="order in orders" :key="order.id" role="row">
        <th scope="row" role="rowheader">
          <RouterLink
            class="sales-tax-order-link"
            :to="{ name: 'order-detail', params: { orderId: order.id } }"
          >
            {{ order.order_number }}
          </RouterLink>
        </th>
        <td role="cell">
          <span class="sales-tax-cell-label" aria-hidden="true">Completed</span>
          <time :datetime="order.completed_at">
            {{ formatReportTimestamp(order.completed_at, timezone) }}
          </time>
        </td>
        <td role="cell">
          <span class="sales-tax-cell-label" aria-hidden="true">Customer</span>
          {{ order.customer.name }}
        </td>
        <td
          v-for="(label, field) in SALES_TAX_AMOUNTS"
          :key="field"
          role="cell"
          class="sales-tax-amount"
          :class="{ 'sales-tax-total': field === 'grand_total_minor' }"
        >
          <span class="sales-tax-cell-label" aria-hidden="true">{{ label }}</span>
          {{ formatOrderTotal(order[field], order.currency) }}
        </td>
      </tr>
    </tbody>
  </VTable>
</template>

<style scoped>
.sales-tax-table {
  min-inline-size: 0;
  container-type: inline-size;
}

.sales-tax-table :deep(.v-table__wrapper > table) {
  table-layout: fixed;
}

.sales-tax-table thead {
  background: rgba(var(--v-theme-primary), 0.055);
}

.sales-tax-table th,
.sales-tax-table td {
  min-inline-size: 0;
  padding-inline: 12px;
  overflow-wrap: anywhere;
}

.sales-tax-table tbody th,
.sales-tax-table td {
  padding-block: 10px;
}

.sales-tax-order-column,
.sales-tax-customer-column {
  inline-size: 13%;
}

.sales-tax-completion-column {
  inline-size: 14%;
}

.sales-tax-order-link {
  display: inline-block;
  max-inline-size: 100%;
  min-block-size: 24px;
  border-radius: 3px;
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
  text-decoration-color: rgba(var(--v-theme-primary), 0.48);
  text-underline-offset: 3px;
}

.sales-tax-order-link:hover {
  text-decoration-color: currentColor;
}

.sales-tax-order-link:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}

.sales-tax-table .sales-tax-amount {
  text-align: end;
  font-variant-numeric: tabular-nums;
}

.sales-tax-total {
  font-weight: 700;
}

.sales-tax-cell-label {
  display: none;
}

@container (max-width: 760px) {
  .sales-tax-table thead {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .sales-tax-table tbody tr {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 10px 14px;
    padding: 12px 16px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }

  .sales-tax-table tbody th,
  .sales-tax-table td {
    height: auto;
    padding: 0;
    border: 0;
  }

  .sales-tax-table th[scope='row'] {
    grid-column: 1 / -1;
  }

  .sales-tax-table .sales-tax-amount {
    text-align: start;
  }

  .sales-tax-cell-label {
    display: block;
    margin-block-end: 3px;
    color: rgba(var(--v-theme-on-surface), 0.77);
    font-size: 0.75rem;
    font-weight: 400;
  }
}
</style>
