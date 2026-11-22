import { expect, it, vi } from 'vitest'
import { useUserPermissions } from '../composables/useUserPermissions'

const userId = 12
const endpoint = '/api/admin/users/12/permissions'
const inherited = ['orders.view.assigned']
const catalog = ['orders.view.assigned', 'orders.create', 'products.view']

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

function setup(direct = []) {
  const controller = new AbortController()
  const request = vi.fn((path) =>
    Promise.resolve(path === endpoint ? envelope(direct) : { data: { permissions: catalog } }),
  )
  const state = useUserPermissions({ request, userId, signal: controller.signal })
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

it('uses the full catalog for direct grants when the response marks role-only restrictions', async () => {
  const { state, request } = setup()
  const reserved = 'users.manage'
  request
    .mockResolvedValueOnce(envelope())
    .mockResolvedValueOnce({
      data: { permissions: [...catalog, reserved], admin_only_permissions: [reserved] },
    })
    .mockResolvedValueOnce(envelope([reserved]))

  await state.load()
  expect(state.catalog.value).toContain(reserved)
  state.selectedPermissions.value = [reserved]

  await state.save()
  expect(request).toHaveBeenLastCalledWith(
    endpoint,
    expect.objectContaining({ method: 'PATCH', body: { direct_permissions: [reserved] } }),
  )
})
