import { ApiError } from './client'
import { createPageParams } from './pagination'

const rolesPath = '/api/admin/roles'

function isName(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function invalidResponse() {
  return new ApiError('The server returned invalid role data.', { code: 'INVALID_RESPONSE' })
}

function isRole(role) {
  return (
    Number.isInteger(role?.id) &&
    role.id > 0 &&
    isName(role.name) &&
    Array.isArray(role.permissions) &&
    role.permissions.every(isName)
  )
}

export async function loadRolePage(request, { page, perPage }, signal) {
  const params = createPageParams(page, perPage)
  const { data, meta } = await request(`${rolesPath}?${params}`, { signal })
  if (
    !Array.isArray(data?.roles) ||
    !data.roles.every(isRole) ||
    meta?.current_page !== page ||
    !Number.isInteger(meta.last_page) ||
    meta.last_page < 1
  ) {
    throw invalidResponse()
  }
  return { roles: data.roles, currentPage: page, lastPage: meta.last_page }
}

export async function loadRoleNames(request, signal) {
  const names = new Set()
  let lastPage = 1

  for (let page = 1; page <= lastPage; page += 1) {
    const result = await loadRolePage(request, { page }, signal)
    if (signal.aborted) return []

    for (const { name } of result.roles) names.add(name)
    lastPage = result.lastPage
  }

  return [...names]
}

export async function loadPermissionCatalog(request, signal) {
  const { data } = await request('/api/admin/permissions', { signal })
  if (!Array.isArray(data?.permissions) || !data.permissions.every(isName)) {
    throw invalidResponse()
  }

  const permissions = [...new Set(data.permissions)]
  const adminOnly = data.admin_only_permissions
  if (adminOnly === undefined) return { permissions, adminOnlyPermissions: null }

  if (!Array.isArray(adminOnly) || !adminOnly.every((name) => permissions.includes(name))) {
    throw invalidResponse()
  }

  return { permissions, adminOnlyPermissions: [...new Set(adminOnly)] }
}

async function requestRole(request, path, options, roleId) {
  const { data } = await request(path, options)
  if (!isRole(data?.role) || (roleId !== undefined && data.role.id !== roleId)) {
    throw invalidResponse()
  }
  return data.role
}

export function createRole(request, name, signal) {
  return requestRole(request, rolesPath, { method: 'POST', body: { name }, signal })
}

export function renameRole(request, id, name, signal) {
  return requestRole(request, `${rolesPath}/${id}`, { method: 'PATCH', body: { name }, signal }, id)
}

export function replaceRolePermissions(request, id, permissions, signal) {
  return requestRole(
    request,
    `${rolesPath}/${id}/permissions`,
    { method: 'PATCH', body: { permissions }, signal },
    id,
  )
}
