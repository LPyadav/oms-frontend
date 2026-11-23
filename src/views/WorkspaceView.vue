<script setup>
import { storeToRefs } from 'pinia'
import { onMounted, useTemplateRef } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import AccountMenu from '../components/auth/AccountMenu.vue'
import NotificationBell from '../components/notifications/NotificationBell.vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const {
  canManageUsers,
  canManageRoles,
  canViewAccessAudit,
  canViewDashboard,
  canViewReports,
  canViewCustomers,
  canViewProducts,
  canViewOrders,
  isAuthenticated,
  user,
} = storeToRefs(auth)
const heading = useTemplateRef('workspaceHeading')

onMounted(() => heading.value?.focus({ preventScroll: true }))
</script>

<template>
  <main v-if="isAuthenticated && user" class="workspace">
    <section class="workspace-panel" aria-labelledby="workspace-heading">
      <div class="workspace-panel-heading">
        <h1 id="workspace-heading" ref="workspaceHeading" tabindex="-1">OMS workspace</h1>
        <div class="workspace-header-actions">
          <NotificationBell v-if="canViewOrders" />
          <AccountMenu compact />
        </div>
      </div>
      <div class="workspace-account">
        <strong>{{ user.name }}</strong>
        <p>{{ user.email }}</p>
      </div>
      <VBtn
        v-if="canViewDashboard"
        :to="{ name: 'dashboard' }"
        class="text-none"
        color="primary"
        variant="outlined"
        height="48"
      >
        Open dashboard
      </VBtn>
      <VBtn
        v-if="canViewReports"
        :to="{ name: 'report-orders' }"
        class="text-none"
        color="primary"
        variant="outlined"
        height="48"
      >
        Reports
      </VBtn>
      <VBtn
        v-if="canManageUsers"
        :to="{ name: 'admin-users' }"
        class="text-none"
        color="primary"
        variant="flat"
        height="48"
      >
        Manage users
      </VBtn>
      <VBtn
        v-if="canManageRoles"
        :to="{ name: 'admin-roles' }"
        class="text-none"
        color="primary"
        variant="outlined"
        height="48"
      >
        Manage roles
      </VBtn>
      <VBtn
        v-if="canViewAccessAudit"
        :to="{ name: 'admin-access-audit' }"
        class="text-none"
        color="primary"
        variant="outlined"
        height="48"
      >
        View access audit
      </VBtn>
      <VBtn
        v-if="canViewAccessAudit"
        :to="{ name: 'admin-operational-audit' }"
        class="text-none"
        color="primary"
        variant="outlined"
        height="48"
      >
        View operational audit
      </VBtn>
      <VBtn
        v-if="canViewCustomers"
        :to="{ name: 'catalog-customers' }"
        class="text-none"
        color="primary"
        :variant="canManageUsers ? 'outlined' : 'flat'"
        height="48"
      >
        Browse customers
      </VBtn>
      <VBtn
        v-if="canViewProducts"
        :to="{ name: 'catalog-products' }"
        class="text-none"
        color="primary"
        :variant="canManageUsers || canViewCustomers ? 'outlined' : 'flat'"
        height="48"
      >
        Browse products
      </VBtn>
      <VBtn
        v-if="canViewOrders"
        :to="{ name: 'orders' }"
        class="text-none"
        color="primary"
        :variant="canManageUsers || canViewCustomers || canViewProducts ? 'outlined' : 'flat'"
        height="48"
      >
        Browse orders
      </VBtn>
    </section>
  </main>
</template>

<style scoped>
.workspace {
  display: grid;
  flex: 1 0 auto;
  place-items: center;
  padding: 24px;
}

.workspace-panel {
  display: grid;
  width: min(100%, 460px);
  gap: 20px;
  padding: clamp(22px, 5vw, 32px);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 20px;
  background: rgb(var(--v-theme-surface));
}

.workspace-panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.workspace-header-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
}

.workspace-panel h1 {
  font-size: clamp(1.625rem, 3vw, 2rem);
  font-weight: 700;
  line-height: 1.2;
}

.workspace-panel h1:focus {
  outline: none;
}

.workspace-account {
  overflow-wrap: anywhere;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.06);
}
</style>
