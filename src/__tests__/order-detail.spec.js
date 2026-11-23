import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { loadOrder } from '../api/orders'
import { useOrderDetail } from '../composables/useOrderDetail'
import { orderActivity, orderTimeline } from '../utils/orderHistory'

const createdAt = '2026-11-20T06:00:00Z'
const confirmedAt = '2026-11-20T06:20:00Z'
const processingAt = '2026-11-20T06:30:00Z'
const actor = { id: 3, name: 'Maya Chen' }
const assignee = { id: 5, name: 'Mira Lane' }
const assigneeProfile = { ...assignee, email: 'mira@example.test', roles: ['staff'] }
const item = {
  position: 1,
  product_id: 3,
  product_name: 'Packing tape',
  product_sku: 'PK-100',
  quantity: 2,
  unit_price_minor: 350,
  item_discount_minor: 50,
  allocated_order_discount_minor: 50,
  tax_rate_basis_points: 1800,
  tax_minor: 108,
  line_total_minor: 708,
}

function orderDetail(overrides = {}) {
  return {
    id: 42,
    order_number: 'ORD-42',
    customer: { id: 7, name: 'Harbor Retail', email: null, phone: null, address: null },
    assignee,
    order_date: '2026-11-20',
    status: 'processing',
    priority: 'normal',
    currency: 'USD',
    subtotal_minor: 700,
    version: 1,
    order_discount_minor: 50,
    discount_total_minor: 100,
    tax_total_minor: 108,
    grand_total_minor: 708,
    created_at: createdAt,
    completed_at: null,
    items: [item],
    notes: [],
    status_history: [
      {
        id: 1,
        previous_status: 'pending',
        new_status: 'confirmed',
        remarks: null,
        actor,
        created_at: confirmedAt,
      },
      {
        id: 2,
        previous_status: 'confirmed',
        new_status: 'processing',
        remarks: null,
        actor,
        created_at: processingAt,
      },
    ],
    assignment_history: [],
    system_activity: [],
    ...overrides,
  }
}

const payload = (order) => ({ success: true, data: { order } })

describe('loading an order', () => {
  it('requests the wrapped backend detail with the normalized ID and caller signal', async () => {
    const order = orderDetail()
    const request = vi.fn().mockResolvedValue(payload(order))
    const { signal } = new AbortController()

    await expect(loadOrder(request, '0042', signal)).resolves.toBe(order)

    expect(request).toHaveBeenCalledExactlyOnceWith('/api/orders/42', { signal })
  })

  it.each([assigneeProfile, { ...assigneeProfile, roles: [] }, null])(
    'preserves the assignee detail %j',
    async (assignee) => {
      const order = orderDetail({ assignee })
      const request = vi.fn().mockResolvedValue(payload(order))

      await expect(loadOrder(request, '42')).resolves.toBe(order)
    },
  )

  it.each(['0', '42/notes', '1e2', '9007199254740992'])(
    'treats invalid route ID %s as unavailable before requesting',
    async (id) => {
      const request = vi.fn()

      await expect(loadOrder(request, id)).rejects.toMatchObject({ status: 404 })
      expect(request).not.toHaveBeenCalled()
    },
  )

  it.each([
    { id: 43 },
    { items: [{ ...item, unit_price_minor: '350' }] },
    { status_history: [{ id: 1, new_status: 'shipped', created_at: createdAt }] },
    { system_activity: undefined },
    { assignee: { ...assignee, roles: assigneeProfile.roles } },
    { assignee: { ...assignee, email: assigneeProfile.email } },
    { assignee: { ...assigneeProfile, email: null } },
    { assignee: { ...assigneeProfile, roles: [1] } },
  ])('rejects malformed or mismatched detail %j', async (overrides) => {
    const request = vi.fn().mockResolvedValue(payload(orderDetail(overrides)))

    await expect(loadOrder(request, '42')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it.each([403, 404])('preserves the backend %s without exposing order data', async (status) => {
    const request = vi.fn().mockRejectedValue(new ApiError('Unavailable', { status }))
    const { signal } = new AbortController()
    const detail = useOrderDetail({ request, signal })

    await detail.load('42')

    expect(detail.error.value.status).toBe(status)
    expect(detail.order.value).toBeNull()
    expect(detail.loading.value).toBe(false)
  })

  it('drops the previous record on navigation and ignores late responses', async () => {
    const pending = Promise.withResolvers()
    const current = orderDetail({ id: 44 })
    const request = vi
      .fn()
      .mockResolvedValueOnce(payload(orderDetail()))
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValueOnce(payload(current))
    const { signal } = new AbortController()
    const detail = useOrderDetail({ request, signal })

    await detail.load('42')
    expect(detail.order.value.id).toBe(42)

    const stale = detail.load('43')
    expect(detail.order.value).toBeNull()
    expect(detail.loading.value).toBe(true)

    await detail.load('44')
    pending.resolve(payload(orderDetail({ id: 43 })))
    await stale

    expect(request.mock.calls[1][1].signal.aborted).toBe(true)
    expect(detail.order.value).toBe(current)
    expect(detail.error.value).toBeNull()
    expect(detail.loading.value).toBe(false)
  })
})

describe('order history', () => {
  it('marks recorded lifecycle steps using their event timestamps', () => {
    const timeline = new Map(orderTimeline(orderDetail()).map((step) => [step.key, step]))

    expect(timeline.get('created')).toMatchObject({ at: createdAt, reached: true })
    expect(timeline.get('pending')).toMatchObject({ at: null, reached: true })
    expect(timeline.get('confirmed')).toMatchObject({ at: confirmedAt, reached: true })
    expect(timeline.get('processing')).toMatchObject({ at: processingAt, reached: true })
    expect(timeline.get('ready')).toMatchObject({ at: null, reached: false })
  })

  it('uses completion time as a fallback and includes cancellation when applicable', () => {
    const completed = orderDetail({ status: 'completed', completed_at: processingAt })
    expect(orderTimeline(completed).at(-1)).toMatchObject({ key: 'completed', at: processingAt })

    const cancelled = orderDetail({
      status: 'cancelled',
      status_history: [
        {
          id: 1,
          previous_status: 'draft',
          new_status: 'cancelled',
          remarks: null,
          actor,
          created_at: confirmedAt,
        },
      ],
    })
    expect(orderTimeline(cancelled).at(-1)).toMatchObject({ key: 'cancelled', at: confirmedAt })
  })

  it('merges dated status, note, assignment, and system events newest first', () => {
    const noteAt = '2026-11-20T06:45:00Z'
    const order = orderDetail({
      notes: [{ id: 1, author: actor, body: 'Pack separately.', created_at: noteAt }],
      assignment_history: [
        {
          id: 1,
          previous_assignee_id: 6,
          new_assignee_id: 5,
          actor_id: 3,
          actor_name: null,
          created_at: confirmedAt,
        },
      ],
      system_activity: [
        {
          id: 1,
          action: 'order.created',
          actor_id: 3,
          actor_name: actor.name,
          created_at: createdAt,
        },
      ],
    })
    const events = orderActivity(order)

    expect(events.map(({ key }) => key)).toEqual([
      'note-1',
      'status-2',
      'status-1',
      'assignment-1',
      'system-1',
    ])
    expect(events[0]).toMatchObject({ actor: actor.name, body: 'Pack separately.', at: noteAt })
    expect(events[3]).toMatchObject({ title: 'User #6 → Mira Lane', actor: 'User #3' })
  })
})
