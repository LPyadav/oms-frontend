<script setup>
import { RouterLink } from 'vue-router'
import { VChip } from 'vuetify/components/VChip'
import { VTable } from 'vuetify/components/VTable'
import { ORDER_PRIORITY, ORDER_STATUS } from '../../constants/orders'
import { formatOrderDate, formatOrderTotal } from '../../utils/orderDisplay'

defineProps({ orders: { type: Array, required: true } })

const statusColors = {
  confirmed: 'primary',
  ready: 'primary',
  completed: 'primary',
  cancelled: 'error',
}
</script>

<template>
  <VTable class="fulfillment-table" density="comfortable">
    <caption class="d-sr-only">
      Matching orders
    </caption>
    <thead role="rowgroup">
      <tr role="row">
        <th scope="col" role="columnheader">Order</th>
        <th scope="col" role="columnheader">Order date</th>
        <th scope="col" role="columnheader">Customer</th>
        <th scope="col" role="columnheader">Priority</th>
        <th scope="col" role="columnheader">Status</th>
        <th scope="col" role="columnheader">Assigned employee</th>
        <th scope="col" role="columnheader" class="text-end">Total</th>
      </tr>
    </thead>
    <tbody role="rowgroup">
      <tr v-for="order in orders" :key="order.id" role="row">
        <th scope="row" role="rowheader">
          <RouterLink
            class="fulfillment-order-link"
            :to="{ name: 'order-detail', params: { orderId: order.id } }"
          >
            {{ order.order_number }}
          </RouterLink>
        </th>
        <td role="cell">
          <span class="fulfillment-cell-label" aria-hidden="true">Order date</span>
          <time :datetime="order.order_date">{{ formatOrderDate(order.order_date) }}</time>
        </td>
        <td role="cell">
          <span class="fulfillment-cell-label" aria-hidden="true">Customer</span>
          {{ order.customer.name }}
        </td>
        <td role="cell">
          <span class="fulfillment-cell-label" aria-hidden="true">Priority</span>
          {{ ORDER_PRIORITY[order.priority] }}
        </td>
        <td role="cell">
          <span class="fulfillment-cell-label" aria-hidden="true">Status</span>
          <VChip :color="statusColors[order.status]" size="small" variant="tonal" label>
            {{ ORDER_STATUS[order.status] }}
          </VChip>
        </td>
        <td role="cell">
          <span class="fulfillment-cell-label" aria-hidden="true">Assigned employee</span>
          {{ order.assignee?.name ?? 'Unassigned' }}
        </td>
        <td role="cell" class="fulfillment-total">
          <span class="fulfillment-cell-label" aria-hidden="true">Total</span>
          {{ formatOrderTotal(order.grand_total_minor, order.currency) }}
        </td>
      </tr>
    </tbody>
  </VTable>
</template>

<style scoped>
.fulfillment-table {
  min-inline-size: 0;
}

.fulfillment-table thead {
  background: rgba(var(--v-theme-primary), 0.055);
}

.fulfillment-table th,
.fulfillment-table td {
  min-inline-size: 0;
  overflow-wrap: anywhere;
}

.fulfillment-table tbody th,
.fulfillment-table td {
  padding-block: 10px;
}

.fulfillment-order-link {
  display: inline-block;
  max-inline-size: 100%;
  min-block-size: 24px;
  border-radius: 3px;
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
  text-decoration-color: rgba(var(--v-theme-primary), 0.48);
  text-underline-offset: 3px;
}

.fulfillment-order-link:hover {
  text-decoration-color: currentColor;
}

.fulfillment-order-link:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}

.fulfillment-total {
  text-align: end;
  font-variant-numeric: tabular-nums;
}

.fulfillment-cell-label {
  display: none;
}

@media (max-width: 760px) {
  .fulfillment-table thead {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .fulfillment-table tbody tr {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 10px 14px;
    padding: 12px 16px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }

  .fulfillment-table tbody th,
  .fulfillment-table td {
    height: auto;
    padding: 0;
    border: 0;
  }

  .fulfillment-table th[scope='row'] {
    grid-column: 1 / -1;
  }

  .fulfillment-total {
    text-align: start;
  }

  .fulfillment-cell-label {
    display: block;
    margin-block-end: 3px;
    color: rgba(var(--v-theme-on-surface), 0.77);
    font-size: 0.75rem;
  }
}
</style>
