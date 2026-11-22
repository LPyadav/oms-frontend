import { createCustomer, deactivateCustomer, getCustomer, updateCustomer } from '../api/customers'
import { useCatalogRecord } from './useCatalogRecord'

const profileFields = ['name', 'email', 'phone', 'address']

function makeDraft(customer = {}) {
  return Object.fromEntries(profileFields.map((field) => [field, customer[field] ?? '']))
}

function normalizeDraft(draft) {
  return Object.fromEntries(
    profileFields.map((field) => {
      const value = (draft[field] ?? '').trim()
      return [field, field === 'name' ? value : value || null]
    }),
  )
}

function preparePayload(draft, customer) {
  const values = normalizeDraft(draft)
  if (!values.name) return null
  if (!customer) return values

  const original = normalizeDraft(makeDraft(customer))
  return Object.fromEntries(
    Object.entries(values).filter(([field, value]) => value !== original[field]),
  )
}

export function useCustomerProfile({ request, customerId, canManage, signal }) {
  const { record: customer, ...state } = useCatalogRecord({
    id: customerId,
    canManage,
    signal,
    actions: {
      load: (id, signal) => getCustomer(request, id, signal),
      create: (body, signal) => createCustomer(request, body, signal),
      edit: (id, body, signal) => updateCustomer(request, id, body, signal),
      deactivate: (id, signal) => deactivateCustomer(request, id, signal),
    },
    makeDraft,
    preparePayload,
  })

  return { ...state, customer }
}
