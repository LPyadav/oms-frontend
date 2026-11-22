import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from '../api/client'
import { previewOrderPricing } from '../api/orders'
import { useOrderCreation } from '../composables/useOrderCreation'
import { createOrderLine, discountToMinor, validateOrderDraft } from '../utils/orderDraft'

const customer = { id: 3, name: 'Harbor Retail', email: null, phone: null, address: null }
const product = { id: 5, name: 'Packing tape', sku: 'PK-100' }
const body = {
  customer_id: customer.id,
  order_date: '2026-11-22',
  priority: 'normal',
  items: [{ product_id: product.id, quantity: 2, item_discount_minor: 100 }],
  order_discount_minor: 50,
}
const pricing = {
  currency: 'USD',
  subtotal_minor: 2200,
  order_discount_minor: 50,
  discount_total_minor: 150,
  tax_total_minor: 205,
  grand_total_minor: 2255,
  items: [
    {
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      position: 1,
      quantity: 2,
      unit_price_minor: 1100,
      item_discount_minor: 100,
      allocated_order_discount_minor: 50,
      tax_rate_basis_points: 1000,
      tax_minor: 205,
      line_total_minor: 2255,
    },
  ],
}
const savedOrder = {
  ...pricing,
  id: 18,
  version: 1,
  order_number: 'ORD-18',
  customer,
  assignee: null,
  order_date: body.order_date,
  priority: 'normal',
  status: 'draft',
  notes: [],
  status_history: [],
  assignment_history: [],
  system_activity: [],
  created_at: '2026-11-22T07:00:00Z',
  completed_at: null,
}

function draft(overrides = {}) {
  return {
    customer,
    orderDate: body.order_date,
    items: [{ ...createOrderLine(1), product, quantity: '2', discount: '1.00' }],
    discount: '0.50',
    priority: 'normal',
    note: '',
    assignee: null,
    ...overrides,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('draft order validation', () => {
  it.each([
    ['1.09', 109],
    [' 0.1 ', 10],
    ['', 0],
    ['0.001', null],
    ['9e1', null],
    ['-10', null],
    ['90071992547409.92', null],
  ])('converts discount %s to exact minor units', (value, expected) => {
    expect(discountToMinor(value)).toBe(expected)
  })

  it('normalizes only the allowed API fields', () => {
    expect(validateOrderDraft(draft())).toEqual({ fields: {}, body })
  })

  it('rejects invalid dates, repeated products, and invalid quantities before sending', () => {
    const initial = draft()
    const result = validateOrderDraft(
      draft({
        orderDate: '2026-02-30',
        items: [...initial.items, { ...createOrderLine(2), product, quantity: '0.5' }],
      }),
    )
    expect(Object.keys(result.fields)).toEqual([
      'order_date',
      'items.1.product_id',
      'items.1.quantity',
    ])
  })
})

it('uses only server pricing inputs and validates the returned line identity', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce({ data: { pricing } })
    .mockResolvedValueOnce({
      data: { pricing: { ...pricing, items: [{ ...pricing.items[0], product_id: 6 }] } },
    })
  const { signal } = new AbortController()

  await expect(previewOrderPricing(request, body, signal)).resolves.toBe(pricing)
  expect(request).toHaveBeenNthCalledWith(1, '/api/orders/preview', {
    method: 'POST',
    body: { items: body.items, order_discount_minor: body.order_discount_minor },
    signal,
  })
  await expect(previewOrderPricing(request, body, signal)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})

it('drops a pricing request replaced before its response', async () => {
  const first = Promise.withResolvers()
  const request = vi
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce({ data: { pricing } })
  const { signal } = new AbortController()
  const order = useOrderCreation({ request, signal })

  const stale = order.preview(body)
  await order.preview(body)
  first.resolve({ data: { pricing: { ...pricing, grand_total_minor: 123 } } })
  await stale

  expect(request.mock.calls[0][1].signal.aborted).toBe(true)
  expect(order.pricing.value).toBe(pricing)
})

it('sends the approved idempotency key header with the existing bearer token', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ success: true, data: { order: savedOrder } }))
  vi.stubGlobal('fetch', fetch)

  await apiRequest('/api/orders', {
    method: 'POST',
    token: 'test-token',
    idempotencyKey: 'retry-1',
    body,
  })

  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    '/api/orders',
    expect.objectContaining({
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer test-token',
        'Idempotency-Key': 'retry-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  )
})

it('suppresses duplicate submits and reuses the exact request after an uncertain save', async () => {
  const pending = Promise.withResolvers()
  const request = vi
    .fn()
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce({ data: { order: savedOrder } })
  const { signal } = new AbortController()
  const newKey = vi.fn(() => 'first-attempt')
  const order = useOrderCreation({ request, signal, newKey })

  const first = order.save(body)
  await expect(order.save(body)).resolves.toBeNull()
  pending.reject(new ApiError('Network timeout', { code: 'NETWORK_ERROR' }))
  await expect(first).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  await expect(order.save({ ...body, priority: 'urgent' })).resolves.toBe(savedOrder)

  expect(newKey).toHaveBeenCalledOnce()
  expect(request.mock.calls).toEqual([
    ['/api/orders', { method: 'POST', body, idempotencyKey: 'first-attempt', signal }],
    ['/api/orders', { method: 'POST', body, idempotencyKey: 'first-attempt', signal }],
  ])
})

it('allows a corrected payload with a fresh key after confirmed validation failure', async () => {
  const request = vi
    .fn()
    .mockRejectedValueOnce(new ApiError('Choose an active customer', { status: 422 }))
    .mockResolvedValueOnce({ data: { order: savedOrder } })
  const { signal } = new AbortController()
  const newKey = vi.fn().mockReturnValueOnce('first-attempt').mockReturnValueOnce('second-attempt')
  const order = useOrderCreation({ request, signal, newKey })
  const corrected = { ...body, customer_id: 7 }

  await expect(order.save(body)).rejects.toMatchObject({ status: 422 })
  await expect(order.save(corrected)).resolves.toBe(savedOrder)
  expect(request.mock.calls[1][1]).toMatchObject({
    body: corrected,
    idempotencyKey: 'second-attempt',
  })
})

it.each([
  ['', undefined],
  ['0', 0],
  ['8.25', 825],
  ['100.00', 10_000],
])('serializes tax rate %j to optional exact basis points', (taxRate, expected) => {
  const initial = draft()
  const result = validateOrderDraft({ ...initial, items: [{ ...initial.items[0], taxRate }] })
  const expectedItem = {
    ...body.items[0],
    ...(expected !== undefined && { tax_rate_basis_points: expected }),
  }

  expect(result.fields).toEqual({})
  expect(result.body.items).toEqual([expectedItem])
})

it.each(['-1', '100.01', '8.251', '8e1'])('rejects invalid tax rate %j', (taxRate) => {
  const initial = draft()
  const result = validateOrderDraft({ ...initial, items: [{ ...initial.items[0], taxRate }] })

  expect(result.fields).toHaveProperty('items.0.tax_rate_basis_points')
})

it('omits tax overrides when the active account cannot edit orders', () => {
  const initial = draft()
  const result = validateOrderDraft(
    { ...initial, items: [{ ...initial.items[0], taxRate: '8.25' }] },
    { allowTaxOverride: false },
  )

  expect(result.fields).toEqual({})
  expect(result.body.items).toEqual(body.items)
})
