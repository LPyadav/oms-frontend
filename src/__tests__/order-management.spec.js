import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { deleteOrder, previewOrderPricing, updateOrder } from '../api/orders'
import { isOrderDeletable, isOrderEditable } from '../constants/orders'
import {
  changedOrderFields,
  createOrderDraft,
  orderEditConflicts,
  reapplyOrderChanges,
  validateOrderDraft,
} from '../utils/orderDraft'

const line = {
  product_id: 5,
  product_name: 'Packing tape',
  product_sku: 'PK-100',
  position: 1,
  quantity: 1,
  unit_price_minor: 1500,
  item_discount_minor: 100,
  allocated_order_discount_minor: 50,
  tax_rate_basis_points: 1000,
  tax_minor: 135,
  line_total_minor: 1485,
}
const pricing = {
  currency: 'USD',
  subtotal_minor: 1500,
  order_discount_minor: 50,
  discount_total_minor: 150,
  tax_total_minor: 135,
  grand_total_minor: 1485,
  items: [line],
}
const saved = {
  ...pricing,
  id: 42,
  version: 3,
  order_number: 'ORD-42',
  customer: { id: 9, name: 'Harbor Retail', email: null, phone: null, address: null },
  assignee: null,
  order_date: '2026-11-22',
  priority: 'normal',
  status: 'draft',
  created_at: '2026-11-22T06:00:00Z',
  completed_at: null,
  notes: [],
  status_history: [],
  assignment_history: [],
  system_activity: [],
}

function edit(overrides) {
  return { ...createOrderDraft(saved), ...overrides }
}

function changes(draft) {
  return changedOrderFields(saved, validateOrderDraft(draft).body)
}

describe('order edit snapshots', () => {
  it('prefills saved discounts and identifies only writable changes', () => {
    const draft = createOrderDraft(saved)

    expect(draft.discount).toBe('0.50')
    expect(draft.items[0]).toMatchObject({
      product: { id: 5, name: 'Packing tape', sku: 'PK-100' },
      quantity: '1',
      discount: '1.00',
    })
    expect(changes(draft)).toEqual({})
    expect(changes(edit({ priority: 'high', note: 'Not editable here' }))).toEqual({
      priority: 'high',
    })
  })

  it('reapplies local fields on the latest record while keeping its other fields', () => {
    const draft = edit({ discount: '2.50' })
    const latest = { ...saved, version: 4, priority: 'high', order_date: '2026-11-23' }
    const fields = changes(draft)

    expect(orderEditConflicts(saved, latest, fields)).toEqual([])
    const rebased = reapplyOrderChanges(latest, draft, fields)
    expect(rebased).toMatchObject({ discount: '2.50', priority: 'high', orderDate: '2026-11-23' })
    expect(changedOrderFields(latest, validateOrderDraft(rebased).body)).toEqual({
      order_discount_minor: 250,
    })
  })

  it('flags an item list changed on both versions and accepts a value already saved', () => {
    const draft = edit()
    draft.items[0].quantity = '2'
    const latest = { ...saved, items: [{ ...line, quantity: 3 }] }

    expect(orderEditConflicts(saved, latest, changes(draft))).toEqual(['items'])
    expect(
      orderEditConflicts(saved, { ...saved, items: [{ ...line, quantity: 2 }] }, changes(draft)),
    ).toEqual([])
  })

  it.each([
    ['draft', true, true],
    ['pending', true, true],
    ['cancelled', false, true],
    ['confirmed', false, false],
    ['processing', false, false],
    ['ready', false, false],
    ['completed', false, false],
  ])('applies edit and delete state rules to %s', (status, editable, deletable) => {
    expect(isOrderEditable(status)).toBe(editable)
    expect(isOrderDeletable(status)).toBe(deletable)
  })
})

describe('versioned order API calls', () => {
  it('sends a PATCH with the loaded version and accepts the returned detail', async () => {
    const updated = { ...saved, version: 4, priority: 'urgent' }
    const request = vi.fn().mockResolvedValue({ data: { order: updated } })
    const body = { expected_version: 3, priority: 'urgent' }
    const { signal } = new AbortController()

    await expect(updateOrder(request, 42, body, signal)).resolves.toBe(updated)
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/orders/42', {
      method: 'PATCH',
      body,
      signal,
    })
  })

  it('uses order ID with saved lines for a pricing preview', async () => {
    const request = vi.fn().mockResolvedValue({ data: { pricing } })
    const body = { order_id: 42, ...validateOrderDraft(createOrderDraft(saved)).body }
    await expect(previewOrderPricing(request, body)).resolves.toBe(pricing)
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/orders/preview', {
      method: 'POST',
      body: { order_id: 42, items: body.items, order_discount_minor: 50 },
      signal: undefined,
    })
  })

  it('deletes with the version in the query string and no request body', async () => {
    const request = vi.fn().mockResolvedValue({ data: null })
    const { signal } = new AbortController()
    await deleteOrder(request, 42, 3, signal)
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/orders/42?expected_version=3', {
      method: 'DELETE',
      signal,
    })
  })

  it('passes through a stale write error without retrying', async () => {
    const failure = new ApiError('Changed', { status: 409, code: 'ORDER_VERSION_CONFLICT' })
    const request = vi.fn().mockRejectedValue(failure)

    await expect(deleteOrder(request, 42, 3)).rejects.toBe(failure)
    expect(request).toHaveBeenCalledOnce()
  })
})

it('sends a changed tax rate and detects a concurrent change to the saved rate', () => {
  const draft = createOrderDraft(saved)
  expect(draft.items[0].taxRate).toBe('')
  expect(changes(draft)).toEqual({})

  draft.items[0].taxRate = '10'
  expect(changes(draft)).toEqual({})

  draft.items[0].taxRate = '0'
  const fields = changes(draft)
  expect(fields.items).toEqual([
    { product_id: 5, quantity: 1, item_discount_minor: 100, tax_rate_basis_points: 0 },
  ])
  const latest = { ...saved, items: [{ ...line, tax_rate_basis_points: 750 }] }
  expect(orderEditConflicts(saved, latest, fields)).toEqual(['items'])
  expect(
    orderEditConflicts(saved, { ...saved, items: [{ ...line, tax_rate_basis_points: 0 }] }, fields),
  ).toEqual([])
})

it('rejects a pricing response when it ignores an explicit zero tax override', async () => {
  const request = vi.fn().mockResolvedValue({ data: { pricing } })
  const body = validateOrderDraft(createOrderDraft(saved)).body
  body.items[0].tax_rate_basis_points = 0

  await expect(previewOrderPricing(request, body)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})

describe('order-wide tax', () => {
  const taxOrder = { ...saved, order_tax_rate_basis_points: 0 }
  const taxBody = (draft, order = taxOrder) =>
    validateOrderDraft(draft, { savedOrderTaxRate: order.order_tax_rate_basis_points }).body

  it('distinguishes omitted tax, explicit zero and a reset', () => {
    expect(taxBody(createOrderDraft(saved), saved)).not.toHaveProperty(
      'order_tax_rate_basis_points',
    )
    const zero = createOrderDraft(taxOrder)
    expect(zero.orderTaxRate).toBe('0.00')
    expect(taxBody(zero).order_tax_rate_basis_points).toBe(0)
    expect(changedOrderFields(taxOrder, taxBody(zero))).toEqual({})
    zero.orderTaxRate = ''
    expect(changedOrderFields(taxOrder, taxBody(zero))).toEqual({
      order_tax_rate_basis_points: null,
    })
  })

  it('sends exactly one tax method and omits overrides for a creator without update permission', () => {
    const draft = { ...createOrderDraft(saved), orderTaxRate: '5.25' }
    draft.items[0].taxRate = '15'
    expect(taxBody(draft, saved)).toMatchObject({ order_tax_rate_basis_points: 525 })
    expect(taxBody(draft, saved).items[0]).not.toHaveProperty('tax_rate_basis_points')

    draft.orderTaxRate = ''
    expect(taxBody(draft).order_tax_rate_basis_points).toBeNull()
    expect(taxBody(draft).items[0]).not.toHaveProperty('tax_rate_basis_points')
    expect(taxBody(draft, saved).items[0].tax_rate_basis_points).toBe(1500)
    const restricted = validateOrderDraft(
      { ...draft, orderTaxRate: '10' },
      { allowTaxOverride: false },
    ).body
    expect(restricted).not.toHaveProperty('order_tax_rate_basis_points')
    expect(restricted.items[0]).not.toHaveProperty('tax_rate_basis_points')
  })

  it('surfaces invalid order-wide rates in line items', () => {
    const result = validateOrderDraft({ ...createOrderDraft(saved), orderTaxRate: '100.01' })
    expect(result.fields).toHaveProperty('order_tax_rate_basis_points')
    expect(result.body).not.toHaveProperty('order_tax_rate_basis_points')
  })

  it('flags a concurrent tax change and keeps tax in nonconflicting rebases', () => {
    const draft = { ...createOrderDraft(taxOrder), orderTaxRate: '10' }
    const changes = changedOrderFields(taxOrder, taxBody(draft))
    const latest = { ...taxOrder, version: 4, priority: 'high' }
    expect(orderEditConflicts(taxOrder, latest, changes)).toEqual([])
    expect(reapplyOrderChanges(latest, draft, changes)).toMatchObject({
      priority: 'high',
      orderTaxRate: '10',
    })
    expect(
      orderEditConflicts(taxOrder, { ...latest, order_tax_rate_basis_points: 500 }, changes),
    ).toEqual(['order_tax_rate_basis_points'])
  })

  it('flags a concurrent order rate when an item tax edit can no longer be applied', () => {
    const draft = createOrderDraft(saved)
    draft.items[0].taxRate = '5'
    const changes = changedOrderFields(saved, taxBody(draft, saved))
    expect(
      orderEditConflicts(saved, { ...saved, order_tax_rate_basis_points: 1000 }, changes),
    ).toEqual(['items'])
  })

  it.each([0, null])('sends explicit %j for pricing and versioned update', async (rate) => {
    const confirmed = {
      ...pricing,
      order_tax_rate_basis_points: rate,
      items: [{ ...line, tax_rate_basis_points: rate ?? line.tax_rate_basis_points }],
    }
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { pricing: confirmed } })
      .mockResolvedValueOnce({ data: { order: { ...saved, ...confirmed, version: 4 } } })
    const body = {
      ...taxBody(createOrderDraft(saved), saved),
      order_id: 42,
      order_tax_rate_basis_points: rate,
    }
    await expect(previewOrderPricing(request, body)).resolves.toBe(confirmed)
    expect(request.mock.calls[0][1].body.order_tax_rate_basis_points).toBe(rate)
    const patch = { expected_version: 3, order_tax_rate_basis_points: rate }
    await expect(updateOrder(request, 42, patch)).resolves.toMatchObject({
      order_tax_rate_basis_points: rate,
    })
    expect(request.mock.calls[1][1].body).toEqual(patch)
  })

  it('rejects a preview that ignores an explicit order rate or misstates its line rates', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { pricing } })
      .mockResolvedValueOnce({ data: { pricing: { ...pricing, order_tax_rate_basis_points: 0 } } })
    const body = { ...taxBody(createOrderDraft(saved), saved), order_tax_rate_basis_points: 0 }
    await expect(previewOrderPricing(request, body)).rejects.toHaveProperty(
      'code',
      'INVALID_RESPONSE',
    )
    await expect(previewOrderPricing(request, body)).rejects.toHaveProperty(
      'code',
      'INVALID_RESPONSE',
    )
  })
})
