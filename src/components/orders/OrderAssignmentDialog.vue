<script setup>
import { computed, nextTick, onScopeDispose, ref, shallowRef, useTemplateRef } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VDialog } from 'vuetify/components/VDialog'
import { assignOrder, loadOrder, loadOrderAssigneePage } from '../../api/orders'
import { useAuthStore } from '../../stores/auth'
import { canChangeOrderAssignee } from '../../utils/orderActivityAccess'
import { formatOrderAssigneeSubtitle } from '../../utils/orderDisplay'
import OrderAssigneeIdentity from './OrderAssigneeIdentity.vue'
import OrderLookupField from './OrderLookupField.vue'

const props = defineProps({ order: { type: Object, required: true } })
const emit = defineEmits(['close', 'refreshed', 'changed', 'unavailable'])
const auth = useAuthStore()
const controller = new AbortController()
const snapshot = shallowRef(props.order)
const selected = shallowRef(props.order.assignee)
const heading = useTemplateRef('heading')
const reloadButton = useTemplateRef('reload-button')
const feedback = ref(null)
const fieldErrors = ref([])
const saving = ref(false)
const reloading = ref(false)
const reloadRequired = ref(false)
const writeDenied = ref(false)
const busy = computed(() => saving.value || reloading.value)
const canAssign = computed(() => canChangeOrderAssignee(snapshot.value, auth) && !writeDenied.value)
const hasChange = computed(() => selected.value?.id !== snapshot.value.assignee?.id)
const canSave = computed(
  () => canAssign.value && hasChange.value && !busy.value && !reloadRequired.value,
)

const employeeName = (employee) => employee.name
const loadAssignees = (query, signal) => loadOrderAssigneePage(auth.request, query, signal)

function close() {
  if (!busy.value) emit('close')
}

function focusHeading() {
  heading.value?.focus({ preventScroll: true })
}

function requireReload(message) {
  reloadRequired.value = true
  feedback.value = { type: 'warning', message }
}

function showFailure(error) {
  if (error.status === 409 && error.code === 'ORDER_VERSION_CONFLICT') {
    requireReload('This order changed. Reload to review the latest assignee before saving.')
  } else if (error.status === 422) {
    fieldErrors.value = error.fields.assignee_id ?? []
    if (!fieldErrors.value.length) {
      feedback.value = { type: 'error', message: 'The assignment could not be validated.' }
    }
  } else if (error.status === 429 || (error.status === 503 && error.code === 'WRITE_CONTENTION')) {
    feedback.value = { type: 'error', message: 'The order is busy. Try again shortly.' }
  } else if (error.status === 404) {
    emit('unavailable')
  } else if (error.status === 403) {
    writeDenied.value = true
    feedback.value = {
      type: 'error',
      message: 'You no longer have permission to change the assignee.',
    }
  } else {
    requireReload('The assignment could not be confirmed. Reload to check the current assignee.')
  }
}

async function submit() {
  if (!canSave.value) return

  saving.value = true
  fieldErrors.value = []
  feedback.value = null
  let updated
  try {
    updated = await assignOrder(
      auth.request,
      snapshot.value.id,
      { assignee_id: selected.value?.id ?? null, expected_version: snapshot.value.version },
      controller.signal,
    )
  } catch (error) {
    if (!controller.signal.aborted && error.status !== 401) showFailure(error)
  } finally {
    saving.value = false
  }

  if (controller.signal.aborted) return
  if (updated) emit('changed', updated)
  else if (reloadRequired.value) {
    await nextTick()
    reloadButton.value?.$el?.focus()
  }
}

async function reloadOrder() {
  if (busy.value || !reloadRequired.value) return

  reloading.value = true
  try {
    const latest = await loadOrder(auth.request, snapshot.value.id, controller.signal)
    if (controller.signal.aborted) return

    snapshot.value = latest
    if (selected.value?.id === latest.assignee?.id) selected.value = latest.assignee
    fieldErrors.value = []
    reloadRequired.value = false
    let message = 'Latest order loaded. Review the current assignee, then confirm your change.'
    if (!canAssign.value) message = 'Assignment is unavailable for the latest order.'
    else if (!hasChange.value) message = 'The current assignee already matches your selection.'
    feedback.value = { type: 'info', message }
    emit('refreshed', latest)
  } catch (error) {
    if (controller.signal.aborted || error.status === 401) return
    if ([403, 404].includes(error.status)) emit('unavailable')
    else feedback.value = { type: 'error', message: 'Unable to reload the order. Try again.' }
  } finally {
    reloading.value = false
    await nextTick()
    if (!controller.signal.aborted) {
      if (reloadRequired.value) reloadButton.value?.$el?.focus()
      else focusHeading()
    }
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
    aria-labelledby="order-assignment-heading"
    aria-describedby="order-assignment-context"
    @update:model-value="
      (open) => {
        if (!open) close()
      }
    "
    @after-enter="focusHeading"
  >
    <VCard color="surface" rounded="lg">
      <form class="assignment-dialog" novalidate @submit.prevent="submit">
        <header>
          <h2 id="order-assignment-heading" ref="heading" tabindex="-1">Change assignee</h2>
          <p id="order-assignment-context">{{ snapshot.order_number }}</p>
        </header>
        <dl class="current-assignment">
          <dt>{{ reloadRequired ? 'Last loaded assignee' : 'Current assignee' }}</dt>
          <dd>
            <OrderAssigneeIdentity
              :assignee="snapshot.assignee"
              :show-details="auth.canAssignOrders"
            />
          </dd>
        </dl>
        <VAlert
          v-if="feedback"
          :type="feedback.type"
          :role="feedback.type === 'info' ? 'status' : 'alert'"
          variant="tonal"
          :icon="false"
        >
          <p class="feedback-message">{{ feedback.message }}</p>
        </VAlert>
        <OrderLookupField
          v-if="canAssign"
          v-model="selected"
          label="Assignee"
          resource="assignees"
          :load-page="loadAssignees"
          :item-title="employeeName"
          :item-subtitle="formatOrderAssigneeSubtitle"
          show-item-details
          :disabled="busy || reloadRequired"
          :error-messages="fieldErrors"
          @update:model-value="fieldErrors = []"
        />
        <div class="assignment-actions">
          <VBtn type="button" variant="outlined" :disabled="busy" class="text-none" @click="close">
            Close
          </VBtn>
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
            v-else-if="canAssign"
            type="submit"
            color="primary"
            variant="flat"
            :disabled="!canSave"
            :loading="saving"
            class="text-none"
          >
            {{ selected ? 'Save assignment' : 'Unassign order' }}
          </VBtn>
        </div>
      </form>
    </VCard>
  </VDialog>
</template>

<style scoped>
.assignment-dialog {
  display: grid;
  gap: 14px;
  padding: 20px;
}

.assignment-dialog h2 {
  margin: 0;
  font-size: 1.25rem;
}

.assignment-dialog h2:focus {
  outline: none;
}

.assignment-dialog header p {
  margin: 4px 0 0;
}

.current-assignment {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.08);
}

.current-assignment dt {
  font-size: 0.8125rem;
}

.current-assignment dd {
  margin: 2px 0 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.feedback-message {
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
}

.assignment-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: 8px;
}
</style>
