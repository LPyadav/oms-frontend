<script setup>
import { computed, nextTick, onScopeDispose, ref, shallowRef, useTemplateRef } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VDialog } from 'vuetify/components/VDialog'
import { VTextarea } from 'vuetify/components/VTextarea'
import { addOrderNote, loadOrder } from '../../api/orders'
import { useAuthStore } from '../../stores/auth'
import { canAddNoteToOrder } from '../../utils/orderActivityAccess'
import { MAX_ORDER_NOTE_LENGTH } from '../../utils/orderDraft'

const props = defineProps({ order: { type: Object, required: true } })
const emit = defineEmits(['close', 'refreshed', 'added', 'unavailable'])
const auth = useAuthStore()
const controller = new AbortController()
const snapshot = shallowRef(props.order)
const heading = useTemplateRef('heading')
const reviewButton = useTemplateRef('review-button')
const draft = ref('')
const bodyErrors = ref([])
const feedback = ref(null)
const saving = ref(false)
const reloading = ref(false)
const reviewRequired = ref(false)
const noteFound = ref(false)
const writeDenied = ref(false)
const busy = computed(() => saving.value || reloading.value)
const canWrite = computed(
  () => canAddNoteToOrder(snapshot.value, auth) && !noteFound.value && !writeDenied.value,
)
const body = computed(() => draft.value.trim())
const canSave = computed(() => canWrite.value && body.value && !busy.value && !reviewRequired.value)

function close() {
  if (!busy.value) emit('close')
}

function focusHeading() {
  heading.value?.focus({ preventScroll: true })
}

function showFailure(error) {
  if (error.status === 422) {
    bodyErrors.value = error.fields.body ?? []
    if (!bodyErrors.value.length) {
      feedback.value = { type: 'error', message: 'The note could not be validated.' }
    }
  } else if (error.status === 429 || (error.status === 503 && error.code === 'WRITE_CONTENTION')) {
    feedback.value = { type: 'error', message: 'The note could not be saved. Try again shortly.' }
  } else if (error.status === 404) {
    emit('unavailable')
  } else if (error.status === 403) {
    writeDenied.value = true
    feedback.value = { type: 'error', message: 'You no longer have permission to add a note.' }
  } else {
    reviewRequired.value = true
    feedback.value = {
      type: 'warning',
      message: 'The save could not be confirmed. Reload activity before sending this note again.',
    }
  }
}

async function submit() {
  if (!canSave.value) return

  saving.value = true
  bodyErrors.value = []
  feedback.value = null
  const id = snapshot.value.id
  let note
  try {
    note = await addOrderNote(auth.request, id, body.value, controller.signal)
  } catch (error) {
    if (!controller.signal.aborted && error.status !== 401) showFailure(error)
  } finally {
    saving.value = false
  }

  if (controller.signal.aborted) return
  if (note) emit('added', id, note)
  else if (reviewRequired.value) {
    await nextTick()
    reviewButton.value?.$el?.focus()
  }
}

async function reloadActivity() {
  if (busy.value || !reviewRequired.value) return

  reloading.value = true
  try {
    const latest = await loadOrder(auth.request, snapshot.value.id, controller.signal)
    if (controller.signal.aborted) return

    const knownIds = new Set(snapshot.value.notes.map((note) => note.id))
    noteFound.value = latest.notes.some(
      (note) =>
        !knownIds.has(note.id) && note.author?.id === auth.user?.id && note.body === body.value,
    )
    snapshot.value = latest
    reviewRequired.value = false
    let message = 'Activity reloaded. Your draft is ready if you want to try again.'
    if (noteFound.value) message = 'A new note with this text is already in Activity.'
    else if (!canWrite.value) message = 'Your access to add notes to this order has changed.'
    feedback.value = { type: 'info', message }
    emit('refreshed', latest)
  } catch (error) {
    if (controller.signal.aborted || error.status === 401) return
    if ([403, 404].includes(error.status)) emit('unavailable')
    else feedback.value = { type: 'error', message: 'Unable to reload activity. Try again.' }
  } finally {
    reloading.value = false
    await nextTick()
    if (!controller.signal.aborted) {
      if (reviewRequired.value) reviewButton.value?.$el?.focus()
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
    aria-labelledby="order-note-heading"
    aria-describedby="order-note-context"
    @update:model-value="
      (open) => {
        if (!open) close()
      }
    "
    @after-enter="focusHeading"
  >
    <VCard color="surface" rounded="lg">
      <form class="note-dialog" novalidate @submit.prevent="submit">
        <header>
          <h2 id="order-note-heading" ref="heading" tabindex="-1">Add note</h2>
          <p id="order-note-context">{{ snapshot.order_number }}</p>
        </header>
        <VAlert
          v-if="feedback"
          :type="feedback.type"
          :role="feedback.type === 'info' ? 'status' : 'alert'"
          variant="tonal"
          :icon="false"
        >
          <p class="feedback-message">{{ feedback.message }}</p>
        </VAlert>
        <VTextarea
          v-model="draft"
          label="Note"
          rows="4"
          :maxlength="MAX_ORDER_NOTE_LENGTH"
          :readonly="reviewRequired || !canWrite"
          :disabled="busy"
          :error-messages="bodyErrors"
          variant="outlined"
          density="comfortable"
          @update:model-value="bodyErrors = []"
        />
        <div class="note-actions">
          <VBtn type="button" variant="outlined" :disabled="busy" class="text-none" @click="close">
            Close
          </VBtn>
          <VBtn
            v-if="reviewRequired"
            ref="review-button"
            type="button"
            color="primary"
            variant="flat"
            :loading="reloading"
            :disabled="busy"
            class="text-none"
            @click="reloadActivity"
          >
            Reload activity
          </VBtn>
          <VBtn
            v-else-if="canWrite"
            type="submit"
            color="primary"
            variant="flat"
            :disabled="!canSave"
            :loading="saving"
            class="text-none"
          >
            Save note
          </VBtn>
        </div>
      </form>
    </VCard>
  </VDialog>
</template>

<style scoped>
.note-dialog {
  display: grid;
  gap: 14px;
  padding: 20px;
}

.note-dialog h2 {
  margin: 0;
  font-size: 1.25rem;
}

.note-dialog h2:focus {
  outline: none;
}

.note-dialog header p {
  margin: 4px 0 0;
}

.feedback-message {
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
}

.note-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: 8px;
}
</style>
