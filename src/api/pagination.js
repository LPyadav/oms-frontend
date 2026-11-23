import { ApiError } from './client'

export function createPageParams(page, perPage) {
  const params = new URLSearchParams({ page: String(page) })
  if (perPage != null) params.set('per_page', String(perPage))
  return params
}

export function readPaginatedResource(response, { resource, isEntry, page, invalidMessage }) {
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
    throw new ApiError(invalidMessage, { code: 'INVALID_RESPONSE' })
  }

  return {
    [resource]: entries,
    currentPage: meta.current_page,
    perPage: meta.per_page,
    total: meta.total,
    lastPage: meta.last_page,
  }
}
