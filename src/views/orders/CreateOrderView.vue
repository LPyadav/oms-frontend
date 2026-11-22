<script setup>
import { computed, nextTick, onMounted, onScopeDispose, reactive, ref, useTemplateRef } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'
import { VSelect } from 'vuetify/components/VSelect'
import { VTextarea } from 'vuetify/components/VTextarea'
import { VTextField } from 'vuetify/components/VTextField'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { loadCustomerPage } from '../../api/customers'
import { loadOrderAssigneePage } from '../../api/orders'
import { loadProductPage } from '../../api/products'
import OrderItemsCard from '../../components/orders/OrderItemsCard.vue'
import OrderLineFields from '../../components/orders/OrderLineFields.vue'
import OrderLookupField from '../../components/orders/OrderLookupField.vue'
import { useOrderCreation } from '../../composables/useOrderCreation'
import { ORDER_PRIORITY } from '../../constants/orders'
import { useAuthStore } from '../../stores/auth'
import { formatOrderDate } from '../../utils/orderDisplay'
import {
  createOrderLine,
  MAX_ORDER_ITEMS,
  MAX_ORDER_NOTE_LENGTH,
  orderFieldStep,
  todayForOrder,
  validateOrderDraft,
} from '../../utils/orderDraft'

const router = useRouter()
const auth = useAuthStore()
const heading = useTemplateRef('heading')
const stepHeading = useTemplateRef('step-heading')
const steps = ['Customer', 'Line items', 'Order details', 'Review']
const reviewStep = steps.length - 1
const step = ref(0)
const fieldErrors = ref({})
const submitMessage = ref('')
const canRetrySave = ref(true)
const controller = new AbortController()
const { pricing, pricingPending, savePending, attempt, savedOrder, preview, clearPricing, save } =
  useOrderCreation({ request: auth.request, signal: controller.signal })

const canSelectCatalog = computed(() => auth.canViewCustomers && auth.canViewProducts)
const draft = reactive({
  customer: null,
  items: [createOrderLine(1)],
  orderDate: todayForOrder(),
  priority: 'normal',
  assignee: null,
  note: '',
  discount: '',
})
let nextLineKey = 2

const priorityOptions = Object.entries(ORDER_PRIORITY).map(([value, title]) => ({ value, title }))
const name = (item) => item.name
const customerSubtitle = (item) => item.email ?? item.phone
const customerPage = (query, signal) =>
  loadCustomerPage(auth.request, { ...query, isActive: true }, signal)
const productPage = (query, signal) =>
  loadProductPage(auth.request, { ...query, isActive: true }, signal)
const assigneePage = (query, signal) => loadOrderAssigneePage(auth.request, query, signal)

function errorsFor(field) {
  const value = fieldErrors.value[field]
  return Array.isArray(value) ? value : value ? [value] : []
}

function clearFieldError(field) {
  if (Object.hasOwn(fieldErrors.value, field)) delete fieldErrors.value[field]
}

function clearLineError(index, field) {
  clearFieldError('items.' + index + '.' + field)
}

function lineErrors(index) {
  const path = 'items.' + index
  return {
    product: errorsFor(path + '.product_id'),
    quantity: errorsFor(path + '.quantity'),
    discount: errorsFor(path + '.item_discount_minor'),
  }
}

function addLine() {
  if (draft.items.length < MAX_ORDER_ITEMS) draft.items.push(createOrderLine(nextLineKey++))
}

function removeLine(index) {
  if (draft.items.length <= 1) return
  draft.items.splice(index, 1)
  fieldErrors.value = {}
}

async function goToStep(next) {
  step.value = next
  await nextTick()
  stepHeading.value?.focus()
}

async function showValidation(fields) {
  fieldErrors.value = { ...fields }
  const next = Math.min(reviewStep, ...Object.keys(fields).map(orderFieldStep))
  if (next !== reviewStep) clearPricing()
  await goToStep(next)
}

function failureMessage(error, fallback) {
  if (error.status === 403) return 'Your account does not have permission to complete this action.'
  if (error.status === 429) return 'Too many requests. Please wait and try again.'
  return fallback
}

async function showError(error, fallback) {
  if (error.status === 401) return
  if (error.status === 422 && Object.keys(error.fields).length) {
    await showValidation(error.fields)
    return
  }
  submitMessage.value = failureMessage(error, fallback)
}

async function reviewPricing() {
  submitMessage.value = ''
  const { fields, body } = validateOrderDraft(draft)
  if (Object.keys(fields).length) {
    await showValidation(fields)
    return
  }

  await goToStep(reviewStep)
  try {
    await preview(body)
  } catch (error) {
    await showError(error, 'Unable to calculate pricing. Try again.')
  }
}

async function advance() {
  submitMessage.value = ''
  const { fields } = validateOrderDraft(draft)
  const current = Object.fromEntries(
    Object.entries(fields).filter(([field]) => orderFieldStep(field) === step.value),
  )
  fieldErrors.value = current
  if (Object.keys(current).length) return
  if (step.value === reviewStep - 1) await reviewPricing()
  else await goToStep(step.value + 1)
}

function previousStep() {
  clearPricing()
  fieldErrors.value = {}
  submitMessage.value = ''
  void goToStep(step.value - 1)
}

async function submitDraft() {
  submitMessage.value = ''
  const { fields, body } = validateOrderDraft(draft)
  if (!attempt.value && Object.keys(fields).length) {
    await showValidation(fields)
    return
  }

  let order
  try {
    order = await save(body)
  } catch (error) {
    canRetrySave.value = error.status === 0 || error.status === 429 || error.status >= 500
    const fallback = canRetrySave.value
      ? 'The save could not be confirmed. Retry this draft to avoid creating a duplicate.'
      : 'The save could not be confirmed here. Check Orders before creating another draft.'
    const message = attempt.value ? fallback : 'The draft could not be saved. Review the form.'
    await showError(error, message)
    return
  }

  if (!order) return
  await router.replace({ name: 'order-detail', params: { orderId: order.id } })
}

function submitStep() {
  if (!canSelectCatalog.value || pricingPending.value || savePending.value || savedOrder.value)
    return
  if (step.value < reviewStep) return advance()
  if (attempt.value && !canRetrySave.value) return
  if (!pricing.value && !attempt.value) return reviewPricing()
  return submitDraft()
}

onMounted(() => heading.value?.focus({ preventScroll: true }))
onBeforeRouteLeave(() => !savePending.value || !auth.isAuthenticated)
onScopeDispose(() => controller.abort())
</script>

<template>
  <section v-if="auth.canCreateOrders" class="order-create" aria-labelledby="create-order-heading">
    <header class="create-header">
      <VBtn
        :to="{ name: 'orders' }"
        :prepend-icon="aliases.prev"
        :disabled="savePending"
        variant="text"
        color="primary"
        class="create-back text-none"
      >
        Back to orders
      </VBtn>
      <h1 id="create-order-heading" ref="heading" tabindex="-1">Create order</h1>
    </header>

    <VAlert v-if="!canSelectCatalog" type="warning" variant="tonal" :icon="false" role="alert">
      Customer and product view permissions are required to choose catalog records.
    </VAlert>

    <template v-else>
      <ol class="create-steps" aria-label="Order creation steps" role="list">
        <li
          v-for="(label, index) in steps"
          :key="label"
          :aria-current="step === index ? 'step' : undefined"
        >
          <span aria-hidden="true">{{ index + 1 }}</span>
          {{ label }}
        </li>
      </ol>

      <form class="create-form" novalidate @submit.prevent="submitStep">
        <VCard
          tag="section"
          class="step-card"
          variant="flat"
          border
          aria-labelledby="create-step-heading"
        >
          <h2 id="create-step-heading" ref="step-heading" tabindex="-1">{{ steps[step] }}</h2>

          <div v-if="step === 0" class="step-fields">
            <OrderLookupField
              v-model="draft.customer"
              label="Customer"
              resource="customers"
              :load-page="customerPage"
              :item-title="name"
              :item-subtitle="customerSubtitle"
              :error-messages="errorsFor('customer_id')"
              @update:model-value="clearFieldError('customer_id')"
            />
            <p v-if="draft.customer && customerSubtitle(draft.customer)" class="field-hint">
              {{ customerSubtitle(draft.customer) }}
            </p>
          </div>

          <div v-else-if="step === 1" class="step-fields">
            <VAlert
              v-if="errorsFor('items').length"
              type="error"
              :icon="false"
              variant="tonal"
              role="alert"
            >
              {{ errorsFor('items').join(' ') }}
            </VAlert>
            <OrderLineFields
              v-for="(line, index) in draft.items"
              :key="line.key"
              v-model:product="line.product"
              v-model:quantity="line.quantity"
              v-model:discount="line.discount"
              :position="index + 1"
              :errors="lineErrors(index)"
              :load-page="productPage"
              :removable="draft.items.length > 1"
              @update:product="clearLineError(index, 'product_id')"
              @update:quantity="clearLineError(index, 'quantity')"
              @update:discount="clearLineError(index, 'item_discount_minor')"
              @remove="removeLine(index)"
            />
            <VBtn
              type="button"
              variant="outlined"
              color="primary"
              class="step-add text-none"
              :disabled="draft.items.length >= MAX_ORDER_ITEMS"
              @click="addLine"
            >
              Add item
            </VBtn>
            <VTextField
              v-model="draft.discount"
              label="Order discount"
              inputmode="decimal"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              :error-messages="errorsFor('order_discount_minor')"
              @update:model-value="clearFieldError('order_discount_minor')"
              class="step-discount"
            />
          </div>

          <div v-else-if="step === 2" class="order-metadata">
            <VTextField
              v-model="draft.orderDate"
              label="Order date"
              type="date"
              min="1000-01-01"
              max="9999-12-31"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              :error-messages="errorsFor('order_date')"
              @update:model-value="clearFieldError('order_date')"
            />
            <VSelect
              v-model="draft.priority"
              :items="priorityOptions"
              label="Priority"
              :menu-icon="aliases.dropdown"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              :error-messages="errorsFor('priority')"
              @update:model-value="clearFieldError('priority')"
            />
            <OrderLookupField
              v-if="auth.canAssignOrders"
              v-model="draft.assignee"
              label="Assignee (optional)"
              resource="assignees"
              :load-page="assigneePage"
              :item-title="name"
              :error-messages="errorsFor('assignee_id')"
              @update:model-value="clearFieldError('assignee_id')"
            />
            <VTextarea
              v-if="auth.canAddOrderNote"
              v-model="draft.note"
              label="Note (optional)"
              :maxlength="MAX_ORDER_NOTE_LENGTH"
              rows="3"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              :error-messages="errorsFor('note')"
              @update:model-value="clearFieldError('note')"
              class="order-note"
            />
          </div>

          <div v-else class="step-fields">
            <dl class="review-fields">
              <div>
                <dt>Customer</dt>
                <dd>{{ draft.customer.name }}</dd>
              </div>
              <div>
                <dt>Order date</dt>
                <dd>{{ formatOrderDate(draft.orderDate) }}</dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd>{{ ORDER_PRIORITY[draft.priority] }}</dd>
              </div>
              <div>
                <dt>Assigned to</dt>
                <dd>{{ draft.assignee?.name ?? 'Unassigned' }}</dd>
              </div>
              <div v-if="draft.note.trim()" class="review-note">
                <dt>Note</dt>
                <dd>{{ draft.note.trim() }}</dd>
              </div>
            </dl>
            <VProgressLinear
              v-if="pricingPending"
              color="primary"
              indeterminate
              aria-label="Calculating pricing"
            />
            <p v-if="pricing" class="field-hint">
              Prices and taxes are recalculated when the draft is saved.
            </p>
          </div>
        </VCard>

        <OrderItemsCard v-if="step === reviewStep && pricing" :order="pricing" />

        <VAlert
          v-if="submitMessage || (step === reviewStep && Object.keys(fieldErrors).length)"
          type="error"
          variant="tonal"
          :icon="false"
          role="alert"
        >
          {{ submitMessage || Object.values(fieldErrors).flat().join(' ') }}
        </VAlert>

        <div class="create-actions">
          <VBtn
            v-if="step > 0 && !attempt && !savedOrder"
            type="button"
            variant="outlined"
            class="text-none"
            @click="previousStep"
          >
            Previous
          </VBtn>
          <VBtn
            v-if="savedOrder"
            :to="{ name: 'order-detail', params: { orderId: savedOrder.id } }"
            color="primary"
            variant="flat"
            class="text-none"
          >
            Open saved order
          </VBtn>
          <VBtn
            v-else
            type="submit"
            color="primary"
            variant="flat"
            class="text-none"
            :disabled="pricingPending || savePending || (!!attempt && !canRetrySave)"
            :loading="savePending"
          >
            {{
              step < reviewStep
                ? 'Continue'
                : attempt
                  ? 'Retry save'
                  : pricing
                    ? 'Create draft'
                    : 'Review prices'
            }}
          </VBtn>
        </div>
      </form>
    </template>
  </section>
</template>

<style scoped>
.order-create {
  display: grid;
  gap: 16px;
  max-width: 1100px;
  padding-block: clamp(20px, 2.8vw, 28px) 28px;
}

.create-back {
  margin-inline-start: -8px;
}

.create-header h1 {
  margin: 6px 0 0;
  font-size: clamp(1.625rem, 3.4vw, 2.125rem);
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.create-header h1:focus,
.step-card h2:focus {
  outline: none;
}

.create-steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.create-steps li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  background: rgb(var(--v-theme-surface));
}

.create-steps span {
  display: grid;
  flex: none;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
  font-size: 0.75rem;
  font-weight: 700;
}

.create-steps li[aria-current='step'] {
  border-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-primary));
}

.create-steps li[aria-current='step'] span {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}

.create-form,
.step-fields,
.order-metadata {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.step-card {
  padding: 18px;
  border-color: rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 12px;
}

.step-card h2 {
  margin: 0 0 14px;
  font-size: 1.0625rem;
}

.step-fields > .v-autocomplete {
  max-width: 540px;
}

.step-add {
  justify-self: start;
}

.step-discount {
  max-width: 260px;
}

.order-metadata,
.review-fields {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.order-note,
.review-note {
  grid-column: 1 / -1;
}

.review-fields {
  display: grid;
  gap: 10px 16px;
  margin: 0;
}

.review-fields dt,
.field-hint {
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
}

.review-fields dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.field-hint {
  margin: 0;
}

.create-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 620px) {
  .create-steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .order-metadata {
    grid-template-columns: minmax(0, 1fr);
  }

  .create-actions > * {
    flex: 1;
  }
}
</style>
