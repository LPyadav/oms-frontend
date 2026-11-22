import { ApiError } from './client'
import { readPaginatedResource } from './pagination'

export const ADMIN_USERS_PATH = '/api/admin/users'

function isAdminUser(user) {
  return (
    Number.isSafeInteger(user?.id) &&
    user.id > 0 &&
    typeof user.name === 'string' &&
    typeof user.email === 'string' &&
    typeof user.is_active === 'boolean' &&
    Array.isArray(user.roles) &&
    user.roles.every((role) => typeof role === 'string')
  )
}

export async function loadAdminUserPage(request, { page, search, status, role }, signal) {
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set('search', search)
  if (status === 'active') params.set('is_active', '1')
  if (status === 'disabled') params.set('is_active', '0')
  if (role) params.set('role', role)

  const response = await request(`${ADMIN_USERS_PATH}?${params}`, { signal })
  return readPaginatedResource(response, {
    resource: 'users',
    isEntry: isAdminUser,
    page,
    invalidMessage: 'The server returned an invalid user directory.',
  })
}

export async function loadAdminUser(request, id, signal) {
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiError('The user ID is invalid.', { code: 'INVALID_RESPONSE' })
  }

  const { data } = await request(`${ADMIN_USERS_PATH}/${id}`, { signal })
  if (!isAdminUser(data?.user) || data.user.id !== id) {
    throw new ApiError('The server returned invalid account details.', { code: 'INVALID_RESPONSE' })
  }
  return data.user
}

function isPermissionList(value) {
  return (
    Array.isArray(value) &&
    value.every((name) => typeof name === 'string' && name.trim().length > 0) &&
    new Set(value).size === value.length
  )
}

async function requestPermissions(request, userId, options) {
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new ApiError('The user ID is invalid.', { code: 'INVALID_RESPONSE' })
  }

  const { data } = await request(ADMIN_USERS_PATH + '/' + userId + '/permissions', options)
  if (
    data?.user_id !== userId ||
    !isPermissionList(data.inherited_permissions) ||
    !isPermissionList(data.direct_permissions)
  ) {
    throw new ApiError('The server returned invalid user permission data.', {
      code: 'INVALID_RESPONSE',
    })
  }

  return {
    userId: data.user_id,
    inheritedPermissions: data.inherited_permissions,
    directPermissions: data.direct_permissions,
  }
}

export function loadUserPermissions(request, userId, signal) {
  return requestPermissions(request, userId, { signal })
}

export function replaceUserPermissions(request, userId, directPermissions, signal) {
  return requestPermissions(request, userId, {
    method: 'PATCH',
    body: { direct_permissions: directPermissions },
    signal,
  })
}
