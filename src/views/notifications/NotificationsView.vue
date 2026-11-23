<script setup>
import { computed, nextTick, onMounted, useTemplateRef } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VChip } from 'vuetify/components/VChip'
import { VIcon } from 'vuetify/components/VIcon'
import { VPagination } from 'vuetify/components/VPagination'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import DirectoryState from '../../components/directory/DirectoryState.vue'
import { useNotificationInbox } from '../../composables/useNotificationInbox'

const filters = [
  { label: 'All', value: null },
  { label: 'Unread', value: 'unread' },
  { label: 'Read', value: 'read' },
]

const eventDetails = new Map([
  ['order.assigned', { title: 'Order assigned', icon: aliases.next }],
  ['order.confirmed', { title: 'Order confirmed', icon: aliases.complete }],
  ['order.cancelled', { title: 'Order cancelled', icon: aliases.cancel }],
])
const defaultEvent = { title: 'Order updated', icon: aliases.info }
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const heading = useTemplateRef('heading')
const retryButton = useTemplateRef('retryButton')
const {
  page,
  loading,
  error,
  status,
  load,
  setStatus,
  changePage,
  pendingAction,
  actionError,
  actionNotice,
  unreadCount,
  markRead,
  markAllRead,
} = useNotificationInbox()
const actionPending = computed(() => pendingAction.value !== null)
const denied = computed(() => error.value?.status === 403)
const errorMessage = computed(() =>
  denied.value
    ? 'You do not have permission to view notifications.'
    : 'Unable to load notifications.',
)
const emptyMessage = computed(() =>
  status.value ? 'No ' + status.value + ' notifications.' : 'No notifications yet.',
)
const notifications = computed(() =>
  (page.value?.notifications ?? []).map((notification) => {
    const date = new Date(notification.created_at)
    return {
      ...notification,
      ...(eventDetails.get(notification.event_type) ?? defaultEvent),
      timestamp: Number.isNaN(date.getTime()) ? 'Unknown time' : dateFormatter.format(date),
    }
  }),
)

const canMarkAllRead = computed(() =>
  unreadCount.value === null ? page.value !== null && error.value === null : unreadCount.value > 0,
)

async function performActionWithFocus(event, action, fallback = () => heading.value) {
  const trigger = event.currentTarget
  const result = await action()
  await nextTick()

  const active = document.activeElement
  if (active && active !== document.body && active !== trigger) return

  const target = trigger?.isConnected && !trigger.disabled ? trigger : fallback(result)
  target?.focus({ preventScroll: true })
}

function retryInbox(event) {
  return performActionWithFocus(event, load, (result) => {
    if (result) return heading.value
    if (error.value) return retryButton.value?.$el ?? heading.value
  })
}

async function goToPage(number) {
  if (!(await changePage(number))) return
  await nextTick()
  heading.value?.focus()
}

onMounted(() => {
  heading.value?.focus({ preventScroll: true })
  void load()
})
</script>

<template>
  <section class="notifications-view" aria-labelledby="notifications-heading">
    <header class="notifications-header">
      <h1 id="notifications-heading" ref="heading" tabindex="-1">Notifications</h1>
    </header>

    <VCard color="surface" variant="flat" border class="notification-card">
      <div class="notification-toolbar">
        <div class="notification-filters" role="group" aria-label="Filter notifications">
          <VBtn
            v-for="filter in filters"
            :key="filter.label"
            type="button"
            class="text-none"
            :variant="status === filter.value ? 'tonal' : 'text'"
            :color="status === filter.value ? 'primary' : undefined"
            :aria-pressed="status === filter.value"
            :disabled="actionPending"
            @click="setStatus(filter.value)"
          >
            {{ filter.label }}
          </VBtn>
        </div>
        <VBtn
          type="button"
          class="text-none"
          color="primary"
          variant="outlined"
          :loading="pendingAction === 'all'"
          :aria-busy="pendingAction === 'all'"
          :disabled="loading || actionPending || !canMarkAllRead"
          @click="performActionWithFocus($event, markAllRead)"
        >
          Mark all as read
        </VBtn>
      </div>

      <div v-if="actionError || actionNotice" class="notification-feedback">
        <VAlert v-if="actionError" type="error" variant="tonal" :icon="false" role="alert">
          {{ actionError }}
        </VAlert>
        <VAlert v-else color="primary" variant="tonal" :icon="false" role="status">
          {{ actionNotice }}
        </VAlert>
      </div>

      <DirectoryState
        v-if="loading"
        kind="loading"
        message="Loading notifications…"
        class="notification-state"
      />
      <DirectoryState
        v-else-if="error"
        kind="error"
        :message="errorMessage"
        class="notification-state"
      >
        <template #actions>
          <VBtn v-if="denied" :to="{ name: 'workspace' }" variant="outlined" class="text-none">
            Back to workspace
          </VBtn>
          <VBtn
            v-else
            ref="retryButton"
            type="button"
            variant="outlined"
            class="text-none"
            :disabled="actionPending"
            @click="retryInbox"
          >
            Try again
          </VBtn>
        </template>
      </DirectoryState>
      <template v-else-if="page">
        <DirectoryState
          v-if="page.currentPage > page.lastPage"
          kind="empty"
          message="This notification page is no longer available."
          class="notification-state"
        >
          <template #actions>
            <VBtn
              type="button"
              variant="outlined"
              class="text-none"
              :disabled="actionPending"
              @click="goToPage(page.lastPage)"
            >
              Go to last page
            </VBtn>
          </template>
        </DirectoryState>
        <DirectoryState
          v-else-if="!notifications.length"
          kind="empty"
          :message="emptyMessage"
          class="notification-state"
        />
        <template v-else>
          <ul class="notification-list" role="list">
            <li
              v-for="notification in notifications"
              :key="notification.id"
              class="notification-entry"
              :class="{ 'notification-entry-unread': !notification.read_at }"
            >
              <div class="notification-icon" aria-hidden="true">
                <VIcon :icon="notification.icon" size="20" />
              </div>
              <div class="notification-content">
                <h2>{{ notification.title }}</h2>
                <div class="notification-meta">
                  <span class="notification-order-number">{{ notification.order_number }}</span>
                  <time :datetime="notification.created_at">{{ notification.timestamp }}</time>
                  <VChip
                    :color="notification.read_at ? undefined : 'primary'"
                    :variant="notification.read_at ? 'outlined' : 'tonal'"
                    size="small"
                  >
                    {{ notification.read_at ? 'Read' : 'Unread' }}
                  </VChip>
                </div>
              </div>
              <div class="notification-actions">
                <VBtn
                  v-if="!notification.read_at"
                  type="button"
                  :aria-label="
                    'Mark as read for order ' +
                    notification.order_number +
                    ' (' +
                    notification.title +
                    ')'
                  "
                  :loading="pendingAction === notification.id"
                  :aria-busy="pendingAction === notification.id"
                  :disabled="actionPending"
                  variant="text"
                  class="text-none"
                  @click="performActionWithFocus($event, () => markRead(notification.id))"
                >
                  Mark as read
                </VBtn>
                <VBtn
                  :to="{
                    name: 'order-detail',
                    params: { orderId: String(notification.order_id) },
                  }"
                  :aria-label="'View order ' + notification.order_number"
                  :append-icon="aliases.next"
                  color="primary"
                  variant="text"
                  class="text-none"
                >
                  View order
                </VBtn>
              </div>
            </li>
          </ul>
          <footer class="notification-footer">
            <span aria-live="polite">
              {{ page.total }} {{ page.total === 1 ? 'notification' : 'notifications' }}
            </span>
            <VPagination
              v-if="page.lastPage > 1"
              :model-value="page.currentPage"
              :length="page.lastPage"
              :total-visible="3"
              :prev-icon="aliases.prev"
              :next-icon="aliases.next"
              density="comfortable"
              :disabled="actionPending"
              aria-label="Notification pages"
              @update:model-value="goToPage"
            />
          </footer>
        </template>
      </template>
    </VCard>
  </section>
</template>

<style scoped>
.notifications-view {
  max-inline-size: 70rem;
  margin-inline: auto;
  padding-block: clamp(20px, 2.8vw, 28px) 28px;
}

.notifications-header {
  margin-block-end: 18px;
}

.notifications-header h1 {
  margin: 0;
  font-size: clamp(1.625rem, 3.4vw, 2.125rem);
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.notifications-header h1:focus {
  outline: none;
}

.notification-card {
  border-color: rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 12px;
  box-shadow: 0 2px 7px rgba(var(--v-theme-on-surface), 0.045);
}

.notification-toolbar,
.notification-filters,
.notification-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.notification-toolbar {
  justify-content: space-between;
  padding: 12px 16px;
  border-block-end: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.notification-actions {
  justify-content: flex-end;
}

.notification-toolbar .v-btn,
.notification-actions .v-btn {
  min-block-size: 44px;
}

.notification-feedback {
  padding: 12px 16px;
  border-block-end: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.notification-state {
  display: grid;
  gap: 12px;
  justify-items: start;
  padding: 16px;
}

.notification-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.notification-entry {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px 16px;
  padding: 14px 16px;
}

.notification-entry + .notification-entry,
.notification-footer {
  border-block-start: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.notification-entry-unread {
  background: rgba(var(--v-theme-primary), 0.045);
}

.notification-icon {
  display: grid;
  place-items: center;
  inline-size: 40px;
  block-size: 40px;
  border-radius: 10px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.11);
}

.notification-content h2 {
  margin: 0 0 4px;
  font-size: 1rem;
  line-height: 1.3;
}

.notification-meta,
.notification-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
}

.notification-order-number {
  color: rgb(var(--v-theme-on-surface));
  font-weight: 500;
  overflow-wrap: anywhere;
}

.notification-footer {
  justify-content: space-between;
  padding: 12px 16px;
}

@media (max-width: 600px) {
  .notification-entry {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    row-gap: 6px;
  }

  .notification-actions {
    grid-column: 2;
    justify-content: flex-start;
  }
}
</style>
