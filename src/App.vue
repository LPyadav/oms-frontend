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
    <div role="status">
      <VAlert
        v-if="route.meta.requiresAuth && auth.sessionExpiresSoon"
        type="warning"
        variant="tonal"
        density="comfortable"
        :icon="false"
        role="presentation"
        class="session-warning"
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
  inline-size: min(720px, calc(100% - 32px));
  margin: 16px auto 0;
}

.session-warning-message {
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
}
</style>
