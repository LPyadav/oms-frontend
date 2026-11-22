import { ApiError } from './client'

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

export async function loadCustomerPage(request, { page, search, isActive }, signal) {
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set('search', search)
  if (isActive !== null) params.set('is_active', isActive ? '1' : '0')

  const { data, meta } = await request(customersPath + '?' + params, { signal })
  if (
    !Array.isArray(data?.customers) ||
    !data.customers.every(isCustomer) ||
    meta?.current_page !== page ||
    !Number.isSafeInteger(meta.per_page) ||
    meta.per_page < 1 ||
    !Number.isSafeInteger(meta.total) ||
    meta.total < 0 ||
    !Number.isSafeInteger(meta.last_page) ||
    meta.last_page < 1
  ) {
    throw new ApiError('The server returned an invalid customer list.', {
      code: 'INVALID_RESPONSE',
    })
  }

  return {
    customers: data.customers,
    currentPage: meta.current_page,
    perPage: meta.per_page,
    total: meta.total,
    lastPage: meta.last_page,
  }
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
