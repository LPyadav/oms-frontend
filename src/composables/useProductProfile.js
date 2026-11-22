import { createProduct, deactivateProduct, getProduct, updateProduct } from '../api/products'
import { useCatalogRecord } from './useCatalogRecord'

function makeDraft({ name = '', sku = '', price = '', tax_rate = '' } = {}) {
  return { name, sku, price, tax_rate }
}

function decimalKey(value) {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) return value

  const [whole, fraction = ''] = value.split('.')
  return whole.replace(/^0+(?=\d)/, '') + '.' + fraction.padEnd(2, '0')
}

function comparable(field, value) {
  if (field === 'price' || field === 'tax_rate') return decimalKey(value)
  if (field === 'sku' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) return value.toUpperCase()
  return value
}

function preparePayload(draft, product) {
  const name = draft.name.trim()
  const sku = draft.sku.trim()
  const price = draft.price.trim()
  const taxRate = draft.tax_rate.trim()
  if (!name || !sku || !price || (product && !taxRate)) return null

  const values = { name, sku, price, ...(taxRate && { tax_rate: taxRate }) }
  if (!product) return values

  return Object.fromEntries(
    Object.entries(values).filter(
      ([field, value]) => comparable(field, value) !== comparable(field, product[field].trim()),
    ),
  )
}

export function useProductProfile({ request, productId, canManage, signal }) {
  const { record: product, ...state } = useCatalogRecord({
    id: productId,
    canManage,
    signal,
    actions: {
      load: (id, signal) => getProduct(request, id, signal),
      create: (body, signal) => createProduct(request, body, signal),
      edit: (id, body, signal) => updateProduct(request, id, body, signal),
      deactivate: (id, signal) => deactivateProduct(request, id, signal),
    },
    makeDraft,
    preparePayload,
  })

  return { ...state, product }
}
