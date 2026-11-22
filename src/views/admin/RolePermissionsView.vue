<script setup>
import { computed, nextTick, onMounted, onScopeDispose, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VList, VListItem } from 'vuetify/components/VList'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import AdminRoleNameDialog from '../../components/admin/AdminRoleNameDialog.vue'
import AdminRolePermissionPanel from '../../components/admin/AdminRolePermissionPanel.vue'
import DirectoryPagination from '../../components/directory/DirectoryPagination.vue'
import DirectoryPanel from '../../components/directory/DirectoryPanel.vue'
import DirectoryState from '../../components/directory/DirectoryState.vue'
import { isBuiltInRole, useRoleManagement } from '../../composables/useRoleManagement'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const heading = useTemplateRef('heading')
const rolesHeading = useTemplateRef('rolesHeading')
const requests = new AbortController()
const refreshingAccess = ref(false)
let dialogTrigger
const {
  page,
  pageLoading,
  pageError,
  requestedPage,
  loadPage,
  selectRole,
  selectedRole,
  selectedBuiltIn,
  permissionsReadOnly,
  permissionsEditable,
  canSavePermissions,
  adminOnlyPermissions,
  blockedPermissions,
  catalog,
  catalogLoading,
  catalogError,
  loadCatalog,
  missingPermissions,
  selectedPermissions,
  permissionError,
  savePermissions,
  nameDialog,
  nameError,
  nameErrors,
  openNameDialog,
  closeNameDialog,
  saveRoleName,
  saving,
  notice,
} = useRoleManagement({ request: auth.request, signal: requests.signal })

const busy = computed(() => saving.value || refreshingAccess.value)
const canEditPermissions = computed(() => permissionsEditable.value && !refreshingAccess.value)
const permissionKeys = computed(
  () =>
    (permissionsReadOnly.value ? selectedRole.value?.permissions : catalog.value?.permissions) ??
    [],
)
const permissionCatalogError = computed(
  () =>
    catalogError.value ||
    (missingPermissions.value
      ? 'Some assigned permissions are missing from the catalog. Refresh before saving.'
      : ''),
)
const roleDescription = computed(() => {
  if (permissionsReadOnly.value) return 'Built-in role · permissions are read-only'
  return selectedBuiltIn.value ? 'Built-in role' : 'Custom role'
})

function roleLabel(role) {
  return isBuiltInRole(role.name)
    ? role.name.charAt(0).toUpperCase() + role.name.slice(1)
    : role.name
}

async function changePage(number) {
  await loadPage(number)
  await nextTick()
  rolesHeading.value?.focus()
}

function beginNameEdit(role, event) {
  dialogTrigger = event.currentTarget
  openNameDialog(role)
}

async function restoreFocus() {
  await nextTick()
  const trigger = dialogTrigger
  dialogTrigger = null
  if (trigger?.isConnected && !trigger.disabled) trigger.focus({ preventScroll: true })
  else rolesHeading.value?.focus({ preventScroll: true })
}

function dismissNameDialog() {
  closeNameDialog()
  void restoreFocus()
}

async function refreshOwnAccess(change) {
  if (!change?.previousName || !auth.user?.roles.includes(change.previousName)) return

  refreshingAccess.value = true
  try {
    const profile = await auth.refreshCurrentUser()
    if (!profile || requests.signal.aborted || auth.canManageRoles) return

    await router.replace({ name: auth.canManageUsers ? 'admin-users' : 'workspace' })
  } finally {
    refreshingAccess.value = false
  }
}

async function submitName(name) {
  const change = await saveRoleName(name)
  if (!change) return

  await refreshOwnAccess(change)
  await restoreFocus()
}

async function submitPermissions() {
  if (!canSavePermissions.value || refreshingAccess.value) return

  await refreshOwnAccess(await savePermissions())
}

onMounted(() => {
  heading.value?.focus({ preventScroll: true })
  void loadPage()
  void loadCatalog()
})
onScopeDispose(() => requests.abort())
</script>

<template>
  <section v-if="auth.canManageRoles" class="role-management" aria-labelledby="roles-page-title">
    <header class="role-page-header">
      <div>
        <h1 ref="heading" id="roles-page-title" tabindex="-1">Roles &amp; permissions</h1>
        <p>Changes to a role’s permissions apply to all users assigned to that role.</p>
      </div>
      <VBtn
        color="primary"
        variant="flat"
        rounded="lg"
        type="button"
        class="text-none"
        :prepend-icon="aliases.plus"
        :disabled="busy || pageLoading"
        @click="beginNameEdit(null, $event)"
        >New role</VBtn
      >
    </header>

    <VAlert
      v-if="notice"
      class="role-notice"
      color="primary"
      variant="tonal"
      :icon="false"
      role="status"
    >
      {{ notice }}
      <span v-if="refreshingAccess"> Checking your access…</span>
    </VAlert>

    <div class="role-grid">
      <DirectoryPanel class="role-card">
        <header class="role-card-header">
          <h2 ref="rolesHeading" tabindex="-1">Roles</h2>
        </header>
        <DirectoryState
          v-if="pageLoading"
          class="role-state"
          kind="loading"
          message="Loading roles…"
        />
        <DirectoryState v-else-if="pageError" class="role-state" kind="error" :message="pageError">
          <template #actions>
            <VBtn
              class="text-none"
              variant="outlined"
              type="button"
              @click="changePage(requestedPage)"
            >
              Try again
            </VBtn>
          </template>
        </DirectoryState>
        <template v-else-if="page">
          <DirectoryState
            v-if="!page.roles.length"
            class="role-state"
            kind="empty"
            message="No roles found on this page."
          />
          <VList v-else nav aria-label="Select a role" class="role-list">
            <VListItem
              v-for="role in page.roles"
              :key="role.id"
              tag="button"
              type="button"
              role="button"
              :title="roleLabel(role)"
              :active="selectedRole?.id === role.id"
              :aria-pressed="selectedRole?.id === role.id"
              :disabled="busy"
              color="primary"
              rounded="lg"
              @click="selectRole(role)"
            />
          </VList>
          <DirectoryPagination
            v-if="page.lastPage > 1 || page.currentPage > page.lastPage"
            class="role-pagination"
            label="Role pages"
            previous-label="Previous roles page"
            next-label="Next roles page"
            :current-page="page.currentPage"
            :last-page="page.lastPage"
            :disabled="busy"
            @page-change="changePage"
          />
        </template>
      </DirectoryPanel>

      <DirectoryPanel
        v-if="selectedRole && !pageLoading && !pageError"
        class="role-card"
        aria-labelledby="selected-role-name"
      >
        <header class="role-card-header">
          <div>
            <h2 id="selected-role-name">{{ roleLabel(selectedRole) }}</h2>
            <p>{{ roleDescription }}</p>
          </div>
          <VBtn
            v-if="!selectedBuiltIn"
            class="text-none"
            type="button"
            variant="outlined"
            :disabled="busy"
            @click="beginNameEdit(selectedRole, $event)"
          >
            Rename
          </VBtn>
        </header>

        <AdminRolePermissionPanel
          v-model="selectedPermissions"
          :role-id="selectedRole.id"
          :permission-keys="permissionKeys"
          :read-only="permissionsReadOnly"
          :editable="canEditPermissions"
          :admin-only-permissions="adminOnlyPermissions"
          :blocked-permissions="blockedPermissions"
          :loading="catalogLoading"
          :load-error="permissionCatalogError"
          :error="permissionError"
          :saving="saving && !nameDialog"
          :can-save="canSavePermissions && !refreshingAccess"
          @retry="loadCatalog"
          @submit="submitPermissions"
        />
      </DirectoryPanel>
    </div>

    <AdminRoleNameDialog
      v-if="nameDialog"
      :role="nameDialog.role"
      :saving="saving"
      :error="nameError"
      :name-errors="nameErrors"
      @close="dismissNameDialog"
      @submit="submitName"
    />
  </section>
  <section v-else-if="refreshingAccess" class="role-management" role="status">
    Access updated. Opening your workspace…
  </section>
</template>

<style scoped>
.role-management {
  padding-block: clamp(20px, 2.8vw, 28px) 28px;
}

.role-page-header,
.role-card-header,
.role-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.role-page-header {
  align-items: flex-end;
  margin-bottom: 20px;
}

.role-page-header h1 {
  margin: 0;
  font-size: clamp(1.625rem, 3.4vw, 2.125rem);
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.role-page-header p,
.role-card-header p {
  margin: 5px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.875rem;
}

.role-page-header h1:focus,
.role-card-header h2:focus {
  outline: none;
}

.role-grid {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(0, 2.1fr);
  align-items: start;
  gap: 14px;
}

.role-card {
  min-width: 0;
}

.role-list {
  padding: 8px;
}

.role-list :deep(.v-list-item) {
  width: 100%;
  text-align: start;
}

.role-list :deep(.v-list-item-title),
.role-card-header h2 {
  overflow-wrap: anywhere;
  white-space: normal;
}

.role-card-header,
.role-state,
.role-pagination {
  padding: 14px 16px;
}

.role-card-header {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.role-card-header h2 {
  margin: 0;
  font-size: 1.0625rem;
}

.role-state {
  display: grid;
  gap: 12px;
  justify-items: start;
  margin: 0;
}

.role-notice {
  margin-bottom: 12px;
}

.role-pagination {
  justify-content: center;
  font-size: 0.8125rem;
}

@media (max-width: 650px) {
  .role-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
