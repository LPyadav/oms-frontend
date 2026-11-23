import { onScopeDispose, ref, shallowRef } from 'vue'

export function useDashboardResource(fetchResource) {
  const data = shallowRef(null)
  const error = shallowRef(null)
  const loading = ref(true)
  let activeRequest

  async function load(query) {
    activeRequest?.abort()
    const controller = new AbortController()
    activeRequest = controller
    error.value = null
    loading.value = true

    try {
      const result = await fetchResource(query, controller.signal)
      if (!controller.signal.aborted) data.value = result
    } catch (failure) {
      if (!controller.signal.aborted && failure?.status !== 401) error.value = failure
    } finally {
      if (activeRequest === controller) {
        activeRequest = null
        loading.value = false
      }
    }
  }

  onScopeDispose(() => activeRequest?.abort())

  return { data, error, loading, load }
}
