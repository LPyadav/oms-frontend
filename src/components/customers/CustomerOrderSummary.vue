<script setup>
import { onMounted, onScopeDispose, ref, shallowRef } from 'vue'
import { RouterLink } from 'vue-router'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VChip } from 'vuetify/components/VChip'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'
import { loadCustomerOrderSummary } from '../../api/customers'
import { ORDER_STATUS } from '../../constants/orders'
import { useAuthStore } from '../../stores/auth'
import { formatOrderDate, formatOrderTotal } from '../../utils/orderDisplay'

const props = defineProps({
  customerId: { type: Number, required: true },
})
const auth = useAuthStore()
const controller = new AbortController()
const summary = shallowRef(null)
const error = shallowRef(null)
const loading = ref(false)
const counts = [
  ['total_orders', 'Total orders'],
  ['pending_orders', 'Pending'],
  ['completed_orders', 'Completed'],
  ['cancelled_orders', 'Cancelled'],
]

async function load() {
  const { signal } = controller
  if (loading.value || signal.aborted) return

  error.value = null
  summary.value = null
  loading.value = true
  try {
    const result = await loadCustomerOrderSummary(auth.request, props.customerId, signal)
    if (!signal.aborted) summary.value = result
  } catch (failure) {
    if (!signal.aborted && failure?.status !== 401) error.value = failure
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())
onScopeDispose(() => controller.abort())
</script>

<template>
  <section class="customer-order-summary" aria-labelledby="customer-order-summary-heading">
    <h3 id="customer-order-summary-heading">Order summary</h3>
    <p v-if="!auth.canViewAllOrders" class="order-summary-scope">Orders assigned to you</p>
    <div v-if="loading" class="order-summary-state" role="status">
      <VProgressLinear color="primary" indeterminate aria-hidden="true" />
      <p>Loading order summary…</p>
    </div>
    <div v-else-if="error" class="order-summary-state">
      <VAlert type="error" variant="tonal" :icon="false" role="alert">
        {{
          error.status === 403
            ? 'You do not have access to this order summary.'
            : 'Unable to load the order summary.'
        }}
      </VAlert>
      <VBtn
        v-if="![403, 404].includes(error.status)"
        type="button"
        variant="outlined"
        class="text-none"
        @click="load"
      >
        Retry order summary
      </VBtn>
    </div>
    <template v-else-if="summary">
      <dl class="order-summary-counts">
        <div v-for="[field, label] in counts" :key="field">
          <dt>{{ label }}</dt>
          <dd>{{ summary[field] }}</dd>
        </div>
      </dl>
      <dl class="order-summary-value">
        <dt>Total order value</dt>
        <dd v-if="!summary.total_value_by_currency.length">0</dd>
        <template v-else>
          <dd v-for="total in summary.total_value_by_currency" :key="total.currency">
            {{ formatOrderTotal(total.total_minor, total.currency) }}
          </dd>
        </template>
      </dl>

      <h4 id="customer-recent-orders-heading">Recent orders</h4>
      <p v-if="!summary.recent_orders.length">No orders to show for this customer.</p>
      <ul v-else class="customer-recent-orders" aria-labelledby="customer-recent-orders-heading">
        <li v-for="order in summary.recent_orders" :key="order.id">
          <div>
            <RouterLink
              :to="{ name: 'order-detail', params: { orderId: order.id } }"
              class="recent-order-link"
            >
              {{ order.order_number }}
            </RouterLink>
            <time :datetime="order.order_date">{{ formatOrderDate(order.order_date) }}</time>
          </div>
          <VChip
            :color="order.status === 'cancelled' ? 'error' : 'primary'"
            size="small"
            variant="tonal"
            label
          >
            {{ ORDER_STATUS[order.status] }}
          </VChip>
          <strong>{{ formatOrderTotal(order.grand_total_minor, order.currency) }}</strong>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.customer-order-summary {
  display: grid;
  gap: 12px;
  min-inline-size: 0;
  padding-block-start: 16px;
  border-block-start: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.customer-order-summary h3,
.customer-order-summary h4,
.customer-order-summary p,
.customer-order-summary dl,
.customer-order-summary dd {
  margin: 0;
}

.customer-order-summary h3 {
  font-size: 1rem;
}

.customer-order-summary h4 {
  font-size: 0.875rem;
}

.order-summary-state {
  display: grid;
  gap: 10px;
  justify-items: start;
}

.order-summary-counts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.order-summary-counts div {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.055);
}

.order-summary-scope,
.order-summary-counts dt,
.order-summary-value dt,
.customer-recent-orders time {
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
}

.order-summary-counts dd,
.order-summary-value dd {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.order-summary-value {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
}

.customer-recent-orders {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.customer-recent-orders li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px 12px;
  padding-block: 10px;
  border-block-start: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  font-size: 0.875rem;
}

.customer-recent-orders strong {
  overflow-wrap: anywhere;
}

.customer-recent-orders time {
  display: block;
  margin-block-start: 2px;
}

.recent-order-link {
  color: rgb(var(--v-theme-primary));
  font-weight: 650;
  overflow-wrap: anywhere;
}

@media (max-width: 500px) {
  .order-summary-counts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .customer-recent-orders li {
    grid-template-columns: minmax(0, 1fr) auto;
  }
}
</style>
