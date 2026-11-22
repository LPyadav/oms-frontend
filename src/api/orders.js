import { ORDER_PRIORITY, ORDER_STATUS } from '../constants/orders'
import { ApiError } from './client'
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

const detailMoneyFields = ['subtotal_minor', 'discount_total_minor', 'tax_total_minor']
const itemMoneyFields = [
  'unit_price_minor',
  'item_discount_minor',
  'allocated_order_discount_minor',
  'tax_minor',
  'line_total_minor',
]

const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0
const nonnegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0
const nullableText = (value) => value === null || typeof value === 'string'
const namedText = (value) => typeof value === 'string' && !!value.trim()
const isTimestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const historyEntry = (entry) => positiveInteger(entry?.id) && isTimestamp(entry.created_at)
const actor = (value) => value === null || isParty(value)
const nullableId = (value) => value === null || positiveInteger(value)
const validEntries = (values, validate) => Array.isArray(values) && values.every(validate)

function isItem(item) {
  return (
    positiveInteger(item?.position) &&
    positiveInteger(item.quantity) &&
    namedText(item.product_name) &&
    namedText(item.product_sku) &&
    nonnegativeInteger(item.tax_rate_basis_points) &&
    itemMoneyFields.every((field) => nonnegativeInteger(item[field])) &&
    Number.isSafeInteger(item.item_discount_minor + item.allocated_order_discount_minor)
  )
}

function isStatusEntry(entry) {
  return (
    historyEntry(entry) &&
    Object.hasOwn(ORDER_STATUS, entry.previous_status) &&
    Object.hasOwn(ORDER_STATUS, entry.new_status) &&
    nullableText(entry.remarks) &&
    actor(entry.actor)
  )
}

function isNote(entry) {
  return historyEntry(entry) && typeof entry.body === 'string' && actor(entry.author)
}

function isAssignment(entry) {
  return (
    historyEntry(entry) &&
    nullableId(entry.previous_assignee_id) &&
    nullableId(entry.new_assignee_id) &&
    positiveInteger(entry.actor_id) &&
    nullableText(entry.actor_name)
  )
}

function isSystemActivity(entry) {
  return (
    historyEntry(entry) &&
    namedText(entry.action) &&
    positiveInteger(entry.actor_id) &&
    nullableText(entry.actor_name)
  )
}

function isOrderDetail(order) {
  return (
    isOrder(order) &&
    detailMoneyFields.every((field) => nonnegativeInteger(order[field])) &&
    ['email', 'phone', 'address'].every((field) => nullableText(order.customer[field])) &&
    (order.created_at === null || isTimestamp(order.created_at)) &&
    (order.completed_at === null || isTimestamp(order.completed_at)) &&
    validEntries(order.items, isItem) &&
    validEntries(order.notes, isNote) &&
    validEntries(order.status_history, isStatusEntry) &&
    validEntries(order.assignment_history, isAssignment) &&
    validEntries(order.system_activity, isSystemActivity)
  )
}

export async function loadOrder(request, orderId, signal) {
  const id = Number(orderId)
  if (!/^\d+$/.test(String(orderId)) || !positiveInteger(id)) {
    throw new ApiError('This order is unavailable.', { status: 404 })
  }

  const response = await request(`/api/orders/${id}`, { signal })
  const order = response?.data?.order
  if (!isOrderDetail(order) || order.id !== id) {
    throw new ApiError('The server returned invalid order details.', { code: 'INVALID_RESPONSE' })
  }

  return order
}
