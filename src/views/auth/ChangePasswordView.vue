<script setup>
import { reactive, ref } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VTextField } from 'vuetify/components/VTextField'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const fields = reactive({ current_password: '', password: '', password_confirmation: '' })
const fieldErrors = ref({})
const feedback = ref('')
const saving = ref(false)

function clearError(field) {
  delete fieldErrors.value[field]
  if (field === 'password_confirmation') delete fieldErrors.value.password
}

async function submit() {
  if (saving.value) return

  fieldErrors.value = {}
  feedback.value = ''
  if (fields.password !== fields.password_confirmation) {
    fieldErrors.value = { password_confirmation: ['The passwords do not match.'] }
    return
  }

  saving.value = true
  try {
    await auth.changePassword({ ...fields })
    Object.assign(fields, { current_password: '', password: '', password_confirmation: '' })
  } catch (failure) {
    if (failure.status === 401) return

    if (failure.status === 422 && failure.fields && Object.keys(failure.fields).length) {
      fieldErrors.value = failure.fields
      feedback.value = 'Check the fields below and try again.'
    } else {
      feedback.value = 'Could not confirm the password change. Check your connection and try again.'
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="password-page" aria-labelledby="password-heading">
    <header>
      <h1 id="password-heading">Change password</h1>
      <p>After you save, you’ll be signed out on this device and any other device.</p>
    </header>

    <VCard class="password-card" rounded="xl" variant="outlined">
      <form class="password-form" @submit.prevent="submit">
        <VAlert v-if="feedback" type="error" variant="tonal" :icon="false" role="alert">
          {{ feedback }}
        </VAlert>

        <VTextField
          v-model="fields.current_password"
          label="Current password"
          name="current_password"
          type="password"
          autocomplete="current-password"
          required
          :disabled="saving"
          :error-messages="fieldErrors.current_password"
          @update:model-value="clearError('current_password')"
        />
        <VTextField
          v-model="fields.password"
          label="New password"
          name="password"
          type="password"
          autocomplete="new-password"
          required
          :disabled="saving"
          :error-messages="fieldErrors.password"
          @update:model-value="clearError('password')"
        />
        <VTextField
          v-model="fields.password_confirmation"
          label="Confirm new password"
          name="password_confirmation"
          type="password"
          autocomplete="new-password"
          required
          :disabled="saving"
          :error-messages="fieldErrors.password_confirmation"
          @update:model-value="clearError('password_confirmation')"
        />

        <VBtn
          class="password-submit"
          type="submit"
          color="primary"
          variant="flat"
          :loading="saving"
        >
          Change password
        </VBtn>
      </form>
    </VCard>
  </section>
</template>

<style scoped>
.password-page {
  display: grid;
  gap: 20px;
  inline-size: min(100%, 560px);
  margin-inline: auto;
}

.password-page h1 {
  margin: 0;
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-weight: 700;
  line-height: 1.2;
}

.password-page p {
  margin: 8px 0 0;
  color: rgb(var(--v-theme-on-surface-variant));
}

.password-card {
  border-color: rgba(var(--v-theme-on-surface), 0.14);
}

.password-form {
  display: grid;
  gap: 8px;
  padding: clamp(16px, 4vw, 28px);
}

.password-submit {
  justify-self: start;
}

@media (max-width: 420px) {
  .password-submit {
    justify-self: stretch;
  }
}
</style>
