import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { changeOrderStatus } from '../api/orders'
import { availableOrderStatuses } from '../utils/orderLifecycle'

const fullAccess = { canChangeAnyOrderStatus: true }
const assignedAccess = { canChangeAssignedOrderStatus: true, user: { id: 3 } }
const assignee = { id: 3, name: 'Casey' }

describe('available order statuses', () => {
  it.each([
    ['draft', ['pending', 'cancelled']],
    ['pending', ['confirmed', 'cancelled']],
    ['confirmed', ['processing', 'cancelled']],
    ['processing', ['ready', 'cancelled']],
    ['ready', ['completed', 'cancelled']],
    ['completed', []],
    ['cancelled', []],
    ['unknown', []],
  ])('lists the allowed full-access targets for %s', (status, targets) => {
    expect(availableOrderStatuses({ status, assignee: null }, fullAccess)).toEqual(targets)
  })

  it.each([
    ['draft', []],
    ['pending', []],
    ['confirmed', ['processing']],
    ['processing', ['ready']],
    ['ready', []],
    ['completed', []],
    ['cancelled', []],
  ])('lists the allowed assigned targets for %s', (status, targets) => {
    expect(availableOrderStatuses({ status, assignee }, assignedAccess)).toEqual(targets)
  })

  it('requires exact assignee identity and status grants', () => {
    const order = { status: 'confirmed', assignee }
    expect(availableOrderStatuses(order, { user: assignee })).toEqual([])
    expect(availableOrderStatuses(order, { ...assignedAccess, user: { id: 4 } })).toEqual([])
    expect(availableOrderStatuses({ ...order, assignee: null }, assignedAccess)).toEqual([])
    expect(availableOrderStatuses(order, { ...assignedAccess, user: null })).toEqual([])
    expect(availableOrderStatuses(order, { ...assignedAccess, ...fullAccess })).toEqual([
      'processing',
      'cancelled',
    ])
    expect(availableOrderStatuses(null, fullAccess)).toEqual([])
  })
})

const at = '2026-11-22T08:00:00Z'
const transitioned = {
  id: 10,
  order_number: 'ORD-10',
  customer: { id: 9, name: 'Harbor Retail', email: null, phone: null, address: null },
  assignee,
  status: 'processing',
  version: 3,
  priority: 'normal',
  order_date: '2026-11-22',
  currency: 'USD',
  subtotal_minor: 1000,
  order_discount_minor: 0,
  discount_total_minor: 0,
  tax_total_minor: 0,
  grand_total_minor: 1000,
  items: [],
  notes: [],
  assignment_history: [],
  system_activity: [],
  status_history: [
    {
      id: 1,
      previous_status: 'confirmed',
      new_status: 'processing',
      actor: assignee,
      remarks: 'Started packing',
      created_at: at,
    },
  ],
  created_at: at,
  completed_at: null,
}
const payload = { status: 'processing', expected_version: 2, remarks: 'Started packing' }

describe('order status API', () => {
  it('sends the version and remarks with the status and reads the returned order', async () => {
    const request = vi.fn().mockResolvedValue({ data: { order: transitioned } })
    const { signal } = new AbortController()

    await expect(changeOrderStatus(request, '10', payload, signal)).resolves.toBe(transitioned)
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/orders/10/status', {
      method: 'POST',
      body: payload,
      signal,
    })
  })

  it.each([{ id: 11 }, { status: 'ready' }, { version: 2 }])(
    'rejects an inconsistent write response %j',
    async (override) => {
      const request = vi
        .fn()
        .mockResolvedValue({ data: { order: { ...transitioned, ...override } } })
      await expect(changeOrderStatus(request, 10, payload)).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      })
    },
  )

  it('passes through a stale version conflict without replaying the write', async () => {
    const error = new ApiError('Order changed', { status: 409, code: 'ORDER_VERSION_CONFLICT' })
    const request = vi.fn().mockRejectedValue(error)

    await expect(changeOrderStatus(request, 10, payload)).rejects.toBe(error)
    expect(request).toHaveBeenCalledOnce()
  })
})
