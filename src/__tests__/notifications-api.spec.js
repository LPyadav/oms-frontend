import { expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { loadNotificationPage, loadUnreadNotificationCount } from '../api/notifications'

const unreadNotification = {
  id: 17,
  event_type: 'order.assigned',
  order_id: 8,
  order_number: 'OMS-000008',
  read_at: null,
  created_at: '2026-11-23T04:15:00.000000Z',
}
const readNotification = {
  ...unreadNotification,
  id: 18,
  event_type: 'order.confirmed',
  read_at: '2026-11-23T04:20:00.000000Z',
}
const firstPage = { page: 1, status: null }

function envelope(notifications, pagination = {}) {
  return {
    data: { notifications },
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 25,
      total: notifications.length,
      ...pagination,
    },
  }
}

it('loads all statuses and preserves the server fields, ordering, and future event types', async () => {
  const notifications = [
    { ...unreadNotification, id: 19, event_type: 'order.future-event' },
    readNotification,
    unreadNotification,
  ]
  const request = vi.fn().mockResolvedValue(envelope(notifications))
  const { signal } = new AbortController()

  await expect(loadNotificationPage(request, firstPage, signal)).resolves.toEqual({
    notifications,
    currentPage: 1,
    lastPage: 1,
    perPage: 25,
    total: 3,
  })
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/notifications?page=1', { signal })
})

it.each([
  ['read', readNotification],
  ['unread', unreadNotification],
])('requests the %s status and honors server pagination', async (status, notification) => {
  const request = vi
    .fn()
    .mockResolvedValue(
      envelope([notification], { current_page: 2, last_page: 2, per_page: 4, total: 5 }),
    )
  const { signal } = new AbortController()

  await expect(loadNotificationPage(request, { page: 2, status }, signal)).resolves.toEqual({
    notifications: [notification],
    currentPage: 2,
    lastPage: 2,
    perPage: 4,
    total: 5,
  })
  expect(request).toHaveBeenCalledExactlyOnceWith(`/api/notifications?page=2&status=${status}`, {
    signal,
  })
})

it('keeps an empty out-of-range page so the caller can recover to the last page', async () => {
  const request = vi.fn().mockResolvedValue(envelope([], { current_page: 2 }))
  const { signal } = new AbortController()

  await expect(loadNotificationPage(request, { ...firstPage, page: 2 }, signal)).resolves.toEqual({
    notifications: [],
    currentPage: 2,
    lastPage: 1,
    perPage: 25,
    total: 0,
  })
})

it.each([
  ['missing notification list', { meta: envelope([]).meta, data: {} }],
  ['nonpositive notification ID', envelope([{ ...unreadNotification, id: 0 }])],
  ['unsafe order ID', envelope([{ ...unreadNotification, order_id: Number.MAX_SAFE_INTEGER + 1 }])],
  ['empty order number', envelope([{ ...unreadNotification, order_number: '' }])],
  ['blank event type', envelope([{ ...unreadNotification, event_type: ' ' }])],
  ['missing read time', envelope([{ ...unreadNotification, read_at: undefined }])],
  ['invalid creation time', envelope([{ ...unreadNotification, created_at: 'yesterday' }])],
  ['missing pagination', { data: { notifications: [] } }],
  ['wrong page number', envelope([], { current_page: 2 })],
  ['nonpositive page size', envelope([], { per_page: 0 })],
  ['nonpositive last page', envelope([], { last_page: 0 })],
  ['negative total', envelope([], { total: -1 })],
])('rejects list responses with %s', async (_, payload) => {
  const request = vi.fn().mockResolvedValue(payload)
  const { signal } = new AbortController()

  await expect(loadNotificationPage(request, firstPage, signal)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})

it.each([0, 12])('returns the unread count %i and forwards the abort signal', async (count) => {
  const request = vi.fn().mockResolvedValue({ data: { unread_count: count } })
  const { signal } = new AbortController()

  await expect(loadUnreadNotificationCount(request, signal)).resolves.toBe(count)
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/notifications/unread-count', { signal })
})

it.each([undefined, null, '2', -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
  'rejects an invalid unread count (%j)',
  async (count) => {
    const request = vi.fn().mockResolvedValue({ data: { unread_count: count } })
    const { signal } = new AbortController()

    await expect(loadUnreadNotificationCount(request, signal)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  },
)

it('lets both failures from the shared authenticated client reach the caller', async () => {
  const failure = new ApiError('Too many requests.', { status: 429, retryAfter: '10' })
  const request = vi.fn().mockRejectedValue(failure)
  const { signal } = new AbortController()

  await expect(loadNotificationPage(request, firstPage, signal)).rejects.toBe(failure)
  await expect(loadUnreadNotificationCount(request, signal)).rejects.toBe(failure)
})
