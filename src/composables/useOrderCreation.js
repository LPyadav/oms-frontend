import { ref, shallowRef } from 'vue'
import { createOrder, previewOrderPricing } from '../api/orders'

export function useOrderCreation({ request, signal, newKey = () => crypto.randomUUID() }) {
  const pricing = shallowRef(null)
  const pricingPending = ref(false)
  const savePending = ref(false)
  const attempt = shallowRef(null)
  const savedOrder = shallowRef(null)
  let pricingRequest

  function clearPricing() {
    pricingRequest?.abort()
    pricingRequest = null
    pricingPending.value = false
    pricing.value = null
  }

  async function preview(body) {
    clearPricing()
    const controller = new AbortController()
    pricingRequest = controller
    const requestSignal = AbortSignal.any([signal, controller.signal])
    pricingPending.value = true
    try {
      const result = await previewOrderPricing(request, body, requestSignal)
      if (!requestSignal.aborted) pricing.value = result
    } catch (error) {
      if (!requestSignal.aborted) throw error
    } finally {
      if (pricingRequest === controller) {
        pricingRequest = null
        pricingPending.value = false
      }
    }
  }

  async function save(body) {
    if (savePending.value || savedOrder.value || signal.aborted) return null

    attempt.value ??= { key: newKey(), body: structuredClone(body) }
    savePending.value = true
    try {
      const { body: submitted, key } = attempt.value
      const order = await createOrder(request, submitted, key, signal)
      if (signal.aborted) return null
      savedOrder.value = order
      attempt.value = null
      return order
    } catch (error) {
      if (error.status === 422) attempt.value = null
      if (!signal.aborted) throw error
      return null
    } finally {
      savePending.value = false
    }
  }

  return { pricing, pricingPending, savePending, attempt, savedOrder, preview, clearPricing, save }
}
