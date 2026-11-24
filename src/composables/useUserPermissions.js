import { computed, ref, shallowRef } from 'vue'
import { loadPermissionCatalog } from '../api/adminRoles'
import { loadUserPermissions, replaceUserPermissions } from '../api/adminUsers'
import { AUTH_ROLE } from '../constants/auth'

function errorMessage(failure, fallback) {
  if (failure.status === 403) return 'You do not have permission to manage user grants.'
  if (failure.status === 404) return 'This user is no longer available.'
  if (failure.status === 429) return 'Too many requests. Try again shortly.'
  return fallback
}

function validationMessage(failure) {
  if (failure.status !== 422) return ''

  return Object.entries(failure.fields ?? {})
    .filter(
      ([field, messages]) =>
        /^direct_permissions(?:\.\d+)?$/.test(field) && Array.isArray(messages),
    )
    .flatMap(([, messages]) => messages)
    .find((message) => typeof message === 'string' && message.trim())
}

export function useUserPermissions({ request, userId, targetRoles = [], signal }) {
  const targetIsAdmin = targetRoles.includes(AUTH_ROLE.ADMIN)
  const grants = shallowRef(null)
  const permissionCatalog = shallowRef(null)
  const selection = ref([])
  const loading = ref(false)
  const saving = ref(false)
  const loadError = ref('')
  const saveError = ref('')
  const reloadRequired = ref(false)

  const restrictionsUnavailable = computed(
    () => !targetIsAdmin && permissionCatalog.value?.adminOnlyPermissions === null,
  )
  const restrictedPermissions = computed(() => {
    if (targetIsAdmin) return new Set()

    const available = permissionCatalog.value
    return new Set(available?.adminOnlyPermissions ?? available?.permissions)
  })
  const legacyRestrictedGrants = computed(
    () =>
      new Set(
        grants.value?.directPermissions.filter((name) => restrictedPermissions.value.has(name)),
      ),
  )
  const catalog = computed(
    () =>
      permissionCatalog.value?.permissions.filter(
        (name) => !restrictedPermissions.value.has(name) || legacyRestrictedGrants.value.has(name),
      ) ?? [],
  )

  function canChangePermission(name) {
    return !restrictedPermissions.value.has(name) || selection.value.includes(name)
  }

  const selectedPermissions = computed({
    get: () => selection.value,
    set: (names) => {
      if (names.every((name) => catalog.value.includes(name) && canChangePermission(name))) {
        selection.value = names
      }
    },
  })
  const canEdit = computed(
    () =>
      !!grants.value &&
      !loading.value &&
      !saving.value &&
      !loadError.value &&
      !reloadRequired.value,
  )
  const canSave = computed(() => {
    if (!canEdit.value) return false

    const original = grants.value.directPermissions
    return (
      original.length !== selectedPermissions.value.length ||
      selectedPermissions.value.some((name) => !original.includes(name))
    )
  })

  async function load() {
    if (loading.value || saving.value || signal.aborted) return

    loading.value = true
    loadError.value = ''
    saveError.value = ''
    reloadRequired.value = false
    try {
      const [currentGrants, availablePermissions] = await Promise.all([
        loadUserPermissions(request, userId, signal),
        loadPermissionCatalog(request, signal),
      ])
      if (signal.aborted) return

      grants.value = currentGrants
      permissionCatalog.value = availablePermissions
      selection.value = [...currentGrants.directPermissions]
      if (
        currentGrants.directPermissions.some(
          (name) => !availablePermissions.permissions.includes(name),
        )
      ) {
        loadError.value = 'Some direct grants are missing from the catalog. Reload before editing.'
      }
    } catch (failure) {
      if (!signal.aborted && failure.status !== 401) {
        loadError.value = errorMessage(failure, 'Unable to load user permissions.')
      }
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (!canSave.value || signal.aborted) return null

    saving.value = true
    saveError.value = ''
    try {
      const saved = await replaceUserPermissions(
        request,
        userId,
        [...selectedPermissions.value],
        signal,
      )
      if (signal.aborted) return null

      grants.value = saved
      selection.value = [...saved.directPermissions]
      return saved
    } catch (failure) {
      if (!signal.aborted && failure.status !== 401) {
        reloadRequired.value = ['NETWORK_ERROR', 'INVALID_RESPONSE'].includes(failure.code)
        saveError.value = reloadRequired.value
          ? 'The save could not be confirmed. Reload the grants before editing again.'
          : validationMessage(failure) || errorMessage(failure, 'Unable to save direct grants.')
      }
      return null
    } finally {
      saving.value = false
    }
  }

  return {
    grants,
    catalog,
    restrictionsUnavailable,
    legacyRestrictedGrants,
    selectedPermissions,
    loading,
    saving,
    loadError,
    saveError,
    reloadRequired,
    canEdit,
    canChangePermission,
    canSave,
    load,
    save,
  }
}
