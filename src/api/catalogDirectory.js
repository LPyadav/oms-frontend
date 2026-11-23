import { readPaginatedResource } from './pagination'

export async function loadCatalogPage(request, { resource, isEntry }, query, signal) {
  const { page, search, isActive } = query
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set('search', search)
  if (isActive !== null) params.set('is_active', isActive ? '1' : '0')

  const response = await request(`/api/${resource}?${params}`, { signal })
  return readPaginatedResource(response, {
    resource,
    isEntry,
    page,
    invalidMessage: 'The server returned an invalid catalog page.',
  })
}
