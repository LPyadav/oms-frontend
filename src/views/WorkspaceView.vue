<script setup>
import { storeToRefs } from 'pinia'
import { onMounted, ref, useTemplateRef } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const { isAuthenticated, user } = storeToRefs(auth)
const heading = useTemplateRef('workspaceHeading')
const signingOut = ref(false)
const feedback = ref('')

onMounted(() => heading.value?.focus({ preventScroll: true }))

async function signOut() {
  if (signingOut.value) return

  signingOut.value = true
  feedback.value = ''
  try {
    await auth.logout()
  } catch {
    feedback.value = 'Sign-out could not be completed. Try again.'
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <main v-if="isAuthenticated && user" class="workspace">
    <section class="workspace-panel" aria-labelledby="workspace-heading">
      <h1 id="workspace-heading" ref="workspaceHeading" tabindex="-1">OMS workspace</h1>
      <div class="workspace-account">
        <strong>{{ user.name }}</strong>
        <p>{{ user.email }}</p>
      </div>
      <VAlert v-if="feedback" type="error" :icon="false" variant="tonal" role="alert">
        {{ feedback }}
      </VAlert>
      <VBtn
        class="text-none"
        type="button"
        variant="outlined"
        height="48"
        :loading="signingOut"
        :disabled="signingOut"
        @click="signOut"
      >
        {{ signingOut ? 'Signing out…' : 'Sign out' }}
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
