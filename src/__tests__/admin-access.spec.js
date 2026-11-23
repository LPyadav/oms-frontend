import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '../router'

vi.mock('../layouts/AdminLayout.vue', () => ({ default: {} }))
vi.mock('../views/auth/LoginView.vue', () => ({ default: {} }))
vi.mock('../views/AccessDeniedView.vue', () => ({ default: {} }))
vi.mock('../views/DashboardView.vue', () => ({ default: {} }))
vi.mock('../views/admin/UserDirectoryView.vue', () => ({ default: {} }))
vi.mock('../views/admin/RolePermissionsView.vue', () => ({ default: {} }))
vi.mock('../views/admin/AccessAuditView.vue', () => ({ default: {} }))
vi.mock('../views/customers/CustomerDirectoryView.vue', () => ({ default: {} }))
vi.mock('../views/products/ProductDirectoryView.vue', () => ({ default: {} }))
vi.mock('../views/orders/OrderDirectoryView.vue', () => ({ default: {} }))
vi.mock('../views/orders/OrderDetailView.vue', () => ({ default: {} }))
vi.mock('../views/orders/CreateOrderView.vue', () => ({ default: {} }))
vi.mock('../views/orders/EditOrderView.vue', () => ({ default: {} }))
vi.mock('../views/notifications/NotificationsView.vue', () => ({ default: {} }))

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

it.each([
  { roles: ['admin'], permissions: ['audit.view'], destination: 'admin-access-audit' },
  { roles: ['admin'], permissions: ['users.manage'], destination: 'access-denied' },
  { roles: ['Admin'], permissions: ['audit.view'], destination: 'access-denied' },
  { roles: ['manager'], permissions: ['audit.view'], destination: 'access-denied' },
])(
  'checks the independent access audit grant for $roles',
  async ({ roles, permissions, destination }) => {
    rememberAccount(roles, permissions)

    await router.push('/admin/access-audit')

    expect(router.currentRoute.value.name).toBe(destination)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
  },
)

it('preserves the dashboard destination for a signed-out visitor', async () => {
  await router.push('/dashboard')

  expect(router.currentRoute.value.name).toBe('login')
  expect(router.currentRoute.value.query.redirect).toBe('/dashboard')
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each([
  {
    roles: ['admin'],
    permissions: ['dashboard.view', 'orders.view.any'],
    destination: 'dashboard',
  },
  {
    roles: ['manager'],
    permissions: ['dashboard.view', 'orders.view.any'],
    destination: 'dashboard',
  },
  {
    roles: ['staff'],
    permissions: ['dashboard.view', 'orders.view.assigned'],
    destination: 'access-denied',
  },
  { roles: ['manager'], permissions: ['orders.view.any'], destination: 'access-denied' },
  { roles: ['admin'], permissions: ['dashboard.view'], destination: 'access-denied' },
])(
  'checks Dashboard permissions for $roles with $permissions',
  async ({ roles, permissions, destination }) => {
    rememberAccount(roles, permissions)

    await router.push('/dashboard')

    expect(router.currentRoute.value.name).toBe(destination)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
  },
)

it('sends a signed-out visitor from the customer directory to login', async () => {
  await router.push('/catalog/customers')

  expect(router.currentRoute.value.name).toBe('login')
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each([
  { roles: ['admin'], permissions: ['customers.view'], destination: 'catalog-customers' },
  { roles: ['manager'], permissions: ['customers.view'], destination: 'catalog-customers' },
  { roles: ['catalog-reader'], permissions: ['customers.view'], destination: 'catalog-customers' },
  {
    roles: ['staff'],
    permissions: ['customers.view.assigned-orders'],
    destination: 'access-denied',
  },
  { roles: ['admin'], permissions: ['users.manage', 'roles.manage'], destination: 'access-denied' },
])(
  'checks customer directory access for $roles with $permissions',
  async ({ roles, permissions, destination }) => {
    rememberAccount(roles, permissions)

    await router.push('/catalog/customers')

    expect(router.currentRoute.value.name).toBe(destination)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
  },
)

it('sends a signed-out visitor from the product directory to login', async () => {
  await router.push('/catalog/products')

  expect(router.currentRoute.value.name).toBe('login')
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each([
  { roles: ['admin'], permissions: ['products.view'], destination: 'catalog-products' },
  { roles: ['manager'], permissions: ['products.view'], destination: 'catalog-products' },
  { roles: ['staff'], permissions: ['products.view'], destination: 'catalog-products' },
  {
    roles: ['staff'],
    permissions: ['customers.view.assigned-orders'],
    destination: 'access-denied',
  },
  { roles: ['admin'], permissions: ['products.manage'], destination: 'access-denied' },
  { roles: ['manager'], permissions: ['customers.view'], destination: 'access-denied' },
])(
  'checks product directory access for $roles with $permissions',
  async ({ roles, permissions, destination }) => {
    rememberAccount(roles, permissions)

    await router.push('/catalog/products')

    expect(router.currentRoute.value.name).toBe(destination)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
  },
)

it.each([
  { permissions: ['products.view'], destination: 'catalog-products' },
  { permissions: ['customers.view', 'products.view'], destination: 'catalog-customers' },
  { permissions: [], destination: 'access-denied' },
])('routes the catalog landing page for $permissions', async ({ permissions, destination }) => {
  rememberAccount(['staff'], permissions)

  await router.push('/catalog')

  expect(router.currentRoute.value.name).toBe(destination)
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
})

it('redirects a guest from Orders before making a list request', async () => {
  await router.push('/orders')

  expect(router.currentRoute.value.name).toBe('login')
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each([
  { roles: ['admin'], permissions: ['orders.view.any'], destination: 'orders' },
  { roles: ['manager'], permissions: ['orders.view.any'], destination: 'orders' },
  { roles: ['staff'], permissions: ['orders.view.assigned'], destination: 'orders' },
  {
    roles: ['staff'],
    permissions: ['orders.status.update.assigned'],
    destination: 'access-denied',
  },
  { roles: ['admin'], permissions: ['orders.create'], destination: 'access-denied' },
])('gates the order directory on $permissions', async ({ roles, permissions, destination }) => {
  rememberAccount(roles, permissions)

  await router.push('/orders')

  expect(router.currentRoute.value.name).toBe(destination)
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
})

it('redirects a guest from a direct order detail link', async () => {
  await router.push('/orders/42')

  expect(router.currentRoute.value.name).toBe('login')
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each([
  { permissions: ['orders.view.any'], destination: 'order-detail' },
  { permissions: ['orders.view.assigned'], destination: 'order-detail' },
  { permissions: ['orders.status.update.assigned'], destination: 'access-denied' },
])('gates a direct order detail link on $permissions', async ({ permissions, destination }) => {
  rememberAccount(['staff'], permissions)

  await router.push('/orders/42')

  expect(router.currentRoute.value.name).toBe(destination)
  const expectedOrderId = destination === 'order-detail' ? '42' : undefined
  expect(router.currentRoute.value.params.orderId).toBe(expectedOrderId)
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
})

it.each([
  { permissions: ['orders.view.any', 'orders.create'], destination: 'order-create' },
  { permissions: ['orders.view.any'], destination: 'access-denied' },
  { permissions: ['orders.view.assigned', 'orders.create'], destination: 'access-denied' },
])(
  'gates the create route on both required grants for $permissions',
  async ({ permissions, destination }) => {
    rememberAccount(['manager'], permissions)

    await router.push('/orders/new')

    expect(router.currentRoute.value.name).toBe(destination)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
  },
)

it.each([
  { permissions: ['orders.view.any', 'orders.update'], destination: 'order-edit' },
  { permissions: ['orders.view.any', 'orders.create'], destination: 'access-denied' },
  { permissions: ['orders.view.assigned', 'orders.update'], destination: 'access-denied' },
])(
  'gates the edit route on both required grants for $permissions',
  async ({ permissions, destination }) => {
    rememberAccount(['manager'], permissions)

    await router.push('/orders/42/edit')

    expect(router.currentRoute.value.name).toBe(destination)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
  },
)

it('sends signed-out notification visitors to login with their intended route', async () => {
  await router.push('/notifications')
  expect(router.currentRoute.value.name).toBe('login')
  expect(router.currentRoute.value.query.redirect).toBe('/notifications')
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each(['orders.view.any', 'orders.view.assigned'])(
  'opens the inbox for an account with %s',
  async (permission) => {
    rememberAccount(['staff'], [permission])
    await router.push('/notifications')
    expect(router.currentRoute.value.name).toBe('notifications')
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
  },
)

it('denies inbox access to accounts without order-view permission', async () => {
  rememberAccount(['staff'], [])
  await router.push('/notifications')
  expect(router.currentRoute.value.name).toBe('access-denied')
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
})
