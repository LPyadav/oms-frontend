import { createRouter, createWebHistory } from 'vue-router'
import { AUTH_STATUS } from '../constants/auth'
import { useAuthStore } from '../stores/auth'
import { getSignedInRouteName } from './signedInRoute'

export function createAppRouter(history = createWebHistory(import.meta.env.BASE_URL)) {
  const router = createRouter({
    history,
    routes: [
      {
        path: '/',
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
        component: () => import('../layouts/AdminLayout.vue'),
        redirect: { name: 'admin-users' },
        meta: { requiresAuth: true },
        children: [
          {
            path: 'users',
            name: 'admin-users',
            component: () => import('../views/admin/UserDirectoryView.vue'),
            meta: { adminTitle: 'Users', requiresUserManagement: true },
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

    if (requiresAuth && !auth.isAuthenticated) return { name: 'login', replace: true }
    if (to.meta.requiresUserManagement && !auth.canManageUsers) {
      return { name: 'access-denied', replace: true }
    }
    if (guestOnly && auth.isAuthenticated) {
      return { name: getSignedInRouteName(auth.canManageUsers), replace: true }
    }
  })

  router.beforeResolve(async (to) => {
    if (!to.meta.requiresAuth) return

    const auth = useAuthStore()
    if (auth.isAuthenticated) await auth.initialize()
    if (!auth.isAuthenticated) return { name: 'login', replace: true }
  })

  return router
}

export default createAppRouter()
