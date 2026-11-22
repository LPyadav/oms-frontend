import { loadCustomerPage } from '../api/customers'
import { useCatalogDirectory } from './useCatalogDirectory'

export function useCustomerDirectory({ request, signal }) {
  return useCatalogDirectory({
    fetchPage: (query, requestSignal) => loadCustomerPage(request, query, requestSignal),
    signal,
  })
}
