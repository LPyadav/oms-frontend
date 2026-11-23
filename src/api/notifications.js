import { ApiError } from './client'
import { readPaginatedResource } from './pagination'

const notificationsPath = '/api/notifications'

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isTimestamp(value) {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value))
}

function isNotification(notification) {
  return (
    isPositiveInteger(notification?.id) &&
    isPositiveInteger(notification.order_id) &&
    isNonEmptyString(notification.order_number) &&
    isNonEmptyString(notification.event_type) &&
    (notification.read_at === null || isTimestamp(notification.read_at)) &&
    isTimestamp(notification.created_at)
  )
}

export async function loadNotificationPage(request, { page, status = null }, signal) {
  const params = new URLSearchParams({ page: String(page) })
  if (status !== null) params.set('status', status)

  const response = await request(`${notificationsPath}?${params}`, { signal })
  return readPaginatedResource(response, {
    resource: 'notifications',
    isEntry: isNotification,
    page,
    invalidMessage: 'The server returned an invalid notifications page.',
  })
}

export async function loadUnreadNotificationCount(request, signal) {
  const response = await request(`${notificationsPath}/unread-count`, { signal })
  const count = response?.data?.unread_count
  if (!isNonNegativeInteger(count)) {
    throw new ApiError('The server returned an invalid unread notifications count.', {
      code: 'INVALID_RESPONSE',
    })
  }

  return count
}
