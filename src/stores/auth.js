import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { ApiError, apiRequest } from '../api/client'
import { AUTH_STATUS } from '../constants/auth'

const storageKey = 'oms.session'
const maxTimeout = 2_147_483_647

function isActive(session) {
  return (
    typeof session?.token === 'string' &&
    session.token.length > 0 &&
    Number.isFinite(session.expiresAt) &&
    session.expiresAt > Date.now()
  )
}

function readSession() {
  try {
    return JSON.parse(globalThis.sessionStorage.getItem(storageKey))
  } catch {
    return null
  }
}

function expiredSession() {
  return new ApiError('Your session has ended. Sign in again.', { status: 401 })
}

function normalizeProfile(profile) {
  if (
    !Number.isInteger(profile?.id) ||
    typeof profile.name !== 'string' ||
    typeof profile.email !== 'string'
  ) {
    throw new ApiError('The server did not return a user profile.', {
      code: 'INVALID_RESPONSE',
    })
  }

  return {
    ...profile,
    roles: Array.isArray(profile.roles)
      ? profile.roles.filter((role) => typeof role === 'string')
      : [],
    permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
  }
}

export const useAuthStore = defineStore('auth', () => {
  const status = ref(AUTH_STATUS.IDLE)
  const user = shallowRef(null)
  const error = shallowRef(null)
  const isAuthenticated = computed(() => status.value === AUTH_STATUS.AUTHENTICATED)
  const isAdmin = computed(
    () =>
      isAuthenticated.value &&
      user.value?.roles.some((role) => role.toLowerCase() === 'admin') === true,
  )
  const canManageUsers = computed(
    () => isAdmin.value && user.value.permissions?.includes('users.manage') === true,
  )
  const canManageRoles = computed(
    () => isAdmin.value && user.value.permissions?.includes('roles.manage') === true,
  )
  const canAssignUserRoles = computed(() => canManageUsers.value && canManageRoles.value)
  const canViewCustomers = computed(
    () => isAuthenticated.value && user.value?.permissions.includes('customers.view') === true,
  )

  const canManageCustomers = computed(
    () => isAdmin.value && user.value.permissions.includes('customers.manage'),
  )

  const canViewProducts = computed(
    () => isAuthenticated.value && user.value?.permissions.includes('products.view') === true,
  )

  const canManageProducts = computed(
    () => isAdmin.value && user.value.permissions.includes('products.manage'),
  )
  const canViewAllOrders = computed(
    () => isAuthenticated.value && user.value?.permissions.includes('orders.view.any') === true,
  )
  const canViewOrders = computed(
    () =>
      canViewAllOrders.value ||
      (isAuthenticated.value && user.value?.permissions.includes('orders.view.assigned') === true),
  )

  const canChangeAnyOrderStatus = computed(
    () => canViewAllOrders.value && user.value.permissions.includes('orders.status.update.any'),
  )
  const canChangeAssignedOrderStatus = computed(
    () =>
      isAuthenticated.value &&
      user.value.permissions.includes('orders.view.assigned') &&
      user.value.permissions.includes('orders.status.update.assigned'),
  )
  const canEditOrders = computed(
    () => canViewAllOrders.value && user.value.permissions.includes('orders.update'),
  )
  const canDeleteOrders = computed(
    () =>
      canViewAllOrders.value && isAdmin.value && user.value.permissions.includes('orders.delete'),
  )
  const canCreateOrders = computed(
    () => canViewAllOrders.value && user.value.permissions.includes('orders.create'),
  )
  const canAssignOrders = computed(
    () => canViewAllOrders.value && user.value.permissions.includes('orders.assign'),
  )
  const canAddOrderNote = computed(
    () => canViewAllOrders.value && user.value.permissions.includes('orders.notes.create.any'),
  )

  let session = readSession()
  let expiryTimer
  let profileRequest
  let loginRequest
  let logoutRequest

  function scheduleExpiry(current) {
    const remaining = Math.max(0, current.expiresAt - Date.now())
    expiryTimer = setTimeout(
      () => {
        if (session !== current) return
        if (isActive(current)) scheduleExpiry(current)
        else clearSession()
      },
      Math.min(remaining, maxTimeout),
    )
  }

  function saveSession(next) {
    session = next
    clearTimeout(expiryTimer)
    if (next) scheduleExpiry(next)

    try {
      if (next) globalThis.sessionStorage.setItem(storageKey, JSON.stringify(next))
      else globalThis.sessionStorage.removeItem(storageKey)
    } catch {
      // The current tab can still use the in-memory session when storage is unavailable.
    }
  }

  function clearSession() {
    saveSession(null)
    user.value = null
    error.value = null
    status.value = AUTH_STATUS.ANONYMOUS
  }

  function activeSession() {
    if (isActive(session)) return session

    clearSession()
    return null
  }

  async function loadUser(current) {
    status.value = AUTH_STATUS.LOADING
    error.value = null

    try {
      const { data } = await apiRequest('/api/me', { token: current.token })

      if (session !== current || !activeSession()) throw expiredSession()

      user.value = normalizeProfile(data?.user)
      status.value = AUTH_STATUS.AUTHENTICATED
      return user.value
    } catch (failure) {
      if (session === current) {
        if (failure.status === 401) clearSession()
        else {
          error.value = failure
          status.value = AUTH_STATUS.UNAVAILABLE
        }
      }

      throw failure
    }
  }

  function refreshUser(current) {
    if (profileRequest?.session === current) return profileRequest.promise

    const promise = loadUser(current).finally(() => {
      if (profileRequest?.session === current) profileRequest = null
    })
    profileRequest = { session: current, promise }
    return promise
  }

  async function initialize() {
    if (loginRequest) {
      await loginRequest.catch(() => {})
      return
    }

    const current = activeSession()
    if (current && !isAuthenticated.value) {
      if (status.value === AUTH_STATUS.IDLE) scheduleExpiry(current)
      await refreshUser(current).catch(() => {})
    }
  }

  async function signIn({ email, password }) {
    status.value = AUTH_STATUS.LOADING
    error.value = null

    let next
    try {
      const { data } = await apiRequest('/api/login', {
        method: 'POST',
        body: { email, password },
      })
      next = { token: data?.access_token, expiresAt: Date.parse(data?.expires_at) }

      if (!isActive(next)) {
        throw new ApiError('The server did not return a valid session.', {
          code: 'INVALID_RESPONSE',
        })
      }
    } catch (failure) {
      if (activeSession()) {
        error.value = failure
        status.value = AUTH_STATUS.UNAVAILABLE
      }
      throw failure
    }

    saveSession(next)
    return refreshUser(next)
  }

  function login(credentials) {
    if (isAuthenticated.value) return Promise.resolve(user.value)
    loginRequest ??= signIn(credentials).finally(() => {
      loginRequest = null
    })
    return loginRequest
  }

  async function request(path, options) {
    const current = activeSession()
    if (!current || !isAuthenticated.value) throw expiredSession()

    try {
      return await apiRequest(path, { ...options, token: current.token })
    } catch (failure) {
      if (failure.status === 401 && session === current) clearSession()
      throw failure
    }
  }

  async function refreshCurrentUser() {
    const current = activeSession()
    if (!current || !isAuthenticated.value) return null

    try {
      const { data } = await apiRequest('/api/me', { token: current.token })
      if (session !== current || !activeSession()) return null

      user.value = normalizeProfile(data?.user)
      return user.value
    } catch {
      // A confirmed self-assignment can invalidate the cached authorization.
      if (session === current) clearSession()
      return null
    }
  }

  async function signOut(current) {
    try {
      await apiRequest('/api/logout', { method: 'POST', token: current.token })
    } catch (failure) {
      if (failure.status !== 401 && isActive(current)) throw failure
    }

    if (session === current) clearSession()
  }

  async function logout() {
    const current = activeSession()
    if (!current) return

    if (logoutRequest?.session === current) return logoutRequest.promise

    const promise = signOut(current).finally(() => {
      if (logoutRequest?.session === current) logoutRequest = null
    })
    logoutRequest = { session: current, promise }
    return promise
  }

  onScopeDispose(() => clearTimeout(expiryTimer))

  return {
    status,
    user,
    error,
    isAuthenticated,
    canManageUsers,
    canManageRoles,
    canAssignUserRoles,
    canViewCustomers,
    canManageCustomers,
    canViewProducts,
    canManageProducts,
    canViewOrders,
    canViewAllOrders,
    canChangeAnyOrderStatus,
    canChangeAssignedOrderStatus,
    canCreateOrders,
    canEditOrders,
    canDeleteOrders,
    canAssignOrders,
    canAddOrderNote,
    initialize,
    login,
    logout,
    request,
    refreshCurrentUser,
    clearSession,
  }
})
