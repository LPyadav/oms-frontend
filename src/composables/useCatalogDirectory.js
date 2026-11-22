import { usePagedDirectory } from './usePagedDirectory'

const firstPage = { page: 1, search: '', isActive: null }

export function useCatalogDirectory({ fetchPage, signal }) {
  return usePagedDirectory({ fetchPage, signal, initialQuery: firstPage })
}
