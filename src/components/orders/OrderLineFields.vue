<script setup>
import { VBtn } from 'vuetify/components/VBtn'
import { VTextField } from 'vuetify/components/VTextField'
import { MAX_LINE_QUANTITY } from '../../utils/orderDraft'
import OrderLookupField from './OrderLookupField.vue'

defineProps({
  position: { type: Number, required: true },
  loadPage: { type: Function, required: true },
  errors: { type: Object, required: true },
  removable: Boolean,
})
const emit = defineEmits(['remove'])
const product = defineModel('product', { type: Object, default: null })
const quantity = defineModel('quantity', { type: String, required: true })
const discount = defineModel('discount', { type: String, required: true })

const productTitle = (item) => item.name + ' · ' + item.sku
</script>

<template>
  <fieldset class="order-line">
    <legend>Item {{ position }}</legend>
    <div class="line-fields">
      <OrderLookupField
        v-model="product"
        :label="'Product for item ' + position"
        resource="products"
        :load-page="loadPage"
        :item-title="productTitle"
        :error-messages="errors.product"
        class="line-product"
      />
      <VTextField
        v-model="quantity"
        label="Quantity"
        :aria-label="'Quantity for item ' + position"
        type="number"
        inputmode="numeric"
        min="1"
        :max="MAX_LINE_QUANTITY"
        step="1"
        variant="outlined"
        density="comfortable"
        hide-details="auto"
        :error-messages="errors.quantity"
      />
      <VTextField
        v-model="discount"
        label="Discount"
        :aria-label="'Discount for item ' + position"
        inputmode="decimal"
        variant="outlined"
        density="comfortable"
        hide-details="auto"
        :error-messages="errors.discount"
      />
      <VBtn
        v-if="removable"
        class="line-remove text-none"
        type="button"
        variant="text"
        color="error"
        :aria-label="'Remove item ' + position"
        @click="emit('remove')"
      >
        Remove
      </VBtn>
    </div>
  </fieldset>
</template>

<style scoped>
.order-line {
  min-width: 0;
  margin: 0;
  padding: 10px 12px 12px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 10px;
}

.order-line legend {
  padding-inline: 6px;
  font-size: 0.8125rem;
  font-weight: 700;
}

.line-fields {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 0.9fr) minmax(0, 0.9fr) auto;
  align-items: start;
  gap: 10px;
}

.line-remove {
  align-self: start;
  justify-self: start;
}

@media (max-width: 1050px) {
  .line-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .line-product,
  .line-remove {
    grid-column: 1 / -1;
  }
}
</style>
