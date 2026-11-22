<script setup>
import { computed, nextTick, onMounted, onScopeDispose, useTemplateRef } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VCheckbox } from 'vuetify/components/VCheckbox'
import { VChip } from 'vuetify/components/VChip'
import { VDialog } from 'vuetify/components/VDialog'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { useUserPermissions } from '../../composables/useUserPermissions'
import { useAuthStore } from '../../stores/auth'
import { getPermissionLabel, groupPermissions } from '../../utils/permissions'

const props = defineProps({
  account: { type: Object, required: true },
})
const emit = defineEmits(['close', 'saved'])
const auth = useAuthStore()
const heading = useTemplateRef('heading')
const directHeading = useTemplateRef('directHeading')
const requests = new AbortController()
const {
  grants,
  catalog,
  selectedPermissions,
  loading,
  saving,
  loadError,
  saveError,
  reloadRequired,
  canEdit,
  canSave,
  load,
  save,
} = useUserPermissions({ request: auth.request, userId: props.account.id, signal: requests.signal })
const groups = computed(() => groupPermissions(catalog.value))

function close() {
  if (!saving.value) emit('close')
}

function focusHeading() {
  heading.value?.focus({ preventScroll: true })
}

async function clearDirectGrants() {
  selectedPermissions.value = []
  await nextTick()
  directHeading.value?.focus({ preventScroll: true })
}

async function submit() {
  if (!auth.canAssignUserRoles) return

  const updated = await save()
  if (updated) emit('saved', updated.userId)
}

onMounted(() => void load())
onScopeDispose(() => requests.abort())
</script>

<template>
  <VDialog
    :model-value="true"
    :persistent="saving"
    max-width="640"
    aria-labelledby="user-permissions-title"
    aria-describedby="user-permissions-account"
    @update:model-value="(open) => !open && close()"
    @after-enter="focusHeading"
  >
    <VCard color="surface" rounded="lg">
      <form class="permissions-form" @submit.prevent="submit">
        <header class="permissions-header">
          <div>
            <h2 id="user-permissions-title" ref="heading" tabindex="-1">Edit permissions</h2>
            <p id="user-permissions-account">{{ account.name }} · {{ account.email }}</p>
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
        </header>

        <div class="permissions-body">
          <div v-if="loading" class="permissions-state" role="status">
            <VProgressLinear color="primary" indeterminate aria-hidden="true" />
            <span>Loading permissions…</span>
          </div>
          <template v-else>
            <div v-if="loadError || saveError" class="permissions-state">
              <VAlert type="error" variant="tonal" :icon="false" role="alert">
                {{ loadError || saveError }}
              </VAlert>
              <VBtn
                v-if="loadError || reloadRequired"
                type="button"
                variant="outlined"
                class="text-none"
                @click="load"
              >
                Reload grants
              </VBtn>
            </div>

            <template v-if="grants">
              <section class="inherited-grants" aria-labelledby="inherited-grants-title">
                <h3 id="inherited-grants-title">Inherited from roles</h3>
                <p>Read-only. These permissions stay in effect when direct grants are removed.</p>
                <ul v-if="grants.inheritedPermissions.length" class="inherited-list" role="list">
                  <li v-for="permission in grants.inheritedPermissions" :key="permission">
                    <VChip color="primary" variant="tonal" size="small" label>
                      {{ getPermissionLabel(permission) }}
                    </VChip>
                  </li>
                </ul>
                <p v-else>No inherited permissions.</p>
              </section>

              <fieldset class="direct-grants" :disabled="!canEdit">
                <legend ref="directHeading" tabindex="-1">Direct grants</legend>
                <div class="direct-grants-toolbar">
                  <span aria-live="polite">{{ selectedPermissions.length }} selected</span>
                  <VBtn
                    type="button"
                    class="text-none"
                    color="primary"
                    variant="text"
                    size="small"
                    :disabled="!canEdit || selectedPermissions.length === 0"
                    @click="clearDirectGrants"
                  >
                    Clear direct grants
                  </VBtn>
                </div>
                <p v-if="!groups.length && !loadError">No permissions are available to grant.</p>
                <details
                  v-for="([group, permissions], index) in groups"
                  :key="group"
                  class="grant-group"
                  :open="
                    index === 0 ||
                    permissions.some((name) => grants.directPermissions.includes(name))
                  "
                >
                  <summary>{{ group }}</summary>
                  <VCheckbox
                    v-for="permission in permissions"
                    :key="permission"
                    v-model="selectedPermissions"
                    :label="getPermissionLabel(permission)"
                    :value="permission"
                    :true-icon="aliases.checkboxOn"
                    :false-icon="aliases.checkboxOff"
                    :disabled="!canEdit"
                    color="primary"
                    density="compact"
                    hide-details
                  />
                </details>
              </fieldset>
            </template>
          </template>
        </div>

        <footer class="permissions-footer">
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
            :disabled="!canSave"
          >
            Save permissions
          </VBtn>
        </footer>
      </form>
    </VCard>
  </VDialog>
</template>

<style scoped>
.permissions-form {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  max-block-size: min(720px, calc(100dvh - 48px));
}

.permissions-header,
.permissions-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
}

.permissions-header {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.permissions-header h2 {
  margin: 0;
  font-size: 1.3125rem;
  line-height: 1.2;
}

.permissions-header p,
.inherited-grants p {
  margin: 6px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}

.permissions-header h2:focus,
.direct-grants legend:focus {
  outline: none;
}

.permissions-body {
  display: grid;
  gap: 16px;
  align-content: start;
  overflow-y: auto;
  padding: 16px 20px;
}

.permissions-state {
  display: grid;
  gap: 10px;
  justify-items: start;
}

.inherited-grants {
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), 0.055);
}

.inherited-grants h3,
.direct-grants legend {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.inherited-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.inherited-list li {
  max-inline-size: 100%;
}

.inherited-list :deep(.v-chip) {
  height: auto;
  min-height: 26px;
}

.inherited-list :deep(.v-chip__content) {
  white-space: normal;
  overflow-wrap: anywhere;
}

.direct-grants {
  min-inline-size: 0;
  padding: 0;
  border: 0;
}

.direct-grants-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-bottom: 4px;
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
}

.grant-group {
  padding-block: 7px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  overflow-wrap: anywhere;
}

.grant-group summary {
  padding-block: 3px;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
}

.permissions-footer {
  justify-content: flex-end;
  flex-wrap: wrap;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
</style>
