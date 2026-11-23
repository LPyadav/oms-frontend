<script setup>
import { computed, ref, useTemplateRef, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useDisplay } from 'vuetify'
import { VAppBar } from 'vuetify/components/VAppBar'
import { VAvatar } from 'vuetify/components/VAvatar'
import { VBtn } from 'vuetify/components/VBtn'
import { VIcon } from 'vuetify/components/VIcon'
import { VLayout } from 'vuetify/components/VLayout'
import { VList, VListGroup, VListItem } from 'vuetify/components/VList'
import { VMain } from 'vuetify/components/VMain'
import { VNavigationDrawer } from 'vuetify/components/VNavigationDrawer'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import AccountMenu from '../components/auth/AccountMenu.vue'
import NotificationBell from '../components/notifications/NotificationBell.vue'
import { REPORT_TITLE } from '../constants/reports'
import { useAuthStore } from '../stores/auth'

const navigationIcons = {
  dashboard: ['M3.5 3.5h6v9h-6zM14.5 3.5h6v5h-6zM3.5 16.5h6v4h-6zM14.5 12.5h6v8h-6z'],
  orders: [
    'M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3',
    'M9 3h6v4H9zM8 12h8m-8 4h8',
  ],
  reports: ['M5 3h14v18l-3.5-2-3.5 2-3.5-2L5 21z', 'm9 15 6-6M9 9h.01M15 15h.01'],
  users: [
    'M12 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    'M3 19v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 4.2a3 3 0 0 1 0 5.6M21 19v-2a4 4 0 0 0-3.2-3.9',
  ],
  roles: ['M12 22C7 20 4 16 4 11V6l8-4 8 4v5c0 5-3 9-8 11Z', 'm9 12 2 2 4-4'],
  audit: ['M4 11a8 8 0 1 1 1.7 5.9M4 6v5h5', 'M12 7.5v5l3 1.5'],
  customers: [
    'M3 5h18v14H3z',
    'M10.5 9.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.5 16v-.5a3 3 0 0 1 6 0v.5M14 9h4m-4 4h4',
  ],
  products: [
    'M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Z',
    'M3.5 7.5 12 12l8.5-4.5M12 12v9M7.8 5.3l8.5 4.5v3',
  ],
  workspace: ['M3.5 10 12 3l8.5 7M5.5 8.5V21h4v-6h5v6h4V8.5'],
}

const auth = useAuthStore()
const route = useRoute()
const { mdAndUp } = useDisplay()
const mobileNavigationOpen = ref(false)
const openNavigationGroups = ref([])
const menuButton = useTemplateRef('menuButton')
const closeButton = useTemplateRef('closeButton')
const contentScroll = useTemplateRef('contentScroll')
const sectionTitle = computed(() => route.meta.sectionTitle)

const drawerOpen = computed({
  get: () => mdAndUp.value || mobileNavigationOpen.value,
  set: (open) => {
    if (!mdAndUp.value) mobileNavigationOpen.value = open
  },
})

watch(mdAndUp, (desktop) => {
  if (desktop) mobileNavigationOpen.value = false
})

watch(
  mobileNavigationOpen,
  (open) => {
    if (mdAndUp.value) return

    const button = open ? closeButton.value : menuButton.value
    button?.$el.focus()
  },
  { flush: 'post' },
)

watch(
  () => route.path,
  () => {
    if (contentScroll.value) contentScroll.value.scrollTop = 0
  },
  { flush: 'post' },
)

watch(
  () => route.path,
  () => {
    const group = route.meta.navigationGroup
    if (group && !openNavigationGroups.value.includes(group)) {
      openNavigationGroups.value = [...openNavigationGroups.value, group]
    }
  },
  { immediate: true },
)

function focusMain() {
  contentScroll.value?.focus({ preventScroll: true })
}
</script>

<template>
  <VLayout v-if="auth.isAuthenticated" class="admin-layout">
    <a class="skip-link" href="#admin-content" @click.prevent="focusMain">Skip to content</a>

    <VNavigationDrawer
      id="admin-navigation"
      v-model="drawerOpen"
      aria-label="Workspace navigation"
      class="admin-drawer"
      :mobile="!mdAndUp"
      :permanent="mdAndUp"
      :temporary="!mdAndUp"
      :retain-focus="!mdAndUp"
      disable-resize-watcher
      color="admin-navigation"
      width="232"
      @keydown.esc="mobileNavigationOpen = false"
    >
      <template #prepend>
        <div class="admin-brand">
          <VAvatar color="primary" size="40" rounded="lg" aria-hidden="true">
            <span class="brand-mark"></span>
          </VAvatar>
          <div>
            <strong>OMS</strong>
            <span class="admin-brand-caption">Order management</span>
          </div>
          <VBtn
            v-if="!mdAndUp"
            ref="closeButton"
            class="ms-auto"
            variant="text"
            :icon="aliases.close"
            aria-label="Close workspace menu"
            @click="mobileNavigationOpen = false"
          />
        </div>
      </template>

      <VList v-model:opened="openNavigationGroups" open-strategy="multiple" nav class="admin-links">
        <VListItem
          v-if="auth.canViewDashboard"
          :to="{ name: 'dashboard' }"
          :prepend-icon="navigationIcons.dashboard"
          title="Dashboard"
          rounded="lg"
          @click="mobileNavigationOpen = false"
        />
        <VListItem
          v-if="auth.canViewOrders"
          :to="{ name: 'orders' }"
          :active="route.meta.requiresOrderView === true"
          :prepend-icon="navigationIcons.orders"
          title="Orders"
          rounded="lg"
          @click="mobileNavigationOpen = false"
        />
        <VListGroup
          v-if="auth.canViewReports"
          value="reports"
          title="Reports"
          :prepend-icon="navigationIcons.reports"
          :expand-icon="aliases.expand"
          :collapse-icon="aliases.collapse"
        >
          <template #activator="{ props, isOpen }">
            <VListItem
              v-bind="props"
              :value="null"
              tag="button"
              type="button"
              role="button"
              :aria-expanded="isOpen"
              :active="!isOpen && route.meta.navigationGroup === 'reports'"
              :ripple="false"
              rounded="lg"
            />
          </template>
          <VListItem
            :to="{ name: 'report-orders' }"
            :title="REPORT_TITLE.ORDER_FULFILLMENT"
            rounded="lg"
            @click="mobileNavigationOpen = false"
          />
          <VListItem
            :to="{ name: 'report-sales-tax' }"
            :title="REPORT_TITLE.SALES_TAX"
            rounded="lg"
            @click="mobileNavigationOpen = false"
          />
        </VListGroup>
        <VListItem
          v-if="auth.canManageUsers"
          :to="{ name: 'admin-users' }"
          :prepend-icon="navigationIcons.users"
          title="Users"
          rounded="lg"
          @click="mobileNavigationOpen = false"
        />
        <VListItem
          v-if="auth.canManageRoles"
          :to="{ name: 'admin-roles' }"
          :prepend-icon="navigationIcons.roles"
          title="Roles &amp; permissions"
          rounded="lg"
          @click="mobileNavigationOpen = false"
        />
        <VListGroup
          v-if="auth.canViewAccessAudit"
          value="audit"
          title="Audit"
          :prepend-icon="navigationIcons.audit"
          :expand-icon="aliases.expand"
          :collapse-icon="aliases.collapse"
        >
          <template #activator="{ props, isOpen }">
            <VListItem
              v-bind="props"
              :value="null"
              tag="button"
              type="button"
              role="button"
              :aria-expanded="isOpen"
              :active="!isOpen && route.meta.navigationGroup === 'audit'"
              :ripple="false"
              rounded="lg"
            />
          </template>
          <VListItem
            :to="{ name: 'admin-access-audit' }"
            title="Access audit"
            rounded="lg"
            @click="mobileNavigationOpen = false"
          />
          <VListItem
            :to="{ name: 'admin-operational-audit' }"
            title="Operational audit"
            rounded="lg"
            @click="mobileNavigationOpen = false"
          />
        </VListGroup>
        <VListItem
          v-if="auth.canViewCustomers"
          :to="{ name: 'catalog-customers' }"
          :prepend-icon="navigationIcons.customers"
          title="Customers"
          rounded="lg"
          @click="mobileNavigationOpen = false"
        />
        <VListItem
          v-if="auth.canViewProducts"
          :to="{ name: 'catalog-products' }"
          :prepend-icon="navigationIcons.products"
          title="Products"
          rounded="lg"
          @click="mobileNavigationOpen = false"
        />
      </VList>

      <template #append>
        <VList nav class="admin-links admin-footer-links">
          <VListItem
            :to="{ name: 'workspace' }"
            :prepend-icon="navigationIcons.workspace"
            title="Workspace"
            rounded="lg"
          />
        </VList>
      </template>
    </VNavigationDrawer>

    <VAppBar tag="header" height="68" color="surface" :elevation="0" class="admin-bar">
      <div class="admin-frame admin-bar-content">
        <div class="admin-location">
          <VBtn
            v-if="!mdAndUp"
            ref="menuButton"
            :icon="aliases.menu"
            variant="text"
            aria-label="Open workspace menu"
            aria-controls="admin-navigation"
            :aria-expanded="mobileNavigationOpen"
            @click="mobileNavigationOpen = true"
          />
          <span class="admin-location-parent">{{ sectionTitle }}</span>
          <VIcon
            class="admin-location-parent"
            :icon="aliases.next"
            size="small"
            aria-hidden="true"
          />
          <strong>{{ route.meta.pageTitle }}</strong>
        </div>

        <div class="admin-header-actions">
          <NotificationBell v-if="auth.canViewOrders" />
          <AccountMenu />
        </div>
      </div>
    </VAppBar>

    <VMain class="admin-content" :inert="mobileNavigationOpen">
      <div
        id="admin-content"
        ref="contentScroll"
        class="admin-scroll-region"
        role="region"
        :aria-label="sectionTitle + ' content'"
        tabindex="0"
      >
        <div class="admin-frame">
          <RouterView />
        </div>
      </div>
    </VMain>
  </VLayout>
</template>

<style scoped>
.admin-layout {
  flex: 1 1 0;
  min-block-size: 0;
  --admin-frame-width: 1184px;
  --admin-frame-gutter: clamp(16px, 2.8vw, 32px);
  background: rgb(var(--v-theme-background));
}

.admin-frame {
  width: min(100%, var(--admin-frame-width));
  margin-inline: auto;
  padding-inline: var(--admin-frame-gutter);
}

.skip-link {
  position: absolute;
  z-index: 2000;
  inset: 8px auto auto 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-primary));
  transform: translateY(-150%);
}

.skip-link:focus {
  transform: none;
}

.admin-drawer {
  background-image: linear-gradient(165deg, rgba(var(--v-theme-primary), 0.1), transparent 58%);
}

.admin-drawer :deep(.v-navigation-drawer__content) {
  overscroll-behavior-y: contain;
  scroll-padding-block: 12px;
  scrollbar-color: rgba(var(--v-theme-on-admin-navigation), 0.45) transparent;
  scrollbar-gutter: stable;
}

@media (prefers-reduced-motion: no-preference) {
  .admin-drawer :deep(.v-navigation-drawer__content) {
    scroll-behavior: smooth;
  }
}

.admin-brand {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 20px 14px 20px 20px;
  border-block-end: 1px solid rgba(var(--v-theme-on-admin-navigation), 0.12);
}

.admin-brand strong {
  display: block;
  font-size: 1.125rem;
  line-height: 1.2;
}

.admin-brand-caption {
  display: block;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-admin-navigation), 0.78);
}

.brand-mark {
  color: rgb(var(--v-theme-on-primary));
  width: 4px;
  height: 13px;
  border-radius: 2px;
  background: currentColor;
  box-shadow:
    -5px 2px 0 currentColor,
    5px -2px 0 currentColor;
  transform: rotate(27deg);
}

.admin-links {
  padding: 12px 14px;
  background: transparent;
  color: inherit;
}

.admin-footer-links {
  border-block-start: 1px solid rgba(var(--v-theme-on-admin-navigation), 0.12);
}

.admin-links :deep(.v-list-item) {
  min-height: 44px;
}

.admin-links :deep(.v-list-item__title) {
  font-size: 0.875rem;
  font-weight: 500;
}

.admin-links :deep(.v-list-item:focus-visible) {
  outline: 2px solid rgb(var(--v-theme-on-admin-navigation));
  outline-offset: -2px;
}

.admin-links :deep(.v-list-group__header) {
  width: 100%;
  text-align: start;
}

.admin-links :deep(.v-list-group__header .v-list-item__append > .v-icon) {
  font-size: 18px;
}

.admin-links :deep(.v-list-group__items) {
  margin-inline-start: 17px;
  padding-inline-start: 8px;
  border-inline-start: 1px solid rgba(var(--v-theme-on-admin-navigation), 0.24);
}

.admin-links :deep(.v-list-group__items .v-list-item) {
  padding-inline: 12px;
}

.admin-links :deep(.v-list-item__prepend) {
  padding-inline-end: 10px;
}

.admin-links :deep(.v-list-item__spacer) {
  display: none;
}

.admin-links :deep(.v-list-item__prepend > .v-icon) {
  width: 18px;
  height: 18px;
  font-size: 18px;
  opacity: 0.85;
}

.admin-links :deep(.v-list-item__prepend .v-icon__svg) {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.admin-links :deep(.v-list-item--active) {
  --v-activated-opacity: 0;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.15);
  box-shadow: inset 0 0 0 1px rgba(var(--v-theme-primary), 0.25);
}

.admin-links :deep(.v-list-item--active .v-list-item__title) {
  font-weight: 600;
}

.admin-bar {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.admin-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 100%;
}

.admin-header-actions {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: clamp(4px, 2vw, 12px);
}

.admin-location {
  display: flex;
  min-width: 0;
  gap: 8px;
  align-items: center;
  font-size: 0.875rem;
}

.admin-location-parent {
  color: rgba(var(--v-theme-on-surface), 0.74);
}

.admin-content {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
  min-block-size: 0;
}

.admin-scroll-region {
  flex: 1 1 0;
  min-block-size: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-gutter: stable;
}

.admin-scroll-region:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

@media (max-width: 440px) {
  .admin-location-parent {
    display: none;
  }
}
</style>
