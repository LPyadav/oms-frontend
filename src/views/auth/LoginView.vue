<script setup>
import { nextTick, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VTextField } from 'vuetify/components/VTextField'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { useSignInForm } from '../../composables/useSignInForm'
import AuthLayout from '../../layouts/AuthLayout.vue'
import { signedInLocation } from '../../router/authRedirect'
import { useAuthStore } from '../../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const heading = useTemplateRef('heading')
const {
  checkingSession,
  email,
  emailErrors,
  feedback,
  isAuthenticated,
  password,
  passwordErrors,
  passwordVisible,
  restoreSession,
  sessionUnavailable,
  signIn,
  signingIn,
} = useSignInForm()

watch(isAuthenticated, (authenticated) => {
  if (authenticated) {
    void router.replace(signedInLocation(router, route.query.redirect, auth.canManageUsers))
  }
})

async function retrySession() {
  await restoreSession()
  await nextTick()
  heading.value?.focus()
}
</script>

<template>
  <AuthLayout>
    <section class="login-panel" aria-labelledby="login-heading">
      <header>
        <h1 id="login-heading" ref="heading" tabindex="-1">Sign in</h1>
        <p>Use your work account to access OMS.</p>
      </header>

      <VAlert
        v-if="auth.passwordWasChanged"
        type="success"
        :icon="false"
        variant="tonal"
        role="status"
      >
        Password changed. Sign in with your new password.
      </VAlert>
      <VAlert v-if="feedback" type="error" :icon="false" variant="tonal" role="alert">
        {{ feedback }}
      </VAlert>

      <p v-if="checkingSession || isAuthenticated" role="status">
        {{ isAuthenticated ? 'Opening OMS…' : 'Checking your session…' }}
      </p>

      <template v-else-if="sessionUnavailable">
        <VAlert type="error" :icon="false" variant="tonal" role="alert">
          Your session could not be restored. Try again to continue.
        </VAlert>
        <VBtn class="text-none" color="primary" height="48" @click="retrySession"> Try again </VBtn>
      </template>

      <form v-else class="login-form" :aria-busy="signingIn" @submit.prevent="signIn">
        <VTextField
          v-model="email"
          label="Work email"
          name="email"
          type="email"
          autocomplete="username"
          maxlength="254"
          variant="outlined"
          color="primary"
          hide-details="auto"
          :readonly="signingIn"
          :error-messages="emailErrors"
          required
          @update:model-value="emailErrors = []"
        />

        <VTextField
          v-model="password"
          label="Password"
          name="password"
          :type="passwordVisible ? 'text' : 'password'"
          autocomplete="current-password"
          maxlength="1024"
          variant="outlined"
          color="primary"
          hide-details="auto"
          :readonly="signingIn"
          :error-messages="passwordErrors"
          required
          @update:model-value="passwordErrors = []"
        >
          <template #append-inner>
            <VBtn
              class="text-none"
              type="button"
              color="primary"
              variant="text"
              height="44"
              :aria-label="passwordVisible ? 'Hide password' : 'Show password'"
              :disabled="signingIn"
              @click="passwordVisible = !passwordVisible"
            >
              {{ passwordVisible ? 'Hide' : 'Show' }}
            </VBtn>
          </template>
        </VTextField>

        <VBtn
          class="login-submit text-none"
          type="submit"
          color="primary"
          variant="flat"
          rounded="lg"
          height="50"
          :append-icon="aliases.next"
          :loading="signingIn"
          :disabled="signingIn"
        >
          {{ signingIn ? 'Signing in…' : 'Sign in' }}
        </VBtn>
        <VBtn
          :to="{ name: 'forgot-password' }"
          class="login-recovery-link text-none"
          color="primary"
          variant="text"
          height="44"
          :disabled="signingIn"
        >
          Forgot password?
        </VBtn>
      </form>
    </section>
  </AuthLayout>
</template>

<style scoped>
.login-panel {
  display: grid;
  gap: 24px;
}

.login-panel h1 {
  margin: 0 0 8px;
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: -0.045em;
}

.login-panel h1:focus {
  outline: none;
}

.login-panel p {
  margin: 0;
}

.login-panel header p {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.9375rem;
  line-height: 1.5;
}

.login-form {
  display: grid;
  gap: 18px;
}

.login-recovery-link {
  justify-self: center;
  margin-top: -2px;
}

.login-submit:not(.v-btn--disabled) {
  background-image: linear-gradient(107deg, #ffd298, #efad63 82%);
  box-shadow: 0 9px 21px rgba(var(--v-theme-primary), 0.22);
}

.login-form :deep(.v-field) {
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.login-form :deep(.v-field--focused:not(.v-field--error)) {
  background: rgba(var(--v-theme-primary), 0.07);
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.16);
}

.login-form :deep(.v-label) {
  opacity: 1;
}
</style>
