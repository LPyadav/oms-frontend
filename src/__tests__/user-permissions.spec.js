import { expect, it, vi } from 'vitest'
import { useUserPermissions } from '../composables/useUserPermissions'

const userId = 12
const endpoint = '/api/admin/users/12/permissions'
const inherited = ['orders.view.assigned']
const catalog = ['orders.view.assigned', 'orders.create', 'products.view']
const adminOnlyPermission = 'users.manage'

function envelope(direct = [], fields = {}) {
  return {
    data: {
      user_id: userId,
      inherited_permissions: inherited,
      direct_permissions: direct,
      ...fields,
    },
  }
}

function setup(direct = [], targetRoles = ['manager']) {
  const controller = new AbortController()
  const request = vi.fn((path) =>
    Promise.resolve(
      path === endpoint
        ? envelope(direct)
        : {
            data: {
              permissions: [...catalog, adminOnlyPermission],
              admin_only_permissions: [adminOnlyPermission],
            },
          },
    ),
  )
  const state = useUserPermissions({ request, userId, targetRoles, signal: controller.signal })
  return { request, controller, state }
}

it('loads both endpoints and keeps inherited keys out of the checkbox selection', async () => {
  const { state, request, controller } = setup(['orders.create'])

  await state.load()

  expect(request).toHaveBeenCalledWith(endpoint, { signal: controller.signal })
  expect(request).toHaveBeenCalledWith('/api/admin/permissions', { signal: controller.signal })
  expect(state.grants.value.inheritedPermissions).toEqual(inherited)
  expect(state.selectedPermissions.value).toEqual(['orders.create'])
  expect(state.canSave.value).toBe(false)
})

it('replaces only direct grants and permits an explicit direct grant for an inherited key', async () => {
  const { state, request, controller } = setup(['orders.create'])
  await state.load()
  state.selectedPermissions.value = ['orders.view.assigned', 'products.view']
  request.mockResolvedValueOnce(envelope(['orders.view.assigned', 'products.view']))

  await expect(state.save()).resolves.toEqual({
    userId,
    inheritedPermissions: inherited,
    directPermissions: ['orders.view.assigned', 'products.view'],
  })
  expect(request).toHaveBeenLastCalledWith(endpoint, {
    method: 'PATCH',
    body: { direct_permissions: ['orders.view.assigned', 'products.view'] },
    signal: controller.signal,
  })
  expect(state.canSave.value).toBe(false)
})

it('clears the full direct set with an explicit empty list and retains inherited grants', async () => {
  const { state, request } = setup(['orders.view.assigned', 'orders.create'])
  await state.load()
  state.selectedPermissions.value = []
  request.mockResolvedValueOnce(envelope())

  await state.save()

  expect(request).toHaveBeenLastCalledWith(
    endpoint,
    expect.objectContaining({ method: 'PATCH', body: { direct_permissions: [] } }),
  )
  expect(state.grants.value.inheritedPermissions).toEqual(inherited)
  expect(state.grants.value.directPermissions).toEqual([])
  expect(state.canSave.value).toBe(false)
  await expect(state.save()).resolves.toBeNull()
  expect(request).toHaveBeenCalledTimes(3)
})

it.each([{ user_id: 34 }, { inherited_permissions: null }, { direct_permissions: {} }])(
  'blocks edits for an invalid permission snapshot (%j)',
  async (fields) => {
    const { state, request } = setup()
    request.mockResolvedValueOnce(envelope([], fields))

    await state.load()

    expect(state.loadError.value).toBeTruthy()
    expect(state.canEdit.value).toBe(false)
    await expect(state.save()).resolves.toBeNull()
    expect(request).toHaveBeenCalledTimes(2)
  },
)

it('blocks replacement when the catalog omits a stored direct grant', async () => {
  const { state } = setup(['new.permission'])
  await state.load()

  expect(state.loadError.value).toContain('missing from the catalog')
  expect(state.selectedPermissions.value).toEqual(['new.permission'])
  expect(state.canEdit.value).toBe(false)
  expect(state.canSave.value).toBe(false)
})

it('keeps the selection and shows a field error when Laravel rejects a direct grant', async () => {
  const { state, request } = setup()
  await state.load()
  state.selectedPermissions.value = ['products.view']
  request.mockRejectedValueOnce({
    status: 422,
    fields: { 'direct_permissions.0': ['This permission is unavailable.'] },
  })

  await expect(state.save()).resolves.toBeNull()

  expect(state.saveError.value).toBe('This permission is unavailable.')
  expect(state.selectedPermissions.value).toEqual(['products.view'])
  expect(state.canSave.value).toBe(true)
})

it('reloads the grants before allowing another save when the first result is uncertain', async () => {
  const { state, request } = setup()
  await state.load()
  state.selectedPermissions.value = ['products.view']
  request.mockRejectedValueOnce({ code: 'NETWORK_ERROR' })

  await expect(state.save()).resolves.toBeNull()

  expect(state.reloadRequired.value).toBe(true)
  await expect(state.save()).resolves.toBeNull()
  expect(request).toHaveBeenCalledTimes(3)
  request.mockResolvedValueOnce(envelope(['products.view']))

  await state.load()

  expect(state.reloadRequired.value).toBe(false)
  expect(state.selectedPermissions.value).toEqual(['products.view'])
  expect(state.canSave.value).toBe(false)
})

it('ignores a result after the permission dialog has closed', async () => {
  const { state, request, controller } = setup()
  const pending = Promise.withResolvers()
  request.mockReturnValueOnce(pending.promise)

  const load = state.load()
  controller.abort()
  pending.resolve(envelope(['orders.create']))
  await load

  expect(state.grants.value).toBeNull()
  expect(state.loadError.value).toBe('')
  expect(state.canEdit.value).toBe(false)
})

it.each(['manager', 'staff'])('excludes Admin-only choices for a %s account', async (role) => {
  const { state, request } = setup([], [role])

  await state.load()

  expect(state.catalog.value).toEqual(catalog)
  state.selectedPermissions.value = [adminOnlyPermission]
  expect(state.selectedPermissions.value).toEqual([])
  await expect(state.save()).resolves.toBeNull()
  expect(request).toHaveBeenCalledTimes(2)
})

it('allows Admin-only direct grants for accounts with the Admin role', async () => {
  const { state, request } = setup([], ['manager', 'admin'])
  await state.load()
  expect(state.catalog.value).toContain(adminOnlyPermission)
  state.selectedPermissions.value = [adminOnlyPermission]
  request.mockResolvedValueOnce(envelope([adminOnlyPermission]))

  await state.save()
  expect(request).toHaveBeenLastCalledWith(
    endpoint,
    expect.objectContaining({
      method: 'PATCH',
      body: { direct_permissions: [adminOnlyPermission] },
    }),
  )
})

it('retains existing Admin-only grants until removed and then blocks reselecting them', async () => {
  const { state, request } = setup([adminOnlyPermission])
  await state.load()
  expect(state.catalog.value).toContain(adminOnlyPermission)
  expect(state.legacyRestrictedGrants.value.has(adminOnlyPermission)).toBe(true)
  expect(state.canChangePermission(adminOnlyPermission)).toBe(true)

  state.selectedPermissions.value = [adminOnlyPermission, 'products.view']
  request.mockResolvedValueOnce(envelope([adminOnlyPermission, 'products.view']))
  await state.save()
  expect(request).toHaveBeenLastCalledWith(
    endpoint,
    expect.objectContaining({
      method: 'PATCH',
      body: { direct_permissions: [adminOnlyPermission, 'products.view'] },
    }),
  )

  state.selectedPermissions.value = []
  expect(state.canChangePermission(adminOnlyPermission)).toBe(false)
  state.selectedPermissions.value = [adminOnlyPermission]
  expect(state.selectedPermissions.value).toEqual([])
  request.mockResolvedValueOnce(envelope())

  await state.save()
  expect(request).toHaveBeenLastCalledWith(
    endpoint,
    expect.objectContaining({ method: 'PATCH', body: { direct_permissions: [] } }),
  )
  expect(state.catalog.value).toEqual(catalog)
  expect(state.grants.value.inheritedPermissions).toEqual(inherited)
})

it('blocks new non-Admin grants when catalog rules are unavailable and still allows removal', async () => {
  const { state, request } = setup(['orders.create'])
  request
    .mockResolvedValueOnce(envelope(['orders.create']))
    .mockResolvedValueOnce({ data: { permissions: catalog } })
    .mockResolvedValueOnce(envelope())

  await state.load()
  expect(state.restrictionsUnavailable.value).toBe(true)
  expect(state.catalog.value).toEqual(['orders.create'])
  state.selectedPermissions.value = ['orders.create', 'products.view']
  expect(state.selectedPermissions.value).toEqual(['orders.create'])
  state.selectedPermissions.value = []
  await state.save()

  expect(request).toHaveBeenLastCalledWith(
    endpoint,
    expect.objectContaining({ method: 'PATCH', body: { direct_permissions: [] } }),
  )
})
