import { SALES_TAX_AMOUNTS } from '../constants/reports'
import { isReportTimeZone } from '../utils/reportDates'
import { ApiError } from './client'
import { isCalendarDate, isOrderSummary } from './orders'
import { readPaginatedResource } from './pagination'

const invalidFulfillment = 'The server returned an invalid Order Fulfillment report.'
const invalidSalesTax = 'The server returned an invalid Sales & Tax report.'
const salesAmountFields = Object.keys(SALES_TAX_AMOUNTS)

const isCount = (value) => Number.isSafeInteger(value) && value >= 0
const isPositiveId = (value) => isCount(value) && value > 0
const isText = (value) => typeof value === 'string' && !!value.trim()
const isCurrency = (value) => typeof value === 'string' && /^[A-Z]{3}$/.test(value)
const isExactMinor = (value) => typeof value === 'string' && /^\d+$/.test(value)
const isTimestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))

function isSalesOrder(order) {
  return (
    isPositiveId(order?.id) &&
    isText(order.order_number) &&
    isTimestamp(order.completed_at) &&
    isPositiveId(order.customer?.id) &&
    isText(order.customer.name) &&
    isCurrency(order.currency) &&
    salesAmountFields.every((field) => isCount(order[field]))
  )
}

function matchesOrderCount(totals, count, amountFields) {
  const currencies = totals?.by_currency
  return (
    totals?.order_count === count &&
    Array.isArray(currencies) &&
    currencies.every(
      (entry) =>
        isCurrency(entry?.currency) &&
        isPositiveId(entry.order_count) &&
        amountFields.every((field) => isExactMinor(entry[field])),
    ) &&
    new Set(currencies.map(({ currency }) => currency)).size === currencies.length &&
    currencies.reduce((sum, { order_count }) => sum + order_count, 0) === count
  )
}

function reportParams({ page, perPage, dateFrom, dateTo }, filters) {
  const params = new URLSearchParams({ page: String(page) })
  const optional = { per_page: perPage, date_from: dateFrom, date_to: dateTo, ...filters }

  for (const [field, value] of Object.entries(optional)) {
    if (value) params.set(field, String(value))
  }

  return params
}

function readReport(response, { page, isEntry, amountFields, invalidMessage }) {
  const result = readPaginatedResource(response, {
    resource: 'orders',
    isEntry,
    page,
    invalidMessage,
  })
  const { date_from, date_to, snapshot_at } = response.meta
  const { totals } = response.data

  if (
    !matchesOrderCount(totals, result.total, amountFields) ||
    !isCalendarDate(date_from) ||
    !isCalendarDate(date_to) ||
    date_from > date_to ||
    !isTimestamp(snapshot_at)
  ) {
    throw new ApiError(invalidMessage, { code: 'INVALID_RESPONSE' })
  }

  return { ...result, totals, dateFrom: date_from, dateTo: date_to, snapshotAt: snapshot_at }
}

export async function loadOrderFulfillmentReport(request, query, signal) {
  const params = reportParams(query, {
    status: query.status,
    customer_id: query.customerId,
    assignee_id: query.assigneeId,
  })
  const response = await request('/api/reports/orders?' + params, { signal })

  return readReport(response, {
    page: query.page,
    isEntry: isOrderSummary,
    amountFields: ['grand_total_minor'],
    invalidMessage: invalidFulfillment,
  })
}

export async function loadSalesTaxReport(request, query, signal) {
  const params = reportParams(query, { customer_id: query.customerId, product_id: query.productId })
  const response = await request('/api/reports/sales-tax?' + params, { signal })
  const result = readReport(response, {
    page: query.page,
    isEntry: isSalesOrder,
    amountFields: salesAmountFields,
    invalidMessage: invalidSalesTax,
  })
  const { timezone } = response.meta

  if (!isReportTimeZone(timezone)) {
    throw new ApiError(invalidSalesTax, { code: 'INVALID_RESPONSE' })
  }

  return { ...result, timezone }
}
