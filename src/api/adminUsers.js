import { ApiError } from './client'

export const ADMIN_USERS_PATH = '/api/admin/users'

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
