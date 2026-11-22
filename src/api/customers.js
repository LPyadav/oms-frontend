import { ApiError } from './client'
import { loadCatalogPage } from './catalogDirectory'

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
