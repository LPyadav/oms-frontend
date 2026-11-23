import { computed, ref, watch } from 'vue'
import { usePagedDirectory } from './usePagedDirectory'

const firstPage = { page: 1, search: '', isActive: null }
const searchDebounceMs = 300

export function useCatalogDirectory({ fetchPage, signal }) {
  const directory = usePagedDirectory({ fetchPage, signal, initialQuery: firstPage })
  const { query, load } = directory
  const search = ref(firstPage.search)
  const searchTerm = computed(() => (search.value ?? '').trim())
  let searchTimer

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

  return { ...directory, search, applyFilters }
}
