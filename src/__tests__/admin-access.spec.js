import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '../router'

vi.mock('../layouts/AdminLayout.vue', () => ({ default: {} }))
vi.mock('../views/auth/LoginView.vue', () => ({ default: {} }))
vi.mock('../views/AccessDeniedView.vue', () => ({ default: {} }))
vi.mock('../views/admin/UserDirectoryView.vue', () => ({ default: {} }))
vi.mock('../views/admin/RolePermissionsView.vue', () => ({ default: {} }))

const user = { id: 1, name: 'Alex Morgan', email: 'alex@example.test' }
let pinia
let router
let fetchMock

function rememberAccount(roles, permissions) {
  sessionStorage.setItem(
    'oms.session',
    JSON.stringify({ token: 'test-token', expiresAt: Date.now() + 60_000 }),
  )
  fetchMock.mockResolvedValueOnce(
    Response.json({ success: true, data: { user: { ...user, roles, permissions } } }),
  )
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
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

it('sends a signed-out visitor to login', async () => {
  await router.push('/admin/users')

  expect(router.currentRoute.value.name).toBe('login')
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each([
  { roles: ['manager'], permissions: ['users.manage'] },
  { roles: ['staff'], permissions: [] },
  { roles: ['admin'], permissions: [] },
])('denies directory access when grants are %j', async ({ roles, permissions }) => {
  rememberAccount(roles, permissions)

  await router.push('/admin/users')

  expect(router.currentRoute.value.name).toBe('access-denied')
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
})

it.each(['/admin', '/admin/users'])(
  'opens %s in the shared Admin layout for an authorized user',
  async (path) => {
    rememberAccount(['admin'], ['users.manage'])

    await router.push(path)

    expect(router.currentRoute.value.name).toBe('admin-users')
    expect(router.currentRoute.value.matched.map((record) => record.path)).toEqual([
      '/admin',
      '/admin/users',
    ])
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
  },
)

it.each([
  { roles: ['admin'], permissions: ['roles.manage'], destination: 'admin-roles' },
  { roles: ['admin'], permissions: ['users.manage'], destination: 'access-denied' },
  { roles: ['manager'], permissions: ['roles.manage'], destination: 'access-denied' },
])(
  'checks the independent role-management grant for $roles with $permissions',
  async ({ roles, permissions, destination }) => {
    rememberAccount(roles, permissions)

    await router.push('/admin/roles')

    expect(router.currentRoute.value.name).toBe(destination)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
  },
)
