<script setup>
import { computed, nextTick, onMounted, onScopeDispose, ref, shallowRef, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { VAlert } from 'vuetify/components/VAlert'
import { VAvatar } from 'vuetify/components/VAvatar'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VChip } from 'vuetify/components/VChip'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'
import { VTable } from 'vuetify/components/VTable'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import AdminUserAccountDialog from '../../components/admin/AdminUserAccountDialog.vue'
import { ADMIN_USERS_PATH, useUserAccountActions } from '../../composables/useUserAccountActions'
import { useAuthStore } from '../../stores/auth'
import { getAccountInitials } from '../../utils/accountInitials'

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
const pageRange = computed(() => {
  const result = directory.value
  if (!result?.users.length) return ''

  const first = (result.currentPage - 1) * result.perPage + 1
  const last = first + result.users.length - 1
  const range = first === last ? first : `${first}–${last}`
  return `${range} of ${result.total} ${result.total === 1 ? 'user' : 'users'}`
})

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

  if (mode === 'roles' && isSelf) {
    refreshingAccess.value = true
    notice.value = 'Roles updated. Checking your access…'
    try {
      const profile = await auth.refreshCurrentUser()
      if (!profile || requests.signal.aborted) return

      if (!auth.canManageUsers) {
        await router.replace({ name: 'workspace' })
        return
      }
    } finally {
      refreshingAccess.value = false
    }
  }

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

    <VCard color="surface" class="directory-card" variant="flat" border>
      <div class="directory-card-header">
        <h2 ref="directoryHeading" tabindex="-1">User directory</h2>
        <span v-if="directory && !loading && !error" class="directory-detail">
          {{ directory.total }} {{ directory.total === 1 ? 'account' : 'accounts' }}
        </span>
      </div>

      <div v-if="loading" class="directory-state" role="status">
        <VProgressLinear color="primary" indeterminate aria-hidden="true" />
        <p>Loading users…</p>
      </div>

      <div v-else-if="error" class="directory-state">
        <VAlert type="error" variant="tonal" :icon="false" role="alert">
          {{ accessDenied ? 'You do not have permission to view users.' : 'Unable to load users.' }}
        </VAlert>
        <VBtn
          v-if="!accessDenied"
          class="text-none"
          color="primary"
          variant="outlined"
          @click="changePage(requestedPage)"
        >
          Try again
        </VBtn>
      </div>

      <template v-else-if="directory">
        <div v-if="!directory.users.length" class="directory-state">
          <p>{{ directory.total === 0 ? 'No users found.' : 'No users on this page.' }}</p>
          <VBtn
            v-if="directory.currentPage > directory.lastPage"
            class="text-none"
            color="primary"
            variant="outlined"
            @click="changePage(directory.lastPage)"
          >
            Go to the last page
          </VBtn>
        </div>

        <VTable v-else class="directory-table" aria-label="OMS user accounts" density="compact">
          <colgroup>
            <col class="account-column" />
            <col class="roles-column" />
            <col />
            <col class="actions-column" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Roles</th>
              <th scope="col">Status</th>
              <th scope="col"><span class="d-sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            <tr v-for="account in directory.users" :key="account.id" role="row">
              <th scope="row" role="rowheader">
                <div class="account-identity">
                  <VAvatar size="34" color="primary" variant="tonal" aria-hidden="true">
                    {{ getAccountInitials(account.name) }}
                  </VAvatar>
                  <div class="account-text">
                    <span class="account-name">{{ account.name }}</span>
                    <span class="directory-detail">{{ account.email }}</span>
                  </div>
                </div>
              </th>
              <td role="cell">
                <span class="mobile-column-label" aria-hidden="true">Roles</span>
                <div v-if="account.roles.length" class="role-list">
                  <VChip
                    v-for="role in account.roles"
                    :key="role"
                    :color="role === 'admin' ? 'primary' : undefined"
                    size="small"
                    variant="tonal"
                    label
                  >
                    {{ role }}
                  </VChip>
                </div>
                <span v-else class="directory-detail">No role</span>
              </td>
              <td role="cell">
                <span class="mobile-column-label" aria-hidden="true">Status</span>
                <span
                  class="account-status"
                  :class="{ 'account-status--active': account.is_active }"
                >
                  {{ account.is_active ? 'Active' : 'Disabled' }}
                </span>
              </td>
              <td role="cell" class="table-action">
                <VBtn
                  :aria-label="`Manage ${account.name}`"
                  :append-icon="aliases.next"
                  class="manage-account text-none"
                  type="button"
                  variant="text"
                  size="small"
                  color="primary"
                  :disabled="refreshingAccess"
                  @click="openAccountAction('edit', account, $event)"
                >
                  Manage
                </VBtn>
              </td>
            </tr>
          </tbody>
        </VTable>

        <nav
          v-if="
            directory.users.length ||
            (directory.lastPage > 1 && directory.currentPage <= directory.lastPage)
          "
          class="directory-pagination"
          aria-label="User directory pages"
        >
          <span class="directory-detail" aria-live="polite">
            {{ pageRange }}
          </span>
          <div v-if="directory.lastPage > 1" class="page-actions">
            <VBtn
              aria-label="Previous page"
              :icon="aliases.prev"
              size="small"
              rounded="lg"
              variant="outlined"
              :disabled="directory.currentPage <= 1"
              @click="changePage(directory.currentPage - 1)"
            />
            <span class="directory-detail" aria-hidden="true">
              {{ directory.currentPage }} / {{ directory.lastPage }}
            </span>
            <span class="d-sr-only">
              Page {{ directory.currentPage }} of {{ directory.lastPage }}
            </span>
            <VBtn
              aria-label="Next page"
              :icon="aliases.next"
              size="small"
              rounded="lg"
              variant="outlined"
              :disabled="directory.currentPage >= directory.lastPage"
              @click="changePage(directory.currentPage + 1)"
            />
          </div>
        </nav>
      </template>
    </VCard>

    <AdminUserAccountDialog
      v-if="action"
      :mode="action.mode"
      :account="action.account"
      :can-assign-roles="auth.canAssignUserRoles"
      :is-self="action.account?.id === auth.user?.id"
      :saving="saving"
      :message="message"
      :field-errors="fieldErrors"
      @close="dismissAccountAction"
      @change-status="openAction($event, action.account)"
      @assign-roles="openRoleAssignment"
      @submit="submitAccountAction"
      @clear-field-error="clearFieldError"
    />
  </section>
  <section v-else-if="refreshingAccess" class="user-directory" role="status">
    Roles updated. Opening your workspace…
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

.directory-card {
  border-color: rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 12px;
  box-shadow: 0 2px 7px rgba(var(--v-theme-on-surface), 0.045);
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

.directory-table :deep(.v-table__wrapper) {
  border-radius: 0;
}

.directory-table :deep(thead) {
  background: rgba(var(--v-theme-primary), 0.07);
  font-size: 0.8125rem;
}

.directory-table th[scope='row'] {
  padding-block: 12px;
  font-weight: 500;
}

.account-identity {
  display: flex;
  min-width: 0;
  gap: 10px;
  align-items: center;
}

.account-identity :deep(.v-avatar) {
  flex: none;
  font-size: 0.75rem;
  font-weight: 700;
}

.account-text {
  min-width: 0;
}

.account-name,
.directory-detail {
  display: block;
  overflow-wrap: anywhere;
}

.account-name {
  font-weight: 600;
}

.directory-detail {
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
  font-weight: 400;
}

.role-list,
.page-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.role-list :deep(.v-chip) {
  max-width: 100%;
  height: auto;
  min-height: 24px;
  padding-block: 2px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 6px;
  white-space: normal;
  overflow-wrap: anywhere;
  text-transform: capitalize;
}

.account-status {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: rgba(var(--v-theme-on-surface), 0.76);
  font-size: 0.8125rem;
  font-weight: 600;
}

.account-status::before {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: currentColor;
  content: '';
}

.account-status--active {
  color: rgb(var(--v-theme-primary));
}

.table-action {
  text-align: end;
}

.manage-account :deep(.v-btn__append) {
  margin-inline-start: 3px;
}

.directory-pagination {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.page-actions {
  gap: 8px;
}

.page-actions :deep(.v-btn) {
  border-color: rgba(var(--v-theme-on-surface), 0.18);
}

.mobile-column-label {
  display: none;
}

@media (min-width: 600px) {
  .directory-table :deep(table) {
    table-layout: fixed;
  }

  .account-column {
    width: 44%;
  }

  .roles-column {
    width: 21%;
  }

  .actions-column {
    width: 16%;
  }
}

@media (max-width: 599px) {
  .directory-table :deep(thead) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .directory-table tbody tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 9px 10px;
    align-items: end;
    padding: 12px 14px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }

  .directory-table th[scope='row'],
  .directory-table td {
    height: auto;
    padding: 0;
    border: 0;
  }

  .directory-table th[scope='row'] {
    grid-column: 1 / -1;
  }

  .manage-account {
    min-height: 44px;
    padding-inline: 6px;
  }

  .mobile-column-label {
    display: block;
    margin-bottom: 2px;
    color: rgba(var(--v-theme-on-surface), 0.77);
    font-size: 0.75rem;
  }
}
</style>
