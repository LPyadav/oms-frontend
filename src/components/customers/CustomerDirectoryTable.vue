<script setup>
import { VAvatar } from 'vuetify/components/VAvatar'
import { VChip } from 'vuetify/components/VChip'
import { VTable } from 'vuetify/components/VTable'
import { getAccountInitials } from '../../utils/accountInitials'

defineProps({
  customers: { type: Array, required: true },
})
const emit = defineEmits(['open-profile'])
</script>

<template>
  <VTable class="customers-table" density="comfortable">
    <caption class="d-sr-only">
      Customer directory
    </caption>
    <thead role="rowgroup">
      <tr role="row">
        <th scope="col" role="columnheader">Customer</th>
        <th scope="col" role="columnheader">Phone</th>
        <th scope="col" role="columnheader">Status</th>
      </tr>
    </thead>
    <tbody role="rowgroup">
      <tr v-for="customer in customers" :key="customer.id" role="row">
        <th scope="row" role="rowheader">
          <div class="customer-identity">
            <VAvatar size="34" color="primary" variant="tonal" aria-hidden="true">
              {{ getAccountInitials(customer.name) }}
            </VAvatar>
            <div class="customer-name">
              <button
                type="button"
                class="customer-name-button"
                :aria-label="`View ${customer.name}`"
                @click="emit('open-profile', customer.id, $event.currentTarget)"
              >
                {{ customer.name }}
              </button>
              <span class="customer-detail">{{ customer.email || 'No email' }}</span>
            </div>
          </div>
        </th>
        <td role="cell">
          <span class="customer-cell-label" aria-hidden="true">Phone</span>
          {{ customer.phone || '—' }}
        </td>
        <td role="cell">
          <span class="customer-cell-label" aria-hidden="true">Status</span>
          <VChip
            :color="customer.is_active ? 'primary' : undefined"
            size="small"
            variant="tonal"
            label
          >
            {{ customer.is_active ? 'Active' : 'Inactive' }}
          </VChip>
        </td>
      </tr>
    </tbody>
  </VTable>
</template>

<style scoped>
.customer-identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.customers-table thead {
  background: rgba(var(--v-theme-primary), 0.055);
}

.customers-table th[scope='row'],
.customers-table td {
  padding-block: 10px;
}

.customer-name {
  display: grid;
  min-inline-size: 0;
  gap: 2px;
  font-weight: 400;
}

.customer-name-button {
  justify-self: start;
  min-width: 0;
  padding: 0;
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
  text-align: start;
  text-decoration: underline;
  text-underline-offset: 2px;
  overflow-wrap: anywhere;
}

.customer-name span,
.customers-table td {
  overflow-wrap: anywhere;
}

.customer-detail {
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
}

.customer-cell-label {
  display: none;
}

@media (max-width: 599px) {
  .customers-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .customers-table tbody tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 10px;
    padding: 12px 16px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }

  .customers-table th[scope='row'],
  .customers-table td {
    height: auto;
    padding: 0;
    border: 0;
  }

  .customers-table th[scope='row'] {
    grid-column: 1 / -1;
  }

  .customer-cell-label {
    display: block;
    margin-bottom: 3px;
    color: rgba(var(--v-theme-on-surface), 0.77);
    font-size: 0.75rem;
  }
}
</style>
