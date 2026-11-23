import { ORDER_PRIORITY, ORDER_STATUS } from '../constants/orders'
import { ApiError } from './client'

const isCount = (value) => Number.isSafeInteger(value) && value >= 0
const isOptionalCount = (value) => value === null || isCount(value)
const isCurrency = (value) => typeof value === 'string' && /^[A-Z]{3}$/.test(value)
const isRevenue = (value) => typeof value === 'string' && /^\d+$/.test(value)
const isText = (value) => typeof value === 'string' && value.trim().length > 0
const isArrayOf = (value, predicate) => Array.isArray(value) && value.every(predicate)

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}

function isFinancialMetric(metric) {
  return (
    isCurrency(metric?.currency) &&
    isCount(metric.completed_orders) &&
    isRevenue(metric.total_revenue_minor) &&
    isCount(metric.average_order_value_minor)
  )
}

function isRecentOrder(order) {
  return (
    Number.isSafeInteger(order?.id) &&
    order.id > 0 &&
    isText(order.order_number) &&
    isCalendarDate(order.order_date) &&
    Object.hasOwn(ORDER_STATUS, order.status) &&
    Object.hasOwn(ORDER_PRIORITY, order.priority) &&
    isCurrency(order.currency) &&
    isCount(order.grand_total_minor)
  )
}

function isOverview(data) {
  return (
    isCount(data?.total_orders) &&
    Object.keys(ORDER_STATUS).every((status) => isCount(data.orders_by_status?.[status])) &&
    isOptionalCount(data.total_customers) &&
    isOptionalCount(data.total_products) &&
    isArrayOf(data.financial_metrics, isFinancialMetric) &&
    data.financial_metrics.length > 0 &&
    isArrayOf(data.recent_orders, isRecentOrder)
  )
}

function isPoint(point) {
  return (
    isCalendarDate(point?.period_start) &&
    isCalendarDate(point.period_end) &&
    point.period_start <= point.period_end &&
    isRevenue(point.revenue_minor) &&
    isCount(point.completed_orders)
  )
}

function isSeries(series) {
  return (
    isCurrency(series?.currency) && isArrayOf(series.points, isPoint) && series.points.length > 0
  )
}

function isTrend(data, group) {
  return (
    data?.group_by === group &&
    isText(data.timezone) &&
    isCalendarDate(data.date_from) &&
    isCalendarDate(data.date_to) &&
    data.date_from <= data.date_to &&
    isArrayOf(data.series, isSeries) &&
    data.series.length > 0
  )
}

export async function loadDashboardOverview(request, signal) {
  const response = await request('/api/dashboard', { signal })
  const data = response?.data

  if (!isOverview(data)) {
    throw new ApiError('The server returned an invalid dashboard overview.', {
      code: 'INVALID_RESPONSE',
    })
  }

  return data
}

export async function loadDashboardTrend(
  request,
  { group = 'day', dateFrom, dateTo } = {},
  signal,
) {
  const params = new URLSearchParams({ group_by: group })
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)

  const response = await request('/api/dashboard/revenue-trend?' + params, { signal })
  const data = response?.data

  if (!isTrend(data, group)) {
    throw new ApiError('The server returned an invalid revenue trend.', {
      code: 'INVALID_RESPONSE',
    })
  }

  return data
}
