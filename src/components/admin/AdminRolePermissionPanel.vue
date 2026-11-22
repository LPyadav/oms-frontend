<script setup>
import { computed } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCheckbox } from 'vuetify/components/VCheckbox'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import DirectoryState from '../directory/DirectoryState.vue'
import { getPermissionLabel, groupPermissions } from '../../utils/permissions'

const props = defineProps({
  roleId: { type: Number, required: true },
  permissionKeys: { type: Array, required: true },
  readOnly: Boolean,
  editable: Boolean,
  adminOnlyPermissions: { type: Set, required: true },
  blockedPermissions: { type: Set, required: true },
  loading: Boolean,
  loadError: { type: String, default: '' },
  error: { type: String, default: '' },
  saving: Boolean,
  canSave: Boolean,
})
const emit = defineEmits(['retry', 'submit'])
const selectedPermissions = defineModel({ type: Array, required: true })
const permissionGroups = computed(() => groupPermissions(props.permissionKeys))
</script>

<template>
  <DirectoryState
    v-if="!readOnly && loading"
    class="permission-state"
    kind="loading"
    message="Loading permissions…"
  />
  <DirectoryState
    v-else-if="!readOnly && loadError"
    class="permission-state"
    kind="error"
    :message="loadError"
  >
    <template #actions>
      <VBtn type="button" variant="outlined" class="text-none" @click="emit('retry')">
        Try again
      </VBtn>
    </template>
  </DirectoryState>
  <form v-else @submit.prevent="emit('submit')">
    <fieldset class="permissions-fieldset" :disabled="!editable">
      <legend>Permissions</legend>
      <section
        v-if="permissionGroups.length"
        :key="roleId"
        class="permission-groups"
        aria-label="Permission groups"
        tabindex="0"
      >
        <details
          v-for="([group, permissions], index) in permissionGroups"
          :key="group"
          :open="index === 0"
        >
          <summary>{{ group }}</summary>
          <VCheckbox
            v-for="permission in permissions"
            :key="permission"
            v-model="selectedPermissions"
            :value="permission"
            :true-icon="aliases.checkboxOn"
            :false-icon="aliases.checkboxOff"
            :disabled="!editable || blockedPermissions.has(permission)"
            color="primary"
            density="compact"
            hide-details
          >
            <template #label>
              <span>
                {{ getPermissionLabel(permission) }}
                <span
                  v-if="!readOnly && adminOnlyPermissions.has(permission)"
                  class="permission-restriction"
                >
                  {{
                    blockedPermissions.has(permission)
                      ? '· Admin only'
                      : '· Existing Admin-only grant'
                  }}
                </span>
              </span>
            </template>
          </VCheckbox>
        </details>
      </section>
      <p v-else>No permissions to display.</p>
      <VAlert v-if="error" class="mt-3" type="error" variant="tonal" :icon="false" role="alert">
        {{ error }}
      </VAlert>
    </fieldset>
    <footer v-if="!readOnly" class="permission-footer">
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
</template>

<style scoped>
.permission-state {
  display: grid;
  gap: 12px;
  justify-items: start;
  margin: 0;
  padding: 14px 16px;
}

.permissions-fieldset {
  min-width: 0;
  margin: 14px 16px;
  padding: 0;
  border: 0;
}

.permissions-fieldset legend,
.permissions-fieldset summary {
  padding-block: 8px;
  font-weight: 600;
}

.permission-groups {
  block-size: clamp(10rem, calc(100dvh - 26rem), 28rem);
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-gutter: stable;
  overflow-wrap: anywhere;
  padding-inline-end: 8px;
}

.permission-groups:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.permissions-fieldset details,
.permission-footer {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.permissions-fieldset details {
  padding-bottom: 3px;
}

.permissions-fieldset summary {
  cursor: pointer;
}

.permission-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 16px;
}

.permission-restriction {
  font-size: 0.8125rem;
}

@media (max-width: 650px) {
  .permission-groups {
    block-size: clamp(9rem, 40dvh, 18rem);
  }
}
</style>
