import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../api/client'

const path = '/api/test'
let fetchMock
let timeout
let createTimeout

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  timeout = new AbortController()
  createTimeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function waitForAbort(signal) {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
}

it.each([
  [undefined, 10_000],
  [30_000, 30_000],
  [750, 750],
])('uses the requested timeout %s as %d milliseconds', async (timeoutMs, expected) => {
  const payload = { success: true, data: {} }
  fetchMock.mockResolvedValueOnce(Response.json(payload))

  await expect(apiRequest(path, { timeoutMs })).resolves.toEqual(payload)

  expect(createTimeout).toHaveBeenCalledExactlyOnceWith(expected)
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
    path,
    expect.objectContaining({ signal: timeout.signal }),
  )
})

it.each([0, -1, 1.5, Infinity, 2_147_483_648, '30000', null])(
  'rejects an invalid timeout %s before calling fetch',
  async (timeoutMs) => {
    await expect(apiRequest(path, { timeoutMs })).rejects.toBeInstanceOf(RangeError)

    expect(createTimeout).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  },
)

it('reports a timed-out fetch as an API network error', async () => {
  fetchMock.mockImplementation((_path, { signal }) => waitForAbort(signal))

  const request = apiRequest(path, { timeoutMs: 30_000 })
  timeout.abort(new DOMException('Request timed out', 'TimeoutError'))

  await expect(request).rejects.toMatchObject({
    name: 'ApiError',
    status: 0,
    code: 'NETWORK_ERROR',
  })
  expect(fetchMock).toHaveBeenCalledOnce()
})

it('applies the same timeout while the response body is being read', async () => {
  const readBody = vi.fn()
  fetchMock.mockImplementation((_path, { signal }) =>
    Promise.resolve({ ok: true, json: () => readBody(signal) }),
  )
  readBody.mockImplementation(waitForAbort)

  const request = apiRequest(path, { timeoutMs: 30_000 })
  await vi.waitFor(() => expect(readBody).toHaveBeenCalledOnce())
  timeout.abort(new DOMException('Request timed out', 'TimeoutError'))

  await expect(request).rejects.toMatchObject({
    name: 'ApiError',
    status: 0,
    code: 'NETWORK_ERROR',
  })
})

it('propagates a caller cancellation before the custom timeout', async () => {
  const caller = new AbortController()
  const reason = new DOMException('Canceled by caller', 'AbortError')
  fetchMock.mockImplementation((_path, { signal }) => waitForAbort(signal))

  const request = apiRequest(path, { timeoutMs: 30_000, signal: caller.signal })
  caller.abort(reason)

  await expect(request).rejects.toBe(reason)
  expect(createTimeout).toHaveBeenCalledExactlyOnceWith(30_000)
  expect(timeout.signal.aborted).toBe(false)
})
