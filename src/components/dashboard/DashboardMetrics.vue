<script setup>
import { computed } from 'vue'
import { VCard } from 'vuetify/components/VCard'
import { formatOrderTotal } from '../../utils/orderDisplay'

const props = defineProps({ overview: { type: Object, required: true } })

const countFormatter = new Intl.NumberFormat()
const countCards = computed(() => [
  { label: 'Total orders', value: props.overview.total_orders },
  { label: 'Customers', value: props.overview.total_customers },
  { label: 'Products', value: props.overview.total_products },
])
const financialCards = [
  { label: 'Total revenue', field: 'total_revenue_minor' },
  { label: 'Average order value', field: 'average_order_value_minor' },
]
</script>

<template>
  <dl class="dashboard-metrics" aria-label="Dashboard metrics">
    <VCard
      v-for="card in countCards"
      :key="card.label"
      tag="div"
      class="metric-card"
      variant="flat"
      rounded="lg"
      border
    >
      <dt>{{ card.label }}</dt>
      <dd :class="{ 'metric-unavailable': card.value === null }">
        {{ card.value === null ? 'Unavailable' : countFormatter.format(card.value) }}
      </dd>
    </VCard>

    <VCard
      v-for="card in financialCards"
      :key="card.field"
      tag="div"
      class="metric-card"
      variant="flat"
      rounded="lg"
      border
    >
      <dt>{{ card.label }}</dt>
      <dd v-for="metric in overview.financial_metrics" :key="metric.currency">
        {{ formatOrderTotal(metric[card.field], metric.currency) }}
      </dd>
      <dd class="metric-context">Completed orders · all time</dd>
    </VCard>
  </dl>
</template>

<style scoped>
.dashboard-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

.metric-card {
  min-width: 0;
  padding: 16px;
}

.metric-card dt,
.metric-card .metric-context {
  color: rgba(var(--v-theme-on-surface), 0.76);
  font-size: 0.8125rem;
}

.metric-card dt {
  margin-bottom: 8px;
  font-weight: 600;
}

.metric-card dd {
  margin: 0 0 3px;
  color: rgb(var(--v-theme-on-surface));
  font-size: clamp(1.075rem, 1.65vw, 1.55rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.metric-card .metric-unavailable {
  font-size: 1rem;
  font-weight: 500;
}

.metric-card .metric-context {
  margin-top: 9px;
  margin-bottom: 0;
  font-weight: 400;
}

@media (max-width: 1050px) {
  .dashboard-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .dashboard-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-card:first-child {
    grid-column: 1 / -1;
  }
}
</style>
