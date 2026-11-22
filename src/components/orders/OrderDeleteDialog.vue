<script setup>
import { nextTick, onScopeDispose, ref, useTemplateRef } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VDialog } from 'vuetify/components/VDialog'
import { deleteOrder } from '../../api/orders'
import { useAuthStore } from '../../stores/auth'

const props = defineProps({ order: { type: Object, required: true } })
const emit = defineEmits(['close', 'reload', 'deleted'])
const auth = useAuthStore()
const cancelButton = useTemplateRef('cancel-button')
const reloadButton = useTemplateRef('reload-button')
const controller = new AbortController()
const pending = ref(false)
const reloadRequired = ref(false)
const message = ref('')

function close() {
  if (!pending.value) emit('close')
}

function focusCancel() {
  cancelButton.value?.$el?.focus()
}

async function confirmDelete() {
  if (pending.value || reloadRequired.value || !auth.canDeleteOrders) return

  message.value = ''
  pending.value = true
  try {
    await deleteOrder(auth.request, props.order.id, props.order.version, controller.signal)
  } catch (error) {
    if (controller.signal.aborted || error.status === 401) return
    if (error.status === 409 && error.code === 'ORDER_VERSION_CONFLICT') {
      reloadRequired.value = true
      message.value = 'This order changed. Reload it and confirm deletion again.'
    } else if ([0, 404].includes(error.status) || error.status >= 500 || error.fields?.status) {
      reloadRequired.value = true
      message.value =
        'The deletion could not be confirmed. Reload the order to check its current state.'
    } else if (error.status === 403) {
      reloadRequired.value = true
      message.value = 'You do not have permission to delete this order.'
    } else if (error.status === 429) {
      message.value = 'Too many requests. Please wait and try again.'
    } else {
      message.value = 'Unable to delete the order. Try again.'
    }
    return
  } finally {
    pending.value = false
    if (reloadRequired.value) {
      await nextTick()
      reloadButton.value?.$el?.focus()
    }
  }

  if (!controller.signal.aborted) emit('deleted')
}

const canNavigate = () => !pending.value || !auth.isAuthenticated
onBeforeRouteLeave(canNavigate)
onBeforeRouteUpdate(canNavigate)
onScopeDispose(() => controller.abort())
</script>

<template>
  <VDialog
    :model-value="true"
    :persistent="pending"
    max-width="456"
    aria-labelledby="delete-order-heading"
    aria-describedby="delete-order-description"
    @update:model-value="
      (open) => {
        if (!open) close()
      }
    "
    @after-enter="focusCancel"
  >
    <VCard color="surface" rounded="lg" class="delete-order-dialog">
      <h2 id="delete-order-heading">Delete order</h2>
      <p id="delete-order-description">
        Delete <strong>{{ order.order_number }}</strong>? It will be removed from the Orders list.
      </p>
      <VAlert v-if="message" type="error" variant="tonal" :icon="false" role="alert">
        {{ message }}
      </VAlert>
      <div class="delete-order-actions">
        <VBtn
          ref="cancel-button"
          type="button"
          :disabled="pending"
          variant="outlined"
          class="text-none"
          @click="close"
        >
          Cancel
        </VBtn>
        <VBtn
          v-if="reloadRequired"
          ref="reload-button"
          type="button"
          color="primary"
          variant="flat"
          class="text-none"
          @click="emit('reload')"
        >
          Reload order
        </VBtn>
        <VBtn
          v-else
          type="button"
          color="error"
          variant="flat"
          :loading="pending"
          :disabled="pending"
          class="text-none"
          @click="confirmDelete"
        >
          Delete order
        </VBtn>
      </div>
    </VCard>
  </VDialog>
</template>

<style scoped>
.delete-order-dialog {
  display: grid;
  gap: 14px;
  padding: 20px;
}

.delete-order-dialog h2 {
  margin: 0;
  font-size: 1.25rem;
}

.delete-order-dialog p {
  margin: 0;
  overflow-wrap: anywhere;
}

.delete-order-actions {
  display: flex;
  justify-content: end;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
