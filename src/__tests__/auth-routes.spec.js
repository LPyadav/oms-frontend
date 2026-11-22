import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createMemoryHistory } from 'vue-router'
import App from '../App.vue'
import { createAppRouter } from '../router'
import { useAuthStore } from '../stores/auth'

vi.mock('vuetify/components/VApp', () => ({
  VApp: {
    setup(_props, { slots }) {
      return () => slots.default?.()
    },
  },
}))
vi.mock('../views/ConnectionCheckView.vue', () => ({ default: { render: () => null } }))
vi.mock('../views/auth/LoginView.vue', () => ({ default: { render: () => null } }))
vi.mock('../views/WorkspaceView.vue', () => ({ default: { render: () => null } }))

const sessionKey = 'oms.session'
const user = { id: 1, name: 'Review User', email: 'review@example.test' }
let pinia
let router
let fetchMock
let app

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
  app?.unmount()
  app = undefined
  disposePinia(pinia)
  vi.useRealTimers()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

it.each(['/', '/workspace?view=open#details'])(
  'redirects a guest opening %s to login',
  async (path) => {
    await router.push(path)

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe(path === '/' ? '/workspace' : path)
    expect(fetchMock).not.toHaveBeenCalled()
  },
)

it.each(['/', '/workspace', '/login'])(
  'restores a verified session before opening %s',
  async (path) => {
    rememberSession()
    fetchMock.mockResolvedValueOnce(profileResponse())

    await router.push(path)

    expect(router.currentRoute.value.name).toBe('workspace')
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
  },
)

it.each([
  ['the timer runs', () => vi.advanceTimersByTimeAsync(60_000)],
  ['the timer is delayed', () => vi.setSystemTime(Date.now() + 60_000)],
])(
  'redirects to login when the session expires during workspace loading and %s',
  async (_, expireSession) => {
    vi.useFakeTimers()
    await router.push('/dev/health')
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

    const intended = '/workspace?view=open#details'
    const navigation = router.push(intended)
    await componentRequested.promise
    await expireSession()
    componentReady.resolve({ render: () => null })
    await navigation

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe(intended)
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

  await router.push('/dev/health')

  expect(router.currentRoute.value.name).toBe('connection-check')
  expect(fetchMock).not.toHaveBeenCalled()
})

it('uses a valid protected destination when a verified session opens login', async () => {
  const intended = '/workspace?view=open#details'
  rememberSession()
  fetchMock.mockResolvedValueOnce(profileResponse())

  await router.push({ name: 'login', query: { redirect: intended } })

  expect(router.currentRoute.value.fullPath).toBe(intended)
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
})

it('runs the destination guard after resolving the return path', async () => {
  const requireAccess = vi.fn(() => ({ name: 'workspace' }))
  router.addRoute({
    path: '/restricted/:section',
    name: 'restricted',
    meta: { requiresAuth: true },
    component: { render: () => null },
    beforeEnter: requireAccess,
  })
  rememberSession()
  fetchMock.mockResolvedValueOnce(profileResponse())

  await router.push({ name: 'login', query: { redirect: '/restricted/admin#panel' } })

  expect(requireAccess).toHaveBeenCalledOnce()
  expect(router.currentRoute.value.fullPath).toBe('/workspace')
})

it.each([
  ['external URL', 'https://outside.example.test/workspace'],
  ['protocol-relative URL', '//outside.example.test/workspace'],
  ['backslash URL', '/\\outside.example.test/workspace'],
  ['encoded slash', '/%2Foutside.example.test/workspace'],
  ['encoded backslash', '/%5Coutside.example.test/workspace'],
  ['control character', '/workspace%00'],
  ['malformed encoding', '/workspace%XX'],
  ['login route', '/login'],
  ['public diagnostic', '/dev/health'],
  ['redirect-only root', '/'],
  ['duplicate query values', ['/workspace?view=one', '/workspace?view=two']],
  ['empty query', null],
])('falls back to the workspace for an invalid %s', async (_, redirect) => {
  rememberSession()
  fetchMock.mockResolvedValueOnce(profileResponse())

  await router.push({ name: 'login', query: { redirect } })

  expect(router.currentRoute.value.fullPath).toBe('/workspace')
})

it.each(['expiry', 'unauthorized response', 'explicit sign-out'])(
  'handles %s while a protected page is mounted',
  async (cause) => {
    if (cause === 'expiry') vi.useFakeTimers()
    rememberSession()
    fetchMock.mockResolvedValueOnce(profileResponse())
    const intended = '/workspace?view=open#details'
    await router.push(intended)
    app = createApp(App).use(pinia).use(router)
    app.mount(document.createElement('div'))
    const auth = useAuthStore()
    let requestFailure

    if (cause === 'expiry') {
      await vi.advanceTimersByTimeAsync(60_000)
    } else if (cause === 'unauthorized response') {
      fetchMock.mockResolvedValueOnce(Response.json({ success: false }, { status: 401 }))
      requestFailure = await auth.request('/api/me').catch((error) => error)
    } else {
      fetchMock.mockResolvedValueOnce(Response.json({ success: true, data: null }))
      await auth.logout()
    }

    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'))
    expect(router.currentRoute.value.query.redirect).toBe(
      cause === 'explicit sign-out' ? undefined : intended,
    )
    expect(requestFailure?.status).toBe(cause === 'unauthorized response' ? 401 : undefined)
    expect(sessionStorage.getItem(sessionKey)).toBeNull()
  },
)
