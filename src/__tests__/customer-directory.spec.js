import { expect, it, vi } from 'vitest'
import { loadCustomerPage } from '../api/customers'
import { useCustomerDirectory } from '../composables/useCustomerDirectory'

const customer = {
  id: 7,
  name: 'North 100% & Co',
  email: 'hello@north.example.test',
  phone: null,
  address: null,
  is_active: false,
}
const firstPage = { page: 1, search: '', isActive: null }

function envelope(customers = [customer], pagination = {}) {
  return {
    data: { customers },
    meta: { current_page: 1, per_page: 25, total: 1, last_page: 1, ...pagination },
  }
}

function setup() {
  const controller = new AbortController()
  const request = vi.fn()
  const directory = useCustomerDirectory({ request, signal: controller.signal })
  return { request, directory, controller }
}

it('sends literal search and inactive filtering and uses server pagination', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(
      envelope([customer], { current_page: 2, per_page: 3, total: 4, last_page: 2 }),
    )
  const { signal } = new AbortController()

  await expect(
    loadCustomerPage(request, { page: 2, search: '100% & Co', isActive: false }, signal),
  ).resolves.toEqual({ customers: [customer], currentPage: 2, perPage: 3, total: 4, lastPage: 2 })
  expect(request).toHaveBeenCalledExactlyOnceWith(
    '/api/customers?page=2&search=100%25+%26+Co&is_active=0',
    { signal },
  )
})

it('omits optional filters and honors a deployment page-size default', async () => {
  const request = vi.fn().mockResolvedValueOnce(envelope())
  const { signal } = new AbortController()

  await loadCustomerPage(request, firstPage, signal)

  expect(request).toHaveBeenCalledExactlyOnceWith('/api/customers?page=1', { signal })
})

it('retains an empty out-of-range result so the view can return to the last page', async () => {
  const request = vi.fn().mockResolvedValueOnce(envelope([], { current_page: 3, total: 0 }))
  const { signal } = new AbortController()

  await expect(loadCustomerPage(request, { ...firstPage, page: 3 }, signal)).resolves.toEqual({
    customers: [],
    currentPage: 3,
    perPage: 25,
    total: 0,
    lastPage: 1,
  })
})

it.each([
  envelope([{ ...customer, is_active: '0' }]),
  envelope([{ ...customer, email: 7 }]),
  envelope([customer], { current_page: 2 }),
  envelope([customer], { per_page: 0 }),
])('rejects invalid customer list data and paging (%j)', async (payload) => {
  const request = vi.fn().mockResolvedValueOnce(payload)
  const { signal } = new AbortController()

  await expect(loadCustomerPage(request, firstPage, signal)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})

it('discards an older result when a newer search completes first', async () => {
  const { request, directory } = setup()
  const stale = Promise.withResolvers()
  const latest = { ...customer, id: 8, name: 'South Warehouse', is_active: true }
  request.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(envelope([latest]))

  const earlier = directory.load()
  const oldSignal = request.mock.calls[0][1].signal
  await directory.load({ ...firstPage, search: 'South', isActive: true })

  expect(oldSignal.aborted).toBe(true)
  stale.resolve(envelope())
  await earlier
  expect(directory.result.value.customers).toEqual([latest])
  expect(directory.error.value).toBeNull()
  expect(directory.loading.value).toBe(false)
})

it('retries the requested page and filters after an API error', async () => {
  const { request, directory } = setup()
  const interval = { page: 2, search: 'North', isActive: false }
  request
    .mockRejectedValueOnce({ status: 429 })
    .mockResolvedValueOnce(envelope([customer], { current_page: 2, last_page: 2, total: 26 }))

  await directory.load(interval)

  expect(directory.error.value.status).toBe(429)
  await directory.load()
  expect(request.mock.calls.map(([url]) => url)).toEqual([
    '/api/customers?page=2&search=North&is_active=0',
    '/api/customers?page=2&search=North&is_active=0',
  ])
  expect(directory.query.value).toEqual(interval)
  expect(directory.error.value).toBeNull()
  expect(directory.result.value.currentPage).toBe(2)
})

it('ignores returned data when the directory has been left', async () => {
  const { request, directory, controller } = setup()
  const pending = Promise.withResolvers()
  request.mockReturnValueOnce(pending.promise)

  const load = directory.load()
  controller.abort()
  pending.resolve(envelope())
  await load

  expect(directory.result.value).toBeNull()
  expect(directory.error.value).toBeNull()
})
