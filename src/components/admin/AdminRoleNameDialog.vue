<script setup>
import { computed, ref, useTemplateRef, watch } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VDialog } from 'vuetify/components/VDialog'
import { VTextField } from 'vuetify/components/VTextField'
import { aliases } from 'vuetify/iconsets/mdi-svg'

const props = defineProps({
  role: { type: Object, default: null },
  saving: Boolean,
  error: { type: String, default: '' },
  nameErrors: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'submit'])
const name = ref(props.role?.name ?? '')
const input = useTemplateRef('roleName')
const title = computed(() => (props.role ? 'Rename role' : 'New role'))
const canSave = computed(() => !!name.value.trim() && name.value.trim() !== props.role?.name)

function focusName() {
  input.value?.$el.querySelector('input')?.focus()
}

function close() {
  if (!props.saving) emit('close')
}

function submit() {
  if (canSave.value && !props.saving) emit('submit', name.value.trim())
}

watch(
  () => props.nameErrors,
  (errors) => {
    if (errors.length) focusName()
  },
  { flush: 'post' },
)
</script>

<template>
  <VDialog
    :model-value="true"
    :persistent="saving"
    max-width="448"
    aria-labelledby="role-name-dialog-title"
    @update:model-value="(open) => !open && close()"
    @after-enter="focusName"
  >
    <VCard color="surface" rounded="lg">
      <form @submit.prevent="submit">
        <div class="role-name-header">
          <div>
            <h2 id="role-name-dialog-title">{{ title }}</h2>
            <p v-if="!role">New roles start without permissions.</p>
          </div>
          <VBtn
            :icon="aliases.close"
            type="button"
            variant="text"
            size="small"
            aria-label="Close dialog"
            :disabled="saving"
            @click="close"
          />
        </div>
        <div class="role-name-body">
          <VAlert v-if="error" type="error" variant="tonal" :icon="false" role="alert">
            {{ error }}
          </VAlert>
          <VTextField
            ref="roleName"
            v-model="name"
            name="name"
            label="Role name"
            variant="outlined"
            density="comfortable"
            maxlength="255"
            hide-details="auto"
            required
            :disabled="saving"
            :error-messages="nameErrors"
          />
        </div>
        <footer class="role-name-footer">
          <VBtn
            type="button"
            variant="outlined"
            class="text-none"
            :disabled="saving"
            @click="close"
          >
            Cancel
          </VBtn>
          <VBtn
            type="submit"
            color="primary"
            variant="flat"
            class="text-none"
            :loading="saving"
            :disabled="saving || !canSave"
          >
            {{ role ? 'Save name' : 'Create role' }}
          </VBtn>
        </footer>
      </form>
    </VCard>
  </VDialog>
</template>

<style scoped>
.role-name-header,
.role-name-footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
}

.role-name-header h2 {
  margin: 0;
  font-size: 1.3125rem;
}

.role-name-header p {
  margin: 5px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.875rem;
}

.role-name-body {
  display: grid;
  gap: 12px;
  padding: 0 20px 16px;
}

.role-name-footer {
  justify-content: flex-end;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
</style>
