import { ApiError } from './client'
import { loadCatalogPage } from './catalogDirectory'

const productsPath = '/api/products'
const fixedDecimal = /^\d+\.\d{2}$/

function isProduct(product) {
  return (
    Number.isSafeInteger(product?.id) &&
    product.id > 0 &&
    typeof product.name === 'string' &&
    product.name.trim().length > 0 &&
    typeof product.sku === 'string' &&
    product.sku.trim().length > 0 &&
    typeof product.price === 'string' &&
    fixedDecimal.test(product.price) &&
    typeof product.tax_rate === 'string' &&
    fixedDecimal.test(product.tax_rate) &&
    Number.isSafeInteger(product.stock_quantity) &&
    product.stock_quantity >= 0 &&
    Number.isSafeInteger(product.stock_version) &&
    product.stock_version >= 0 &&
    typeof product.is_active === 'boolean'
  )
}

export function loadProductPage(request, query, signal) {
  return loadCatalogPage(request, { resource: 'products', isEntry: isProduct }, query, signal)
}

async function requestProduct(request, path, options, { id, active } = {}) {
  const response = await request(path, options)
  const product = response?.data?.product
  if (
    !isProduct(product) ||
    (id !== undefined && product.id !== id) ||
    (active !== undefined && product.is_active !== active)
  ) {
    throw new ApiError('The server returned invalid product details.', {
      code: 'INVALID_RESPONSE',
    })
  }

  return product
}

export function getProduct(request, id, signal) {
  return requestProduct(request, `${productsPath}/${id}`, { signal }, { id })
}

export function createProduct(request, body, signal) {
  return requestProduct(request, productsPath, { method: 'POST', body, signal }, { active: true })
}

export function updateProduct(request, id, body, signal) {
  return requestProduct(request, `${productsPath}/${id}`, { method: 'PATCH', body, signal }, { id })
}

export function deactivateProduct(request, id, signal) {
  return requestProduct(
    request,
    `${productsPath}/${id}/deactivate`,
    { method: 'PATCH', signal },
    { id, active: false },
  )
}
