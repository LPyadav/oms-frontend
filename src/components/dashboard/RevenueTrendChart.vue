<script setup>
import { computed, ref, watch } from 'vue'
import { VSelect } from 'vuetify/components/VSelect'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { formatOrderDate, formatOrderTotal } from '../../utils/orderDisplay'

const props = defineProps({ trend: { type: Object, required: true } })

const currency = ref('')
const showValues = ref(false)
const currencies = computed(() => props.trend.series.map((series) => series.currency))
const points = computed(() => {
  const selected = props.trend.series.find((series) => series.currency === currency.value)
  const selectedPoints = selected?.points ?? []
  return selectedPoints.toSorted((left, right) =>
    right.period_start.localeCompare(left.period_start),
  )
})
const hasCompletedOrders = computed(() => points.value.some((point) => point.completed_orders > 0))
const values = computed(() => points.value.map((point) => BigInt(point.revenue_minor)))
const maximum = computed(() =>
  values.value.reduce((largest, value) => (value > largest ? value : largest), 0n),
)

watch(
  currencies,
  (available) => {
    if (!available.includes(currency.value)) currency.value = available[0]
  },
  { immediate: true },
)

const shortDate = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function plotPercentage(amount) {
  if (!maximum.value) return '0%'
  const basisPoints = Number((amount * 10000n) / maximum.value)
  return basisPoints / 100 + '%'
}

function formatRange(from, to) {
  const start = formatOrderDate(from)
  return from === to ? start : start + ' – ' + formatOrderDate(to)
}

const axis = computed(() => {
  const amounts = [0n, 1n, 2n, 3n, 4n].map((step) => (maximum.value * step) / 4n)

  return [...new Set(amounts)].map((amount) => ({
    amount: amount.toString(),
    position: plotPercentage(amount),
  }))
})

const dateTicks = computed(() => {
  const last = points.value.length - 1
  if (last < 0) return []

  const positions = [0, 1, 2, 3, 4].map((step) => Math.round((step * last) / 4))
  return [...new Set(positions)].map((index) => ({
    label: shortDate.format(new Date(points.value[index].period_start + 'T00:00:00Z')),
    position: ((index + 0.5) / points.value.length) * 100 + '%',
    edge: index === 0 ? 'start' : index === last ? 'end' : 'middle',
  }))
})

const minimumWidth = computed(() => Math.max(248, points.value.length * 8) + 'px')
</script>

<template>
  <div class="revenue-trend">
    <div class="trend-context">
      <p>{{ formatRange(trend.date_from, trend.date_to) }} · {{ trend.timezone }}</p>
      <VSelect
        v-if="currencies.length > 1"
        v-model="currency"
        :items="currencies"
        label="Currency"
        :menu-icon="aliases.dropdown"
        variant="outlined"
        density="compact"
        hide-details
        class="trend-currency"
      />
      <span v-else class="trend-currency-code">{{ currency }}</span>
    </div>

    <div v-if="hasCompletedOrders" class="trend-chart">
      <div class="trend-value-axis" aria-hidden="true">
        <span
          v-for="tick in axis"
          :key="tick.amount"
          class="trend-value-label"
          :style="{ '--tick-position': tick.position }"
        >
          {{ formatOrderTotal(tick.amount, currency) }}
        </span>
      </div>

      <div
        class="trend-scroll"
        role="region"
        tabindex="0"
        aria-label="Scrollable revenue chart, newest first"
      >
        <div class="trend-track" :style="{ '--track-width': minimumWidth }" aria-hidden="true">
          <div class="trend-bars" :style="{ '--columns': points.length }">
            <span
              v-for="tick in axis"
              :key="tick.amount"
              class="trend-gridline"
              :style="{ '--tick-position': tick.position }"
            />
            <div
              v-for="(point, index) in points"
              :key="point.period_start"
              class="trend-column"
              :title="
                formatRange(point.period_start, point.period_end) +
                ': ' +
                formatOrderTotal(point.revenue_minor, currency)
              "
            >
              <div
                v-if="values[index] > 0n"
                class="trend-bar"
                :style="{ '--bar-height': plotPercentage(values[index]) }"
              />
            </div>
          </div>
          <div class="trend-date-axis">
            <span
              v-for="tick in dateTicks"
              :key="tick.position"
              class="trend-date-label"
              :class="'trend-date-label--' + tick.edge"
              :style="{ '--tick-position': tick.position }"
            >
              {{ tick.label }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <p v-else class="trend-empty">No completed orders in this date range.</p>

    <details v-if="points.length" class="trend-values" @toggle="showValues = $event.target.open">
      <summary>View revenue values</summary>
      <div
        v-if="showValues"
        class="trend-table-scroll"
        role="region"
        tabindex="0"
        aria-label="Scrollable revenue values"
      >
        <table class="trend-table">
          <caption>
            Revenue by
            {{
              trend.group_by
            }}
            ({{
              currency
            }})
          </caption>
          <thead>
            <tr>
              <th scope="col" aria-sort="descending">Period</th>
              <th scope="col">Completed orders</th>
              <th scope="col">Revenue</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="point in points" :key="point.period_start">
              <th scope="row">{{ formatRange(point.period_start, point.period_end) }}</th>
              <td>{{ point.completed_orders.toLocaleString() }}</td>
              <td>{{ formatOrderTotal(point.revenue_minor, currency) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
</template>

<style scoped>
.revenue-trend {
  --plot-height: clamp(8rem, 24vw, 12rem);
  min-inline-size: 0;
}

.trend-context {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-block-end: 10px;
}

.trend-context p {
  margin: 0;
  color: rgba(var(--v-theme-on-surface), 0.74);
  font-size: 0.875rem;
}

.trend-currency {
  flex: 0 1 112px;
}

.trend-currency-code {
  color: rgba(var(--v-theme-on-surface), 0.72);
  font-size: 0.8125rem;
  font-weight: 600;
}

.trend-chart {
  display: grid;
  grid-template-columns: fit-content(34%) minmax(0, 1fr);
  gap: 9px;
}

.trend-value-axis {
  position: relative;
  block-size: var(--plot-height);
  margin-block-start: 12px;
  text-align: end;
}

.trend-value-label {
  position: absolute;
  inset-block-end: var(--tick-position);
  inset-inline-end: 0;
  padding-inline-start: 2px;
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
  overflow-wrap: anywhere;
  transform: translateY(50%);
}

.trend-value-axis::before {
  display: block;
  inline-size: clamp(54px, 10vw, 100px);
  content: '';
}

.trend-scroll {
  min-inline-size: 0;
  margin-inline: -2px;
  padding: 12px 2px 4px;
  overflow-x: auto;
}

.trend-track {
  min-inline-size: max(100%, var(--track-width));
}

.trend-bars {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  align-items: end;
  block-size: var(--plot-height);
}

.trend-gridline {
  position: absolute;
  inset-block-end: var(--tick-position);
  inset-inline: 0;
  border-block-end: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  pointer-events: none;
}

.trend-column {
  position: relative;
  display: flex;
  align-items: end;
  justify-content: center;
  block-size: 100%;
  padding-inline: 1px;
}

.trend-bar {
  inline-size: min(100%, 38px);
  block-size: var(--bar-height);
  min-block-size: 1px;
  border-radius: 3px 3px 0 0;
  background: rgba(var(--v-theme-primary), 0.85);
}

.trend-date-axis {
  position: relative;
  min-block-size: 26px;
  font-size: 0.6875rem;
  white-space: nowrap;
}

.trend-date-label {
  position: absolute;
  inset-block-start: 7px;
  inset-inline-start: var(--tick-position);
  transform: translateX(-50%);
}

.trend-date-label--start {
  inset-inline-start: 0;
  transform: none;
}

.trend-date-label--end {
  inset-inline-start: auto;
  inset-inline-end: 0;
  transform: none;
}

.trend-empty {
  margin: 0;
  padding: 26px 8px;
  text-align: center;
}

.trend-values {
  margin-block-start: 10px;
}

.trend-values summary {
  inline-size: fit-content;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
}

.trend-scroll:focus-visible,
.trend-table-scroll:focus-visible,
.trend-values summary:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.trend-table-scroll {
  max-block-size: 280px;
  margin-block-start: 8px;
  overflow: auto;
}

.trend-table {
  inline-size: 100%;
  min-inline-size: 260px;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.trend-table caption {
  margin-block: 4px;
  text-align: start;
}

.trend-table th,
.trend-table td {
  padding: 7px 8px;
  border-block-end: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  text-align: start;
}

.trend-table td {
  text-align: end;
  font-variant-numeric: tabular-nums;
}

.trend-table thead th:not(:first-child) {
  text-align: end;
}

.trend-table th[scope='row'] {
  font-weight: 400;
}
</style>
