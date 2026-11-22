import { createRouter, createWebHistory } from 'vue-router'
import { AUTH_STATUS } from '../constants/auth'
import { useAuthStore } from '../stores/auth'
import { loginLocation, signedInLocation } from './authRedirect'

export function createAppRouter(history = createWebHistory(import.meta.env.BASE_URL)) {
  const router = createRouter({
    history,
    routes: [
      {
        path: '/',
        redirect: { name: 'workspace' },
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
    if (guestOnly && auth.isAuthenticated)
      return { ...signedInLocation(router, to.query.redirect), replace: true }
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
