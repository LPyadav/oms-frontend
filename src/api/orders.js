import { ORDER_PRIORITY, ORDER_STATUS } from '../constants/orders'
import { readPaginatedResource } from './pagination'

function isParty(party) {
  return (
    Number.isSafeInteger(party?.id) &&
    party.id > 0 &&
    typeof party.name === 'string' &&
    !!party.name.trim()
  )
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}

function isOrder(order) {
  return (
    Number.isSafeInteger(order?.id) &&
    order.id > 0 &&
    typeof order.order_number === 'string' &&
    !!order.order_number.trim() &&
    isParty(order.customer) &&
    (order.assignee === null || isParty(order.assignee)) &&
    isCalendarDate(order.order_date) &&
    Object.hasOwn(ORDER_STATUS, order.status) &&
    Object.hasOwn(ORDER_PRIORITY, order.priority) &&
    typeof order.currency === 'string' &&
    /^[A-Z]{3}$/.test(order.currency) &&
    Number.isSafeInteger(order.grand_total_minor) &&
    order.grand_total_minor >= 0
  )
}

export async function loadOrderPage(request, query, signal) {
  const { page, search, status, priority, dateFrom, dateTo, sort, direction } = query
  const params = new URLSearchParams({ page: String(page), sort, direction })
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  if (priority) params.set('priority', priority)
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)

  const response = await request(`/api/orders?${params}`, { signal })
  return readPaginatedResource(response, {
    resource: 'orders',
    isEntry: isOrder,
    page,
    invalidMessage: 'The server returned an invalid order page.',
  })
}
