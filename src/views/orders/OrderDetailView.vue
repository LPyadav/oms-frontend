<script setup>
import { computed, nextTick, onScopeDispose, useTemplateRef, watch } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VChip } from 'vuetify/components/VChip'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import OrderItemsCard from '../../components/orders/OrderItemsCard.vue'
import { useOrderDetail } from '../../composables/useOrderDetail'
import { ORDER_PRIORITY, ORDER_STATUS } from '../../constants/orders'
import { useAuthStore } from '../../stores/auth'
import { formatOrderDate, formatOrderTimestamp, formatOrderTotal } from '../../utils/orderDisplay'
import { orderActivity, orderTimeline } from '../../utils/orderHistory'

const props = defineProps({
  orderId: { type: String, required: true },
})

const auth = useAuthStore()
const heading = useTemplateRef('heading')
const controller = new AbortController()
const { order, error, loading, load } = useOrderDetail({
  request: auth.request,
  signal: controller.signal,
})

const timeline = computed(() => (order.value ? orderTimeline(order.value) : []))
const activity = computed(() => (order.value ? orderActivity(order.value) : []))
const errorMessage = computed(() => {
  if (error.value?.status === 403) return 'You do not have permission to view this order.'
  if (error.value?.status === 404) return 'This order is unavailable.'
  if (error.value?.status === 429) return 'Too many requests. Try again shortly.'
  return 'Unable to load this order. Try again.'
})
const canRetry = computed(() => error.value && ![403, 404].includes(error.value.status))

watch(
  () => props.orderId,
  async (id) => {
    if (!auth.canViewOrders) return
    void load(id)
    await nextTick()
    heading.value?.focus({ preventScroll: true })
  },
  { immediate: true },
)

onScopeDispose(() => controller.abort())
</script>

<template>
  <section v-if="auth.canViewOrders" class="order-detail" aria-labelledby="order-detail-heading">
    <header class="detail-header">
      <VBtn
        :to="{ name: 'orders' }"
        :prepend-icon="aliases.prev"
        variant="text"
        color="primary"
        class="text-none detail-back"
      >
        Back to orders
      </VBtn>
      <div class="detail-title">
        <h1 id="order-detail-heading" ref="heading" tabindex="-1">
          {{ order?.order_number ?? 'Order detail' }}
        </h1>
        <VChip
          v-if="order"
          :color="order.status === 'cancelled' ? 'error' : 'primary'"
          variant="tonal"
          size="small"
          label
        >
          {{ ORDER_STATUS[order.status] }}
        </VChip>
      </div>
    </header>

    <VCard v-if="loading" class="detail-panel detail-state" variant="flat" border role="status">
      <VProgressLinear color="primary" indeterminate aria-hidden="true" />
      <p>Loading order…</p>
    </VCard>
    <VCard v-else-if="error" class="detail-panel detail-state" variant="flat" border>
      <VAlert type="error" variant="tonal" :icon="false" role="alert">{{ errorMessage }}</VAlert>
      <VBtn v-if="canRetry" variant="outlined" class="text-none" @click="load(orderId)">
        Try again
      </VBtn>
    </VCard>

    <template v-else-if="order">
      <div class="detail-overview">
        <VCard
          tag="section"
          class="detail-panel"
          variant="flat"
          border
          aria-labelledby="summary-heading"
        >
          <h2 id="summary-heading">Order summary</h2>
          <dl class="detail-fields">
            <div>
              <dt>Order date</dt>
              <dd>
                <time :datetime="order.order_date">{{ formatOrderDate(order.order_date) }}</time>
              </dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{{ ORDER_PRIORITY[order.priority] }}</dd>
            </div>
            <div>
              <dt>Assigned to</dt>
              <dd>{{ order.assignee?.name ?? 'Unassigned' }}</dd>
            </div>
            <div>
              <dt>Order total</dt>
              <dd class="detail-total">
                {{ formatOrderTotal(order.grand_total_minor, order.currency) }}
              </dd>
            </div>
          </dl>
        </VCard>

        <VCard
          tag="section"
          class="detail-panel"
          variant="flat"
          border
          aria-labelledby="customer-heading"
        >
          <h2 id="customer-heading">Customer</h2>
          <dl class="detail-fields">
            <div>
              <dt>Name</dt>
              <dd>{{ order.customer.name }}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{{ order.customer.email || 'Not provided' }}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{{ order.customer.phone || 'Not provided' }}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd class="detail-body">{{ order.customer.address || 'Not provided' }}</dd>
            </div>
          </dl>
        </VCard>
      </div>

      <div class="detail-content">
        <OrderItemsCard :order="order" />
        <VCard
          tag="section"
          class="detail-panel"
          variant="flat"
          border
          aria-labelledby="timeline-heading"
        >
          <h2 id="timeline-heading">Order timeline</h2>
          <ol class="detail-timeline" role="list">
            <li
              v-for="step in timeline"
              :key="step.key"
              :class="{ 'timeline-reached': step.reached }"
            >
              <span class="timeline-dot" aria-hidden="true"></span>
              <div>
                <p class="timeline-title">{{ step.title }}</p>
                <time v-if="step.at" :datetime="step.at">{{ formatOrderTimestamp(step.at) }}</time>
                <span v-else>{{ step.reached ? 'Date unavailable' : 'Not reached' }}</span>
              </div>
            </li>
          </ol>
        </VCard>
      </div>

      <VCard
        tag="section"
        class="detail-panel"
        variant="flat"
        border
        aria-labelledby="activity-heading"
      >
        <h2 id="activity-heading">Activity</h2>
        <p v-if="!activity.length" class="activity-empty">No activity recorded.</p>
        <ol v-else class="detail-activity" role="list">
          <li v-for="event in activity" :key="event.key">
            <div class="activity-header">
              <VChip label size="x-small" variant="tonal" color="primary">{{ event.type }}</VChip>
              <h3>{{ event.title }}</h3>
              <time :datetime="event.at">{{ formatOrderTimestamp(event.at) }}</time>
            </div>
            <p class="activity-actor">{{ event.actor }}</p>
            <p v-if="event.body" class="detail-body activity-body">{{ event.body }}</p>
          </li>
        </ol>
      </VCard>
    </template>
  </section>
</template>

<style scoped>
.order-detail {
  display: grid;
  gap: 16px;
  padding-block: clamp(20px, 2.8vw, 28px) 28px;
}

.detail-back {
  margin-inline-start: -8px;
}

.detail-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  margin-top: 6px;
}

.detail-title h1 {
  margin: 0;
  font-size: clamp(1.625rem, 3.4vw, 2.125rem);
  letter-spacing: -0.035em;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.detail-title h1:focus {
  outline: none;
}

.detail-overview,
.detail-content {
  display: grid;
  gap: 16px;
}

.detail-overview {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.detail-content {
  grid-template-columns: minmax(0, 1fr) minmax(220px, 0.34fr);
  align-items: start;
}

.detail-panel {
  min-width: 0;
  padding: 18px;
  border-color: rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 12px;
}

.detail-panel h2 {
  margin: 0 0 14px;
  font-size: 1.0625rem;
  line-height: 1.4;
}

.detail-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
  margin: 0;
}

.detail-fields dt,
.detail-timeline time,
.detail-timeline span,
.activity-header time,
.activity-actor,
.activity-empty {
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
}

.detail-fields dd {
  margin: 3px 0 0;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.detail-total {
  color: rgb(var(--v-theme-primary));
  font-variant-numeric: tabular-nums;
}

.detail-state {
  display: grid;
  justify-items: start;
  gap: 12px;
}

.detail-state p,
.detail-timeline p,
.activity-empty,
.activity-actor,
.activity-body {
  margin: 0;
}

.detail-timeline,
.detail-activity {
  margin: 0;
  padding: 0;
  list-style: none;
}

.detail-timeline li {
  position: relative;
  display: grid;
  grid-template-columns: 12px 1fr;
  gap: 12px;
  padding-bottom: 16px;
}

.detail-timeline li:last-child {
  padding-bottom: 0;
}

.detail-timeline li:not(:last-child)::before {
  position: absolute;
  inset: 12px auto -8px 5px;
  width: 2px;
  background: rgba(var(--v-theme-on-surface), 0.16);
  content: '';
}

.timeline-dot {
  z-index: 1;
  width: 12px;
  height: 12px;
  margin-top: 5px;
  border: 2px solid rgba(var(--v-theme-on-surface), 0.42);
  border-radius: 50%;
  background: rgb(var(--v-theme-surface));
}

.timeline-reached .timeline-dot {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
}

.timeline-title {
  font-size: 0.875rem;
  font-weight: 500;
}

.detail-activity li {
  padding-block: 14px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  overflow-wrap: anywhere;
}

.detail-activity li:last-child {
  padding-bottom: 0;
}

.activity-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
}

.activity-header h3 {
  font-size: 0.9375rem;
}

.activity-header time {
  margin-inline-start: auto;
}

.detail-body {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.activity-actor,
.activity-body {
  margin-top: 5px;
}

@media (max-width: 1100px) {
  .detail-content {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .detail-overview {
    grid-template-columns: minmax(0, 1fr);
  }

  .activity-header time {
    flex-basis: 100%;
    margin-inline-start: 0;
  }
}
</style>
