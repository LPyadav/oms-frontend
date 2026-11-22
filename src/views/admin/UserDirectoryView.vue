<script setup>
import { computed, nextTick, onMounted, onScopeDispose, ref, shallowRef, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import DirectoryPagination from '../../components/directory/DirectoryPagination.vue'
import DirectoryPanel from '../../components/directory/DirectoryPanel.vue'
import DirectoryState from '../../components/directory/DirectoryState.vue'
import { ADMIN_USERS_PATH } from '../../api/adminUsers'
import AdminUserAccountDialog from '../../components/admin/AdminUserAccountDialog.vue'
import AdminUserDirectoryTable from '../../components/admin/AdminUserDirectoryTable.vue'
import AdminUserPermissionsDialog from '../../components/admin/AdminUserPermissionsDialog.vue'
import { useUserAccountActions } from '../../composables/useUserAccountActions'
import { useAuthStore } from '../../stores/auth'
import { formatDirectoryPageRange, getDirectoryErrorMessage } from '../../utils/directory'

const auth = useAuthStore()
const router = useRouter()
const pageHeading = useTemplateRef('pageHeading')
const directoryHeading = useTemplateRef('directoryHeading')
const directory = shallowRef(null)
const error = shallowRef(null)
const loading = ref(false)
const requestedPage = ref(1)
const notice = ref('')
const refreshingAccess = ref(false)
const requests = new AbortController()
const {
  action,
  saving,
  message,
  fieldErrors,
  openAction,
  closeAction,
  clearFieldError,
  saveAccount,
} = useUserAccountActions({ request: auth.request, signal: requests.signal })
let actionTrigger
const accessDenied = computed(() => error.value?.status === 403)
const errorMessage = computed(() =>
  getDirectoryErrorMessage(error.value, 'Unable to load users.', {
    403: 'You do not have permission to view users.',
  }),
)
const pageRange = computed(() =>
  formatDirectoryPageRange(directory.value, directory.value?.users.length, 'user', 'users'),
)

async function loadPage(page = 1) {
  if (loading.value) return

  const { signal } = requests
  requestedPage.value = page
  loading.value = true
  error.value = null

  try {
    const { data, meta } = await auth.request(`${ADMIN_USERS_PATH}?page=${page}`, { signal })
    if (signal.aborted) return

    if (
      !Array.isArray(data?.users) ||
      !Number.isInteger(meta?.current_page) ||
      meta.current_page < 1 ||
      !Number.isInteger(meta.per_page) ||
      meta.per_page < 1 ||
      !Number.isInteger(meta.last_page) ||
      meta.last_page < 1 ||
      !Number.isInteger(meta.total) ||
      meta.total < 0
    ) {
      throw new Error('Invalid user directory response.')
    }

    directory.value = {
      users: data.users,
      currentPage: meta.current_page,
      perPage: meta.per_page,
      lastPage: meta.last_page,
      total: meta.total,
    }
    return directory.value
  } catch (failure) {
    if (!signal.aborted && failure.status !== 401) error.value = failure
  } finally {
    loading.value = false
  }
}

async function changePage(page) {
  await loadPage(page)
  await nextTick()
  directoryHeading.value?.focus()
}

function openAccountAction(mode, account, event) {
  actionTrigger = event.currentTarget
  notice.value = ''
  openAction(mode, account)
}

async function restoreActionFocus() {
  await nextTick()
  const trigger = actionTrigger
  actionTrigger = null
  if (trigger?.isConnected && !trigger.disabled) trigger.focus({ preventScroll: true })
  else directoryHeading.value?.focus({ preventScroll: true })
}

function dismissAccountAction() {
  if (closeAction()) void restoreActionFocus()
}

function openRoleAssignment() {
  if (auth.canAssignUserRoles && action.value?.account) {
    openAction('roles', action.value.account)
  }
}

function openPermissionEditor() {
  if (auth.canAssignUserRoles && action.value?.account) {
    openAction('permissions', action.value.account)
  }
}

async function refreshOwnAccess(successMessage) {
  refreshingAccess.value = true
  notice.value = successMessage + ' Checking your access…'
  try {
    const profile = await auth.refreshCurrentUser()
    if (!profile || requests.signal.aborted) return false

    if (!auth.canManageUsers) {
      await router.replace({ name: 'workspace' })
      return false
    }

    return true
  } finally {
    refreshingAccess.value = false
  }
}

async function finishPermissionEdit(userId) {
  if (!closeAction()) return

  const successMessage = 'Direct permissions saved.'
  if (userId === auth.user?.id && !(await refreshOwnAccess(successMessage))) return

  notice.value = successMessage
  await restoreActionFocus()
}

async function submitAccountAction(body) {
  if (action.value?.mode === 'roles' && !auth.canAssignUserRoles) return

  const result = await saveAccount(body)
  if (!result || requests.signal.aborted) return

  const { mode, user } = result
  const isSelf = user.id === auth.user?.id
  if (mode === 'disable' && isSelf) {
    auth.clearSession()
    return
  }

  if (mode === 'roles' && isSelf && !(await refreshOwnAccess('Roles updated.'))) return

  if (mode === 'create') {
    notice.value = 'User created.'
    const page = await loadPage(directory.value?.lastPage ?? 1)
    if (page && page.currentPage !== page.lastPage) await loadPage(page.lastPage)
  } else {
    const page = directory.value
    if (page) {
      directory.value = {
        ...page,
        users: page.users.map((account) => (account.id === user.id ? user : account)),
      }
    }
    if (mode === 'edit' && isSelf) {
      auth.user = { ...auth.user, name: user.name, email: user.email }
    }
    notice.value = {
      disable: 'Account disabled.',
      enable: 'Account enabled.',
      edit: 'User details saved.',
      roles: 'Roles updated.',
    }[mode]
  }

  await restoreActionFocus()
}

onMounted(() => {
  pageHeading.value?.focus({ preventScroll: true })
  void loadPage()
})
onScopeDispose(() => requests.abort())
</script>

<template>
  <section v-if="auth.canManageUsers" class="user-directory" aria-labelledby="users-heading">
    <header class="directory-header">
      <div>
        <h1 id="users-heading" ref="pageHeading" tabindex="-1">Users</h1>
        <p>Manage accounts, assigned roles, and access to OMS.</p>
      </div>
      <VBtn
        :prepend-icon="aliases.plus"
        type="button"
        color="primary"
        variant="flat"
        rounded="lg"
        class="text-none"
        :disabled="loading || accessDenied || refreshingAccess"
        @click="openAccountAction('create', null, $event)"
      >
        Add user
      </VBtn>
    </header>

    <VAlert
      v-if="notice"
      class="directory-notice"
      color="primary"
      variant="tonal"
      :icon="false"
      role="status"
    >
      {{ notice }}
    </VAlert>

    <DirectoryPanel>
      <div class="directory-card-header">
        <h2 ref="directoryHeading" tabindex="-1">User directory</h2>
        <span v-if="directory && !loading && !error" class="directory-detail">
          {{ directory.total }} {{ directory.total === 1 ? 'account' : 'accounts' }}
        </span>
      </div>

      <DirectoryState
        v-if="loading"
        class="directory-state"
        kind="loading"
        message="Loading users…"
      />

      <DirectoryState
        v-else-if="error"
        class="directory-state"
        kind="error"
        :message="errorMessage"
      >
        <template #actions>
          <VBtn
            v-if="!accessDenied"
            class="text-none"
            color="primary"
            variant="outlined"
            @click="changePage(requestedPage)"
          >
            Try again
          </VBtn>
        </template>
      </DirectoryState>

      <template v-else-if="directory">
        <DirectoryState
          v-if="!directory.users.length"
          class="directory-state"
          kind="empty"
          :message="directory.total === 0 ? 'No users found.' : 'No users on this page.'"
        >
          <template #actions>
            <VBtn
              v-if="directory.currentPage > directory.lastPage"
              class="text-none"
              color="primary"
              variant="outlined"
              @click="changePage(directory.lastPage)"
            >
              Go to the last page
            </VBtn>
          </template>
        </DirectoryState>

        <AdminUserDirectoryTable
          v-else
          :accounts="directory.users"
          :disabled="refreshingAccess"
          @manage="(account, event) => openAccountAction('edit', account, event)"
        />

        <footer
          v-if="
            directory.users.length ||
            (directory.lastPage > 1 && directory.currentPage <= directory.lastPage)
          "
          class="directory-pagination"
        >
          <span class="directory-detail" aria-live="polite">
            {{ pageRange }}
          </span>
          <DirectoryPagination
            v-if="directory.lastPage > 1"
            class="page-actions"
            label="User directory pages"
            :current-page="directory.currentPage"
            :last-page="directory.lastPage"
            rounded="lg"
            @page-change="changePage"
          >
            <span class="directory-detail" aria-hidden="true">
              {{ directory.currentPage }} / {{ directory.lastPage }}
            </span>
            <span class="d-sr-only">
              Page {{ directory.currentPage }} of {{ directory.lastPage }}
            </span>
          </DirectoryPagination>
        </footer>
      </template>
    </DirectoryPanel>

    <AdminUserPermissionsDialog
      v-if="action?.mode === 'permissions' && auth.canAssignUserRoles"
      :key="action.account.id"
      :account="action.account"
      @close="dismissAccountAction"
      @saved="finishPermissionEdit"
    />
    <AdminUserAccountDialog
      v-else-if="action && action.mode !== 'permissions'"
      :mode="action.mode"
      :account="action.account"
      :can-manage-access="auth.canAssignUserRoles"
      :is-self="action.account?.id === auth.user?.id"
      :saving="saving"
      :message="message"
      :field-errors="fieldErrors"
      @close="dismissAccountAction"
      @change-status="openAction($event, action.account)"
      @assign-roles="openRoleAssignment"
      @edit-permissions="openPermissionEditor"
      @submit="submitAccountAction"
      @clear-field-error="clearFieldError"
    />
  </section>
  <section v-else-if="refreshingAccess" class="user-directory" role="status">
    Opening your workspace…
  </section>
</template>

<style scoped>
.user-directory {
  padding-block: clamp(20px, 2.8vw, 28px) 28px;
}

.directory-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  margin: 0 0 20px;
}

.directory-header h1 {
  margin: 0;
  font-size: clamp(1.625rem, 3.4vw, 2.125rem);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.directory-header h1:focus,
.directory-card-header h2:focus {
  outline: none;
}

.directory-header p {
  margin: 5px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.875rem;
}

.directory-notice {
  margin-bottom: 12px;
}

.directory-card-header,
.directory-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
}

.directory-card-header h2 {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
}

.directory-state {
  display: grid;
  justify-items: start;
  gap: 16px;
  padding: 20px clamp(14px, 2.1vw, 24px) 28px;
}

.directory-detail {
  display: block;
  overflow-wrap: anywhere;
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
  font-weight: 400;
}

.directory-pagination {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.page-actions {
  flex-wrap: wrap;
  gap: 8px;
}

.page-actions :deep(.v-btn) {
  border-color: rgba(var(--v-theme-on-surface), 0.18);
}
</style>
