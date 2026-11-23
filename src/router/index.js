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
        path: '/forgot-password',
        name: 'forgot-password',
        component: () => import('../views/auth/PasswordRecoveryView.vue'),
      },
      {
        path: '/reset-password',
        name: 'reset-password',
        component: () => import('../views/auth/PasswordRecoveryView.vue'),
        props: { reset: true },
      },
      {
        path: '/dashboard',
        component: workspaceLayout,
        meta: { requiresAuth: true, sectionTitle: 'Analytics', requiresDashboardView: true },
        children: [
          {
            path: '',
            name: 'dashboard',
            component: () => import('../views/DashboardView.vue'),
            meta: { pageTitle: 'Dashboard' },
          },
        ],
      },
      {
        path: '/reports',
        component: workspaceLayout,
        redirect: { name: 'report-orders' },
        meta: { requiresAuth: true, sectionTitle: 'Reports', requiresReportsView: true },
        children: [
          {
            path: 'orders',
            name: 'report-orders',
            component: () => import('../views/reports/OrderFulfillmentReportView.vue'),
            meta: { pageTitle: 'Order status report', navigationGroup: 'orders' },
          },
          {
            path: 'sales-tax',
            name: 'report-sales-tax',
            component: () => import('../views/reports/SalesTaxReportView.vue'),
            meta: { pageTitle: 'Sales & Tax' },
          },
        ],
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
          {
            path: 'access-audit',
            name: 'admin-access-audit',
            component: () => import('../views/admin/AccessAuditView.vue'),
            meta: {
              pageTitle: 'Access audit',
              requiresAccessAudit: true,
              navigationGroup: 'audit',
            },
          },
          {
            path: 'audit',
            name: 'admin-operational-audit',
            component: () => import('../views/admin/OperationalAuditView.vue'),
            meta: {
              pageTitle: 'Operational audit',
              requiresAccessAudit: true,
              navigationGroup: 'audit',
            },
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
        path: '/orders',
        component: workspaceLayout,
        meta: {
          requiresAuth: true,
          sectionTitle: 'Order management',
          requiresOrderView: true,
          navigationGroup: 'orders',
        },
        children: [
          {
            path: '',
            component: () => import('../views/orders/OrdersOutlet.vue'),
            children: [
              {
                path: '',
                name: 'orders',
                component: () => import('../views/orders/OrderDirectoryView.vue'),
                meta: { pageTitle: 'Orders' },
              },
              {
                path: 'new',
                name: 'order-create',
                component: () => import('../views/orders/CreateOrderView.vue'),
                meta: { pageTitle: 'Create order', requiresOrderCreate: true },
              },
              {
                path: ':orderId/edit',
                name: 'order-edit',
                component: () => import('../views/orders/EditOrderView.vue'),
                props: true,
                meta: { pageTitle: 'Edit order', requiresOrderEdit: true },
              },
              {
                path: ':orderId',
                name: 'order-detail',
                component: () => import('../views/orders/OrderDetailView.vue'),
                props: true,
                meta: { pageTitle: 'Order detail' },
              },
            ],
          },
        ],
      },
      {
        path: '/notifications',
        component: workspaceLayout,
        meta: { requiresAuth: true, sectionTitle: 'Order management', requiresOrderView: true },
        children: [
          {
            path: '',
            name: 'notifications',
            component: () => import('../views/notifications/NotificationsView.vue'),
            meta: { pageTitle: 'Notifications' },
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
        path: '/account',
        component: workspaceLayout,
        meta: { requiresAuth: true, sectionTitle: 'Account' },
        children: [
          {
            path: 'password',
            name: 'account-password',
            component: () => import('../views/auth/ChangePasswordView.vue'),
            meta: { pageTitle: 'Change password' },
          },
        ],
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
      (to.meta.requiresAccessAudit && !auth.canViewAccessAudit) ||
      (to.meta.requiresCustomerView && !auth.canViewCustomers) ||
      (to.meta.requiresProductView && !auth.canViewProducts) ||
      (to.meta.requiresDashboardView && !auth.canViewDashboard) ||
      (to.meta.requiresReportsView && !auth.canViewReports) ||
      (to.meta.requiresOrderView && !auth.canViewOrders) ||
      (to.meta.requiresOrderCreate && !auth.canCreateOrders) ||
      (to.meta.requiresOrderEdit && !auth.canEditOrders)
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
