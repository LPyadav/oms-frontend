<script setup>
import { computed, onScopeDispose, reactive, ref, useTemplateRef, watch } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VCheckbox } from 'vuetify/components/VCheckbox'
import { VDialog } from 'vuetify/components/VDialog'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'
import { VTextField } from 'vuetify/components/VTextField'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { loadRoleNames } from '../../api/adminRoles'
import { getUserAccountBody } from '../../composables/useUserAccountActions'
import { useAuthStore } from '../../stores/auth'

const props = defineProps({
  mode: { type: String, required: true },
  account: { type: Object, default: null },
  canManageAccess: Boolean,
  isSelf: Boolean,
  saving: Boolean,
  message: { type: String, default: '' },
  fieldErrors: { type: Object, required: true },
})
const emit = defineEmits([
  'close',
  'change-status',
  'assign-roles',
  'edit-permissions',
  'submit',
  'clear-field-error',
])
const auth = useAuthStore()
const form = useTemplateRef('form')
const cancelButton = useTemplateRef('cancelButton')
const creating = computed(() => props.mode === 'create')
const disabling = computed(() => props.mode === 'disable')
const changingStatus = computed(() => disabling.value || props.mode === 'enable')
const statusMode = computed(() => (props.account?.is_active ? 'disable' : 'enable'))
const assigningRoles = computed(() => props.mode === 'roles')
const draft = reactive({
  name: props.account?.name ?? '',
  email: props.account?.email ?? '',
  password: '',
})
const selectedRoles = ref([])
const builtInRoleLabels = new Map([
  ['admin', 'Admin'],
  ['manager', 'Manager'],
  ['staff', 'Staff'],
])
const roleNames = ref(null)
const rolesLoading = ref(false)
const rolesError = ref('')
const roleRequests = new AbortController()
const body = computed(() => {
  if (assigningRoles.value) return { roles: selectedRoles.value }
  return changingStatus.value ? {} : getUserAccountBody(props.mode, draft, props.account)
})
const accountCopy = {
  create: { title: 'Add user', submit: 'Create user' },
  edit: { title: 'Edit user', submit: 'Save changes' },
  roles: { title: 'Assign roles', submit: 'Save roles' },
  disable: { title: 'Disable account', submit: 'Disable account' },
  enable: { title: 'Enable account', submit: 'Enable account' },
}
const copy = computed(() => accountCopy[props.mode])
const unchanged = computed(() => props.mode === 'edit' && !Object.keys(body.value).length)
const rolesChanged = computed(() => {
  const existing = props.account?.roles ?? []
  return (
    selectedRoles.value.length !== existing.length ||
    selectedRoles.value.some((role) => !existing.includes(role))
  )
})
const submitDisabled = computed(
  () =>
    props.saving ||
    unchanged.value ||
    (assigningRoles.value && (!props.canManageAccess || !roleNames.value || !rolesChanged.value)),
)

async function loadRoles() {
  const { signal } = roleRequests
  if (rolesLoading.value || signal.aborted) return

  rolesLoading.value = true
  roleNames.value = null
  rolesError.value = ''
  try {
    const names = await loadRoleNames(auth.request, signal)
    if (signal.aborted) return

    if (props.account.roles.some((role) => !names.includes(role))) {
      rolesError.value = 'Assigned roles have changed. Reload the Users page before editing roles.'
      return
    }
    roleNames.value = names
  } catch (failure) {
    if (!signal.aborted && failure.status !== 401) {
      rolesError.value =
        failure.status === 403
          ? 'You do not have permission to view roles.'
          : 'Unable to load roles.'
    }
  } finally {
    rolesLoading.value = false
  }
}

function focusInitialControl() {
  if (changingStatus.value || assigningRoles.value) cancelButton.value?.$el.focus()
  else form.value?.elements.namedItem('name')?.focus()
}

function close() {
  if (!props.saving) emit('close')
}

function handleVisibility(open) {
  if (!open) close()
}

function submit() {
  if (submitDisabled.value) return

  emit('submit', body.value)
}

watch(() => props.mode, focusInitialControl, { flush: 'post' })
watch(
  assigningRoles,
  (active) => {
    if (!active) return

    selectedRoles.value = [...props.account.roles]
    void loadRoles()
  },
  { immediate: true },
)
onScopeDispose(() => roleRequests.abort())
watch(
  () => props.fieldErrors,
  (errors, previous) => {
    const field = ['name', 'email', 'password'].find(
      (name) => errors[name]?.length && errors[name] !== previous[name],
    )
    if (field) form.value?.elements.namedItem(field)?.focus()
  },
  { flush: 'post' },
)
</script>

<template>
  <VDialog
    :model-value="true"
    :persistent="saving"
    max-width="448"
    aria-labelledby="user-account-dialog-title"
    aria-describedby="user-account-dialog-description"
    @update:model-value="handleVisibility"
    @after-enter="focusInitialControl"
  >
    <VCard color="surface" rounded="lg">
      <form ref="form" autocomplete="off" @submit.prevent="submit">
        <header class="account-dialog-header">
          <div>
            <h2 id="user-account-dialog-title">{{ copy.title }}</h2>
            <p id="user-account-dialog-description">
              <template v-if="creating">New accounts start without a role.</template>
              <template v-else-if="disabling">
                <strong>{{ account.name }}</strong> will lose access to OMS and be signed out of all
                sessions.
                <span v-if="isSelf">This will end your current session.</span>
              </template>
              <template v-else-if="changingStatus">
                <strong>{{ account.name }}</strong> will be able to sign in again.
              </template>
              <template v-else>{{ account.name }}</template>
            </p>
          </div>
          <VBtn
            :icon="aliases.close"
            variant="text"
            size="small"
            aria-label="Close dialog"
            :disabled="saving"
            @click="close"
          />
        </header>

        <div class="account-dialog-body">
          <VAlert v-if="message" type="error" variant="tonal" :icon="false" role="alert">
            {{ message }}
          </VAlert>

          <template v-if="assigningRoles">
            <div v-if="rolesLoading" role="status" class="roles-loading">
              <VProgressLinear color="primary" indeterminate aria-hidden="true" />
              <span>Loading roles…</span>
            </div>
            <template v-else-if="rolesError">
              <VAlert type="error" variant="tonal" :icon="false" role="alert">
                {{ rolesError }}
              </VAlert>
              <VBtn class="text-none" variant="outlined" type="button" @click="loadRoles">
                Try again
              </VBtn>
            </template>
            <fieldset
              v-else-if="roleNames?.length"
              class="role-options"
              :disabled="saving || !canManageAccess"
              :aria-describedby="fieldErrors.roles?.length ? 'user-role-errors' : undefined"
            >
              <legend>Assigned roles</legend>
              <div class="role-options-list">
                <VCheckbox
                  v-for="role in roleNames"
                  :key="role"
                  v-model="selectedRoles"
                  :label="builtInRoleLabels.get(role) ?? role"
                  :value="role"
                  :true-icon="aliases.checkboxOn"
                  :false-icon="aliases.checkboxOff"
                  :disabled="saving || !canManageAccess"
                  color="primary"
                  density="compact"
                  hide-details
                  @update:model-value="emit('clear-field-error', 'roles')"
                />
              </div>
            </fieldset>
            <p v-else-if="roleNames">No roles are available.</p>
            <VAlert
              v-if="fieldErrors.roles?.length"
              id="user-role-errors"
              type="error"
              variant="tonal"
              :icon="false"
              role="alert"
            >
              <div v-for="error in fieldErrors.roles" :key="error">{{ error }}</div>
            </VAlert>
          </template>

          <template v-else-if="!changingStatus">
            <VTextField
              v-model="draft.name"
              name="name"
              label="Full name"
              variant="outlined"
              density="comfortable"
              maxlength="255"
              required
              hide-details="auto"
              :disabled="saving"
              :error-messages="fieldErrors.name ?? []"
              @update:model-value="emit('clear-field-error', 'name')"
            />
            <VTextField
              v-model="draft.email"
              name="email"
              label="Email address"
              type="email"
              variant="outlined"
              density="comfortable"
              maxlength="254"
              required
              hide-details="auto"
              :disabled="saving"
              :error-messages="fieldErrors.email ?? []"
              @update:model-value="emit('clear-field-error', 'email')"
            />
            <VTextField
              v-if="creating"
              v-model="draft.password"
              name="password"
              label="Password"
              type="password"
              autocomplete="new-password"
              variant="outlined"
              density="comfortable"
              minlength="8"
              maxlength="1024"
              required
              hide-details="auto"
              :disabled="saving"
              :error-messages="fieldErrors.password ?? []"
              @update:model-value="emit('clear-field-error', 'password')"
            />
            <div v-if="!creating" class="account-secondary-actions">
              <VBtn
                v-if="canManageAccess"
                type="button"
                variant="outlined"
                class="text-none"
                :disabled="saving"
                @click="emit('assign-roles')"
              >
                Assign roles
              </VBtn>
              <VBtn
                v-if="canManageAccess"
                type="button"
                variant="outlined"
                class="text-none"
                :disabled="saving"
                @click="emit('edit-permissions')"
              >
                Edit permissions
              </VBtn>
              <VBtn
                type="button"
                variant="text"
                :color="statusMode === 'disable' ? 'error' : 'primary'"
                class="text-none"
                :disabled="saving"
                @click="emit('change-status', statusMode)"
              >
                {{ accountCopy[statusMode].title }}
              </VBtn>
            </div>
          </template>
        </div>

        <footer class="account-dialog-footer">
          <VBtn
            ref="cancelButton"
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
            :color="disabling ? 'error' : 'primary'"
            variant="flat"
            class="text-none"
            :loading="saving"
            :disabled="submitDisabled"
          >
            {{ copy.submit }}
          </VBtn>
        </footer>
      </form>
    </VCard>
  </VDialog>
</template>

<style scoped>
.account-dialog-header,
.account-dialog-footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
}

.account-dialog-header h2 {
  margin: 0;
  font-size: 1.3125rem;
  line-height: 1.2;
}

.account-dialog-header p {
  margin: 6px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.875rem;
}

.account-dialog-body {
  display: grid;
  gap: 14px;
  padding-inline: 20px;
}

.account-dialog-body:not(:empty) {
  padding-bottom: 16px;
}

.account-secondary-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.roles-loading {
  display: grid;
  gap: 8px;
}

.role-options {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.role-options legend {
  font-weight: 600;
}

.role-options-list {
  max-height: 242px;
  overflow-y: auto;
}

.account-dialog-footer {
  flex-wrap: wrap;
  justify-content: flex-end;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
</style>
