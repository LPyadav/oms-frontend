import { expect, it, vi } from 'vitest'
import { useRoleManagement } from '../composables/useRoleManagement'

const builtIn = { id: 1, name: 'admin', permissions: ['roles.manage'] }
const custom = { id: 2, name: 'Fulfillment coordinator', permissions: ['orders.view.assigned'] }

function rolesPage(roles, current_page = 1, last_page = 1) {
  return { data: { roles }, meta: { current_page, last_page } }
}

function setup() {
  const request = vi.fn()
  const { signal } = new AbortController()
  const state = useRoleManagement({ request, signal })
  return { request, signal, state }
}

it('keeps Admin grants and name protected with the updated catalog', async () => {
  const { request, state } = setup()
  request.mockResolvedValueOnce(rolesPage([builtIn])).mockResolvedValueOnce({
    data: { permissions: ['roles.manage'], admin_only_permissions: ['roles.manage'] },
  })
  await state.loadPage()
  await state.loadCatalog()

  state.openNameDialog(builtIn)
  expect(state.nameDialog.value).toBeNull()
  expect(state.permissionsReadOnly.value).toBe(true)
  state.selectedPermissions.value = []
  expect(await state.savePermissions()).toBeNull()
  expect(request).toHaveBeenCalledTimes(2)
})

it('creates a role and selects it from the new last page', async () => {
  const { request, state } = setup()
  request
    .mockResolvedValueOnce(rolesPage([builtIn]))
    .mockResolvedValueOnce({ data: { role: { ...custom, permissions: [] } } })
    .mockResolvedValueOnce(rolesPage([builtIn], 1, 2))
    .mockResolvedValueOnce(rolesPage([{ ...custom, permissions: [] }], 2, 2))
  await state.loadPage()
  state.openNameDialog()

  await state.saveRoleName(custom.name)

  expect(state.nameDialog.value).toBeNull()
  expect(state.selectedRole.value.id).toBe(custom.id)
  expect(state.selectedPermissions.value).toEqual([])
  expect(request).toHaveBeenNthCalledWith(
    2,
    '/api/admin/roles',
    expect.objectContaining({ method: 'POST', body: { name: custom.name } }),
  )
  expect(request).toHaveBeenLastCalledWith('/api/admin/roles?page=2', expect.any(Object))
})

it('keeps the selected role and pending permission edits after renaming', async () => {
  const { request, state } = setup()
  const renamed = { ...custom, name: 'Dispatch lead' }
  request
    .mockResolvedValueOnce(rolesPage([custom]))
    .mockResolvedValueOnce({ data: { role: renamed } })
  await state.loadPage()
  state.selectedPermissions.value = []
  state.openNameDialog(custom)

  await expect(state.saveRoleName(renamed.name)).resolves.toEqual({ previousName: custom.name })

  expect(state.selectedRole.value).toEqual(renamed)
  expect(state.selectedPermissions.value).toEqual([])
  expect(request).toHaveBeenLastCalledWith(
    '/api/admin/roles/2',
    expect.objectContaining({ method: 'PATCH', body: { name: renamed.name } }),
  )
})

it('keeps the name dialog open for a Laravel duplicate-name error', async () => {
  const { request, state } = setup()
  const messages = ['The name has already been taken.']
  request.mockRejectedValueOnce({ status: 409, fields: { name: messages } })
  state.openNameDialog()

  await expect(state.saveRoleName(custom.name)).resolves.toBeNull()

  expect(state.nameDialog.value).not.toBeNull()
  expect(state.nameErrors.value).toEqual(messages)
})

it('replaces the full permission set, including an empty set', async () => {
  const { request, signal, state } = setup()
  const cleared = { ...custom, permissions: [] }
  request
    .mockResolvedValueOnce(rolesPage([custom]))
    .mockResolvedValueOnce({ data: { permissions: custom.permissions } })
    .mockResolvedValueOnce({ data: { role: cleared } })
  await state.loadPage()
  await state.loadCatalog()
  state.selectedPermissions.value = []

  await expect(state.savePermissions()).resolves.toEqual({ previousName: custom.name })

  expect(request).toHaveBeenLastCalledWith('/api/admin/roles/2/permissions', {
    method: 'PATCH',
    body: { permissions: [] },
    signal,
  })
  expect(state.selectedRole.value).toEqual(cleared)
  expect(state.hasPermissionChanges.value).toBe(false)
})

it('blocks the replacement if a current permission is missing from the catalog', async () => {
  const { request, state } = setup()
  request
    .mockResolvedValueOnce(rolesPage([custom]))
    .mockResolvedValueOnce({ data: { permissions: ['orders.create'] } })
  await state.loadPage()
  await state.loadCatalog()
  state.selectedPermissions.value = ['orders.create']

  expect(state.missingPermissions.value).toBe(true)
  expect(await state.savePermissions()).toBeNull()
  expect(request).toHaveBeenCalledTimes(2)
})

const manager = { id: 3, name: 'manager', permissions: ['orders.create'] }
const staff = { id: 4, name: 'staff', permissions: ['orders.view.assigned'] }
const reserved = 'users.manage'
const permissions = ['orders.view.assigned', 'orders.create', reserved]

function catalogResponse(adminOnly = [reserved]) {
  return { data: { permissions, admin_only_permissions: adminOnly } }
}

it.each([manager, staff])(
  'allows changing grants on $name and keeps the name protected',
  async (role) => {
    const { request, state, signal } = setup()
    const updated = { ...role, permissions: ['orders.create', 'orders.view.assigned'] }
    request
      .mockResolvedValueOnce(rolesPage([role]))
      .mockResolvedValueOnce(catalogResponse())
      .mockResolvedValueOnce({ data: { role: updated } })

    await state.loadPage()
    await state.loadCatalog()
    state.openNameDialog(role)
    expect(state.nameDialog.value).toBeNull()
    expect(state.permissionsReadOnly.value).toBe(false)
    state.selectedPermissions.value = updated.permissions
    expect(state.canSavePermissions.value).toBe(true)

    await expect(state.savePermissions()).resolves.toEqual({ previousName: role.name })
    expect(request).toHaveBeenLastCalledWith('/api/admin/roles/' + role.id + '/permissions', {
      method: 'PATCH',
      body: { permissions: updated.permissions },
      signal,
    })
  },
)

it.each([manager, staff])('keeps $name read-only with a legacy catalog', async (role) => {
  const { request, state } = setup()
  request.mockResolvedValueOnce(rolesPage([role])).mockResolvedValueOnce({ data: { permissions } })
  await state.loadPage()
  await state.loadCatalog()
  state.selectedPermissions.value = []

  expect(state.permissionsReadOnly.value).toBe(true)
  await expect(state.savePermissions()).resolves.toBeNull()
  expect(request).toHaveBeenCalledTimes(2)
})

it('blocks adding a reserved grant to a custom role before sending the request', async () => {
  const { request, state } = setup()
  request.mockResolvedValueOnce(rolesPage([custom])).mockResolvedValueOnce(catalogResponse())
  await state.loadPage()
  await state.loadCatalog()

  expect(state.blockedPermissions.value.has(reserved)).toBe(true)
  state.selectedPermissions.value = [...custom.permissions, reserved]
  expect(state.canSavePermissions.value).toBe(false)
  await expect(state.savePermissions()).resolves.toBeNull()
  expect(request).toHaveBeenCalledTimes(2)
})

it('allows retaining, undoing and removing a saved Admin-only grant', async () => {
  const { request, state, signal } = setup()
  const existing = { ...custom, permissions: [...custom.permissions, reserved] }
  const retained = { ...existing, permissions: [...existing.permissions, 'orders.create'] }
  const removed = { ...existing, permissions: ['orders.view.assigned', 'orders.create'] }
  request
    .mockResolvedValueOnce(rolesPage([existing]))
    .mockResolvedValueOnce(catalogResponse())
    .mockResolvedValueOnce({ data: { role: retained } })
    .mockResolvedValueOnce({ data: { role: removed } })
  await state.loadPage()
  await state.loadCatalog()

  state.selectedPermissions.value = [...custom.permissions]
  expect(state.blockedPermissions.value.has(reserved)).toBe(false)
  state.selectedPermissions.value = retained.permissions
  await state.savePermissions()
  expect(request).toHaveBeenLastCalledWith('/api/admin/roles/2/permissions', {
    method: 'PATCH',
    body: { permissions: retained.permissions },
    signal,
  })

  state.selectedPermissions.value = removed.permissions
  await state.savePermissions()
  expect(state.selectedPermissions.value).toEqual(removed.permissions)
  expect(state.blockedPermissions.value.has(reserved)).toBe(true)
})

it.each([null, ['permission.outside.catalog']])(
  'blocks writes when catalog restrictions are malformed (%j)',
  async (adminOnly) => {
    const { request, state } = setup()
    request
      .mockResolvedValueOnce(rolesPage([custom]))
      .mockResolvedValueOnce(catalogResponse(adminOnly))
    await state.loadPage()
    await state.loadCatalog()
    state.selectedPermissions.value = []

    expect(state.catalogError.value).toBeTruthy()
    await expect(state.savePermissions()).resolves.toBeNull()
    expect(request).toHaveBeenCalledTimes(2)
  },
)
