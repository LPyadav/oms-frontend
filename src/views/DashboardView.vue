<script setup>
import { computed, onMounted, useTemplateRef } from 'vue'
import { RouterLink } from 'vue-router'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VChip } from 'vuetify/components/VChip'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'
import { VTable } from 'vuetify/components/VTable'
import { loadDashboardOverview } from '../api/dashboard'
import DashboardMetrics from '../components/dashboard/DashboardMetrics.vue'
import DashboardRevenueCard from '../components/dashboard/DashboardRevenueCard.vue'
import { useDashboardResource } from '../composables/useDashboardResource'
import { ORDER_PRIORITY, ORDER_STATUS } from '../constants/orders'
import { useAuthStore } from '../stores/auth'
import { formatOrderDate, formatOrderTotal } from '../utils/orderDisplay'

const auth = useAuthStore()
const heading = useTemplateRef('heading')
const countFormatter = new Intl.NumberFormat()
const formatCount = (value) => countFormatter.format(value)
const {
  data: overview,
  error,
  loading,
  load,
} = useDashboardResource((_, signal) => loadDashboardOverview(auth.request, signal))

const statusRows = computed(() => {
  if (!overview.value) return []

  const { total_orders: total, orders_by_status: counts } = overview.value
  return Object.entries(ORDER_STATUS).map(([status, label]) => ({
    status,
    label,
    count: counts[status],
    width: total ? Math.min((counts[status] / total) * 100, 100) : 0,
  }))
})
const errorMessage = computed(() => {
  if (error.value?.status === 403) return 'You no longer have access to the dashboard overview.'
  if (error.value?.status === 429) return 'Too many requests. Try again shortly.'
  return 'Unable to load the dashboard overview.'
})

onMounted(() => {
  heading.value?.focus({ preventScroll: true })
  if (auth.canViewDashboard) void load()
})
</script>

<template>
  <section v-if="auth.canViewDashboard" class="dashboard-page" aria-labelledby="dashboard-title">
    <header class="dashboard-header">
      <div>
        <h1 id="dashboard-title" ref="heading" tabindex="-1">Dashboard</h1>
        <p>Order activity, completed revenue, and catalog totals.</p>
      </div>
      <VBtn :to="{ name: 'orders' }" color="primary" variant="outlined" class="text-none">
        View orders
      </VBtn>
    </header>

    <div v-if="loading" class="overview-state" role="status">
      <VProgressLinear color="primary" indeterminate aria-hidden="true" />
      <p>Loading dashboard overview…</p>
    </div>
    <VAlert v-else-if="error" type="error" variant="tonal" :icon="false" role="alert">
      {{ errorMessage }}
      <VBtn
        v-if="error.status !== 403"
        variant="text"
        class="text-none overview-retry"
        size="small"
        @click="load()"
      >
        Try again
      </VBtn>
    </VAlert>
    <DashboardMetrics v-else-if="overview" :overview="overview" />

    <div class="dashboard-analysis">
      <DashboardRevenueCard />
      <VCard
        v-if="overview"
        tag="section"
        class="dashboard-card"
        variant="flat"
        border
        rounded="lg"
        aria-labelledby="distribution-title"
      >
        <h2 id="distribution-title">Orders by status</h2>
        <p class="card-context">Share of all orders</p>
        <ul class="status-list">
          <li v-for="row in statusRows" :key="row.status">
            <div class="status-label">
              <span>{{ row.label }}</span>
              <strong>{{ formatCount(row.count) }}</strong>
            </div>
            <div class="status-track" aria-hidden="true">
              <span
                :class="'status-fill status-' + row.status"
                :style="{ width: row.width + '%' }"
              />
            </div>
          </li>
        </ul>
      </VCard>
    </div>

    <VCard
      v-if="overview"
      tag="section"
      class="dashboard-card"
      variant="flat"
      border
      rounded="lg"
      aria-labelledby="recent-orders-title"
    >
      <h2 id="recent-orders-title">Recent orders</h2>
      <p v-if="!overview.recent_orders.length" class="card-context">No orders yet.</p>
      <VTable
        v-else
        class="recent-orders"
        density="comfortable"
        tabindex="0"
        role="region"
        aria-labelledby="recent-orders-title"
      >
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">Date</th>
            <th scope="col">Status</th>
            <th scope="col">Priority</th>
            <th scope="col" class="recent-order-total">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in overview.recent_orders" :key="order.id">
            <th scope="row">
              <RouterLink
                :to="{ name: 'order-detail', params: { orderId: order.id } }"
                class="recent-order-link"
              >
                {{ order.order_number }}
              </RouterLink>
            </th>
            <td>
              <time :datetime="order.order_date">{{ formatOrderDate(order.order_date) }}</time>
            </td>
            <td>
              <VChip
                size="small"
                variant="tonal"
                label
                :color="order.status === 'cancelled' ? 'error' : 'primary'"
              >
                {{ ORDER_STATUS[order.status] }}
              </VChip>
            </td>
            <td>{{ ORDER_PRIORITY[order.priority] }}</td>
            <td class="recent-order-total">
              {{ formatOrderTotal(order.grand_total_minor, order.currency) }}
            </td>
          </tr>
        </tbody>
      </VTable>
    </VCard>
  </section>
</template>

<style scoped>
.dashboard-page {
  display: grid;
  min-width: 0;
  gap: 20px;
  padding-block: clamp(17px, 2.8vw, 30px) 30px;
}

.dashboard-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dashboard-header h1 {
  margin: 0;
  font-size: clamp(1.625rem, 3.4vw, 2.125rem);
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.dashboard-header h1:focus {
  outline: none;
}

.dashboard-header p,
.card-context,
.overview-state p {
  margin: 5px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.76);
  font-size: 0.875rem;
}

.overview-state {
  display: grid;
  gap: 4px;
}

.overview-retry {
  margin-inline-start: 6px;
}

.dashboard-analysis {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
  align-items: start;
  gap: 16px;
}

.dashboard-analysis > :only-child {
  grid-column: 1 / -1;
}

.dashboard-card {
  min-width: 0;
  padding: clamp(14px, 2vw, 20px);
}

.dashboard-card h2 {
  margin: 0;
  font-size: 1.125rem;
}

.status-list {
  display: grid;
  gap: 12px;
  padding: 0;
  margin: 16px 0 0;
  list-style: none;
}

.status-label {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 0.875rem;
}

.status-label strong,
.recent-order-total {
  font-variant-numeric: tabular-nums;
}

.status-track {
  height: 7px;
  overflow: hidden;
  border-radius: 4px;
  background: rgba(var(--v-theme-primary), 0.11);
}

.status-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: rgba(var(--v-theme-primary), 0.7);
}

.status-completed {
  background: rgb(var(--v-theme-primary));
}

.status-cancelled {
  background: rgb(var(--v-theme-error));
}

.recent-orders {
  margin-top: 12px;
}

.recent-orders .recent-order-total {
  text-align: end;
  white-space: nowrap;
}

.recent-order-link {
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
  white-space: nowrap;
}

.recent-order-link:focus-visible,
.recent-orders:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}

@media (max-width: 1080px) {
  .dashboard-analysis {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
