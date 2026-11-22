import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useCatalogDirectory } from '../composables/useCatalogDirectory'

let scope
let lifetime
let fetchPage
let directory

beforeEach(() => {
  vi.useFakeTimers()
  scope = effectScope()
  lifetime = new AbortController()
  fetchPage = vi.fn().mockResolvedValue({ currentPage: 1 })
  directory = scope.run(() => useCatalogDirectory({ fetchPage, signal: lifetime.signal }))
})

afterEach(() => {
  lifetime.abort()
  scope.stop()
  vi.useRealTimers()
})

it('waits 300 ms from the latest term, trims it, and resets to page 1 with the applied status', async () => {
  await directory.applyFilters(false)
  await directory.load({ ...directory.query.value, page: 2 })
  fetchPage.mockClear()

  directory.search.value = 'ware'
  await vi.advanceTimersByTimeAsync(200)
  directory.search.value = '  warehouse  '
  await vi.advanceTimersByTimeAsync(299)
  expect(fetchPage).not.toHaveBeenCalled()

  await vi.advanceTimersByTimeAsync(1)
  expect(fetchPage).toHaveBeenCalledExactlyOnceWith(
    { page: 1, search: 'warehouse', isActive: false },
    expect.any(AbortSignal),
  )

  directory.search.value = 'warehouse'
  await vi.advanceTimersByTimeAsync(300)
  expect(fetchPage).toHaveBeenCalledOnce()
})

it('applies and clears immediately, superseding any queued search', async () => {
  directory.search.value = 'urgent'
  await directory.applyFilters(true)
  await vi.advanceTimersByTimeAsync(300)

  expect(fetchPage).toHaveBeenCalledExactlyOnceWith(
    { page: 1, search: 'urgent', isActive: true },
    expect.any(AbortSignal),
  )
  fetchPage.mockClear()

  directory.search.value = 'queued'
  directory.search.value = ''
  await directory.applyFilters(null)
  await vi.advanceTimersByTimeAsync(300)

  expect(fetchPage).toHaveBeenCalledExactlyOnceWith(
    { page: 1, search: '', isActive: null },
    expect.any(AbortSignal),
  )
})

it('keeps a queued search when a page request uses the applied query', async () => {
  await directory.applyFilters(true)
  fetchPage.mockClear()

  directory.search.value = 'new term'
  await directory.load({ ...directory.query.value, page: 2 })
  expect(fetchPage).toHaveBeenCalledExactlyOnceWith(
    { page: 2, search: '', isActive: true },
    expect.any(AbortSignal),
  )

  await vi.advanceTimersByTimeAsync(300)
  expect(fetchPage).toHaveBeenLastCalledWith(
    { page: 1, search: 'new term', isActive: true },
    expect.any(AbortSignal),
  )
  expect(fetchPage).toHaveBeenCalledTimes(2)
})

it('cancels a queued search when leaving the directory', async () => {
  directory.search.value = 'queued'
  lifetime.abort()
  await vi.advanceTimersByTimeAsync(300)

  expect(fetchPage).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

it('ignores an older in-flight result once the debounced search starts', async () => {
  const stale = Promise.withResolvers()
  const current = { currentPage: 1, search: 'latest' }
  fetchPage.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(current)
  const firstRequest = directory.load()
  const previousSignal = fetchPage.mock.calls[0][1]

  directory.search.value = 'latest'
  await vi.advanceTimersByTimeAsync(300)
  stale.resolve({ currentPage: 1, search: 'stale' })
  await firstRequest

  expect(previousSignal.aborted).toBe(true)
  expect(directory.result.value).toBe(current)
})
