<script setup>
import { watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
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
    <RouterView />
  </VApp>
</template>
