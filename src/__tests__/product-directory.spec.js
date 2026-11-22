import { expect, it, vi } from 'vitest'
import { loadProductPage } from '../api/products'

const product = {
  id: 15,
  name: 'Shipping tape',
  sku: 'TAPE_100%',
  price: '24.50',
  tax_rate: '0.00',
  stock_quantity: 0,
  stock_version: 0,
  is_active: false,
}

function envelope(products = [product], pagination = {}) {
  return {
    data: { products },
    meta: { current_page: 1, per_page: 25, total: 1, last_page: 1, ...pagination },
  }
}

it('combines literal SKU search, inactive filtering and one-based pagination', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(
      envelope([product], { current_page: 2, per_page: 3, total: 4, last_page: 2 }),
    )
  const { signal } = new AbortController()

  await expect(
    loadProductPage(request, { page: 2, search: 'TAPE_100%', isActive: false }, signal),
  ).resolves.toEqual({ products: [product], currentPage: 2, perPage: 3, total: 4, lastPage: 2 })
  expect(request).toHaveBeenCalledExactlyOnceWith(
    '/api/products?page=2&search=TAPE_100%25&is_active=0',
    { signal },
  )
})

it('omits all-status and empty search parameters and retains configured page size', async () => {
  const request = vi.fn().mockResolvedValueOnce(envelope([product], { per_page: 3 }))

  const page = await loadProductPage(request, { page: 1, search: '', isActive: null })

  expect(page.perPage).toBe(3)
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/products?page=1', { signal: undefined })
})

it('uses the active status flag and retains out-of-range paging metadata', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(envelope([], { current_page: 3, per_page: 3, total: 4, last_page: 2 }))

  const page = await loadProductPage(request, { page: 3, search: '', isActive: true })

  expect(page).toEqual({ products: [], currentPage: 3, perPage: 3, total: 4, lastPage: 2 })
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/products?page=3&is_active=1', {
    signal: undefined,
  })
})

it.each([
  envelope([{ ...product, price: 24.5 }]),
  envelope([{ ...product, tax_rate: '0%' }]),
  envelope([{ ...product, stock_quantity: -1 }]),
  envelope([{ ...product, stock_version: '1' }]),
  envelope([{ ...product, is_active: 'false' }]),
  envelope([{ ...product, sku: '' }]),
  envelope([product], { per_page: 0 }),
  envelope([product], { current_page: 2 }),
  { data: { customers: [] }, meta: envelope().meta },
])('rejects a malformed products response (%j)', async (response) => {
  const request = vi.fn().mockResolvedValueOnce(response)

  await expect(
    loadProductPage(request, { page: 1, search: '', isActive: null }),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})
