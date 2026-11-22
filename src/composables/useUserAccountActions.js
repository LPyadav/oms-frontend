import { ref, shallowRef } from 'vue'
import { ADMIN_USERS_PATH } from '../api/adminUsers'
import { ApiError } from '../api/client'

export function getUserAccountBody(mode, draft, account) {
  const profile = { name: draft.name.trim(), email: draft.email.trim() }
  if (mode === 'create') return { ...profile, password: draft.password }

  return Object.fromEntries(
    Object.entries(profile).filter(([field, value]) => value !== account[field]),
  )
}

function getFieldErrors(failure, mode) {
  if (['disable', 'enable'].includes(mode) || ![409, 422].includes(failure.status)) return {}

  if (mode === 'roles') {
    const roles = Object.entries(failure.fields ?? {})
      .filter(([field, messages]) => /^roles(?:\.\d+)?$/.test(field) && Array.isArray(messages))
      .flatMap(([, messages]) => messages)
    return roles.length ? { roles: [...new Set(roles)] } : {}
  }

  const fields = mode === 'create' ? ['name', 'email', 'password'] : ['name', 'email']
  return Object.fromEntries(
    fields
      .filter((field) => Array.isArray(failure.fields?.[field]) && failure.fields[field].length)
      .map((field) => [field, failure.fields[field]]),
  )
}

function getErrorMessage(failure, mode) {
  if (failure.code === 'LAST_ACTIVE_ADMIN') {
    return mode === 'roles'
      ? 'The Admin role cannot be removed from the last active Admin.'
      : 'The last active Admin cannot be disabled.'
  }
  if (failure.status === 403) return 'You do not have permission to manage users.'
  if (failure.status === 404) return 'This account is no longer available.'
  if (failure.status === 429) {
    const seconds = Number(failure.retryAfter)
    return Number.isInteger(seconds) && seconds > 0
      ? `Too many requests. Try again in ${seconds} seconds.`
      : 'Too many requests. Try again shortly.'
  }
  if (failure.code === 'NETWORK_ERROR' || failure.code === 'INVALID_RESPONSE') {
    return 'Could not confirm the change. Check the user directory before retrying.'
  }
  return 'Could not save the account. Try again.'
}

export function useUserAccountActions({ request, signal }) {
  const action = shallowRef(null)
  const saving = ref(false)
  const message = ref('')
  const fieldErrors = shallowRef({})

  function openAction(mode, account = null) {
    if (saving.value) return

    action.value = { mode, account }
    message.value = ''
    fieldErrors.value = {}
  }

  function closeAction() {
    if (saving.value) return false

    action.value = null
    return true
  }

  function clearFieldError(field) {
    if (!fieldErrors.value[field]) return

    const next = { ...fieldErrors.value }
    delete next[field]
    fieldErrors.value = next
  }

  async function saveAccount(body = {}) {
    if (!action.value || saving.value || signal.aborted) return null

    const { mode, account } = action.value
    if (mode === 'edit' && !Object.keys(body).length) return null

    const creating = mode === 'create'
    const expectedStatus = { disable: false, enable: true }[mode]
    const changingStatus = typeof expectedStatus === 'boolean'
    const userPath = creating ? ADMIN_USERS_PATH : `${ADMIN_USERS_PATH}/${account.id}`
    const actionPath = { disable: '/disable', enable: '/enable', roles: '/roles' }[mode] ?? ''
    const path = userPath + actionPath
    const options = { method: creating ? 'POST' : 'PATCH', signal }
    if (!changingStatus) options.body = body

    saving.value = true
    message.value = ''
    fieldErrors.value = {}
    try {
      const { data } = await request(path, options)
      if (signal.aborted) return null

      const user = data?.user
      if (
        !Number.isInteger(user?.id) ||
        typeof user.name !== 'string' ||
        typeof user.email !== 'string' ||
        typeof user.is_active !== 'boolean' ||
        !Array.isArray(user.roles) ||
        (!creating && user.id !== account.id) ||
        (changingStatus && user.is_active !== expectedStatus)
      ) {
        throw new ApiError('The server did not return an updated account.', {
          code: 'INVALID_RESPONSE',
        })
      }

      action.value = null
      return { mode, user }
    } catch (failure) {
      if (!signal.aborted && failure.status !== 401) {
        const fields = getFieldErrors(failure, mode)
        fieldErrors.value = fields
        if (!Object.keys(fields).length) message.value = getErrorMessage(failure, mode)
      }
      return null
    } finally {
      saving.value = false
    }
  }

  return {
    action,
    saving,
    message,
    fieldErrors,
    openAction,
    closeAction,
    clearFieldError,
    saveAccount,
  }
}
