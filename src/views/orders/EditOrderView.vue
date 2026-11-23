<script setup>
import { computed, onScopeDispose, watch } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'
import OrderForm from '../../components/orders/OrderForm.vue'
import { useOrderDetail } from '../../composables/useOrderDetail'
import { isOrderEditable } from '../../constants/orders'
import { useAuthStore } from '../../stores/auth'

const props = defineProps({ orderId: { type: String, required: true } })
const auth = useAuthStore()
const controller = new AbortController()
const { order, error, loading, load } = useOrderDetail({
  request: auth.request,
  signal: controller.signal,
})
const editable = computed(() => isOrderEditable(order.value?.status))
const errorMessage = computed(() => {
  if (error.value?.status === 404) return 'This order is unavailable.'
  if (error.value?.status === 403) return 'You do not have permission to view this order.'
  return 'Unable to load the order for editing.'
})
const canRetry = computed(() => error.value && ![403, 404].includes(error.value.status))

watch(
  () => props.orderId,
  (id) => {
    if (auth.canEditOrders) void load(id)
  },
  { immediate: true },
)
onScopeDispose(() => controller.abort())
</script>

<template>
  <template v-if="auth.canEditOrders">
    <OrderForm v-if="editable" :key="order.id" :order="order" />
    <section v-else class="edit-state" aria-labelledby="edit-state-heading">
      <h1 id="edit-state-heading">Edit order</h1>
      <div v-if="loading" role="status">
        <VProgressLinear indeterminate color="primary" aria-hidden="true" />
        <p>Loading order…</p>
      </div>
      <VAlert v-else-if="error" type="error" variant="tonal" :icon="false" role="alert">
        {{ errorMessage }}
      </VAlert>
      <VAlert v-else-if="order" type="warning" variant="tonal" :icon="false" role="alert">
        Only draft and pending orders can be edited.
      </VAlert>
      <div class="edit-state-actions">
        <VBtn
          :to="order ? { name: 'order-detail', params: { orderId } } : { name: 'orders' }"
          variant="outlined"
          class="text-none"
        >
          {{ order ? 'Back to order' : 'Back to orders' }}
        </VBtn>
        <VBtn
          v-if="canRetry"
          color="primary"
          variant="flat"
          class="text-none"
          @click="load(orderId)"
        >
          Try again
        </VBtn>
      </div>
    </section>
  </template>
</template>

<style scoped>
.edit-state {
  display: grid;
  justify-items: start;
  gap: 14px;
  padding-block: clamp(20px, 2.8vw, 28px);
}

.edit-state h1 {
  margin: 0;
  font-size: clamp(1.625rem, 3.4vw, 2.125rem);
}

.edit-state-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
