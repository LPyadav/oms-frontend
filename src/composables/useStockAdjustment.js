import { computed, ref, shallowRef } from 'vue'
import { adjustProductStock, getProduct } from '../api/products'

const maxStockQuantity = 2_147_483_647
const maxReasonLength = 255

function parseQuantity(value) {
  if (!/^\d+$/.test(value)) return null
  const quantity = Number(value)
  return Number.isSafeInteger(quantity) && quantity <= maxStockQuantity ? quantity : null
}

export function useStockAdjustment({ request, product, canManage, signal }) {
  const countedQuantity = ref('')
  const reason = ref('')
  const saving = ref(false)
  const reloading = ref(false)
  const error = shallowRef(null)
  const reloadError = shallowRef(null)
  const reloadReason = ref(null)
  const reloaded = ref(false)

  const quantity = computed(() => parseQuantity((countedQuantity.value ?? '').trim()))
  const normalizedReason = computed(() => (reason.value ?? '').trim())
  const reasonLength = computed(() => [...normalizedReason.value].length)
  const matchesCurrent = computed(
    () => quantity.value !== null && quantity.value === product.value?.stock_quantity,
  )
  const quantityMessages = computed(() => {
    if ((countedQuantity.value ?? '').trim() && quantity.value === null) {
      return ['Enter a whole number from 0 to 2,147,483,647.']
    }
    return error.value?.fields?.stock_quantity ?? []
  })
  const reasonMessages = computed(() => {
    if (reasonLength.value > maxReasonLength) return ['Use 255 characters or fewer.']
    return error.value?.fields?.reason ?? []
  })
  const canSubmit = computed(
    () =>
      canManage() &&
      !!product.value &&
      !saving.value &&
      !reloading.value &&
      !reloadReason.value &&
      quantity.value !== null &&
      !matchesCurrent.value &&
      reasonLength.value > 0 &&
      reasonLength.value <= maxReasonLength,
  )

  function reset() {
    countedQuantity.value = ''
    reason.value = ''
    error.value = null
    reloadError.value = null
    reloadReason.value = null
    reloaded.value = false
  }

  async function save() {
    if (signal.aborted || !canSubmit.value) return null
    saving.value = true
    error.value = null
    const current = product.value

    try {
      const updated = await adjustProductStock(
        request,
        current.id,
        {
          stockQuantity: quantity.value,
          expectedStockVersion: current.stock_version,
          reason: normalizedReason.value,
        },
        signal,
      )

      if (signal.aborted) return null
      product.value = updated
      return updated
    } catch (failure) {
      if (signal.aborted || failure?.status === 401) return null
      if (
        failure?.status === 409 &&
        Object.hasOwn(failure.fields ?? {}, 'expected_stock_version')
      ) {
        reloadReason.value = 'conflict'
      } else if (['NETWORK_ERROR', 'INVALID_RESPONSE'].includes(failure?.code)) {
        reloadReason.value = 'unconfirmed'
      } else {
        error.value = failure
      }
      return null
    } finally {
      saving.value = false
    }
  }

  async function reload() {
    if (!reloadReason.value || !product.value || reloading.value || signal.aborted) return null
    reloading.value = true
    reloadError.value = null

    try {
      const current = await getProduct(request, product.value.id, signal)
      if (signal.aborted) return null
      product.value = current
      reloadReason.value = null
      reloaded.value = true
      return current
    } catch (failure) {
      if (!signal.aborted && failure?.status !== 401) reloadError.value = failure
      return null
    } finally {
      reloading.value = false
    }
  }

  return {
    countedQuantity,
    reason,
    saving,
    reloading,
    error,
    reloadError,
    reloadReason,
    reloaded,
    matchesCurrent,
    quantityMessages,
    reasonMessages,
    canSubmit,
    reset,
    save,
    reload,
  }
}
