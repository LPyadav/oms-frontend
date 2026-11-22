<script setup>
import { computed, onMounted, onScopeDispose, ref, useTemplateRef, watch } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VChip } from 'vuetify/components/VChip'
import { VDialog } from 'vuetify/components/VDialog'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'
import { VTextarea } from 'vuetify/components/VTextarea'
import { VTextField } from 'vuetify/components/VTextField'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { useCustomerProfile } from '../../composables/useCustomerProfile'
import { useAuthStore } from '../../stores/auth'

const props = defineProps({
  customerId: { type: Number, default: null },
})
const emit = defineEmits(['close', 'changed'])
const auth = useAuthStore()
const heading = useTemplateRef('heading')
const requests = new AbortController()
const notice = ref('')
const {
  mode,
  customer,
  draft,
  loading,
  saving,
  readError,
  writeError,
  canSubmit,
  load,
  openEdit,
  openDeactivation,
  showProfile,
  save,
} = useCustomerProfile({
  request: auth.request,
  customerId: props.customerId,
  canManage: () => auth.canManageCustomers,
  signal: requests.signal,
})

const titles = { create: 'New customer', edit: 'Edit customer', deactivate: 'Deactivate customer' }
const submitLabels = { create: 'Create customer', edit: 'Save changes', deactivate: 'Deactivate' }
const savedNotices = {
  create: 'Customer created.',
  edit: 'Customer updated.',
  deactivate: 'Customer deactivated.',
}
const title = computed(() => titles[mode.value] ?? customer.value?.name ?? 'Customer profile')
const editing = computed(() => mode.value === 'create' || mode.value === 'edit')
const fieldErrors = computed(() => writeError.value?.fields ?? {})

function failureMessage(failure, fallback) {
  if (failure.status === 403) return 'You no longer have access to perform this action.'
  if (failure.status === 404) return 'This customer could not be found.'
  if (failure.status === 422) return 'Check the highlighted fields and try again.'
  if (failure.status === 429) return 'Too many requests. Try again shortly.'
  if (failure.code === 'WRITE_CONTENTION') {
    const seconds = Number(failure.retryAfter)
    return seconds > 0
      ? `The service is busy. Try again in ${seconds} seconds.`
      : 'The service is busy. Try again shortly.'
  }
  return fallback
}

function focusHeading() {
  heading.value?.focus({ preventScroll: true })
}

function close() {
  if (!saving.value) emit('close')
}

async function submit() {
  const operation = mode.value
  const saved = await save()
  if (!saved) return
  notice.value = savedNotices[operation]
  emit('changed')
}

watch(mode, focusHeading, { flush: 'post' })
onMounted(() => void load())
onScopeDispose(() => requests.abort())
</script>

<template>
  <VDialog
    :model-value="true"
    :persistent="saving"
    max-width="608"
    aria-labelledby="customer-profile-title"
    @update:model-value="(open) => !open && close()"
    @after-enter="focusHeading"
  >
    <VCard color="surface" rounded="lg">
      <form class="customer-dialog" novalidate @submit.prevent="submit">
        <header class="customer-dialog-header">
          <h2 id="customer-profile-title" ref="heading" tabindex="-1">{{ title }}</h2>
          <VBtn
            :icon="aliases.close"
            aria-label="Close dialog"
            type="button"
            variant="text"
            size="small"
            :disabled="saving"
            @click="close"
          />
        </header>

        <div class="customer-dialog-body">
          <div v-if="loading" class="customer-dialog-state" role="status">
            <VProgressLinear color="primary" indeterminate aria-hidden="true" />
            <span>Loading customer…</span>
          </div>
          <div v-else-if="readError" class="customer-dialog-state">
            <VAlert type="error" variant="tonal" :icon="false" role="alert">
              {{ failureMessage(readError, 'Unable to load this customer.') }}
            </VAlert>
            <VBtn
              v-if="![403, 404].includes(readError.status)"
              type="button"
              variant="outlined"
              class="text-none"
              @click="load"
            >
              Try again
            </VBtn>
          </div>
          <template v-else>
            <VAlert v-if="writeError" type="error" variant="tonal" :icon="false" role="alert">
              {{
                failureMessage(
                  writeError,
                  'Could not confirm the change. Check the directory before retrying.',
                )
              }}
            </VAlert>
            <div v-if="editing" class="customer-dialog-fields">
              <VTextField
                v-model="draft.name"
                class="customer-detail-wide"
                label="Customer name"
                autocomplete="organization"
                variant="outlined"
                density="comfortable"
                maxlength="255"
                required
                hide-details="auto"
                :disabled="saving"
                :error-messages="fieldErrors.name ?? []"
              />
              <VTextField
                v-model="draft.email"
                label="Email"
                type="email"
                autocomplete="email"
                variant="outlined"
                density="comfortable"
                maxlength="254"
                hide-details="auto"
                :disabled="saving"
                :error-messages="fieldErrors.email ?? []"
              />
              <VTextField
                v-model="draft.phone"
                label="Phone"
                type="tel"
                autocomplete="tel"
                variant="outlined"
                density="comfortable"
                maxlength="32"
                hide-details="auto"
                :disabled="saving"
                :error-messages="fieldErrors.phone ?? []"
              />
              <VTextarea
                v-model="draft.address"
                class="customer-detail-wide"
                label="Address"
                autocomplete="street-address"
                variant="outlined"
                density="comfortable"
                rows="3"
                maxlength="1000"
                hide-details="auto"
                :disabled="saving"
                :error-messages="fieldErrors.address ?? []"
              />
            </div>
            <p v-else-if="mode === 'deactivate'">
              Deactivate <strong>{{ customer.name }}</strong>? Their profile will remain in the
              directory with an Inactive status.
            </p>
            <template v-else-if="customer">
              <VAlert v-if="notice" color="primary" variant="tonal" :icon="false" role="status">
                {{ notice }}
              </VAlert>
              <dl class="customer-dialog-fields customer-profile">
                <div>
                  <dt>Status</dt>
                  <dd>
                    <VChip
                      :color="customer.is_active ? 'primary' : undefined"
                      size="small"
                      variant="tonal"
                      label
                    >
                      {{ customer.is_active ? 'Active' : 'Inactive' }}
                    </VChip>
                  </dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{{ customer.phone || 'Not provided' }}</dd>
                </div>
                <div class="customer-detail-wide">
                  <dt>Email</dt>
                  <dd>{{ customer.email || 'Not provided' }}</dd>
                </div>
                <div class="customer-detail-wide">
                  <dt>Address</dt>
                  <dd>{{ customer.address || 'Not provided' }}</dd>
                </div>
              </dl>
            </template>
          </template>
        </div>

        <footer class="customer-dialog-footer">
          <VBtn
            type="button"
            variant="text"
            class="text-none"
            :disabled="saving"
            @click="mode === 'create' || mode === 'profile' ? close() : showProfile()"
          >
            {{ mode === 'profile' ? 'Close' : 'Cancel' }}
          </VBtn>
          <template v-if="mode === 'profile'">
            <template v-if="customer && auth.canManageCustomers">
              <VBtn
                v-if="customer.is_active"
                type="button"
                color="error"
                variant="text"
                class="text-none"
                @click="openDeactivation"
              >
                Deactivate
              </VBtn>
              <VBtn
                type="button"
                color="primary"
                variant="flat"
                class="text-none"
                @click="openEdit"
              >
                Edit customer
              </VBtn>
            </template>
          </template>
          <VBtn
            v-else
            type="submit"
            :color="mode === 'deactivate' ? 'error' : 'primary'"
            variant="flat"
            class="text-none"
            :loading="saving"
            :disabled="!canSubmit"
          >
            {{ submitLabels[mode] }}
          </VBtn>
        </footer>
      </form>
    </VCard>
  </VDialog>
</template>

<style scoped>
.customer-dialog {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  max-block-size: min(42rem, calc(100dvh - 48px));
}

.customer-dialog-header,
.customer-dialog-footer {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  padding: 14px 20px;
}

.customer-dialog-header {
  justify-content: space-between;
  flex-wrap: nowrap;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.customer-dialog-header h2 {
  min-inline-size: 0;
  margin: 0;
  font-size: 1.25rem;
  overflow-wrap: anywhere;
}

.customer-dialog-header h2:focus {
  outline: none;
}

.customer-dialog-body {
  display: grid;
  gap: 16px;
  align-content: start;
  padding: 16px 20px;
  overflow-y: auto;
  overscroll-behavior-y: contain;
}

.customer-dialog-body p {
  margin: 0;
  overflow-wrap: anywhere;
}

.customer-dialog-state {
  display: grid;
  gap: 12px;
  justify-items: start;
}

.customer-dialog-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.customer-detail-wide {
  grid-column: 1 / -1;
}

.customer-profile {
  margin: 0;
}

.customer-profile dt {
  margin-bottom: 3px;
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
  font-weight: 500;
}

.customer-profile dd {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.customer-dialog-footer {
  justify-content: flex-end;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

@media (max-width: 500px) {
  .customer-dialog-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
