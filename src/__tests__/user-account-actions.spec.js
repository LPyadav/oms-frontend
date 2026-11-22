import { expect, it, vi } from 'vitest'
import { loadRoleNames } from '../api/adminRoles'
import { getUserAccountBody, useUserAccountActions } from '../composables/useUserAccountActions'

const account = {
  id: 12,
  name: 'Asha Mehta',
  email: 'asha@example.test',
  roles: ['admin'],
  is_active: true,
}

function setup() {
  const request = vi.fn()
  const controller = new AbortController()
  const api = useUserAccountActions({ request, signal: controller.signal })
  return { request, controller, api }
}

it('submits the create fields and preserves the password exactly as entered', async () => {
  const { request, controller, api } = setup()
  const body = getUserAccountBody('create', {
    name: '  Asha Mehta  ',
    email: ' asha@example.test ',
    password: ' password with spaces ',
  })
  const created = { ...account, roles: [] }
  request.mockResolvedValue({ data: { user: created } })
  api.openAction('create')

  await expect(api.saveAccount(body)).resolves.toEqual({ mode: 'create', user: created })
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/admin/users', {
    method: 'POST',
    body: { name: account.name, email: account.email, password: ' password with spaces ' },
    signal: controller.signal,
  })
  expect(api.action.value).toBeNull()
})

it('sends only changed profile fields and skips a no-op edit', async () => {
  const { request, api } = setup()
  api.openAction('edit', account)
  await expect(api.saveAccount(getUserAccountBody('edit', account, account))).resolves.toBeNull()
  expect(request).not.toHaveBeenCalled()

  const updated = { ...account, name: 'Asha Singh' }
  request.mockResolvedValue({ data: { user: updated } })
  const body = getUserAccountBody('edit', { ...account, name: ' Asha Singh ' }, account)

  await expect(api.saveAccount(body)).resolves.toEqual({ mode: 'edit', user: updated })
  expect(request).toHaveBeenCalledExactlyOnceWith(
    '/api/admin/users/12',
    expect.objectContaining({ method: 'PATCH', body: { name: 'Asha Singh' } }),
  )
})

it.each([409, 422])('keeps the dialog open and exposes errors from HTTP %i', async (status) => {
  const { request, api } = setup()
  const fields = { email: ['Use another email address.'], password: ['Choose a longer password.'] }
  request.mockRejectedValue({ status, fields })
  api.openAction('create')

  await expect(
    api.saveAccount({ name: account.name, email: account.email, password: 'example-password' }),
  ).resolves.toBeNull()

  expect(api.action.value.mode).toBe('create')
  expect(api.fieldErrors.value).toEqual(fields)
  api.clearFieldError('email')
  expect(api.fieldErrors.value).toEqual({ password: fields.password })
})

it('omits the disable body and keeps the confirmation open when Laravel protects the last Admin', async () => {
  const { request, controller, api } = setup()
  request.mockRejectedValue({ status: 409, code: 'LAST_ACTIVE_ADMIN' })
  api.openAction('disable', account)

  await expect(api.saveAccount()).resolves.toBeNull()

  expect(request).toHaveBeenCalledExactlyOnceWith('/api/admin/users/12/disable', {
    method: 'PATCH',
    signal: controller.signal,
  })
  expect(api.message.value).toBe('The last active Admin cannot be disabled.')
  expect(api.action.value).toEqual({ mode: 'disable', account })
  expect(account.is_active).toBe(true)
})

it('enables a disabled user with a bodyless request and uses the returned account', async () => {
  const { request, controller, api } = setup()
  const disabled = { ...account, is_active: false, roles: ['staff'] }
  const enabled = { ...disabled, is_active: true }
  request.mockResolvedValue({ data: { user: enabled } })
  api.openAction('enable', disabled)

  await expect(api.saveAccount()).resolves.toEqual({ mode: 'enable', user: enabled })

  expect(request).toHaveBeenCalledExactlyOnceWith('/api/admin/users/12/enable', {
    method: 'PATCH',
    signal: controller.signal,
  })
  expect(api.action.value).toBeNull()
})

it.each([{ is_active: false }, { id: 52 }])(
  'keeps the enable confirmation open when the response cannot confirm the change (%j)',
  async (fields) => {
    const { request, api } = setup()
    const disabled = { ...account, is_active: false }
    request.mockResolvedValue({ data: { user: { ...account, ...fields } } })
    api.openAction('enable', disabled)

    await expect(api.saveAccount()).resolves.toBeNull()

    expect(api.action.value).toEqual({ mode: 'enable', account: disabled })
    expect(api.message.value).toContain('Could not confirm the change')
  },
)

it('allows one write at a time and prevents closing while it is pending', async () => {
  const { request, api } = setup()
  const pending = Promise.withResolvers()
  request.mockReturnValue(pending.promise)
  api.openAction('disable', account)
  const saving = api.saveAccount()

  await expect(api.saveAccount()).resolves.toBeNull()
  expect(api.closeAction()).toBe(false)
  expect(request).toHaveBeenCalledTimes(1)

  const disabled = { ...account, is_active: false }
  pending.resolve({ data: { user: disabled } })
  await expect(saving).resolves.toEqual({ mode: 'disable', user: disabled })
  expect(api.saving.value).toBe(false)
})

it('discards a write response when the directory has been left', async () => {
  const { request, controller, api } = setup()
  const pending = Promise.withResolvers()
  request.mockReturnValue(pending.promise)
  api.openAction('edit', account)
  const saving = api.saveAccount({ name: 'New name' })

  controller.abort()
  pending.resolve({ data: { user: { ...account, name: 'New name' } } })

  await expect(saving).resolves.toBeNull()
  expect(api.message.value).toBe('')
})

it('loads all catalog pages and preserves role names exactly as returned', async () => {
  const { request, controller } = setup()
  request
    .mockResolvedValueOnce({
      data: { roles: [{ name: 'admin' }, { name: 'Fulfillment Lead' }] },
      meta: { current_page: 1, last_page: 2 },
    })
    .mockResolvedValueOnce({
      data: { roles: [{ name: 'staff' }] },
      meta: { current_page: 2, last_page: 2 },
    })

  await expect(loadRoleNames(request, controller.signal)).resolves.toEqual([
    'admin',
    'Fulfillment Lead',
    'staff',
  ])
  expect(request.mock.calls).toEqual([
    ['/api/admin/roles?page=1', { signal: controller.signal }],
    ['/api/admin/roles?page=2', { signal: controller.signal }],
  ])
})

it('replaces the full role set, including an empty set, and preserves a disabled account', async () => {
  const { request, controller, api } = setup()
  const disabled = { ...account, roles: ['staff'], is_active: false }
  const updated = { ...disabled, roles: [] }
  request.mockResolvedValue({ data: { user: updated } })
  api.openAction('roles', disabled)

  await expect(api.saveAccount({ roles: [] })).resolves.toEqual({ mode: 'roles', user: updated })

  expect(request).toHaveBeenCalledExactlyOnceWith('/api/admin/users/12/roles', {
    method: 'PATCH',
    body: { roles: [] },
    signal: controller.signal,
  })
})

it('keeps the role dialog open when Laravel protects the last active Admin', async () => {
  const { request, api } = setup()
  request.mockRejectedValue({ status: 409, code: 'LAST_ACTIVE_ADMIN' })
  api.openAction('roles', account)

  await expect(api.saveAccount({ roles: ['staff'] })).resolves.toBeNull()

  expect(api.action.value).toEqual({ mode: 'roles', account })
  expect(api.message.value).toBe('The Admin role cannot be removed from the last active Admin.')
  expect(account.roles).toEqual(['admin'])
})

it('associates indexed Laravel validation errors with the role selector', async () => {
  const { request, api } = setup()
  const messages = ['The selected role is invalid.']
  request.mockRejectedValue({ status: 422, fields: { 'roles.0': messages } })
  api.openAction('roles', account)

  await expect(api.saveAccount({ roles: ['unavailable-role'] })).resolves.toBeNull()

  expect(api.fieldErrors.value).toEqual({ roles: messages })
  expect(api.action.value).toEqual({ mode: 'roles', account })
})
