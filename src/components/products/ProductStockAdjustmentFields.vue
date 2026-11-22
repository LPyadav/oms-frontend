<script setup>
import { useTemplateRef } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VTextarea } from 'vuetify/components/VTextarea'
import { VTextField } from 'vuetify/components/VTextField'

defineProps({
  product: { type: Object, required: true },
  busy: Boolean,
  reloading: Boolean,
  reloadReason: { type: String, default: null },
  reloadErrorMessage: { type: String, default: '' },
  reloaded: Boolean,
  matchesCurrent: Boolean,
  quantityMessages: { type: Array, required: true },
  reasonMessages: { type: Array, required: true },
})
const countedQuantity = defineModel('countedQuantity', { type: String, required: true })
const reason = defineModel('reason', { type: String, required: true })
const emit = defineEmits(['reload'])
const reloadStockButton = useTemplateRef('reloadStockButton')

function focusReloadButton() {
  reloadStockButton.value?.$el.focus()
}

defineExpose({ focusReloadButton })
</script>

<template>
  <div class="stock-adjustment-fields">
    <div v-if="reloadReason" class="stock-reload">
      <VAlert type="warning" variant="tonal" :icon="false" role="alert">
        <span class="stock-conflict-message">{{
          reloadReason === 'conflict'
            ? 'Stock changed after this profile was loaded. Reload current stock before saving.'
            : 'Could not confirm the adjustment. Reload current stock before saving again.'
        }}</span>
      </VAlert>
      <VAlert v-if="reloadErrorMessage" type="error" variant="tonal" :icon="false" role="alert">
        {{ reloadErrorMessage }}
      </VAlert>
      <VBtn
        ref="reloadStockButton"
        type="button"
        variant="outlined"
        class="text-none"
        :loading="reloadingStock"
        :disabled="busy"
        @click="emit('reload')"
      >
        Reload current stock
      </VBtn>
    </div>
    <VAlert v-else-if="reloaded" color="primary" variant="tonal" :icon="false" role="status">
      Current stock reloaded. Review your counted quantity before saving.
    </VAlert>
    <dl class="stock-summary">
      <div>
        <dt>Product</dt>
        <dd>{{ product.name }} · {{ product.sku }}</dd>
      </div>
      <div>
        <dt>{{ reloadReason ? 'Last known stock' : 'Current stock' }}</dt>
        <dd>{{ product.stock_quantity }}</dd>
      </div>
    </dl>
    <VTextField
      v-model="countedQuantity"
      label="Counted quantity"
      hint="Enter the total number of units counted."
      persistent-hint
      inputmode="numeric"
      required
      variant="outlined"
      density="comfortable"
      :disabled="busy"
      :error-messages="quantityMessages"
      hide-details="auto"
    />
    <VTextarea
      v-model="reason"
      label="Reason"
      rows="2"
      required
      variant="outlined"
      density="comfortable"
      :disabled="busy"
      :error-messages="reasonMessages"
      hide-details="auto"
    />
    <p v-if="matchesCurrent && !reloadReason" role="status">
      Counted quantity matches current stock.
    </p>
  </div>
</template>

<style scoped>
.stock-adjustment-fields {
  display: grid;
  gap: 16px;
}

.stock-adjustment-fields p {
  margin: 0;
  overflow-wrap: anywhere;
}

.stock-reload {
  display: grid;
  gap: 12px;
  justify-items: start;
}

.stock-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 0;
}

.stock-summary dt {
  margin-bottom: 3px;
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
  font-weight: 500;
}

.stock-summary dd {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.stock-conflict-message {
  color: rgb(var(--v-theme-on-surface));
}

@media (max-width: 500px) {
  .stock-summary {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
