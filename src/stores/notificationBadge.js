import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { loadUnreadNotificationCount } from '../api/notifications'
import { useAuthStore } from './auth'

export const useNotificationBadgeStore = defineStore('notificationBadge', () => {
  const auth = useAuthStore()
  const viewerId = computed(() => (auth.canViewOrders ? (auth.user?.id ?? null) : null))
  const unreadCount = ref(null)
  const badgeCount = computed(() => (unreadCount.value > 99 ? '99+' : unreadCount.value))
  const label = computed(() =>
    unreadCount.value === null ? 'Notifications' : `Notifications, ${unreadCount.value} unread`,
  )
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

  async function refreshUnreadCount({ background = false } = {}) {
    if (viewerId.value === null || (background && activeRequest)) return

    activeRequest?.abort()
    const controller = new AbortController()
    activeRequest = controller
    try {
      const count = await loadUnreadNotificationCount(auth.request, controller.signal)
      if (!controller.signal.aborted) unreadCount.value = count
    } catch (error) {
      if (!controller.signal.aborted && error?.status === 403) unreadCount.value = null
    } finally {
      if (activeRequest === controller) activeRequest = null
    }
  }

  return { unreadCount, badgeCount, label, refreshUnreadCount }
})
