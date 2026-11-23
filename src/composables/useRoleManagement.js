import { computed, ref, shallowRef } from 'vue'
import {
  createRole,
  loadPermissionCatalog,
  loadRolePage,
  renameRole,
  replaceRolePermissions,
} from '../api/adminRoles'
import { DIRECTORY_PAGE_SIZE } from '../constants/pagination'
import { getDirectoryErrorMessage } from '../utils/directory'

const builtInRoles = new Set(['admin', 'manager', 'staff'])
const roleErrorMessages = {
  403: 'Your account does not have permission for this action.',
  404: 'This role is no longer available.',
}

export function isBuiltInRole(name) {
  return builtInRoles.has(name.toLowerCase())
}

function errorMessage(error, fallback) {
  return getDirectoryErrorMessage(error, fallback, roleErrorMessages)
}

export function useRoleManagement({ request, signal }) {
  const page = shallowRef(null)
  const pageLoading = ref(false)
  const pageError = ref('')
  const requestedPage = ref(1)
  const catalog = shallowRef(null)
  const catalogLoading = ref(false)
  const catalogError = ref('')
  const selectedRoleId = ref(null)
  const selectedPermissions = ref([])
  const permissionError = ref('')
  const nameDialog = shallowRef(null)
  const nameErrors = ref([])
  const nameError = ref('')
  const saving = ref(false)
  const notice = ref('')

  const selectedRole = computed(() =>
    page.value?.roles.find((role) => role.id === selectedRoleId.value),
  )
  const selectedBuiltIn = computed(
    () => selectedRole.value && isBuiltInRole(selectedRole.value.name),
  )
  const permissionsReadOnly = computed(
    () =>
      selectedRole.value?.name.toLowerCase() === 'admin' ||
      (selectedBuiltIn.value && catalog.value?.adminOnlyPermissions === null),
  )
  const adminOnlyPermissions = computed(() => new Set(catalog.value?.adminOnlyPermissions ?? []))
  const blockedPermissions = computed(
    () =>
      new Set(
        [...adminOnlyPermissions.value].filter(
          (name) => !selectedRole.value?.permissions.includes(name),
        ),
      ),
  )
  const missingPermissions = computed(
    () =>
      catalog.value &&
      selectedRole.value?.permissions.some((name) => !catalog.value.permissions.includes(name)),
  )
  const hasPermissionChanges = computed(() => {
    const original = selectedRole.value?.permissions ?? []
    return (
      original.length !== selectedPermissions.value.length ||
      selectedPermissions.value.some((permission) => !original.includes(permission))
    )
  })

  const permissionsEditable = computed(
    () =>
      !!selectedRole.value &&
      !permissionsReadOnly.value &&
      !!catalog.value &&
      !catalogLoading.value &&
      !catalogError.value &&
      !missingPermissions.value &&
      !saving.value,
  )
  const canSavePermissions = computed(
    () =>
      permissionsEditable.value &&
      hasPermissionChanges.value &&
      selectedPermissions.value.every(
        (name) => catalog.value.permissions.includes(name) && !blockedPermissions.value.has(name),
      ),
  )

  function selectRole(role) {
    selectedRoleId.value = role?.id ?? null
    selectedPermissions.value = [...(role?.permissions ?? [])]
    permissionError.value = ''
  }

  async function loadPage(number = 1, preferredId = selectedRoleId.value) {
    if (pageLoading.value || signal.aborted) return null

    requestedPage.value = number
    pageLoading.value = true
    pageError.value = ''
    try {
      const result = await loadRolePage(
        request,
        { page: number, perPage: DIRECTORY_PAGE_SIZE },
        signal,
      )
      if (signal.aborted) return null

      page.value = result
      selectRole(result.roles.find((role) => role.id === preferredId) ?? result.roles[0])
      return result
    } catch (error) {
      if (!signal.aborted && error.status !== 401) {
        pageError.value = errorMessage(error, 'Unable to load roles.')
      }
      return null
    } finally {
      pageLoading.value = false
    }
  }

  async function loadCatalog() {
    if (catalogLoading.value || signal.aborted) return

    catalogLoading.value = true
    catalogError.value = ''
    try {
      const result = await loadPermissionCatalog(request, signal)
      if (!signal.aborted) catalog.value = result
    } catch (error) {
      if (!signal.aborted && error.status !== 401) {
        catalogError.value = errorMessage(error, 'Unable to load permissions.')
      }
    } finally {
      catalogLoading.value = false
    }
  }

  function openNameDialog(role = null) {
    if (saving.value || (role && isBuiltInRole(role.name))) return

    notice.value = ''
    nameErrors.value = []
    nameError.value = ''
    nameDialog.value = { role }
  }

  function closeNameDialog() {
    if (!saving.value) nameDialog.value = null
  }

  function updateRole(role) {
    page.value = {
      ...page.value,
      roles: page.value.roles.map((entry) => (entry.id === role.id ? role : entry)),
    }
  }

  async function saveRoleName(name) {
    if (!nameDialog.value || saving.value || signal.aborted) return null
    const { role: previous } = nameDialog.value
    if (!name || (previous && (isBuiltInRole(previous.name) || name === previous.name))) return null

    const preserveDraft = hasPermissionChanges.value
    saving.value = true
    nameErrors.value = []
    nameError.value = ''
    try {
      const role = previous
        ? await renameRole(request, previous.id, name, signal)
        : await createRole(request, name, signal)
      if (signal.aborted) return null

      nameDialog.value = null
      if (previous) {
        updateRole(role)
        if (!preserveDraft) selectRole(role)
        notice.value = 'Role renamed.'
      } else {
        notice.value = 'Role created.'
        const result = await loadPage(page.value?.lastPage ?? 1, role.id)
        if (
          result &&
          !result.roles.some((entry) => entry.id === role.id) &&
          result.currentPage !== result.lastPage
        ) {
          await loadPage(result.lastPage, role.id)
        }
      }
      return { previousName: previous?.name }
    } catch (error) {
      if (!signal.aborted && error.status !== 401) {
        nameErrors.value = error.fields?.name ?? []
        if (!nameErrors.value.length)
          nameError.value = errorMessage(error, 'Unable to save the role.')
      }
      return null
    } finally {
      saving.value = false
    }
  }

  async function savePermissions() {
    if (!canSavePermissions.value || signal.aborted) return null

    const role = selectedRole.value
    saving.value = true
    notice.value = ''
    permissionError.value = ''
    try {
      const updated = await replaceRolePermissions(
        request,
        role.id,
        [...selectedPermissions.value],
        signal,
      )
      if (signal.aborted) return null

      updateRole(updated)
      selectRole(updated)
      notice.value = 'Permissions saved.'
      return { previousName: role.name }
    } catch (error) {
      if (!signal.aborted && error.status !== 401) {
        const messages = Object.entries(error.fields ?? {})
          .filter(([key, values]) => /^permissions(?:\.\d+)?$/.test(key) && Array.isArray(values))
          .flatMap(([, values]) => values)
        permissionError.value = messages[0] ?? errorMessage(error, 'Unable to save permissions.')
      }
      return null
    } finally {
      saving.value = false
    }
  }

  return {
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
    hasPermissionChanges,
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
  }
}
