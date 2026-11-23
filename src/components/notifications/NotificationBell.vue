<script setup>
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { VBadge } from 'vuetify/components/VBadge'
import { VBtn } from 'vuetify/components/VBtn'
import { NOTIFICATION_BELL_PATH, UNREAD_COUNT_REFRESH_MS } from '../../constants/notifications'
import { useAuthStore } from '../../stores/auth'
import { useNotificationBadgeStore } from '../../stores/notificationBadge'

const auth = useAuthStore()
const route = useRoute()
const badge = useNotificationBadgeStore()
const { unreadCount, badgeCount, label } = storeToRefs(badge)
let refreshTimer

function refreshWhenVisible() {
  if (document.visibilityState === 'visible') void badge.refreshUnreadCount({ background: true })
}

onMounted(() => {
  document.addEventListener('visibilitychange', refreshWhenVisible)
  refreshTimer = window.setInterval(refreshWhenVisible, UNREAD_COUNT_REFRESH_MS)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', refreshWhenVisible)
  window.clearInterval(refreshTimer)
})

watch(
  [() => auth.user?.id, () => route.name === 'notifications'],
  () => void badge.refreshUnreadCount(),
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
        <path :d="NOTIFICATION_BELL_PATH" />
      </svg>
    </VBtn>
  </VBadge>
</template>

<style scoped>
.notification-bell {
  flex: none;
}
</style>
