import { ref, shallowRef } from 'vue'

export function usePagedDirectory({ fetchPage, signal, initialQuery }) {
  const query = shallowRef({ ...initialQuery })
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
      const page = await fetchPage(query.value, requestSignal)
      if (requestSignal.aborted) return null

      result.value = page
      return page
    } catch (failure) {
      if (!requestSignal.aborted && failure?.status !== 401) error.value = failure
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
