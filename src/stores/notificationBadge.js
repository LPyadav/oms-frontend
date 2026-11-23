import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { loadUnreadNotificationCount } from '../api/notifications'
import { useAuthStore } from './auth'

export const useNotificationBadgeStore = defineStore('notificationBadge', () => {
  const auth = useAuthStore()
  const viewerId = computed(() => (auth.canViewOrders ? (auth.user?.id ?? null) : null))
  const unreadCount = ref(null)
  let activeRequest

  watch(
    viewerId,
    () => {
      activeRequest?.abort()
      unreadCount.value = null
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => activeRequest?.abort())

  async function refreshUnreadCount() {
    if (viewerId.value === null) return

    activeRequest?.abort()
    const controller = new AbortController()
    activeRequest = controller
    unreadCount.value = null
    try {
      const count = await loadUnreadNotificationCount(auth.request, controller.signal)
      if (!controller.signal.aborted) unreadCount.value = count
    } catch {
      // The inbox remains available when the unread count is unknown.
    } finally {
      if (activeRequest === controller) activeRequest = null
    }
  }

  return { unreadCount, refreshUnreadCount }
})
