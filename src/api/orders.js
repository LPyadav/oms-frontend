import {
  FIRST_ORDER_PAGE,
  MAX_TAX_RATE_BASIS_POINTS,
  ORDER_PRIORITY,
  ORDER_STATUS,
} from '../constants/orders'
import { isCsvBlob } from '../utils/csv'
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

function isOrderAssignee(assignee) {
  return (
    isParty(assignee) &&
    ((assignee.email === undefined && assignee.roles === undefined) ||
      (namedText(assignee.email) && validEntries(assignee.roles, namedText)))
  )
}

export function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}

export function isOrderSummary(order) {
  return (
    Number.isSafeInteger(order?.id) &&
    order.id > 0 &&
    typeof order.order_number === 'string' &&
    !!order.order_number.trim() &&
    isParty(order.customer) &&
    (order.assignee === null || isOrderAssignee(order.assignee)) &&
    isCalendarDate(order.order_date) &&
    Object.hasOwn(ORDER_STATUS, order.status) &&
    Object.hasOwn(ORDER_PRIORITY, order.priority) &&
    typeof order.currency === 'string' &&
    /^[A-Z]{3}$/.test(order.currency) &&
    Number.isSafeInteger(order.grand_total_minor) &&
    order.grand_total_minor >= 0
  )
}

function orderSearchParams(query) {
  const { search, status, priority, customerId, assigneeId, dateFrom, dateTo, sort, direction } =
    query
  const params = new URLSearchParams()
  if (query.page !== undefined) params.set('page', String(query.page))
  params.set('sort', sort)
  params.set('direction', direction)
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  if (priority) params.set('priority', priority)
  if (positiveInteger(customerId)) params.set('customer_id', String(customerId))
  if (positiveInteger(assigneeId)) params.set('assignee_id', String(assigneeId))
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  return params
}

export async function loadOrderPage(request, query, signal) {
  const response = await request(`/api/orders?${orderSearchParams(query)}`, { signal })
  return readPaginatedResource(response, {
    resource: 'orders',
    isEntry: isOrderSummary,
    page: query.page,
    invalidMessage: 'The server returned an invalid order page.',
  })
}

export async function loadOrdersCsv(request, query, signal) {
  const params = orderSearchParams(query)
  params.delete('page')
  const csv = await request(`/api/orders/export?${params}`, { responseType: 'blob', signal })
  if (!isCsvBlob(csv)) {
    throw new ApiError('The server returned an invalid order export.', { code: 'INVALID_RESPONSE' })
  }

  return csv
}

function partySearchKey(value) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export async function loadOrderFilterPartyPage(request, party, { page, search }, signal) {
  const { orders, lastPage } = await loadOrderPage(
    request,
    { ...FIRST_ORDER_PAGE, page, search },
    signal,
  )
  const term = partySearchKey(search ?? '')
  const parties = new Map()

  for (const order of orders) {
    const choice = order[party]
    if (choice && partySearchKey(choice.name).includes(term)) {
      parties.set(choice.id, { id: choice.id, name: choice.name })
    }
  }

  return { parties: [...parties.values()], lastPage }
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
const isTaxRate = (value) => nonnegativeInteger(value) && value <= MAX_TAX_RATE_BASIS_POINTS
const isOrderTaxRate = (value) => value == null || isTaxRate(value)
const confirmsTaxRate = (result, requested) =>
  requested === undefined || result.order_tax_rate_basis_points === requested
const validEntries = (values, validate) => Array.isArray(values) && values.every(validate)

function isItem(item) {
  return (
    positiveInteger(item?.position) &&
    positiveInteger(item.product_id) &&
    positiveInteger(item.quantity) &&
    namedText(item.product_name) &&
    namedText(item.product_sku) &&
    isTaxRate(item.tax_rate_basis_points) &&
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
    isOrderSummary(order) &&
    positiveInteger(order.version) &&
    nonnegativeInteger(order.order_discount_minor) &&
    isOrderTaxRate(order.order_tax_rate_basis_points) &&
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

function orderPath(orderId) {
  const id = Number(orderId)
  if (!/^\d+$/.test(String(orderId)) || !positiveInteger(id)) {
    throw new ApiError('This order is unavailable.', { status: 404 })
  }

  return `/api/orders/${id}`
}

function readOrder(response, id) {
  const order = response?.data?.order
  if (!isOrderDetail(order) || order.id !== id) {
    throw new ApiError('The server returned invalid order details.', { code: 'INVALID_RESPONSE' })
  }

  return order
}

export async function loadOrder(request, orderId, signal) {
  const response = await request(orderPath(orderId), { signal })
  return readOrder(response, Number(orderId))
}

export function loadOrderAssigneePage(request, { page, search }, signal) {
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set('search', search)

  return request(`/api/orders/assignees?${params}`, { signal }).then((response) =>
    readPaginatedResource(response, {
      resource: 'assignees',
      isEntry: isOrderAssignee,
      page,
      invalidMessage: 'The server returned an invalid assignee page.',
    }),
  )
}

export async function previewOrderPricing(
  request,
  { order_id, items, order_discount_minor, order_tax_rate_basis_points },
  signal,
) {
  const response = await request('/api/orders/preview', {
    method: 'POST',
    body: {
      ...(order_id !== undefined && { order_id }),
      items,
      order_discount_minor,
      ...(order_tax_rate_basis_points !== undefined && { order_tax_rate_basis_points }),
    },
    signal,
  })
  const pricing = response?.data?.pricing
  if (
    typeof pricing?.currency !== 'string' ||
    !/^[A-Z]{3}$/.test(pricing.currency) ||
    ![...detailMoneyFields, 'grand_total_minor', 'order_discount_minor'].every((field) =>
      nonnegativeInteger(pricing[field]),
    ) ||
    pricing.order_discount_minor !== order_discount_minor ||
    !isOrderTaxRate(pricing.order_tax_rate_basis_points) ||
    !confirmsTaxRate(pricing, order_tax_rate_basis_points) ||
    !validEntries(pricing.items, isItem) ||
    pricing.items.length !== items.length ||
    !pricing.items.every(
      (line, index) =>
        line.product_id === items[index].product_id &&
        line.quantity === items[index].quantity &&
        line.item_discount_minor === items[index].item_discount_minor &&
        (pricing.order_tax_rate_basis_points == null ||
          line.tax_rate_basis_points === pricing.order_tax_rate_basis_points) &&
        (items[index].tax_rate_basis_points === undefined ||
          line.tax_rate_basis_points === items[index].tax_rate_basis_points),
    )
  ) {
    throw new ApiError('The server returned invalid order pricing.', { code: 'INVALID_RESPONSE' })
  }

  return pricing
}

export async function createOrder(request, body, idempotencyKey, signal) {
  const response = await request('/api/orders', {
    method: 'POST',
    body,
    idempotencyKey,
    signal,
  })
  const order = response?.data?.order
  if (!isOrderDetail(order)) {
    throw new ApiError('The server returned an invalid saved order.', { code: 'INVALID_RESPONSE' })
  }

  return order
}

export async function updateOrder(request, orderId, body, signal) {
  const response = await request(orderPath(orderId), { method: 'PATCH', body, signal })
  const order = readOrder(response, Number(orderId))
  if (!confirmsTaxRate(order, body.order_tax_rate_basis_points)) {
    throw new ApiError('The server did not confirm the order tax rate.', {
      code: 'INVALID_RESPONSE',
    })
  }

  return order
}

export async function deleteOrder(request, orderId, version, signal) {
  const params = new URLSearchParams({ expected_version: String(version) })
  const response = await request(`${orderPath(orderId)}?${params}`, { method: 'DELETE', signal })
  if (response?.data !== null) {
    throw new ApiError('The server did not confirm the deletion.', { code: 'INVALID_RESPONSE' })
  }
}

export async function changeOrderStatus(request, orderId, body, signal) {
  const response = await request(`${orderPath(orderId)}/status`, { method: 'POST', body, signal })
  const updated = readOrder(response, Number(orderId))
  if (updated.status !== body.status || updated.version !== body.expected_version + 1) {
    throw new ApiError('The server did not confirm the requested status change.', {
      code: 'INVALID_RESPONSE',
    })
  }

  return updated
}

export async function assignOrder(request, orderId, body, signal) {
  const response = await request(`${orderPath(orderId)}/assign`, { method: 'POST', body, signal })
  const updated = readOrder(response, Number(orderId))
  const assigneeId = updated.assignee?.id ?? null
  if (
    assigneeId !== body.assignee_id ||
    ![body.expected_version, body.expected_version + 1].includes(updated.version)
  ) {
    throw new ApiError('The server did not confirm the requested assignment.', {
      code: 'INVALID_RESPONSE',
    })
  }

  return updated
}

export async function addOrderNote(request, orderId, body, signal) {
  const response = await request(`${orderPath(orderId)}/notes`, {
    method: 'POST',
    body: { body },
    signal,
  })
  const note = response?.data?.note
  if (!isNote(note) || note.body !== body) {
    throw new ApiError('The server did not confirm the note.', { code: 'INVALID_RESPONSE' })
  }

  return note
}
