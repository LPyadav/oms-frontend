import { expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { ApiError } from '../api/client'
import { createProduct, deactivateProduct, getProduct, updateProduct } from '../api/products'
import { useProductProfile } from '../composables/useProductProfile'

const product = {
  id: 9,
  name: 'Thermal Labels',
  sku: 'LABELS-V1',
  price: '14.00',
  tax_rate: '5.00',
  stock_quantity: 23,
  stock_version: 3,
  is_active: true,
}

function resource(record = product) {
  return { data: { product: record } }
}

function setup(productId = product.id) {
  const request = vi.fn()
  const { signal } = new AbortController()
  const canManage = ref(true)
  const profile = useProductProfile({
    request,
    productId,
    signal,
    canManage: () => canManage.value,
  })
  return { request, profile, signal, canManage }
}

it('uses the product resource endpoints and a bodyless deactivate request', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(resource())
    .mockResolvedValueOnce(resource({ ...product, stock_quantity: 0, stock_version: 0 }))
    .mockResolvedValueOnce(resource())
    .mockResolvedValueOnce(resource({ ...product, is_active: false }))
  const { signal } = new AbortController()
  const create = { name: 'Labels', sku: 'LABELS', price: '14.00' }

  await expect(getProduct(request, 9, signal)).resolves.toEqual(product)
  await createProduct(request, create, signal)
  await updateProduct(request, 9, { name: 'Labels' }, signal)
  await deactivateProduct(request, 9, signal)

  expect(request.mock.calls).toEqual([
    ['/api/products/9', { signal }],
    ['/api/products', { method: 'POST', body: create, signal }],
    ['/api/products/9', { method: 'PATCH', body: { name: 'Labels' }, signal }],
    ['/api/products/9/deactivate', { method: 'PATCH', signal }],
  ])
})

it('rejects a mismatched product and a deactivation response that is still active', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(resource({ ...product, id: 10 }))
    .mockResolvedValueOnce(resource())

  await expect(getProduct(request, 9)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  await expect(deactivateProduct(request, 9)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})

it('creates with decimal strings and lets Laravel default tax, status and stock', async () => {
  const { request, profile, signal } = setup(null)
  const pending = Promise.withResolvers()
  request.mockReturnValueOnce(pending.promise)
  profile.draft.value = { name: '  Tape  ', sku: ' tape-v2 ', price: ' 0.50 ', tax_rate: ' ' }

  const first = profile.save()
  await expect(profile.save()).resolves.toBeNull()
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/products', {
    method: 'POST',
    body: { name: 'Tape', sku: 'tape-v2', price: '0.50' },
    signal,
  })
  const created = {
    ...product,
    sku: 'TAPE-V2',
    name: 'Tape',
    price: '0.50',
    tax_rate: '0.00',
    stock_quantity: 0,
    stock_version: 0,
  }
  pending.resolve(resource(created))

  await expect(first).resolves.toEqual(created)
  expect(profile.mode.value).toBe('profile')
  expect(profile.product.value).toEqual(created)
})

it('sends a partial patch and treats equivalent decimals and SKU case as unchanged', async () => {
  const { request, profile, signal } = setup()
  request
    .mockResolvedValueOnce(resource())
    .mockResolvedValueOnce(
      resource({ ...product, name: 'Wide Labels', stock_quantity: 19, stock_version: 4 }),
    )
  await profile.load()
  profile.openEdit()
  profile.draft.value.sku = 'labels-v1'
  profile.draft.value.price = '0014'
  profile.draft.value.tax_rate = '5.0'

  expect(profile.canSubmit.value).toBe(false)
  await expect(profile.save()).resolves.toBeNull()
  profile.draft.value.name = 'Wide Labels'
  await profile.save()

  expect(request).toHaveBeenLastCalledWith('/api/products/9', {
    method: 'PATCH',
    body: { name: 'Wide Labels' },
    signal,
  })
  expect(profile.product.value).toMatchObject({ name: 'Wide Labels', stock_quantity: 19 })
})

it('preserves attempted changes and field errors on a normalized SKU conflict', async () => {
  const { request, profile } = setup()
  const conflict = new ApiError('Validation failed.', {
    status: 409,
    fields: { sku: ['The sku has already been taken.'] },
  })
  request.mockResolvedValueOnce(resource()).mockRejectedValueOnce(conflict)
  await profile.load()
  profile.openEdit()
  profile.draft.value.sku = 'already-used'

  await expect(profile.save()).resolves.toBeNull()

  expect(profile.mode.value).toBe('edit')
  expect(profile.draft.value.sku).toBe('already-used')
  expect(profile.writeError.value).toBe(conflict)
  expect(profile.saving.value).toBe(false)
  expect(request).toHaveBeenCalledTimes(2)
})

it('requires a tax rate on edit and lets the user explicitly set zero', async () => {
  const { request, profile, signal } = setup()
  request
    .mockResolvedValueOnce(resource())
    .mockResolvedValueOnce(resource({ ...product, tax_rate: '0.00' }))
  await profile.load()
  profile.openEdit()
  profile.draft.value.tax_rate = ''
  expect(profile.canSubmit.value).toBe(false)
  profile.draft.value.tax_rate = '0'
  expect(profile.canSubmit.value).toBe(true)
  await profile.save()

  expect(request).toHaveBeenLastCalledWith('/api/products/9', {
    method: 'PATCH',
    body: { tax_rate: '0' },
    signal,
  })
})

it('blocks metadata writes when management access is lost', async () => {
  const { request, profile, canManage } = setup()
  request.mockResolvedValueOnce(resource())
  await profile.load()
  profile.openEdit()
  profile.draft.value.name = 'Wide Labels'
  expect(profile.canSubmit.value).toBe(true)
  canManage.value = false

  await expect(profile.save()).resolves.toBeNull()
  expect(request).toHaveBeenCalledTimes(1)
})

it('allows cancellation and preserves the returned stock on confirmed deactivation', async () => {
  const { request, profile, signal } = setup()
  request
    .mockResolvedValueOnce(resource())
    .mockResolvedValueOnce(resource({ ...product, is_active: false }))
  await profile.load()
  profile.openDeactivation()
  profile.showProfile()
  expect(request).toHaveBeenCalledTimes(1)
  profile.openDeactivation()
  await profile.save()

  expect(request).toHaveBeenLastCalledWith('/api/products/9/deactivate', {
    method: 'PATCH',
    signal,
  })
  expect(profile.product.value).toMatchObject({
    is_active: false,
    stock_quantity: 23,
    stock_version: 3,
  })
  profile.openDeactivation()
  expect(profile.mode.value).toBe('profile')
  profile.openEdit()
  expect(profile.mode.value).toBe('edit')
})
