import { storeToRefs } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import {
  loadNotificationPage,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications'
import { useAuthStore } from '../stores/auth'
import { useNotificationBadgeStore } from '../stores/notificationBadge'
import { usePagedDirectory } from './usePagedDirectory'

export function useNotificationInbox() {
  const auth = useAuthStore()
  const badge = useNotificationBadgeStore()
  const { unreadCount } = storeToRefs(badge)
  const requests = new AbortController()
  const pendingAction = ref(null)
  const actionError = ref('')
  const actionNotice = ref('')
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

  async function refreshPage() {
    const current = await load()
    if (current && current.currentPage > current.lastPage) await changePage(current.lastPage)
  }

  function synchronize() {
    return Promise.all([refreshPage(), badge.refreshUnreadCount()])
  }

  async function runReadAction(action, write, successMessage) {
    if (
      pendingAction.value !== null ||
      loading.value ||
      !auth.canViewOrders ||
      requests.signal.aborted
    ) {
      return false
    }

    const viewerId = auth.user?.id
    const isCurrent = () =>
      !requests.signal.aborted && auth.canViewOrders && auth.user?.id === viewerId
    pendingAction.value = action
    actionError.value = ''
    actionNotice.value = ''
    try {
      const result = await write()
      if (!isCurrent()) return false
      actionNotice.value = successMessage(result)
      await synchronize()
      return isCurrent()
    } catch (failure) {
      const responseStatus = failure?.status
      if (!isCurrent() || responseStatus === 401) return false

      if (responseStatus === 404 && action !== 'all') {
        actionNotice.value = 'This notification is no longer available.'
      } else {
        actionError.value =
          responseStatus === 429
            ? 'Too many requests. Try again shortly.'
            : 'Could not confirm the read update.'
      }
      if ((responseStatus === 404 && action !== 'all') || !responseStatus || responseStatus >= 500)
        await synchronize()
      return false
    } finally {
      pendingAction.value = null
    }
  }

  function markRead(id) {
    return runReadAction(
      id,
      () => markNotificationRead(auth.request, id, requests.signal),
      () => 'Notification marked as read.',
    )
  }

  function markAllRead() {
    return runReadAction(
      'all',
      () => markAllNotificationsRead(auth.request, requests.signal),
      (count) =>
        count > 0
          ? 'All visible notifications marked as read.'
          : 'No unread notifications to mark.',
    )
  }

  return {
    page,
    loading,
    error,
    status,
    unreadCount,
    pendingAction,
    actionError,
    actionNotice,
    load,
    setStatus,
    changePage,
    markRead,
    markAllRead,
  }
}
