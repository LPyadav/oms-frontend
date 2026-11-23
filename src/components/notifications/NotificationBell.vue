<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { VBadge } from 'vuetify/components/VBadge'
import { VBtn } from 'vuetify/components/VBtn'
import { loadUnreadNotificationCount } from '../../api/notifications'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const unreadCount = ref(null)
const badgeCount = computed(() => (unreadCount.value > 99 ? '99+' : unreadCount.value))
const label = computed(() =>
  unreadCount.value === null ? 'Notifications' : 'Notifications, ' + unreadCount.value + ' unread',
)

watch(
  [() => auth.user?.id, () => route.name === 'notifications'],
  async ([userId], _, onCleanup) => {
    unreadCount.value = null
    if (!userId) return

    const controller = new AbortController()
    onCleanup(() => controller.abort())
    try {
      const count = await loadUnreadNotificationCount(auth.request, controller.signal)
      if (!controller.signal.aborted) unreadCount.value = count
    } catch {
      // The inbox remains available when the unread count cannot be loaded.
    }
  },
  { immediate: true },
)
</script>

<template>
  <VBadge
    class="notification-bell"
    :model-value="unreadCount > 0"
    :content="badgeCount"
    color="primary"
    location="top end"
    :offset-x="4"
    :offset-y="4"
  >
    <VBtn :to="{ name: 'notifications' }" :aria-label="label" icon size="44" variant="text">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </svg>
    </VBtn>
  </VBadge>
</template>

<style scoped>
.notification-bell {
  flex: none;
}
</style>
