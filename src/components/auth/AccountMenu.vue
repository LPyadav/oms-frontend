<script setup>
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VAvatar } from 'vuetify/components/VAvatar'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VIcon } from 'vuetify/components/VIcon'
import { VList, VListItem } from 'vuetify/components/VList'
import { VMenu } from 'vuetify/components/VMenu'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { AUTH_ROLE } from '../../constants/auth'
import { useAuthStore } from '../../stores/auth'
import { getAccountInitials } from '../../utils/accountInitials'

defineProps({ compact: Boolean })

const auth = useAuthStore()
const open = ref(false)
const signingOut = ref(false)
const feedback = ref('')
const accountTrigger = useTemplateRef('accountTrigger')
const passwordItem = useTemplateRef('passwordItem')
const signOutItem = useTemplateRef('signOutItem')
const accountRole = computed(() => {
  const roles = auth.user?.roles ?? []
  const role = roles.find((name) => name.toLowerCase() === AUTH_ROLE.ADMIN) ?? roles[0]
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : ''
})

function focusFirstMenuItem() {
  if (document.activeElement === accountTrigger.value?.$el) {
    passwordItem.value?.$el.focus({ preventScroll: true })
  }
}

async function signOut() {
  if (signingOut.value) return

  signingOut.value = true
  feedback.value = ''
  try {
    await auth.logout()
    open.value = false
  } catch {
    feedback.value = 'Sign-out could not be completed. Try again.'
  } finally {
    signingOut.value = false
  }

  if (feedback.value && open.value) {
    await nextTick()
    signOutItem.value?.$el.focus({ preventScroll: true })
  }
}
</script>

<template>
  <VMenu
    v-if="auth.user"
    v-model="open"
    location="bottom end"
    :offset="8"
    :close-on-content-click="false"
    @after-enter="focusFirstMenuItem"
  >
    <template #activator="{ props }">
      <VBtn
        ref="accountTrigger"
        v-bind="props"
        type="button"
        variant="text"
        rounded="lg"
        class="account-trigger text-none"
        :aria-label="'Account menu for ' + auth.user.name"
      >
        <span class="account-trigger-content">
          <VAvatar
            size="34"
            color="primary"
            variant="tonal"
            class="account-avatar"
            aria-hidden="true"
          >
            {{ getAccountInitials(auth.user.name) }}
          </VAvatar>
          <span v-if="!compact" class="account-label">
            <strong>{{ auth.user.name }}</strong>
            <span v-if="accountRole">{{ accountRole }}</span>
          </span>
          <VIcon :icon="aliases.dropdown" size="18" class="account-chevron" aria-hidden="true" />
        </span>
      </VBtn>
    </template>

    <VCard class="account-menu" rounded="lg" variant="elevated">
      <div class="account-summary">
        <strong>{{ auth.user.name }}</strong>
        <span>{{ auth.user.email }}</span>
      </div>
      <VList role="menu" aria-label="Account actions" nav density="compact">
        <VListItem
          ref="passwordItem"
          :to="{ name: 'account-password' }"
          role="menuitem"
          title="Change password"
          :disabled="signingOut"
          @click="open = false"
        />
        <VListItem
          ref="signOutItem"
          tag="button"
          type="button"
          role="menuitem"
          :title="signingOut ? 'Signing out…' : 'Sign out'"
          :disabled="signingOut"
          :aria-busy="signingOut"
          @click="signOut"
        />
      </VList>
      <VAlert
        v-if="feedback"
        class="account-feedback"
        type="error"
        variant="tonal"
        density="compact"
        :icon="false"
        role="alert"
      >
        {{ feedback }}
      </VAlert>
    </VCard>
  </VMenu>
</template>

<style scoped>
.account-trigger {
  min-block-size: 44px;
  min-inline-size: 44px;
  padding-inline: 5px 7px;
}

.account-trigger-content {
  display: flex;
  min-inline-size: 0;
  align-items: center;
  gap: 8px;
}

.account-avatar {
  flex: none;
  font-size: 0.75rem;
  font-weight: 700;
}

.account-label {
  max-inline-size: 160px;
  min-inline-size: 0;
  text-align: start;
}

.account-label strong,
.account-label span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-label span,
.account-summary span {
  color: rgba(var(--v-theme-on-surface), 0.74);
  font-size: 0.75rem;
}

.account-chevron {
  flex: none;
}

.account-menu {
  min-inline-size: 220px;
  max-inline-size: min(300px, calc(100vw - 24px));
}

.account-summary {
  display: grid;
  gap: 2px;
  padding: 12px 16px;
  overflow-wrap: anywhere;
  border-block-end: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.account-menu :deep(.v-list-item) {
  min-block-size: 44px;
  inline-size: 100%;
  text-align: start;
}

.account-feedback {
  margin: 0 8px 8px;
}

@media (max-width: 600px) {
  .account-label,
  .account-chevron {
    display: none;
  }
}
</style>
