<script setup>
import { watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { VAlert } from 'vuetify/components/VAlert'
import { VApp } from 'vuetify/components/VApp'
import { loginLocation } from './router/authRedirect'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

watch(
  () => auth.isAuthenticated,
  (authenticated) => {
    if (!authenticated && route.meta.requiresAuth) {
      void router.replace(loginLocation(auth.signedOutExplicitly ? undefined : route))
    }
  },
)
</script>

<template>
  <VApp>
    <div class="session-warning" role="status" aria-atomic="true">
      <VAlert
        v-if="route.meta.requiresAuth && auth.sessionExpiresSoon"
        type="warning"
        variant="tonal"
        density="comfortable"
        :icon="false"
        role="presentation"
        class="session-warning-alert"
      >
        <p class="session-warning-message">
          <strong>Your session expires soon.</strong> Save your work before it ends.
        </p>
      </VAlert>
    </div>
    <RouterView />
  </VApp>
</template>

<style scoped>
.session-warning {
  position: fixed;
  z-index: 999;
  inset-block-end: max(16px, env(safe-area-inset-bottom));
  inset-inline-end: 16px;
  inline-size: min(360px, calc(100% - 32px));
  pointer-events: none;
}

.session-warning-alert {
  border: 1px solid rgba(var(--v-theme-warning), 0.4);
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 4px 16px rgba(var(--v-theme-on-surface), 0.12);
}

.session-warning-message {
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
}
</style>
