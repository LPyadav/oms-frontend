import { ref, shallowRef } from 'vue'
import { loadOrder } from '../api/orders'

export function useOrderDetail({ request, signal }) {
  const order = shallowRef(null)
  const error = shallowRef(null)
  const loading = ref(false)
  let activeRequest

  async function load(id) {
    if (signal.aborted) return

    activeRequest?.abort()
    const controller = new AbortController()
    activeRequest = controller
    const requestSignal = AbortSignal.any([signal, controller.signal])
    order.value = null
    error.value = null
    loading.value = true

    try {
      const detail = await loadOrder(request, id, requestSignal)
      if (!requestSignal.aborted) order.value = detail
    } catch (failure) {
      if (!requestSignal.aborted && failure?.status !== 401) error.value = failure
    } finally {
      if (activeRequest === controller) {
        activeRequest = null
        loading.value = false
      }
    }
  }

  return { order, error, loading, load }
}
