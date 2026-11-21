import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '../router'
import { useAuthStore } from '../stores/auth'

vi.mock('../views/ConnectionCheckView.vue', () => ({ default: {} }))
vi.mock('../views/auth/LoginView.vue', () => ({ default: {} }))
vi.mock('../views/WorkspaceView.vue', () => ({ default: {} }))

const sessionKey = 'oms.session'
const user = { id: 1, name: 'Review User', email: 'review@example.test' }
let pinia
let router
let fetchMock

function rememberSession() {
  sessionStorage.setItem(
    sessionKey,
    JSON.stringify({
      token: 'test-session',
      expiresAt: Date.now() + 60_000,
    }),
  )
}

function profileResponse() {
  return Response.json({ success: true, data: { user } })
}

beforeEach(() => {
  sessionStorage.clear()
  pinia = createPinia()
  setActivePinia(pinia)
  router = createAppRouter(createMemoryHistory())
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  disposePinia(pinia)
  vi.useRealTimers()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

it('redirects a guest from the workspace to login', async () => {
  await router.push('/workspace')

  expect(router.currentRoute.value.name).toBe('login')
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each(['/workspace', '/login'])('restores a verified session before opening %s', async (path) => {
  rememberSession()
  fetchMock.mockResolvedValueOnce(profileResponse())

  await router.push(path)

  expect(router.currentRoute.value.name).toBe('workspace')
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
})

it.each([
  ['the timer runs', () => vi.advanceTimersByTimeAsync(60_000)],
  ['the timer is delayed', () => vi.setSystemTime(Date.now() + 60_000)],
])(
  'redirects to login when the session expires during workspace loading and %s',
  async (_, expireSession) => {
    vi.useFakeTimers()
    await router.push('/')
    rememberSession()
    fetchMock.mockResolvedValueOnce(profileResponse())

    const workspace = router.getRoutes().find((route) => route.name === 'workspace')
    const componentRequested = Promise.withResolvers()
    const componentReady = Promise.withResolvers()
    router.addRoute({
      path: workspace.path,
      name: workspace.name,
      meta: workspace.meta,
      component: () => {
        componentRequested.resolve()
        return componentReady.promise
      },
    })

    const navigation = router.push('/workspace')
    await componentRequested.promise
    await expireSession()
    componentReady.resolve({ render: () => null })
    await navigation

    expect(router.currentRoute.value.path).toBe('/login')
    expect(sessionStorage.getItem(sessionKey)).toBeNull()
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
  },
)

it('asks for an explicit retry when session verification is temporarily unavailable', async () => {
  rememberSession()
  fetchMock.mockRejectedValueOnce(new TypeError('Offline')).mockResolvedValueOnce(profileResponse())

  await router.push('/workspace')

  expect(router.currentRoute.value.name).toBe('login')
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])

  const auth = useAuthStore()
  await auth.initialize()
  await router.replace({ name: 'workspace' })

  expect(router.currentRoute.value.name).toBe('workspace')
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me', '/api/me'])
})

it('clears a rejected saved session and redirects to login', async () => {
  rememberSession()
  fetchMock.mockResolvedValueOnce(Response.json({ success: false }, { status: 401 }))

  await router.push('/workspace')

  expect(router.currentRoute.value.name).toBe('login')
  expect(sessionStorage.getItem(sessionKey)).toBeNull()
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
})

it('opens the public connection check without restoring a session', async () => {
  rememberSession()

  await router.push('/')

  expect(router.currentRoute.value.name).toBe('connection-check')
  expect(fetchMock).not.toHaveBeenCalled()
})
