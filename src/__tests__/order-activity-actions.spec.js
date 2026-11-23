import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { addOrderNote, assignOrder, loadOrderAssigneePage } from '../api/orders'
import { canAddNoteToOrder, canChangeOrderAssignee } from '../utils/orderActivityAccess'

const assignee = { id: 3, name: 'Casey' }
const assigneeProfile = { ...assignee, email: 'casey@example.test', roles: ['manager', 'staff'] }
const timestamp = '2026-11-22T08:00:00Z'
const order = {
  id: 10,
  order_number: 'ORD-10',
  customer: { id: 9, name: 'Harbor Retail', email: null, phone: null, address: null },
  assignee,
  status: 'pending',
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
  status_history: [],
  created_at: timestamp,
  completed_at: null,
}
const note = { id: 1, author: assignee, created_at: timestamp, body: 'Packing instructions' }

describe('order activity permissions', () => {
  it.each(['draft', 'pending', 'confirmed', 'processing', 'ready'])(
    'allows an assignment grant in %s',
    (status) => {
      expect(canChangeOrderAssignee({ ...order, status }, { canAssignOrders: true })).toBe(true)
    },
  )

  it('requires an assignment grant and a nonterminal order', () => {
    expect(canChangeOrderAssignee(order, {})).toBe(false)
    expect(canChangeOrderAssignee(null, { canAssignOrders: true })).toBe(false)
    for (const status of ['completed', 'cancelled']) {
      expect(canChangeOrderAssignee({ ...order, status }, { canAssignOrders: true })).toBe(false)
    }
  })

  it('allows broad notes and note access for the current assignee, including on terminal orders', () => {
    const closedOrder = { ...order, status: 'cancelled' }
    const scoped = { canAddAssignedOrderNote: true, user: assignee }
    expect(canAddNoteToOrder(closedOrder, { canAddOrderNote: true })).toBe(true)
    expect(canAddNoteToOrder(closedOrder, scoped)).toBe(true)
    expect(canAddNoteToOrder({ ...order, assignee: null }, scoped)).toBe(false)
    expect(canAddNoteToOrder(order, { ...scoped, user: { id: 4 }, canViewAllOrders: true })).toBe(
      false,
    )
    expect(canAddNoteToOrder(order, { user: assignee })).toBe(false)
  })
})

function assigneesPayload(assignees) {
  return {
    data: { assignees },
    meta: { current_page: 1, per_page: 25, total: assignees.length, last_page: 1 },
  }
}

describe('order assignment API', () => {
  it('preserves enriched and compact assignee options, including an empty roles array', async () => {
    const options = [
      assigneeProfile,
      { id: 4, name: 'Mira', email: 'mira@example.test', roles: [] },
      { id: 5, name: 'Devon' },
    ]
    const request = vi.fn().mockResolvedValue(assigneesPayload(options))
    const { signal } = new AbortController()

    await expect(
      loadOrderAssigneePage(request, { page: 1, search: 'retail team' }, signal),
    ).resolves.toMatchObject({ assignees: options })
    expect(request).toHaveBeenCalledExactlyOnceWith(
      '/api/orders/assignees?page=1&search=retail+team',
      {
        signal,
      },
    )
  })

  it.each([
    { ...assignee, email: assigneeProfile.email },
    { ...assignee, roles: assigneeProfile.roles },
    { ...assigneeProfile, email: ' ' },
    { ...assigneeProfile, roles: ['staff', ' '] },
    { ...assigneeProfile, roles: 'staff' },
  ])('rejects an invalid assignee option %j', async (option) => {
    const request = vi.fn().mockResolvedValue(assigneesPayload([option]))

    await expect(loadOrderAssigneePage(request, { page: 1 })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  })

  it.each([assigneeProfile, assignee])(
    'returns the confirmed assignee %j and submits only ID and version',
    async (selected) => {
      const updated = { ...order, assignee: selected, version: 4 }
      const request = vi.fn().mockResolvedValue({ data: { order: updated } })
      const { signal } = new AbortController()

      await expect(
        assignOrder(request, 10, { assignee_id: selected.id, expected_version: 3 }, signal),
      ).resolves.toBe(updated)
      expect(request).toHaveBeenCalledExactlyOnceWith('/api/orders/10/assign', {
        method: 'POST',
        body: { assignee_id: 3, expected_version: 3 },
        signal,
      })
    },
  )

  it('sends an explicit null and expected version to unassign', async () => {
    const updated = { ...order, assignee: null, version: 4 }
    const request = vi.fn().mockResolvedValue({ data: { order: updated } })
    const body = { assignee_id: null, expected_version: 3 }
    const { signal } = new AbortController()

    await expect(assignOrder(request, '10', body, signal)).resolves.toBe(updated)
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/orders/10/assign', {
      method: 'POST',
      body,
      signal,
    })
  })

  it('preserves a version conflict and makes only one write attempt', async () => {
    const failure = new ApiError('Order changed', { status: 409, code: 'ORDER_VERSION_CONFLICT' })
    const request = vi.fn().mockRejectedValue(failure)
    await expect(assignOrder(request, 10, { assignee_id: 3, expected_version: 2 })).rejects.toBe(
      failure,
    )
    expect(request).toHaveBeenCalledTimes(1)
  })

  it.each([
    { assignee: null },
    { assignee: { ...assignee, email: assigneeProfile.email } },
    { version: 7 },
  ])('rejects inconsistent confirmation %j', async (change) => {
    const request = vi.fn().mockResolvedValue({ data: { order: { ...order, ...change } } })
    await expect(
      assignOrder(request, 10, { assignee_id: 3, expected_version: 2 }),
    ).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  })
})

describe('order notes API', () => {
  it('posts only the note body and returns the server entry', async () => {
    const request = vi.fn().mockResolvedValue({ data: { note } })
    const { signal } = new AbortController()

    await expect(addOrderNote(request, 10, note.body, signal)).resolves.toBe(note)
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/orders/10/notes', {
      method: 'POST',
      body: { body: note.body },
      signal,
    })
  })

  it.each([null, { ...note, body: 'Different note' }])(
    'rejects an unconfirmed note %j',
    async (entry) => {
      const request = vi.fn().mockResolvedValue({ data: { note: entry } })
      await expect(addOrderNote(request, 10, note.body)).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      })
      expect(request).toHaveBeenCalledTimes(1)
    },
  )
})
