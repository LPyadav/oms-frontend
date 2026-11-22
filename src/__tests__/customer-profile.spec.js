import { expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { ApiError } from '../api/client'
import { createCustomer, deactivateCustomer, getCustomer, updateCustomer } from '../api/customers'
import { useCustomerProfile } from '../composables/useCustomerProfile'

const customer = {
  id: 7,
  name: 'Harbor Retail',
  email: 'accounts@harbor.example.test',
  phone: '+1 555 0101',
  address: null,
  is_active: true,
}

function response(record = customer) {
  return { data: { customer: record } }
}

function setup(customerId = customer.id) {
  const controller = new AbortController()
  const request = vi.fn()
  const canManage = ref(true)
  const profile = useCustomerProfile({
    request,
    customerId,
    canManage: () => canManage.value,
    signal: controller.signal,
  })
  return { controller, request, profile, canManage }
}

it('uses the customer resource endpoints and sends deactivation without a body', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(response())
    .mockResolvedValueOnce(response())
    .mockResolvedValueOnce(response())
    .mockResolvedValueOnce(response({ ...customer, is_active: false }))
  const { signal } = new AbortController()
  const input = { name: 'Harbor Retail' }

  await expect(getCustomer(request, 7, signal)).resolves.toEqual(customer)
  await createCustomer(request, input, signal)
  await updateCustomer(request, 7, input, signal)
  await deactivateCustomer(request, 7, signal)

  expect(request.mock.calls).toEqual([
    ['/api/customers/7', { signal }],
    ['/api/customers', { method: 'POST', body: input, signal }],
    ['/api/customers/7', { method: 'PATCH', body: input, signal }],
    ['/api/customers/7/deactivate', { method: 'PATCH', signal }],
  ])
})

it('rejects a different customer or a status that contradicts the write', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(response({ ...customer, id: 8 }))
    .mockResolvedValueOnce(response())
    .mockResolvedValueOnce(response({ ...customer, is_active: false }))

  await expect(getCustomer(request, 7)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  await expect(deactivateCustomer(request, 7)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  await expect(createCustomer(request, { name: customer.name })).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})

it('allows profile reads while blocking write actions without management access', async () => {
  const { request, profile, canManage } = setup()
  canManage.value = false
  request.mockResolvedValueOnce(response())
  await profile.load()

  expect(profile.customer.value).toEqual(customer)
  profile.openEdit()
  profile.openDeactivation()
  expect(profile.mode.value).toBe('profile')
  await expect(profile.save()).resolves.toBeNull()
  expect(request).toHaveBeenCalledTimes(1)

  const creation = setup(null)
  creation.profile.draft.value.name = 'Unapproved creation'
  creation.canManage.value = false
  await expect(creation.profile.save()).resolves.toBeNull()
  expect(creation.request).not.toHaveBeenCalled()
})

it('creates once while saving and shows the returned profile', async () => {
  const { controller, request, profile } = setup(null)
  const pending = Promise.withResolvers()
  request.mockReturnValueOnce(pending.promise)
  profile.draft.value.name = '  Harbor Retail  '
  profile.draft.value.phone = '  +1 555 0101  '
  profile.draft.value.address = ' '

  const save = profile.save()
  expect(profile.saving.value).toBe(true)
  await expect(profile.save()).resolves.toBeNull()
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/customers', {
    method: 'POST',
    body: { name: 'Harbor Retail', email: null, phone: '+1 555 0101', address: null },
    signal: controller.signal,
  })
  pending.resolve(response())
  await expect(save).resolves.toEqual(customer)
  expect(profile.mode.value).toBe('profile')
  expect(profile.customer.value).toEqual(customer)
})

it('omits unchanged fields, sends null to clear a field, and can edit inactive profiles', async () => {
  const { controller, request, profile } = setup()
  const inactive = { ...customer, is_active: false }
  request
    .mockResolvedValueOnce(response(inactive))
    .mockResolvedValueOnce(response({ ...inactive, email: null, phone: 'Latest server contact' }))
  await profile.load()
  profile.openEdit()
  expect(profile.canSubmit.value).toBe(false)
  await expect(profile.save()).resolves.toBeNull()
  profile.draft.value.email = '  '

  await profile.save()

  expect(request).toHaveBeenLastCalledWith('/api/customers/7', {
    method: 'PATCH',
    body: { email: null },
    signal: controller.signal,
  })
  expect(profile.customer.value).toMatchObject({
    email: null,
    phone: 'Latest server contact',
    is_active: false,
  })
})

it('preserves the form and field errors after validation failure', async () => {
  const { request, profile } = setup(null)
  const failure = new ApiError('Validation failed.', {
    status: 422,
    fields: { email: ['Enter a valid email address.'] },
  })
  request.mockRejectedValueOnce(failure)
  profile.draft.value.name = 'Harbor Retail'
  profile.draft.value.email = 'invalid'

  await expect(profile.save()).resolves.toBeNull()

  expect(profile.writeError.value).toBe(failure)
  expect(profile.mode.value).toBe('create')
  expect(profile.draft.value.email).toBe('invalid')
  expect(profile.saving.value).toBe(false)
  expect(request).toHaveBeenCalledTimes(1)
})

it('cancels a confirmation and prevents re-deactivation after a successful change', async () => {
  const { request, profile } = setup()
  request.mockResolvedValueOnce(response()).mockResolvedValueOnce(
    response({
      ...customer,
      is_active: false,
    }),
  )
  await profile.load()
  profile.openDeactivation()
  expect(profile.mode.value).toBe('deactivate')
  profile.showProfile()
  expect(profile.mode.value).toBe('profile')
  expect(request).toHaveBeenCalledTimes(1)

  profile.openDeactivation()
  await profile.save()
  expect(profile.customer.value.is_active).toBe(false)
  profile.openDeactivation()
  expect(profile.mode.value).toBe('profile')
  await expect(profile.save()).resolves.toBeNull()
  expect(request).toHaveBeenCalledTimes(2)
})

it('keeps a failed detail load distinct and can reload it', async () => {
  const { request, profile } = setup()
  const failure = new ApiError('Customer not found.', { status: 404 })
  request.mockRejectedValueOnce(failure).mockResolvedValueOnce(response())

  await profile.load()
  expect(profile.readError.value).toBe(failure)
  expect(profile.customer.value).toBeNull()

  await profile.load()
  expect(profile.readError.value).toBeNull()
  expect(profile.customer.value).toEqual(customer)
})

it('ignores a response that arrives after the dialog is disposed', async () => {
  const { controller, request, profile } = setup(null)
  const pending = Promise.withResolvers()
  request.mockReturnValueOnce(pending.promise)
  profile.draft.value.name = customer.name

  const saving = profile.save()
  controller.abort()
  pending.resolve(response())

  await expect(saving).resolves.toBeNull()
  expect(profile.customer.value).toBeNull()
})
