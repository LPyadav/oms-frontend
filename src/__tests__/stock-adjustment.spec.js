import { expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'
import { ApiError } from '../api/client'
import { adjustProductStock } from '../api/products'
import { useStockAdjustment } from '../composables/useStockAdjustment'

const fixture = {
  id: 8,
  name: 'Packing tape',
  sku: 'TAPE-100',
  price: '2.50',
  tax_rate: '0.00',
  stock_quantity: 12,
  stock_version: 3,
  is_active: true,
}

function envelope(changes = {}) {
  return { data: { product: { ...fixture, ...changes } } }
}

function staleStock() {
  return new ApiError('Validation failed.', {
    status: 409,
    fields: { expected_stock_version: ['The stock version is out of date.'] },
  })
}

function setup() {
  const controller = new AbortController()
  const product = shallowRef(fixture)
  const canManage = ref(true)
  const request = vi.fn()
  const adjustment = useStockAdjustment({
    request,
    product,
    canManage: () => canManage.value,
    signal: controller.signal,
  })
  return { adjustment, canManage, controller, product, request, signal: controller.signal }
}

function count(adjustment, quantity = '7', reason = 'Cycle count') {
  adjustment.countedQuantity.value = quantity
  adjustment.reason.value = reason
}

it('sends an absolute counted quantity and an integer expected version', async () => {
  const { request, signal } = setup()
  request.mockResolvedValueOnce(envelope({ stock_quantity: 0, stock_version: 4 }))

  await expect(
    adjustProductStock(
      request,
      8,
      { stockQuantity: 0, expectedStockVersion: 3, reason: 'Cycle count' },
      signal,
    ),
  ).resolves.toMatchObject({ id: 8, stock_quantity: 0, stock_version: 4 })

  expect(request).toHaveBeenCalledExactlyOnceWith('/api/products/8/stock', {
    method: 'PATCH',
    body: { stock_quantity: 0, expected_stock_version: 3, reason: 'Cycle count' },
    signal,
  })
})

it.each(['', '-1', '2.5', '1e3', '2147483648', '12'])(
  'does not submit an invalid or unchanged count (%j)',
  async (quantity) => {
    const { adjustment, request } = setup()
    count(adjustment, quantity)
    expect(adjustment.canSubmit.value).toBe(false)
    await expect(adjustment.save()).resolves.toBeNull()
    expect(request).not.toHaveBeenCalled()
  },
)

it('requires a trimmed reason within the server length and accepts the stock limit', () => {
  const { adjustment } = setup()
  count(adjustment, '2147483647', '  ')
  expect(adjustment.canSubmit.value).toBe(false)
  adjustment.reason.value = '🚚'.repeat(256)
  expect(adjustment.reasonMessages.value).toEqual(['Use 255 characters or fewer.'])
  expect(adjustment.canSubmit.value).toBe(false)
  adjustment.reason.value = ' ' + '🚚'.repeat(255) + ' '
  expect(adjustment.canSubmit.value).toBe(true)
})

it('blocks duplicate submits and updates the displayed balance from the response', async () => {
  const { adjustment, product, request, signal } = setup()
  const pending = Promise.withResolvers()
  request.mockReturnValueOnce(pending.promise)
  count(adjustment, '0', '  Counted an empty bin  ')

  const saving = adjustment.save()
  await expect(adjustment.save()).resolves.toBeNull()
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/products/8/stock', {
    method: 'PATCH',
    body: { stock_quantity: 0, expected_stock_version: 3, reason: 'Counted an empty bin' },
    signal,
  })
  pending.resolve(envelope({ stock_quantity: 0, stock_version: 4 }))
  await expect(saving).resolves.toMatchObject({ stock_quantity: 0, stock_version: 4 })
  expect(product.value.stock_quantity).toBe(0)
})

it('preserves the draft after conflict and waits for a successful reload and explicit save', async () => {
  const { adjustment, product, request, signal } = setup()
  request
    .mockRejectedValueOnce(staleStock())
    .mockResolvedValueOnce(envelope({ stock_quantity: 15, stock_version: 6 }))
    .mockResolvedValueOnce(envelope({ stock_quantity: 7, stock_version: 7 }))
  count(adjustment)
  await expect(adjustment.save()).resolves.toBeNull()
  expect(adjustment.reloadReason.value).toBe('conflict')
  expect(adjustment.canSubmit.value).toBe(false)
  expect(product.value.stock_version).toBe(3)
  await expect(adjustment.save()).resolves.toBeNull()

  await adjustment.reload()
  expect(request.mock.calls).toHaveLength(2)
  expect(request).toHaveBeenLastCalledWith('/api/products/8', { signal })
  expect(product.value).toMatchObject({ stock_quantity: 15, stock_version: 6 })
  expect(adjustment.countedQuantity.value).toBe('7')
  expect(adjustment.reason.value).toBe('Cycle count')
  expect(adjustment.reloaded.value).toBe(true)

  await adjustment.save()
  expect(request).toHaveBeenLastCalledWith('/api/products/8/stock', {
    method: 'PATCH',
    body: { stock_quantity: 7, expected_stock_version: 6, reason: 'Cycle count' },
    signal,
  })
})

it('keeps saving blocked after a failed reload and blocks an already matching count after reload', async () => {
  const { adjustment, request } = setup()
  const loadFailure = new ApiError('Unavailable.', { status: 503 })
  request
    .mockRejectedValueOnce(staleStock())
    .mockRejectedValueOnce(loadFailure)
    .mockResolvedValueOnce(envelope({ stock_quantity: 7, stock_version: 4 }))
  count(adjustment)
  await adjustment.save()
  await expect(adjustment.reload()).resolves.toBeNull()
  expect(adjustment.reloadError.value).toBe(loadFailure)
  expect(adjustment.reloadReason.value).toBe('conflict')
  expect(adjustment.canSubmit.value).toBe(false)

  await adjustment.reload()
  expect(adjustment.matchesCurrent.value).toBe(true)
  await expect(adjustment.save()).resolves.toBeNull()
  expect(request).toHaveBeenCalledTimes(3)
})

it('requires a new product snapshot after an unconfirmed write', async () => {
  const { adjustment, request } = setup()
  request.mockRejectedValueOnce(new ApiError('The request timed out.', { code: 'NETWORK_ERROR' }))
  count(adjustment)
  await expect(adjustment.save()).resolves.toBeNull()
  expect(adjustment.reloadReason.value).toBe('unconfirmed')
  await expect(adjustment.save()).resolves.toBeNull()
  expect(request).toHaveBeenCalledTimes(1)
})

it('retains server field errors without treating validation as a version conflict', async () => {
  const { adjustment, request } = setup()
  request.mockRejectedValueOnce(
    new ApiError('Validation failed.', { status: 422, fields: { reason: ['Enter a reason.'] } }),
  )
  count(adjustment)
  await expect(adjustment.save()).resolves.toBeNull()
  expect(adjustment.reasonMessages.value).toEqual(['Enter a reason.'])
  expect(adjustment.reloadReason.value).toBeNull()
})

it('blocks a write when management access was lost', async () => {
  const { adjustment, canManage, request } = setup()
  count(adjustment)
  canManage.value = false
  await expect(adjustment.save()).resolves.toBeNull()
  expect(request).not.toHaveBeenCalled()
})
