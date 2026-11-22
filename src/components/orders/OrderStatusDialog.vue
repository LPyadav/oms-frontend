<script setup>
import { computed, nextTick, onScopeDispose, ref, shallowRef, useTemplateRef } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VDialog } from 'vuetify/components/VDialog'
import { VSelect } from 'vuetify/components/VSelect'
import { VTextarea } from 'vuetify/components/VTextarea'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { changeOrderStatus, loadOrder } from '../../api/orders'
import { ORDER_STATUS } from '../../constants/orders'
import { useAuthStore } from '../../stores/auth'
import { MAX_ORDER_NOTE_LENGTH } from '../../utils/orderDraft'
import { availableOrderStatuses } from '../../utils/orderLifecycle'

const props = defineProps({ order: { type: Object, required: true } })
const emit = defineEmits(['close', 'refreshed', 'changed'])
const auth = useAuthStore()
const controller = new AbortController()
const snapshot = shallowRef(props.order)
const heading = useTemplateRef('heading')
const reloadButton = useTemplateRef('reload-button')
const target = ref(null)
const remarks = ref('')
const fieldErrors = ref({})
const feedback = ref(null)
const pending = ref(false)
const reloading = ref(false)
const reloadRequired = ref(false)
const busy = computed(() => pending.value || reloading.value)

const statuses = computed(() => availableOrderStatuses(snapshot.value, auth))
const options = computed(() =>
  statuses.value.map((status) => ({ title: ORDER_STATUS[status], value: status })),
)
const canSubmit = computed(
  () => !busy.value && !reloadRequired.value && statuses.value.includes(target.value),
)
const submitLabels = {
  pending: 'Move to pending',
  confirmed: 'Confirm order',
  processing: 'Start processing',
  ready: 'Mark ready',
  completed: 'Complete order',
  cancelled: 'Cancel order',
}
const mayRestoreStock = computed(() =>
  ['confirmed', 'processing', 'ready'].includes(snapshot.value.status),
)
const generalErrors = computed(() =>
  Object.entries(fieldErrors.value)
    .filter(([field]) => field !== 'remarks')
    .flatMap(([, messages]) => messages),
)

function close() {
  if (!busy.value) emit('close')
}

function focusHeading() {
  heading.value?.focus({ preventScroll: true })
}

function clearStatusFeedback() {
  feedback.value = null
  const { remarks: remarkErrors } = fieldErrors.value
  fieldErrors.value = remarkErrors ? { remarks: remarkErrors } : {}
}

function requireReload(message) {
  reloadRequired.value = true
  feedback.value = { type: 'warning', message }
}

function showFailure(error) {
  if (error.status === 409 && error.code === 'ORDER_VERSION_CONFLICT') {
    requireReload('This order changed. Reload it and choose a status again.')
  } else if (error.status === 422) {
    fieldErrors.value = error.fields
    if (!Object.keys(error.fields).length) {
      feedback.value = { type: 'error', message: 'The status change could not be validated.' }
    }
  } else if (error.status === 403 || error.status === 404) {
    requireReload(
      'This order is unavailable for status changes. Reload to check its current state.',
    )
  } else if (error.status === 429 || (error.status === 503 && error.code === 'WRITE_CONTENTION')) {
    const message =
      error.status === 429
        ? 'Too many requests. Try again shortly.'
        : 'The order is busy. Try again shortly.'
    feedback.value = { type: 'error', message }
  } else {
    requireReload('The status change could not be confirmed. Reload before trying again.')
  }
}

async function submit() {
  if (!canSubmit.value) return

  feedback.value = null
  fieldErrors.value = {}
  pending.value = true
  const current = snapshot.value
  const text = remarks.value.trim()
  let updated
  try {
    updated = await changeOrderStatus(
      auth.request,
      current.id,
      {
        status: target.value,
        expected_version: current.version,
        ...(text && { remarks: text }),
      },
      controller.signal,
    )
  } catch (error) {
    if (!controller.signal.aborted && error.status !== 401) showFailure(error)
  } finally {
    pending.value = false
    if (reloadRequired.value) {
      await nextTick()
      reloadButton.value?.$el?.focus()
    }
  }

  if (updated && !controller.signal.aborted) emit('changed', updated)
}

async function reloadOrder() {
  if (busy.value || !reloadRequired.value) return

  reloading.value = true
  try {
    const latest = await loadOrder(auth.request, snapshot.value.id, controller.signal)
    if (controller.signal.aborted) return

    snapshot.value = latest
    target.value = null
    fieldErrors.value = {}
    reloadRequired.value = false
    feedback.value = {
      type: 'info',
      message: statuses.value.length
        ? 'Latest order loaded. Choose a status to continue.'
        : 'There are no status changes available for the latest order.',
    }
    emit('refreshed', latest)
  } catch (error) {
    if (!controller.signal.aborted && error.status !== 401) {
      const message = [403, 404].includes(error.status)
        ? 'The latest order is unavailable.'
        : 'Unable to reload the order. Try again.'
      feedback.value = { type: 'error', message }
    }
  } finally {
    reloading.value = false
    await nextTick()
    if (reloadRequired.value) reloadButton.value?.$el?.focus()
    else if (!controller.signal.aborted) focusHeading()
  }
}

const canNavigate = () => !busy.value || !auth.isAuthenticated
onBeforeRouteLeave(canNavigate)
onBeforeRouteUpdate(canNavigate)
onScopeDispose(() => controller.abort())
</script>

<template>
  <VDialog
    :model-value="true"
    :persistent="busy"
    max-width="520"
    aria-labelledby="order-status-heading"
    aria-describedby="order-status-description"
    @update:model-value="
      (open) => {
        if (!open) close()
      }
    "
    @after-enter="focusHeading"
  >
    <VCard color="surface" rounded="lg">
      <form class="status-dialog" novalidate @submit.prevent="submit">
        <header>
          <h2 id="order-status-heading" ref="heading" tabindex="-1">Change order status</h2>
          <p id="order-status-description" class="status-context">
            {{ snapshot.order_number }} · {{ ORDER_STATUS[snapshot.status] }}
          </p>
        </header>

        <VAlert
          v-if="feedback || generalErrors.length"
          :type="feedback?.type ?? 'error'"
          variant="tonal"
          :icon="false"
          :role="feedback?.type === 'info' ? 'status' : 'alert'"
          class="status-feedback"
        >
          <p v-if="feedback">{{ feedback.message }}</p>
          <ul v-if="generalErrors.length" class="status-errors">
            <li v-for="message in generalErrors" :key="message">{{ message }}</li>
          </ul>
        </VAlert>

        <template v-if="statuses.length">
          <VSelect
            v-model="target"
            label="Next status"
            :items="options"
            :disabled="busy || reloadRequired"
            :menu-icon="aliases.dropdown"
            variant="outlined"
            density="comfortable"
            hide-details="auto"
            @update:model-value="clearStatusFeedback"
          />
          <VTextarea
            v-model="remarks"
            label="Remarks (optional)"
            rows="3"
            :maxlength="MAX_ORDER_NOTE_LENGTH"
            :disabled="busy || reloadRequired"
            :error-messages="fieldErrors.remarks ?? []"
            variant="outlined"
            density="comfortable"
            hide-details="auto"
            @update:model-value="delete fieldErrors.remarks"
          />
          <p v-if="target === 'confirmed'" class="status-hint">
            Confirming deducts the order quantities from available stock.
          </p>
          <p v-else-if="target === 'cancelled'" class="status-hint">
            Cancel {{ snapshot.order_number }}? This ends the order.
            {{ mayRestoreStock ? 'Any stock deducted for this order will be restored.' : '' }}
          </p>
        </template>

        <div class="status-actions">
          <VBtn type="button" variant="outlined" :disabled="busy" class="text-none" @click="close"
            >Close</VBtn
          >
          <VBtn
            v-if="reloadRequired"
            ref="reload-button"
            type="button"
            color="primary"
            variant="flat"
            :loading="reloading"
            :disabled="busy"
            class="text-none"
            @click="reloadOrder"
          >
            Reload order
          </VBtn>
          <VBtn
            v-else-if="statuses.length"
            type="submit"
            :color="target === 'cancelled' ? 'error' : 'primary'"
            variant="flat"
            :loading="pending"
            :disabled="!canSubmit"
            class="text-none"
          >
            {{ submitLabels[target] ?? 'Update status' }}
          </VBtn>
        </div>
      </form>
    </VCard>
  </VDialog>
</template>

<style scoped>
.status-dialog {
  display: grid;
  gap: 14px;
  padding: 20px;
}

.status-dialog h2 {
  margin: 0;
  font-size: 1.25rem;
}

.status-dialog h2:focus {
  outline: none;
}

.status-context,
.status-hint,
.status-feedback p {
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
  overflow-wrap: anywhere;
}

.status-context {
  margin-top: 4px;
}

.status-hint {
  font-size: 0.875rem;
}

.status-errors {
  margin: 0;
  padding-inline-start: 1.25rem;
}

.status-actions {
  display: flex;
  justify-content: end;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
