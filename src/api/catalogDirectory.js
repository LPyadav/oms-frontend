import { ApiError } from './client'

export async function loadCatalogPage(request, { resource, isEntry }, query, signal) {
  const { page, search, isActive } = query
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set('search', search)
  if (isActive !== null) params.set('is_active', isActive ? '1' : '0')

  const response = await request(`/api/${resource}?${params}`, { signal })
  const entries = response?.data?.[resource]
  const meta = response?.meta
  if (
    !Array.isArray(entries) ||
    !entries.every(isEntry) ||
    meta?.current_page !== page ||
    !Number.isSafeInteger(meta.per_page) ||
    meta.per_page < 1 ||
    !Number.isSafeInteger(meta.total) ||
    meta.total < 0 ||
    !Number.isSafeInteger(meta.last_page) ||
    meta.last_page < 1
  ) {
    throw new ApiError('The server returned an invalid catalog page.', { code: 'INVALID_RESPONSE' })
  }

  return {
    [resource]: entries,
    currentPage: meta.current_page,
    perPage: meta.per_page,
    total: meta.total,
    lastPage: meta.last_page,
  }
}
