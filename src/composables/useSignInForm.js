import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { AUTH_STATUS } from '../constants/auth'
import { useAuthStore } from '../stores/auth'

export function useSignInForm() {
  const auth = useAuthStore()
  const { isAuthenticated, status } = storeToRefs(auth)
  const email = ref('')
  const password = ref('')
  const passwordVisible = ref(false)
  const pendingAction = ref('')
  const feedback = ref('')
  const emailErrors = ref([])
  const passwordErrors = ref([])

  const checkingSession = computed(
    () => status.value === AUTH_STATUS.IDLE || pendingAction.value === 'restore-session',
  )
  const sessionUnavailable = computed(() => status.value === AUTH_STATUS.UNAVAILABLE)
  const signingIn = computed(() => pendingAction.value === 'sign-in')

  function showSignInError(error) {
    if (sessionUnavailable.value) return

    if (error.status === 422) {
      emailErrors.value = error.fields?.email ?? []
      passwordErrors.value = error.fields?.password ?? []
      feedback.value = 'Check your sign-in details and try again.'
      return
    }

    if (error.code === 'AUTH_INVALID_CREDENTIALS') {
      feedback.value = 'The email or password is incorrect.'
      return
    }

    if (error.status === 429) {
      const seconds = Number(error.retryAfter)
      feedback.value =
        Number.isInteger(seconds) && seconds > 0
          ? `Too many attempts. Wait ${seconds} seconds before trying again.`
          : 'Too many attempts. Try again shortly.'
      return
    }

    feedback.value =
      error.code === 'NETWORK_ERROR'
        ? 'Could not reach OMS. Check your connection and try again.'
        : 'Sign-in could not be completed. Try again.'
  }

  async function restoreSession() {
    if (pendingAction.value) return

    pendingAction.value = 'restore-session'
    feedback.value = ''
    try {
      await auth.initialize()
    } finally {
      pendingAction.value = ''
    }
  }

  async function signIn() {
    if (pendingAction.value || isAuthenticated.value) return

    pendingAction.value = 'sign-in'
    feedback.value = ''
    emailErrors.value = []
    passwordErrors.value = []
    try {
      await auth.login({ email: email.value.trim(), password: password.value })
    } catch (error) {
      showSignInError(error)
    } finally {
      password.value = ''
      passwordVisible.value = false
      pendingAction.value = ''
    }
  }

  return {
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
  }
}
