<script setup>
import { computed, ref, useTemplateRef, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useDisplay } from 'vuetify'
import { VAppBar } from 'vuetify/components/VAppBar'
import { VAvatar } from 'vuetify/components/VAvatar'
import { VBtn } from 'vuetify/components/VBtn'
import { VIcon } from 'vuetify/components/VIcon'
import { VLayout } from 'vuetify/components/VLayout'
import { VList, VListItem } from 'vuetify/components/VList'
import { VMain } from 'vuetify/components/VMain'
import { VNavigationDrawer } from 'vuetify/components/VNavigationDrawer'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { useAuthStore } from '../stores/auth'
import { getAccountInitials } from '../utils/accountInitials'

const auth = useAuthStore()
const route = useRoute()
const { mdAndUp } = useDisplay()
const mobileNavigationOpen = ref(false)
const menuButton = useTemplateRef('menuButton')
const closeButton = useTemplateRef('closeButton')
const main = useTemplateRef('main')

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

function focusMain() {
  main.value?.$el.focus()
}
</script>

<template>
  <VLayout v-if="auth.isAuthenticated" class="admin-layout" height="100dvh">
    <a class="skip-link" href="#admin-content" @click.prevent="focusMain">Skip to content</a>

    <VNavigationDrawer
      id="admin-navigation"
      v-model="drawerOpen"
      aria-label="Administration"
      :mobile="!mdAndUp"
      :permanent="mdAndUp"
      :temporary="!mdAndUp"
      :retain-focus="!mdAndUp"
      disable-resize-watcher
      color="admin-navigation"
      width="212"
      @keydown.esc="mobileNavigationOpen = false"
    >
      <template #prepend>
        <div class="admin-brand">
          <VAvatar color="primary" size="40" rounded="lg" aria-hidden="true">
            <span class="brand-mark"></span>
          </VAvatar>
          <div>
            <strong>OMS</strong>
            <span>Administration</span>
          </div>
          <VBtn
            v-if="!mdAndUp"
            ref="closeButton"
            class="ms-auto"
            variant="text"
            :icon="aliases.close"
            aria-label="Close administration menu"
            @click="mobileNavigationOpen = false"
          />
        </div>
      </template>

      <VList nav class="admin-links">
        <VListItem
          v-if="auth.canManageUsers"
          :to="{ name: 'admin-users' }"
          title="Users"
          rounded="lg"
          @click="mobileNavigationOpen = false"
        >
          <template #prepend>
            <svg
              class="admin-nav-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="7" r="3" />
              <path
                d="M3 19v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 4.2a3 3 0 0 1 0 5.6M21 19v-2a4 4 0 0 0-3.2-3.9"
              />
            </svg>
          </template>
        </VListItem>
      </VList>

      <template #append>
        <VList nav class="admin-links">
          <VListItem
            :to="{ name: 'workspace' }"
            :prepend-icon="aliases.arrowleft"
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
            aria-label="Open administration menu"
            aria-controls="admin-navigation"
            :aria-expanded="mobileNavigationOpen"
            @click="mobileNavigationOpen = true"
          />
          <span class="admin-location-parent">Administration</span>
          <VIcon
            class="admin-location-parent"
            :icon="aliases.next"
            size="small"
            aria-hidden="true"
          />
          <strong>{{ route.meta.adminTitle }}</strong>
        </div>

        <div v-if="auth.user" class="admin-account" role="group" aria-label="Signed-in account">
          <VAvatar
            size="34"
            color="primary"
            variant="tonal"
            class="account-avatar"
            aria-hidden="true"
          >
            {{ getAccountInitials(auth.user.name) }}
          </VAvatar>
          <div class="account-label">
            <strong>{{ auth.user.name }}</strong>
            <span>Admin</span>
          </div>
        </div>
      </div>
    </VAppBar>

    <VMain
      id="admin-content"
      ref="main"
      class="admin-content"
      tabindex="-1"
      :inert="mobileNavigationOpen"
      scrollable
    >
      <div class="admin-frame">
        <RouterView />
      </div>
    </VMain>
  </VLayout>
</template>

<style scoped>
.admin-layout {
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

.admin-brand {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 23px 14px 22px 22px;
}

.admin-brand strong {
  display: block;
  font-size: 1.125rem;
  line-height: 1.2;
}

.admin-brand div > span {
  display: block;
  font-size: 0.75rem;
  opacity: 0.84;
}

.brand-mark {
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
  padding-inline: 14px;
  color: inherit;
}

.admin-links :deep(.v-list-item) {
  min-height: 44px;
}

.admin-links :deep(.v-list-item__prepend) {
  padding-inline-end: 10px;
}

.admin-links :deep(.v-list-item__spacer) {
  display: none;
}

.admin-nav-icon,
.admin-links :deep(.v-list-item__prepend > .v-icon) {
  width: 18px;
  height: 18px;
  font-size: 18px;
}

.admin-links :deep(.v-list-item--active) {
  --v-activated-opacity: 0;
  background: rgba(var(--v-theme-on-admin-navigation), 0.1);
  box-shadow: inset 0 0 0 1px rgba(var(--v-theme-on-admin-navigation), 0.19);
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

.admin-location,
.admin-account {
  display: flex;
  min-width: 0;
  gap: 8px;
  align-items: center;
  font-size: 0.875rem;
}

.admin-location-parent {
  color: rgba(var(--v-theme-on-surface), 0.74);
}

.account-avatar {
  flex: none;
  font-size: 0.75rem;
  font-weight: 700;
}

.account-label {
  min-width: 0;
  max-width: 170px;
}

.account-label strong,
.account-label span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-label span {
  color: rgba(var(--v-theme-on-surface), 0.74);
  font-size: 0.75rem;
}

.admin-content {
  min-width: 0;
}

@media (max-width: 440px) {
  .admin-location-parent {
    display: none;
  }

  .account-label {
    max-width: 112px;
  }
}
</style>
