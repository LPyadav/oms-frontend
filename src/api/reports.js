import { ApiError } from './client'
import { isCalendarDate, isOrderSummary } from './orders'
import { readPaginatedResource } from './pagination'

const invalidFulfillment = 'The server returned an invalid Order Fulfillment report.'

function isCurrencyTotal(entry) {
  return (
    typeof entry?.currency === 'string' &&
    /^[A-Z]{3}$/.test(entry.currency) &&
    Number.isSafeInteger(entry.order_count) &&
    entry.order_count > 0 &&
    typeof entry.grand_total_minor === 'string' &&
    /^\d+$/.test(entry.grand_total_minor)
  )
}

function matchesOrderCount(totals, count) {
  const currencies = totals?.by_currency
  return (
    totals?.order_count === count &&
    Array.isArray(currencies) &&
    currencies.every(isCurrencyTotal) &&
    new Set(currencies.map(({ currency }) => currency)).size === currencies.length &&
    currencies.reduce((sum, { order_count }) => sum + order_count, 0) === count
  )
}

export async function loadOrderFulfillmentReport(request, query, signal) {
  const { page, perPage, dateFrom, dateTo, status, customerId, assigneeId } = query
  const params = new URLSearchParams({ page: String(page) })
  if (perPage) params.set('per_page', String(perPage))
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  if (status) params.set('status', status)
  if (customerId) params.set('customer_id', String(customerId))
  if (assigneeId) params.set('assignee_id', String(assigneeId))

  const response = await request('/api/reports/orders?' + params, { signal })
  const result = readPaginatedResource(response, {
    resource: 'orders',
    isEntry: isOrderSummary,
    page,
    invalidMessage: invalidFulfillment,
  })
  const { date_from, date_to, snapshot_at } = response.meta
  const { totals } = response.data

  if (
    !matchesOrderCount(totals, result.total) ||
    !isCalendarDate(date_from) ||
    !isCalendarDate(date_to) ||
    date_from > date_to ||
    typeof snapshot_at !== 'string' ||
    !Number.isFinite(Date.parse(snapshot_at))
  ) {
    throw new ApiError(invalidFulfillment, { code: 'INVALID_RESPONSE' })
  }

  return { ...result, totals, dateFrom: date_from, dateTo: date_to, snapshotAt: snapshot_at }
}
