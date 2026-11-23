<script setup>
import { computed, onMounted, reactive } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'
import { VSelect } from 'vuetify/components/VSelect'
import { VTextField } from 'vuetify/components/VTextField'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { loadDashboardTrend } from '../../api/dashboard'
import { useDashboardResource } from '../../composables/useDashboardResource'
import { useAuthStore } from '../../stores/auth'
import RevenueTrendChart from './RevenueTrendChart.vue'

const auth = useAuthStore()
const groups = [
  { title: 'Day', value: 'day' },
  { title: 'Week', value: 'week' },
  { title: 'Month', value: 'month' },
]
const fields = reactive({ group: 'day', dateFrom: '', dateTo: '' })
const {
  data: trend,
  error,
  loading,
  load,
} = useDashboardResource((query, signal) => loadDashboardTrend(auth.request, query, signal))
let applied = { ...fields }

const dateFromErrors = computed(() => {
  if (!fields.dateFrom && fields.dateTo) return ['Enter a start date.']
  return error.value?.fields?.date_from ?? []
})
const dateToErrors = computed(() => {
  if (fields.dateFrom && !fields.dateTo) return ['Enter an end date.']
  if (fields.dateFrom && fields.dateTo && fields.dateTo < fields.dateFrom) {
    return ['End date must be on or after the start date.']
  }

  return error.value?.fields?.date_to ?? []
})
const message = computed(() => {
  if (error.value?.status === 403) return 'You no longer have access to the revenue trend.'
  if (error.value?.status === 422) return 'Check the dates and grouping, then apply again.'
  if (error.value?.status === 429) return 'Too many requests. Try again shortly.'
  return 'Unable to load the revenue trend.'
})

function reload() {
  return load(applied)
}

function apply() {
  if (Boolean(fields.dateFrom) !== Boolean(fields.dateTo)) return
  if (fields.dateFrom && fields.dateTo < fields.dateFrom) return
  applied = { ...fields }
  void reload()
}

onMounted(reload)
</script>

<template>
  <VCard
    tag="section"
    class="revenue-card"
    variant="flat"
    border
    rounded="lg"
    aria-labelledby="revenue-title"
  >
    <h2 id="revenue-title">Revenue trend</h2>
    <p class="revenue-description">Completed orders, grouped by completion date.</p>

    <form
      class="revenue-controls"
      aria-label="Revenue trend filters"
      novalidate
      @submit.prevent="apply"
    >
      <VSelect
        v-model="fields.group"
        label="Group by"
        :menu-icon="aliases.dropdown"
        :items="groups"
        :error-messages="error?.fields?.group_by"
        variant="outlined"
        density="comfortable"
        hide-details="auto"
      />
      <VTextField
        v-model="fields.dateFrom"
        type="date"
        label="From date"
        min="1000-01-02"
        max="9999-12-30"
        :error-messages="dateFromErrors"
        variant="outlined"
        density="comfortable"
        hide-details="auto"
      />
      <VTextField
        v-model="fields.dateTo"
        type="date"
        label="To date"
        min="1000-01-02"
        max="9999-12-30"
        :error-messages="dateToErrors"
        variant="outlined"
        density="comfortable"
        hide-details="auto"
      />
      <VBtn type="submit" class="text-none apply-trend" color="primary" :loading="loading">
        Apply
      </VBtn>
    </form>

    <div class="revenue-results" :aria-busy="loading">
      <div v-if="loading" role="status">
        <VProgressLinear color="primary" indeterminate aria-hidden="true" />
        <p>Loading revenue trend…</p>
      </div>
      <VAlert v-if="error" type="error" variant="tonal" :icon="false" role="alert">
        {{ message }}
        <VBtn
          v-if="![403, 422].includes(error.status)"
          class="text-none retry-trend"
          size="small"
          variant="text"
          @click="reload"
        >
          Try again
        </VBtn>
      </VAlert>
      <RevenueTrendChart v-if="trend" v-show="!loading && !error" :trend="trend" />
    </div>
  </VCard>
</template>

<style scoped>
.revenue-card {
  align-self: start;
  min-width: 0;
  padding: clamp(14px, 2vw, 20px);
}

.revenue-card h2 {
  margin: 0;
  font-size: 1.125rem;
}

.revenue-description,
.revenue-results p {
  margin: 4px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.76);
  font-size: 0.875rem;
}

.revenue-controls {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) repeat(2, minmax(0, 1fr)) auto;
  align-items: start;
  gap: 8px;
  margin-top: 16px;
}

.apply-trend {
  min-height: 44px;
}

.revenue-results {
  margin-top: 16px;
}

.retry-trend {
  margin-inline-start: 4px;
}

@media (max-width: 1260px) {
  .revenue-controls {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 420px) {
  .revenue-controls {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
