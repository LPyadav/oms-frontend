<script setup>
import { VAvatar } from 'vuetify/components/VAvatar'
import { VBtn } from 'vuetify/components/VBtn'
import { VChip } from 'vuetify/components/VChip'
import { VTable } from 'vuetify/components/VTable'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { AUTH_ROLE } from '../../constants/auth'
import { getAccountInitials } from '../../utils/accountInitials'

defineProps({
  accounts: { type: Array, required: true },
  disabled: Boolean,
  loadingAccountId: { type: Number, default: null },
})

const emit = defineEmits(['manage'])
</script>

<template>
  <VTable class="directory-table" aria-label="OMS user accounts" density="compact">
    <colgroup>
      <col class="account-column" />
      <col class="roles-column" />
      <col />
      <col class="actions-column" />
    </colgroup>
    <thead>
      <tr>
        <th scope="col">User</th>
        <th scope="col">Roles</th>
        <th scope="col">Status</th>
        <th scope="col"><span class="d-sr-only">Actions</span></th>
      </tr>
    </thead>
    <tbody role="rowgroup">
      <tr v-for="account in accounts" :key="account.id" role="row">
        <th scope="row" role="rowheader">
          <div class="account-identity">
            <VAvatar size="34" color="primary" variant="tonal" aria-hidden="true">
              {{ getAccountInitials(account.name) }}
            </VAvatar>
            <div class="account-text">
              <span class="account-name">{{ account.name }}</span>
              <span class="directory-detail">{{ account.email }}</span>
            </div>
          </div>
        </th>
        <td role="cell">
          <span class="mobile-column-label" aria-hidden="true">Roles</span>
          <div v-if="account.roles.length" class="role-list">
            <VChip
              v-for="role in account.roles"
              :key="role"
              :color="role === AUTH_ROLE.ADMIN ? 'primary' : undefined"
              size="small"
              variant="tonal"
              label
            >
              {{ role }}
            </VChip>
          </div>
          <span v-else class="directory-detail">No role</span>
        </td>
        <td role="cell">
          <span class="mobile-column-label" aria-hidden="true">Status</span>
          <span class="account-status" :class="{ 'account-status--active': account.is_active }">
            {{ account.is_active ? 'Active' : 'Disabled' }}
          </span>
        </td>
        <td role="cell" class="table-action">
          <VBtn
            :aria-label="`Manage ${account.name}`"
            :append-icon="aliases.next"
            class="manage-account text-none"
            type="button"
            variant="text"
            size="small"
            color="primary"
            :disabled="disabled"
            :loading="loadingAccountId === account.id"
            @click="emit('manage', account, $event)"
          >
            Manage
          </VBtn>
        </td>
      </tr>
    </tbody>
  </VTable>
</template>

<style scoped>
.directory-table :deep(.v-table__wrapper) {
  border-radius: 0;
}

.directory-table :deep(thead) {
  background: rgba(var(--v-theme-primary), 0.07);
  font-size: 0.8125rem;
}

.directory-table th[scope='row'] {
  padding-block: 12px;
  font-weight: 500;
}

.account-identity {
  display: flex;
  min-width: 0;
  gap: 10px;
  align-items: center;
}

.account-identity :deep(.v-avatar) {
  flex: none;
  font-size: 0.75rem;
  font-weight: 700;
}

.account-text {
  min-width: 0;
}

.account-name,
.directory-detail {
  display: block;
  overflow-wrap: anywhere;
}

.account-name {
  font-weight: 600;
}

.directory-detail {
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
  font-weight: 400;
}

.role-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.role-list :deep(.v-chip) {
  max-width: 100%;
  height: auto;
  min-height: 24px;
  padding-block: 2px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 6px;
  white-space: normal;
  overflow-wrap: anywhere;
  text-transform: capitalize;
}

.account-status {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: rgba(var(--v-theme-on-surface), 0.76);
  font-size: 0.8125rem;
  font-weight: 600;
}

.account-status::before {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: currentColor;
  content: '';
}

.account-status--active {
  color: rgb(var(--v-theme-primary));
}

.table-action {
  text-align: end;
}

.manage-account :deep(.v-btn__append) {
  margin-inline-start: 3px;
}

.mobile-column-label {
  display: none;
}

@media (min-width: 600px) {
  .directory-table :deep(table) {
    table-layout: fixed;
  }

  .account-column {
    width: 44%;
  }

  .roles-column {
    width: 21%;
  }

  .actions-column {
    width: 16%;
  }
}

@media (max-width: 599px) {
  .directory-table :deep(thead) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .directory-table tbody tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 9px 10px;
    align-items: end;
    padding: 12px 14px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }

  .directory-table th[scope='row'],
  .directory-table td {
    height: auto;
    padding: 0;
    border: 0;
  }

  .directory-table th[scope='row'] {
    grid-column: 1 / -1;
  }

  .manage-account {
    min-height: 44px;
    padding-inline: 6px;
  }

  .mobile-column-label {
    display: block;
    margin-bottom: 2px;
    color: rgba(var(--v-theme-on-surface), 0.77);
    font-size: 0.75rem;
  }
}
</style>
