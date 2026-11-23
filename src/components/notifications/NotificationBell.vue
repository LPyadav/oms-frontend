<script setup>
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { VBadge } from 'vuetify/components/VBadge'
import { VBtn } from 'vuetify/components/VBtn'
import { useAuthStore } from '../../stores/auth'
import { useNotificationBadgeStore } from '../../stores/notificationBadge'

const auth = useAuthStore()
const route = useRoute()
const badge = useNotificationBadgeStore()
const { unreadCount } = storeToRefs(badge)
const badgeCount = computed(() => (unreadCount.value > 99 ? '99+' : unreadCount.value))
const label = computed(() =>
  unreadCount.value === null ? 'Notifications' : 'Notifications, ' + unreadCount.value + ' unread',
)

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
