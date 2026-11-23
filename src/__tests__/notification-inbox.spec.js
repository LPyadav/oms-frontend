import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive } from 'vue'
import { ApiError } from '../api/client'
import { useNotificationInbox } from '../composables/useNotificationInbox'
import { useNotificationBadgeStore } from '../stores/notificationBadge'

const request = vi.fn()
const auth = reactive({ canViewOrders: true, user: { id: 1 }, request })
vi.mock('../stores/auth', () => ({ useAuthStore: () => auth }))

const timestamp = '2026-11-22T08:00:00Z'
const notification = {
  id: 18,
  order_id: 42,
  order_number: 'ORD-42',
  event_type: 'order.assigned',
  read_at: null,
  created_at: timestamp,
}
const readNotification = { ...notification, read_at: timestamp }
const list = (notifications, page = 1, lastPage = 1) => ({
  data: { notifications },
  meta: {
    current_page: page,
    per_page: 1,
    total: lastPage === 1 ? notifications.length : lastPage,
    last_page: lastPage,
  },
})
const count = (unread) => ({ data: { unread_count: unread } })
const methods = () => request.mock.calls.map(([url, options]) => [url, options.method ?? 'GET'])

let pinia
let scope
beforeEach(() => {
  request.mockReset()
  auth.canViewOrders = true
  auth.user = { id: 1 }
  pinia = createPinia()
  setActivePinia(pinia)
  scope = effectScope()
})
afterEach(() => {
  scope.stop()
  disposePinia(pinia)
})

describe('notification read actions', () => {
  it('refreshes the selected filter and shared badge after a single read', async () => {
    request
      .mockResolvedValueOnce(list([notification]))
      .mockResolvedValueOnce({ data: { notification: readNotification } })
      .mockResolvedValueOnce(list([]))
      .mockResolvedValueOnce(count(0))
    const inbox = scope.run(useNotificationInbox)
    await inbox.setStatus('unread')

    await expect(inbox.markRead(18)).resolves.toBe(true)

    expect(inbox.page.value.notifications).toEqual([])
    expect(inbox.unreadCount.value).toBe(0)
    expect(inbox.actionNotice.value).toBe('Notification marked as read.')
    expect(methods()).toEqual([
      ['/api/notifications?page=1&per_page=10&status=unread', 'GET'],
      ['/api/notifications/18/read', 'PATCH'],
      ['/api/notifications?page=1&per_page=10&status=unread', 'GET'],
      ['/api/notifications/unread-count', 'GET'],
    ])
  })

  it('serializes read actions and recovers to the last valid unread page', async () => {
    const bulk = Promise.withResolvers()
    request
      .mockResolvedValueOnce(list([notification], 1, 2))
      .mockResolvedValueOnce(list([notification], 2, 2))
      .mockReturnValueOnce(bulk.promise)
      .mockResolvedValueOnce(list([], 2))
      .mockResolvedValueOnce(count(0))
      .mockResolvedValueOnce(list([]))
    const inbox = scope.run(useNotificationInbox)
    await inbox.setStatus('unread')
    await inbox.changePage(2)

    const pending = inbox.markAllRead()
    expect(inbox.pendingAction.value).toBe('all')
    await expect(inbox.markRead(18)).resolves.toBe(false)
    bulk.resolve({ data: { marked_count: 2 } })
    await expect(pending).resolves.toBe(true)

    expect(inbox.page.value.currentPage).toBe(1)
    expect(inbox.unreadCount.value).toBe(0)
    expect(inbox.pendingAction.value).toBeNull()
    expect(methods().slice(2)).toEqual([
      ['/api/notifications/read-all', 'PATCH'],
      ['/api/notifications?page=2&per_page=10&status=unread', 'GET'],
      ['/api/notifications/unread-count', 'GET'],
      ['/api/notifications?page=1&per_page=10&status=unread', 'GET'],
    ])
  })

  it('reconciles the inbox and badge when a notification is out of scope', async () => {
    request
      .mockResolvedValueOnce(list([notification]))
      .mockRejectedValueOnce(new ApiError('Not found.', { status: 404 }))
      .mockResolvedValueOnce(list([]))
      .mockResolvedValueOnce(count(0))
    const inbox = scope.run(useNotificationInbox)
    await inbox.load()

    await expect(inbox.markRead(18)).resolves.toBe(false)

    expect(inbox.page.value.notifications).toEqual([])
    expect(inbox.unreadCount.value).toBe(0)
    expect(inbox.actionNotice.value).toBe('This notification is no longer available.')
    expect(methods().slice(1)).toEqual([
      ['/api/notifications/18/read', 'PATCH'],
      ['/api/notifications?page=1&per_page=10', 'GET'],
      ['/api/notifications/unread-count', 'GET'],
    ])
  })

  it('reconciles an ambiguous bulk failure with reads and never repeats the write', async () => {
    request
      .mockRejectedValueOnce(new ApiError('Timed out.', { code: 'REQUEST_TIMEOUT' }))
      .mockResolvedValueOnce(list([readNotification]))
      .mockResolvedValueOnce(count(0))
    const inbox = scope.run(useNotificationInbox)

    await expect(inbox.markAllRead()).resolves.toBe(false)

    expect(inbox.actionError.value).toBe('Could not confirm the read update.')
    expect(inbox.unreadCount.value).toBe(0)
    expect(inbox.page.value.notifications).toEqual([readNotification])
    expect(methods()).toEqual([
      ['/api/notifications/read-all', 'PATCH'],
      ['/api/notifications?page=1&per_page=10', 'GET'],
      ['/api/notifications/unread-count', 'GET'],
    ])
  })
})

it('discards an old account badge response after the viewer changes', async () => {
  const older = Promise.withResolvers()
  request.mockReturnValueOnce(older.promise).mockResolvedValueOnce(count(2))
  const badge = useNotificationBadgeStore()
  const pending = badge.refreshUnreadCount()
  const signal = request.mock.calls[0][1].signal

  auth.user = { id: 2 }
  expect(signal.aborted).toBe(true)
  expect(badge.unreadCount).toBeNull()
  await badge.refreshUnreadCount()
  older.resolve(count(9))
  await pending

  expect(badge.unreadCount).toBe(2)
  auth.canViewOrders = false
  expect(badge.unreadCount).toBeNull()
})
