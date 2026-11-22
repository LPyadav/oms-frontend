import { createRouter, createWebHistory } from 'vue-router'
import { AUTH_STATUS } from '../constants/auth'
import { useAuthStore } from '../stores/auth'
import { loginLocation, signedInLocation } from './authRedirect'

const workspaceLayout = () => import('../layouts/AdminLayout.vue')

export function createAppRouter(history = createWebHistory(import.meta.env.BASE_URL)) {
  const router = createRouter({
    history,
    routes: [
      {
        path: '/',
        redirect: { name: 'login' },
      },
      {
        path: '/dev/health',
        name: 'connection-check',
        component: () => import('../views/ConnectionCheckView.vue'),
      },
      {
        path: '/login',
        name: 'login',
        component: () => import('../views/auth/LoginView.vue'),
        meta: { guestOnly: true },
      },
      {
        path: '/admin',
        component: workspaceLayout,
        redirect: { name: 'admin-users' },
        meta: { requiresAuth: true, sectionTitle: 'Administration' },
        children: [
          {
            path: 'users',
            name: 'admin-users',
            component: () => import('../views/admin/UserDirectoryView.vue'),
            meta: { pageTitle: 'Users', requiresUserManagement: true },
          },
          {
            path: 'roles',
            name: 'admin-roles',
            component: () => import('../views/admin/RolePermissionsView.vue'),
            meta: { pageTitle: 'Roles & permissions', requiresRoleManagement: true },
          },
        ],
      },
      {
        path: '/catalog',
        name: 'catalog-home',
        component: workspaceLayout,
        meta: { requiresAuth: true, sectionTitle: 'Catalog' },
        children: [
          {
            path: 'customers',
            name: 'catalog-customers',
            component: () => import('../views/customers/CustomerDirectoryView.vue'),
            meta: { pageTitle: 'Customers', requiresCustomerView: true },
          },
          {
            path: 'products',
            name: 'catalog-products',
            component: () => import('../views/products/ProductDirectoryView.vue'),
            meta: { pageTitle: 'Products', requiresProductView: true },
          },
        ],
      },
      {
        path: '/access-denied',
        name: 'access-denied',
        component: () => import('../views/AccessDeniedView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: '/workspace',
        name: 'workspace',
        component: () => import('../views/WorkspaceView.vue'),
        meta: { requiresAuth: true },
      },
    ],
  })

  router.beforeEach(async (to) => {
    const { guestOnly, requiresAuth } = to.meta
    if (!guestOnly && !requiresAuth) return

    const auth = useAuthStore()
    if (auth.status !== AUTH_STATUS.UNAVAILABLE) await auth.initialize()

    if (requiresAuth && !auth.isAuthenticated) return loginLocation(to)

    if (to.name === 'catalog-home') {
      if (auth.canViewCustomers) return { name: 'catalog-customers', replace: true }
      if (auth.canViewProducts) return { name: 'catalog-products', replace: true }
      return { name: 'access-denied', replace: true }
    }
    if (
      (to.meta.requiresUserManagement && !auth.canManageUsers) ||
      (to.meta.requiresRoleManagement && !auth.canManageRoles) ||
      (to.meta.requiresCustomerView && !auth.canViewCustomers) ||
      (to.meta.requiresProductView && !auth.canViewProducts)
    ) {
      return { name: 'access-denied', replace: true }
    }
    if (guestOnly && auth.isAuthenticated) {
      return { ...signedInLocation(router, to.query.redirect, auth.canManageUsers), replace: true }
    }
  })

  router.beforeResolve(async (to) => {
    if (!to.meta.requiresAuth) return

    const auth = useAuthStore()
    if (auth.isAuthenticated) await auth.initialize()
    if (!auth.isAuthenticated) return loginLocation(to)
  })

  return router
}

export default createAppRouter()
