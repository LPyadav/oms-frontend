import { ORDER_STATUS } from '../constants/orders'
import { loadCatalogPage } from './catalogDirectory'
import { ApiError } from './client'
import { isCalendarDate } from './orders'

const customersPath = '/api/customers'

function isCustomer(customer) {
  return (
    Number.isSafeInteger(customer?.id) &&
    customer.id > 0 &&
    typeof customer.name === 'string' &&
    customer.name.trim().length > 0 &&
    typeof customer.is_active === 'boolean' &&
    ['email', 'phone', 'address'].every(
      (field) => customer[field] === null || typeof customer[field] === 'string',
    )
  )
}

export function loadCustomerPage(request, query, signal) {
  return loadCatalogPage(request, { resource: 'customers', isEntry: isCustomer }, query, signal)
}

async function requestCustomer(request, path, options, { id, active } = {}) {
  const response = await request(path, options)
  const customer = response?.data?.customer
  if (
    !isCustomer(customer) ||
    (id !== undefined && customer.id !== id) ||
    (active !== undefined && customer.is_active !== active)
  ) {
    throw new ApiError('The server returned an invalid customer profile.', {
      code: 'INVALID_RESPONSE',
    })
  }

  return customer
}

export function getCustomer(request, id, signal) {
  return requestCustomer(request, `${customersPath}/${id}`, { signal }, { id })
}

const nonnegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0
const currencyCode = (value) => typeof value === 'string' && /^[A-Z]{3}$/.test(value)
const countFields = ['total_orders', 'pending_orders', 'completed_orders', 'cancelled_orders']

function isCurrencyTotal(total) {
  return (
    currencyCode(total?.currency) &&
    typeof total.total_minor === 'string' &&
    /^(?:0|[1-9]\d*)$/.test(total.total_minor)
  )
}

function isRecentOrder(order) {
  return (
    Number.isSafeInteger(order?.id) &&
    order.id > 0 &&
    typeof order.order_number === 'string' &&
    !!order.order_number.trim() &&
    isCalendarDate(order.order_date) &&
    Object.hasOwn(ORDER_STATUS, order.status) &&
    currencyCode(order.currency) &&
    nonnegativeInteger(order.grand_total_minor)
  )
}

export async function loadCustomerOrderSummary(request, id, signal) {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ApiError('This customer is unavailable.', { status: 404 })
  }

  const response = await request(`${customersPath}/${id}/order-summary`, { signal })
  const summary = response?.data?.order_summary
  if (
    !summary ||
    !countFields.every((field) => nonnegativeInteger(summary[field])) ||
    !Array.isArray(summary.total_value_by_currency) ||
    !summary.total_value_by_currency.every(isCurrencyTotal) ||
    !Array.isArray(summary.recent_orders) ||
    summary.recent_orders.length > 5 ||
    !summary.recent_orders.every(isRecentOrder)
  ) {
    throw new ApiError('The server returned an invalid customer order summary.', {
      code: 'INVALID_RESPONSE',
    })
  }

  return summary
}

export function createCustomer(request, body, signal) {
  return requestCustomer(request, customersPath, { method: 'POST', body, signal }, { active: true })
}

export function updateCustomer(request, id, body, signal) {
  return requestCustomer(
    request,
    `${customersPath}/${id}`,
    { method: 'PATCH', body, signal },
    { id },
  )
}

export function deactivateCustomer(request, id, signal) {
  return requestCustomer(
    request,
    `${customersPath}/${id}/deactivate`,
    { method: 'PATCH', signal },
    { id, active: false },
  )
}
