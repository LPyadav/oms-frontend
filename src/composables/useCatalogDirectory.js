import { computed, ref, shallowRef, watch } from 'vue'

const firstPage = { page: 1, search: '', isActive: null }
const searchDebounceMs = 300

export function useCatalogDirectory({ fetchPage, signal }) {
  const query = shallowRef(firstPage)
  const search = ref(firstPage.search)
  const searchTerm = computed(() => (search.value ?? '').trim())
  const result = shallowRef(null)
  const error = shallowRef(null)
  const loading = ref(false)
  let activeRequest
  let searchTimer

  async function load(next = query.value) {
    if (signal.aborted) return null

    activeRequest?.abort()
    const controller = new AbortController()
    activeRequest = controller
    const requestSignal = AbortSignal.any([signal, controller.signal])
    query.value = { ...next }
    loading.value = true
    error.value = null

    try {
      const page = await fetchPage(query.value, requestSignal)
      if (requestSignal.aborted) return null

      result.value = page
      return page
    } catch (failure) {
      if (!requestSignal.aborted && failure.status !== 401) error.value = failure
      return null
    } finally {
      if (activeRequest === controller) {
        activeRequest = null
        loading.value = false
      }
    }
  }

  function cancelPendingSearch() {
    clearTimeout(searchTimer)
    searchTimer = undefined
  }

  function applyFilters(isActive) {
    cancelPendingSearch()
    return load({ page: 1, search: searchTerm.value, isActive })
  }

  watch(
    searchTerm,
    (term) => {
      cancelPendingSearch()
      if (term === query.value.search || signal.aborted) return

      searchTimer = setTimeout(() => {
        searchTimer = undefined
        if (term !== query.value.search) {
          void load({ ...query.value, search: term, page: 1 })
        }
      }, searchDebounceMs)
    },
    { flush: 'sync' },
  )
  signal.addEventListener('abort', cancelPendingSearch, { once: true })

  return { search, query, result, error, loading, load, applyFilters }
}
