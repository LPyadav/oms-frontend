import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../stores/auth'

const profile = { id: 28, name: 'Alex Morgan', email: 'alex@example.com' }
const admin = { ...profile, roles: ['admin'], permissions: ['users.manage'] }

function success(data) {
  return Response.json({ success: true, data })
}

function failure(status, code, fields = {}, headers = {}) {
  return Response.json(
    { success: false, message: 'Request failed.', errors: { code, fields } },
    { status, headers },
  )
}

function loginResponse(expiresAt = new Date(Date.now() + 60_000).toISOString()) {
  return success({ access_token: 'browser-token', expires_at: expiresAt, user: profile })
}

describe('OMS authentication', () => {
  let pinia
  let fetchMock

  beforeEach(() => {
    sessionStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    disposePinia(pinia)
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('confirms the current profile before gaining admin access and restores it on reload', async () => {
    fetchMock.mockResolvedValueOnce(loginResponse()).mockResolvedValueOnce(success({ user: admin }))
    const auth = useAuthStore()

    const signingIn = auth.login({ email: profile.email, password: 'test-password' })
    expect(auth.canManageUsers).toBe(false)
    await signingIn

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: profile.email, password: 'test-password' }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer browser-token' }),
      }),
    )
    expect(auth.user).toEqual(admin)
    expect(auth.canManageUsers).toBe(true)

    disposePinia(pinia)
    pinia = createPinia()
    setActivePinia(pinia)
    fetchMock.mockResolvedValueOnce(success({ user: admin }))
    const restored = useAuthStore()

    expect(restored.canManageUsers).toBe(false)
    await restored.initialize()
    expect(restored.canManageUsers).toBe(true)
  })

  it.each([
    [[], ['users.manage']],
    [['admin'], []],
    [['manager'], ['orders.assign']],
  ])('denies admin features with roles %j and permissions %j', async (roles, permissions) => {
    fetchMock
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(success({ user: { ...profile, roles, permissions } }))
    const auth = useAuthStore()

    await auth.login({ email: profile.email, password: 'test-password' })

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.canManageUsers).toBe(false)
  })

  it('retries a transient profile failure without submitting credentials again', async () => {
    fetchMock
      .mockResolvedValueOnce(loginResponse())
      .mockRejectedValueOnce(new TypeError('Offline'))
      .mockResolvedValueOnce(success({ user: admin }))
    const auth = useAuthStore()

    await expect(
      auth.login({ email: profile.email, password: 'test-password' }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    expect(auth.status).toBe('unavailable')
    expect(auth.canManageUsers).toBe(false)

    await Promise.all([auth.initialize(), auth.initialize()])

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(['/api/login', '/api/me', '/api/me'])
    expect(auth.canManageUsers).toBe(true)
  })

  it('passes validation and rate limit details without starting a session', async () => {
    const fields = { email: ['Enter a valid email address.'] }
    fetchMock
      .mockResolvedValueOnce(failure(422, 'VALIDATION_FAILED', fields))
      .mockResolvedValueOnce(failure(429, 'RATE_LIMIT_EXCEEDED', {}, { 'Retry-After': '30' }))
    const auth = useAuthStore()
    const credentials = { email: profile.email, password: 'test-password' }

    await expect(auth.login(credentials)).rejects.toMatchObject({ status: 422, fields })
    await expect(auth.login(credentials)).rejects.toMatchObject({ status: 429, retryAfter: '30' })
    expect(auth.status).toBe('anonymous')
    expect(sessionStorage.length).toBe(0)
  })

  it('keeps the session available on a transient logout failure and clears it on retry', async () => {
    fetchMock
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(success({ user: admin }))
      .mockResolvedValueOnce(failure(500, 'INTERNAL_SERVER_ERROR'))
      .mockResolvedValueOnce(success(null))
    const auth = useAuthStore()
    await auth.login({ email: profile.email, password: 'test-password' })

    await expect(auth.logout()).rejects.toMatchObject({ status: 500 })
    expect(auth.isAuthenticated).toBe(true)
    expect(sessionStorage.length).toBe(1)

    await auth.logout()

    expect(auth.isAuthenticated).toBe(false)
    expect(auth.user).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it('clears the session when a protected request returns an authentication error', async () => {
    fetchMock
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(success({ user: admin }))
      .mockResolvedValueOnce(failure(401, 'AUTH_UNAUTHENTICATED'))
    const auth = useAuthStore()
    await auth.login({ email: profile.email, password: 'test-password' })

    await expect(auth.request('/api/admin/users')).rejects.toMatchObject({ status: 401 })
    expect(auth.status).toBe('anonymous')
    expect(sessionStorage.length).toBe(0)
  })

  it('ends an expired session while the user stays on a protected screen', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValueOnce(loginResponse()).mockResolvedValueOnce(success({ user: admin }))
    const auth = useAuthStore()
    await auth.login({ email: profile.email, password: 'test-password' })

    await vi.advanceTimersByTimeAsync(60_000)

    expect(auth.status).toBe('anonymous')
    expect(auth.canManageUsers).toBe(false)
    expect(sessionStorage.length).toBe(0)
  })
})
