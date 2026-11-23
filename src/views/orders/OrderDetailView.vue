<script setup>
import { computed, nextTick, onScopeDispose, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VChip } from 'vuetify/components/VChip'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import DirectoryPagination from '../../components/directory/DirectoryPagination.vue'
import OrderAssigneeIdentity from '../../components/orders/OrderAssigneeIdentity.vue'
import OrderAssignmentDialog from '../../components/orders/OrderAssignmentDialog.vue'
import OrderDeleteDialog from '../../components/orders/OrderDeleteDialog.vue'
import OrderItemsCard from '../../components/orders/OrderItemsCard.vue'
import OrderNoteDialog from '../../components/orders/OrderNoteDialog.vue'
import OrderStatusDialog from '../../components/orders/OrderStatusDialog.vue'
import { useOrderDetail } from '../../composables/useOrderDetail'
import {
  isOrderDeletable,
  isOrderEditable,
  ORDER_PRIORITY,
  ORDER_STATUS,
} from '../../constants/orders'
import { DIRECTORY_PAGE_SIZE } from '../../constants/pagination'
import { useAuthStore } from '../../stores/auth'
import { canAddNoteToOrder, canChangeOrderAssignee } from '../../utils/orderActivityAccess'
import { formatOrderDate, formatOrderTimestamp, formatOrderTotal } from '../../utils/orderDisplay'
import { orderActivity, orderNotes, orderTimeline } from '../../utils/orderHistory'
import { availableOrderStatuses } from '../../utils/orderLifecycle'

const props = defineProps({
  orderId: { type: String, required: true },
})

const auth = useAuthStore()
const router = useRouter()
const activeDialog = ref(null)
const notesExpanded = ref(false)
const activityExpanded = ref(true)
const activityPage = ref(1)
let dialogTrigger
const heading = useTemplateRef('heading')
const activityToggle = useTemplateRef('activityToggle')
const controller = new AbortController()
const { order, error, loading, load } = useOrderDetail({
  request: auth.request,
  signal: controller.signal,
})

const canChangeStatus = computed(() => availableOrderStatuses(order.value, auth).length > 0)
const canEdit = computed(() => auth.canEditOrders && isOrderEditable(order.value?.status))
const canDelete = computed(() => auth.canDeleteOrders && isOrderDeletable(order.value?.status))
const canAssign = computed(() => canChangeOrderAssignee(order.value, auth))
const canAddNote = computed(() => canAddNoteToOrder(order.value, auth))
const timeline = computed(() => (order.value ? orderTimeline(order.value) : []))
const notes = computed(() => (order.value ? orderNotes(order.value) : []))
const activity = computed(() => (order.value ? orderActivity(order.value) : []))
const lastActivityPage = computed(() =>
  Math.max(1, Math.ceil(activity.value.length / DIRECTORY_PAGE_SIZE)),
)
const activityPageEntries = computed(() => {
  const start = (activityPage.value - 1) * DIRECTORY_PAGE_SIZE
  return activity.value.slice(start, start + DIRECTORY_PAGE_SIZE)
})
const errorMessage = computed(() => {
  if (error.value?.status === 403) return 'You do not have permission to view this order.'
  if (error.value?.status === 404) return 'This order is unavailable.'
  if (error.value?.status === 429) return 'Too many requests. Try again shortly.'
  return 'Unable to load this order. Try again.'
})
const canRetry = computed(() => error.value && ![403, 404].includes(error.value.status))

async function changeActivityPage(page) {
  activityPage.value = page
  await nextTick()
  activityToggle.value?.$el.focus()
}

function openDialog(name, event) {
  dialogTrigger = event.currentTarget
  activeDialog.value = name
}

async function closeDialog() {
  activeDialog.value = null
  const trigger = dialogTrigger
  dialogTrigger = null
  await nextTick()
  const target = trigger?.isConnected ? trigger : heading.value
  target?.focus({ preventScroll: true })
}

async function reloadOrderDetail() {
  activeDialog.value = null
  dialogTrigger = null
  await load(props.orderId)
  await nextTick()
  heading.value?.focus({ preventScroll: true })
}

function handleStatusUnavailable(failure) {
  if (!failure) return reloadOrderDetail()

  order.value = null
  error.value = failure
  return closeDialog()
}

function finishDelete() {
  activeDialog.value = null
  dialogTrigger = null
  return router.replace({ name: 'orders' })
}

function applyOrderSnapshot(updated) {
  if (updated.id === Number(props.orderId)) order.value = updated
}

function finishOrderChange(updated) {
  applyOrderSnapshot(updated)
  return closeDialog()
}

function finishNote(orderId, note) {
  const current = order.value
  if (current?.id === orderId && !current.notes.some(({ id }) => id === note.id)) {
    order.value = { ...current, notes: [...current.notes, note] }
  }
  return closeDialog()
}

watch(lastActivityPage, (lastPage) => {
  activityPage.value = Math.min(activityPage.value, lastPage)
})

watch(
  () => props.orderId,
  async (id) => {
    if (!auth.canViewOrders) return
    activeDialog.value = null
    dialogTrigger = null
    notesExpanded.value = false
    activityExpanded.value = true
    activityPage.value = 1
    void load(id)
    await nextTick()
    heading.value?.focus({ preventScroll: true })
  },
  { immediate: true },
)

onScopeDispose(() => controller.abort())
</script>

<template>
  <section v-if="auth.canViewOrders" class="order-detail" aria-labelledby="order-detail-heading">
    <header class="detail-header">
      <VBtn
        :to="{ name: 'orders' }"
        :prepend-icon="aliases.prev"
        variant="text"
        color="primary"
        class="text-none detail-back"
      >
        Back to orders
      </VBtn>
      <div class="detail-title">
        <h1 id="order-detail-heading" ref="heading" tabindex="-1">
          {{ order?.order_number ?? 'Order detail' }}
        </h1>
        <VChip
          v-if="order"
          :color="order.status === 'cancelled' ? 'error' : 'primary'"
          variant="tonal"
          size="small"
          label
        >
          {{ ORDER_STATUS[order.status] }}
        </VChip>
        <div v-if="canChangeStatus || canEdit || canDelete" class="detail-actions">
          <VBtn
            v-if="canChangeStatus"
            color="primary"
            variant="flat"
            class="text-none"
            @click="openDialog('status', $event)"
          >
            Change status
          </VBtn>
          <VBtn
            v-if="canEdit"
            :to="{ name: 'order-edit', params: { orderId: order.id } }"
            color="primary"
            variant="outlined"
            class="text-none"
          >
            Edit order
          </VBtn>
          <VBtn
            v-if="canDelete"
            color="error"
            variant="text"
            class="text-none"
            @click="openDialog('delete', $event)"
          >
            Delete order
          </VBtn>
        </div>
      </div>
    </header>

    <VCard v-if="loading" class="detail-panel detail-state" variant="flat" border role="status">
      <VProgressLinear color="primary" indeterminate aria-hidden="true" />
      <p>Loading order…</p>
    </VCard>
    <VCard v-else-if="error" class="detail-panel detail-state" variant="flat" border>
      <VAlert type="error" variant="tonal" :icon="false" role="alert">{{ errorMessage }}</VAlert>
      <VBtn v-if="canRetry" variant="outlined" class="text-none" @click="load(orderId)">
        Try again
      </VBtn>
    </VCard>

    <template v-else-if="order">
      <OrderDeleteDialog
        v-if="activeDialog === 'delete' && canDelete"
        :order="order"
        @close="closeDialog"
        @reload="reloadOrderDetail"
        @deleted="finishDelete"
      />
      <OrderStatusDialog
        v-if="activeDialog === 'status'"
        :key="order.id"
        :order="order"
        @close="closeDialog"
        @refreshed="applyOrderSnapshot"
        @changed="finishOrderChange"
        @unavailable="handleStatusUnavailable"
      />
      <OrderAssignmentDialog
        v-if="activeDialog === 'assignment'"
        :key="order.id"
        :order="order"
        @close="closeDialog"
        @refreshed="applyOrderSnapshot"
        @changed="finishOrderChange"
        @unavailable="reloadOrderDetail"
      />
      <OrderNoteDialog
        v-if="activeDialog === 'note'"
        :key="order.id"
        :order="order"
        @close="closeDialog"
        @refreshed="applyOrderSnapshot"
        @added="finishNote"
        @unavailable="reloadOrderDetail"
      />
      <div class="detail-overview">
        <VCard
          tag="section"
          class="detail-panel"
          variant="flat"
          border
          aria-labelledby="summary-heading"
        >
          <h2 id="summary-heading">Order summary</h2>
          <dl class="detail-fields">
            <div>
              <dt>Order date</dt>
              <dd>
                <time :datetime="order.order_date">{{ formatOrderDate(order.order_date) }}</time>
              </dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{{ ORDER_PRIORITY[order.priority] }}</dd>
            </div>
            <div>
              <dt>Assigned to</dt>
              <dd class="detail-assignee">
                <OrderAssigneeIdentity
                  :assignee="order.assignee"
                  :show-details="auth.canAssignOrders"
                />
                <VBtn
                  v-if="canAssign"
                  color="primary"
                  size="small"
                  variant="outlined"
                  class="text-none"
                  @click="openDialog('assignment', $event)"
                >
                  Change assignee
                </VBtn>
              </dd>
            </div>
            <div>
              <dt>Order total</dt>
              <dd class="detail-total">
                {{ formatOrderTotal(order.grand_total_minor, order.currency) }}
              </dd>
            </div>
          </dl>
        </VCard>

        <VCard
          tag="section"
          class="detail-panel"
          variant="flat"
          border
          aria-labelledby="customer-heading"
        >
          <h2 id="customer-heading">Customer</h2>
          <dl class="detail-fields">
            <div>
              <dt>Name</dt>
              <dd>{{ order.customer.name }}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{{ order.customer.email || 'Not provided' }}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{{ order.customer.phone || 'Not provided' }}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd class="detail-body">{{ order.customer.address || 'Not provided' }}</dd>
            </div>
          </dl>
        </VCard>
      </div>

      <div class="detail-content">
        <OrderItemsCard :order="order" />
        <VCard
          tag="section"
          class="detail-panel"
          variant="flat"
          border
          aria-labelledby="timeline-heading"
        >
          <h2 id="timeline-heading">Order timeline</h2>
          <ol class="detail-timeline" role="list">
            <li
              v-for="step in timeline"
              :key="step.key"
              :class="{ 'timeline-reached': step.reached }"
            >
              <span class="timeline-dot" aria-hidden="true"></span>
              <div>
                <p class="timeline-title">{{ step.title }}</p>
                <time v-if="step.at" :datetime="step.at">{{ formatOrderTimestamp(step.at) }}</time>
                <span v-else>{{ step.reached ? 'Date unavailable' : 'Not reached' }}</span>
              </div>
            </li>
          </ol>
        </VCard>
      </div>

      <VCard
        tag="section"
        class="detail-panel detail-disclosure"
        variant="flat"
        border
        aria-labelledby="notes-heading"
      >
        <h2 id="notes-heading">
          <VBtn
            type="button"
            block
            variant="text"
            class="text-none detail-disclosure-toggle"
            :append-icon="notesExpanded ? aliases.collapse : aliases.expand"
            :aria-expanded="notesExpanded"
            aria-controls="order-notes"
            @click="notesExpanded = !notesExpanded"
          >
            Notes
          </VBtn>
        </h2>
        <div v-show="notesExpanded" id="order-notes" class="detail-disclosure-body">
          <div v-if="canAddNote" class="notes-actions">
            <VBtn
              type="button"
              color="primary"
              variant="outlined"
              class="text-none"
              @click="openDialog('note', $event)"
            >
              Add note
            </VBtn>
          </div>
          <p v-if="!notes.length" class="history-empty">No notes yet.</p>
          <ol v-else class="detail-history-list" role="list">
            <li v-for="note in notes" :key="note.id">
              <div class="history-entry-header">
                <h3>{{ note.author?.name ?? 'Unknown author' }}</h3>
                <time :datetime="note.created_at">{{ formatOrderTimestamp(note.created_at) }}</time>
              </div>
              <p class="detail-body history-entry-body">{{ note.body }}</p>
            </li>
          </ol>
        </div>
      </VCard>

      <VCard
        tag="section"
        class="detail-panel detail-disclosure"
        variant="flat"
        border
        aria-labelledby="activity-heading"
      >
        <h2 id="activity-heading">
          <VBtn
            ref="activityToggle"
            type="button"
            block
            variant="text"
            class="text-none detail-disclosure-toggle"
            :append-icon="activityExpanded ? aliases.collapse : aliases.expand"
            :aria-expanded="activityExpanded"
            aria-controls="order-activity"
            @click="activityExpanded = !activityExpanded"
          >
            Activity
          </VBtn>
        </h2>
        <div v-show="activityExpanded" id="order-activity" class="detail-disclosure-body">
          <p v-if="!activity.length" class="history-empty">No activity recorded.</p>
          <ol v-else class="detail-history-list" role="list">
            <li v-for="event in activityPageEntries" :key="event.key">
              <div class="history-entry-header">
                <VChip label size="x-small" variant="tonal" color="primary">{{ event.type }}</VChip>
                <h3>{{ event.title }}</h3>
                <time :datetime="event.at">{{ formatOrderTimestamp(event.at) }}</time>
              </div>
              <p class="history-entry-actor">{{ event.actor }}</p>
              <p v-if="event.body" class="detail-body history-entry-body">{{ event.body }}</p>
            </li>
          </ol>
          <DirectoryPagination
            v-if="lastActivityPage > 1"
            :current-page="activityPage"
            :last-page="lastActivityPage"
            label="Activity pages"
            previous-label="Previous activity page"
            next-label="Next activity page"
            class="activity-pages"
            @page-change="changeActivityPage"
          >
            <span aria-live="polite">Page {{ activityPage }} of {{ lastActivityPage }}</span>
          </DirectoryPagination>
        </div>
      </VCard>
    </template>
  </section>
</template>

<style scoped>
.order-detail {
  display: grid;
  gap: 16px;
  padding-block: clamp(20px, 2.8vw, 28px) 28px;
}

.detail-back {
  margin-inline-start: -8px;
}

.detail-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  margin-top: 6px;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-inline-start: auto;
}

.detail-title h1 {
  margin: 0;
  font-size: clamp(1.625rem, 3.4vw, 2.125rem);
  letter-spacing: -0.035em;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.detail-title h1:focus {
  outline: none;
}

.detail-overview,
.detail-content {
  display: grid;
  gap: 16px;
}

.detail-overview {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.detail-content {
  grid-template-columns: minmax(0, 1fr) minmax(220px, 0.34fr);
  align-items: start;
}

.detail-panel {
  min-width: 0;
  padding: 18px;
  border-color: rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 12px;
}

.detail-panel h2 {
  margin: 0 0 14px;
  font-size: 1.0625rem;
  line-height: 1.4;
}

.detail-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
  margin: 0;
}

.detail-fields dt,
.detail-timeline time,
.detail-timeline span,
.history-entry-header time,
.history-entry-actor,
.history-empty {
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
}

.detail-fields dd {
  margin: 3px 0 0;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.detail-assignee {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.detail-total {
  color: rgb(var(--v-theme-primary));
  font-variant-numeric: tabular-nums;
}

.detail-state {
  display: grid;
  justify-items: start;
  gap: 12px;
}

.detail-state p,
.detail-timeline p,
.history-empty,
.history-entry-actor,
.history-entry-body {
  margin: 0;
}

.detail-timeline,
.detail-history-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.detail-timeline li {
  position: relative;
  display: grid;
  grid-template-columns: 12px 1fr;
  gap: 12px;
  padding-bottom: 16px;
}

.detail-timeline li:last-child {
  padding-bottom: 0;
}

.detail-timeline li:not(:last-child)::before {
  position: absolute;
  inset: 12px auto -8px 5px;
  width: 2px;
  background: rgba(var(--v-theme-on-surface), 0.16);
  content: '';
}

.timeline-dot {
  z-index: 1;
  width: 12px;
  height: 12px;
  margin-top: 5px;
  border: 2px solid rgba(var(--v-theme-on-surface), 0.42);
  border-radius: 50%;
  background: rgb(var(--v-theme-surface));
}

.timeline-reached .timeline-dot {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
}

.timeline-title {
  font-size: 0.875rem;
  font-weight: 500;
}

.detail-history-list li {
  padding-block: 14px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  overflow-wrap: anywhere;
}

.detail-history-list li:last-child {
  padding-bottom: 0;
}

.detail-disclosure {
  padding: 0;
}

.detail-disclosure h2 {
  margin: 0;
}

.detail-disclosure-toggle {
  justify-content: space-between;
  min-height: 54px;
  padding-inline: 18px;
  font: inherit;
  font-weight: 700;
  letter-spacing: normal;
}

.detail-disclosure-toggle:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -3px;
}

.detail-disclosure-body {
  padding: 0 18px 18px;
}

.notes-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 14px;
}

.activity-pages {
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
}

.history-entry-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
}

.history-entry-header h3 {
  font-size: 0.9375rem;
}

.history-entry-header time {
  margin-inline-start: auto;
}

.detail-body {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.history-entry-actor,
.history-entry-body {
  margin-top: 5px;
}

@media (max-width: 1100px) {
  .detail-content {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .detail-actions {
    flex-basis: 100%;
    margin-inline-start: 0;
  }

  .detail-overview {
    grid-template-columns: minmax(0, 1fr);
  }

  .history-entry-header time {
    flex-basis: 100%;
    margin-inline-start: 0;
  }
}
</style>
