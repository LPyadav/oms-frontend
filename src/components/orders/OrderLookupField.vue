<script setup>
import { computed, onDeactivated, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { VAutocomplete } from 'vuetify/components/VAutocomplete'
import { VListItem } from 'vuetify/components/VList'
import { aliases } from 'vuetify/iconsets/mdi-svg'

const props = defineProps({
  label: { type: String, required: true },
  resource: { type: String, required: true },
  loadPage: { type: Function, required: true },
  itemTitle: { type: Function, required: true },
  itemSubtitle: { type: Function, default: () => undefined },
  errorMessages: { type: Array, default: () => [] },
  disabled: Boolean,
})
const selected = defineModel({ type: Object, default: null })
const search = ref('')
const open = ref(false)
const loading = ref(false)
const error = ref(false)
const options = shallowRef([])
const page = ref(0)
const lastPage = ref(0)
let timer
let request

const items = computed(() => {
  const choice = selected.value
  const entries = options.value
  return choice && !entries.some(({ id }) => id === choice.id) ? [choice, ...entries] : entries
})

const noDataText = computed(() => {
  if (loading.value) return 'Searching…'
  if (error.value) return 'Unable to load results.'
  return page.value < lastPage.value ? 'No matches on this page.' : 'No matches found.'
})

function searchTerm() {
  const text = (search.value ?? '').trim()
  return selected.value && text === props.itemTitle(selected.value) ? '' : text.slice(0, 255)
}

function cancel() {
  clearTimeout(timer)
  request?.abort()
  request = null
  loading.value = false
}

async function fetchPage(nextPage) {
  const controller = new AbortController()
  request = controller
  loading.value = true
  error.value = false

  try {
    const result = await props.loadPage({ page: nextPage, search: searchTerm() }, controller.signal)
    if (controller.signal.aborted) return

    const entries =
      nextPage === 1 ? result[props.resource] : [...options.value, ...result[props.resource]]
    const byId = new Map(entries.map((entry) => [entry.id, entry]))
    options.value = [...byId.values()]
    page.value = nextPage
    lastPage.value = result.lastPage
  } catch (failure) {
    if (!controller.signal.aborted && failure.status !== 401) error.value = true
  } finally {
    if (request === controller) {
      request = null
      loading.value = false
    }
  }
}

function restart() {
  cancel()
  options.value = []
  page.value = 0
  lastPage.value = 0
  error.value = false
  if (!open.value) return

  loading.value = true
  timer = setTimeout(() => void fetchPage(1), 250)
}

watch([open, search], restart)
onDeactivated(() => {
  open.value = false
  cancel()
})
onScopeDispose(cancel)
</script>

<template>
  <VAutocomplete
    v-model="selected"
    v-model:menu="open"
    v-model:search="search"
    :label="label"
    :items="items"
    :item-title="itemTitle"
    item-value="id"
    :loading="loading"
    :disabled="disabled"
    :error-messages="errorMessages"
    :no-data-text="noDataText"
    :menu-props="{ maxHeight: 320 }"
    :menu-icon="aliases.dropdown"
    :clear-icon="aliases.clear"
    variant="outlined"
    density="comfortable"
    no-filter
    return-object
    hide-selected
    hide-details="auto"
    clearable
  >
    <template #item="{ props: itemProps, item }">
      <VListItem v-bind="itemProps" :subtitle="itemSubtitle(item)" role="option" />
    </template>
    <template #append-item>
      <VListItem v-if="error" title="Retry search" @click="fetchPage(page + 1)" />
      <VListItem
        v-else-if="page < lastPage"
        :disabled="loading"
        title="Show more results"
        @click="fetchPage(page + 1)"
      />
    </template>
  </VAutocomplete>
</template>
