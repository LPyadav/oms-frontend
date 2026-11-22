import { ref, shallowRef } from 'vue'
import { loadCustomerPage } from '../api/customers'

const firstPage = { page: 1, search: '', isActive: null }

export function useCustomerDirectory({ request, signal }) {
  const query = shallowRef(firstPage)
  const result = shallowRef(null)
  const error = shallowRef(null)
  const loading = ref(false)
  let activeRequest

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
      const page = await loadCustomerPage(request, query.value, requestSignal)
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

  return { query, result, error, loading, load }
}
