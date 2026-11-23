<script setup>
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VTextField } from 'vuetify/components/VTextField'
import { apiRequest } from '../../api/client'
import AuthLayout from '../../layouts/AuthLayout.vue'
import { useAuthStore } from '../../stores/auth'

const props = defineProps({ reset: Boolean })
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const fields = reactive({ email: '', password: '', password_confirmation: '' })
const fieldErrors = ref({})
const feedback = ref('')
const submitting = ref(false)
const linkRequested = ref(false)
const linkRejected = ref(false)
let inFlight = null

const resetLink = computed(() => {
  if (!props.reset) return null
  const fragment = route.fullPath.split('#')[1]
  const params = new URLSearchParams(fragment)
  const tokens = params.getAll('token')
  const emails = params.getAll('email')

  if (tokens.length !== 1 || !tokens[0] || tokens[0].length > 255) return null
  if (emails.length !== 1 || !emails[0] || emails[0].length > 254) return null
  return { token: tokens[0], email: emails[0] }
})

const invalidLink = computed(() => props.reset && (!resetLink.value || linkRejected.value))
const title = computed(() => (props.reset ? 'Reset password' : 'Forgot password?'))

watch(
  [() => props.reset, () => route.hash],
  () => {
    inFlight?.abort()
    inFlight = null
    submitting.value = false
    fields.email = resetLink.value?.email ?? ''
    fields.password = ''
    fields.password_confirmation = ''
    fieldErrors.value = {}
    feedback.value = ''
    linkRequested.value = false
    linkRejected.value = false
  },
  { immediate: true },
)
onScopeDispose(() => inFlight?.abort())

function clearError(field) {
  delete fieldErrors.value[field]
  if (field === 'password_confirmation') delete fieldErrors.value.password
}

async function submit() {
  if (submitting.value || invalidLink.value) return
  fieldErrors.value = {}
  feedback.value = ''

  if (props.reset && fields.password !== fields.password_confirmation) {
    fieldErrors.value = { password_confirmation: ['The passwords do not match.'] }
    return
  }

  const request = new AbortController()
  inFlight = request
  submitting.value = true
  try {
    if (props.reset) {
      await auth.resetPassword(
        {
          email: resetLink.value.email,
          token: resetLink.value.token,
          password: fields.password,
          password_confirmation: fields.password_confirmation,
        },
        request.signal,
      )
      if (!request.signal.aborted) {
        fields.password = ''
        fields.password_confirmation = ''
        await router.replace({ name: 'login' })
      }
    } else {
      await apiRequest('/api/forgot-password', {
        method: 'POST',
        body: { email: fields.email.trim() },
        signal: request.signal,
      })
      if (!request.signal.aborted) linkRequested.value = true
    }
  } catch (error) {
    if (request.signal.aborted) return
    if (props.reset && error.status === 422 && error.fields?.token?.length) {
      linkRejected.value = true
      fields.password = ''
      fields.password_confirmation = ''
    } else if (error.status === 422) {
      fieldErrors.value = error.fields ?? {}
      feedback.value = 'Check the fields below and try again.'
    } else if (error.status === 429) {
      feedback.value = 'Too many attempts. Please wait before trying again.'
    } else {
      feedback.value = 'Could not complete the request. Check your connection and try again.'
    }
  } finally {
    if (inFlight === request) {
      inFlight = null
      submitting.value = false
    }
  }
}
</script>

<template>
  <AuthLayout>
    <section class="recovery-panel" aria-labelledby="recovery-heading">
      <header>
        <h1 id="recovery-heading">{{ title }}</h1>
        <p v-if="!reset">Enter your work email to request a reset link.</p>
        <p v-else-if="!invalidLink">Choose a new password for your OMS account.</p>
      </header>

      <VAlert v-if="linkRequested" type="success" variant="tonal" :icon="false" role="status">
        If an account can use that email, a password reset link will be sent.
      </VAlert>
      <template v-else-if="invalidLink">
        <VAlert type="warning" variant="tonal" :icon="false" role="alert">
          This password reset link is invalid or expired.
        </VAlert>
        <VBtn
          :to="{ name: 'forgot-password' }"
          color="primary"
          variant="flat"
          rounded="lg"
          height="48"
          class="text-none"
        >
          Request a new link
        </VBtn>
      </template>
      <form v-else class="recovery-form" :aria-busy="submitting" @submit.prevent="submit">
        <VAlert v-if="feedback" type="error" variant="tonal" :icon="false" role="alert">
          {{ feedback }}
        </VAlert>

        <VTextField
          v-model="fields.email"
          label="Work email"
          name="email"
          type="email"
          autocomplete="username"
          maxlength="254"
          variant="outlined"
          color="primary"
          hide-details="auto"
          :readonly="reset || submitting"
          :error-messages="fieldErrors.email"
          required
          @update:model-value="clearError('email')"
        />

        <template v-if="reset">
          <VTextField
            v-model="fields.password"
            label="New password"
            name="password"
            type="password"
            autocomplete="new-password"
            maxlength="1024"
            variant="outlined"
            color="primary"
            hide-details="auto"
            :readonly="submitting"
            :error-messages="fieldErrors.password"
            required
            @update:model-value="clearError('password')"
          />
          <VTextField
            v-model="fields.password_confirmation"
            label="Confirm new password"
            name="password_confirmation"
            type="password"
            autocomplete="new-password"
            maxlength="1024"
            variant="outlined"
            color="primary"
            hide-details="auto"
            :readonly="submitting"
            :error-messages="fieldErrors.password_confirmation"
            required
            @update:model-value="clearError('password_confirmation')"
          />
        </template>

        <VBtn
          type="submit"
          class="text-none"
          color="primary"
          variant="flat"
          rounded="lg"
          height="48"
          :loading="submitting"
          :disabled="submitting"
        >
          {{ reset ? 'Reset password' : 'Send reset link' }}
        </VBtn>
      </form>

      <VBtn
        :to="{ name: 'login' }"
        class="recovery-back text-none"
        color="primary"
        variant="text"
        height="44"
      >
        Back to sign in
      </VBtn>
    </section>
  </AuthLayout>
</template>

<style scoped>
.recovery-panel,
.recovery-form {
  display: grid;
  gap: 18px;
}

.recovery-panel {
  width: min(100%, 410px);
}

.recovery-panel h1 {
  margin: 0 0 8px;
  font-size: clamp(2rem, 4.25vw, 3.375rem);
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: -0.045em;
}

.recovery-panel p {
  margin: 0;
}

.recovery-form :deep(.v-field) {
  border-radius: 10px;
  background: rgb(var(--v-theme-surface));
}

.recovery-back {
  justify-self: start;
}
</style>
