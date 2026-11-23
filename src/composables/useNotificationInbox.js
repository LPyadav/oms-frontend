import { computed, onScopeDispose } from 'vue'
import { loadNotificationPage } from '../api/notifications'
import { useAuthStore } from '../stores/auth'
import { usePagedDirectory } from './usePagedDirectory'

export function useNotificationInbox() {
  const auth = useAuthStore()
  const requests = new AbortController()
  const {
    query,
    result: page,
    error,
    loading,
    load,
  } = usePagedDirectory({
    fetchPage: (next, signal) => loadNotificationPage(auth.request, next, signal),
    signal: requests.signal,
    initialQuery: { page: 1, status: null },
  })
  const status = computed(() => query.value.status)
  onScopeDispose(() => requests.abort())

  function setStatus(nextStatus) {
    return load({ page: 1, status: nextStatus })
  }

  function changePage(number) {
    return load({ ...query.value, page: number })
  }

  return { page, loading, error, status, load, setStatus, changePage }
}
