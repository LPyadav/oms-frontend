<script setup>
import {
  computed,
  nextTick,
  onMounted,
  onScopeDispose,
  reactive,
  ref,
  shallowRef,
  useTemplateRef,
} from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'
import { VSelect } from 'vuetify/components/VSelect'
import { VTextarea } from 'vuetify/components/VTextarea'
import { VTextField } from 'vuetify/components/VTextField'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { loadCustomerPage } from '../../api/customers'
import { loadOrder, loadOrderAssigneePage, updateOrder } from '../../api/orders'
import { loadProductPage } from '../../api/products'
import OrderAssigneeIdentity from './OrderAssigneeIdentity.vue'
import OrderItemsCard from './OrderItemsCard.vue'
import OrderLineFields from './OrderLineFields.vue'
import OrderLookupField from './OrderLookupField.vue'
import { useOrderCreation } from '../../composables/useOrderCreation'
import { isOrderEditable, ORDER_PRIORITY, ORDER_STATUS } from '../../constants/orders'
import { useAuthStore } from '../../stores/auth'
import { formatOrderAssigneeSubtitle, formatOrderDate } from '../../utils/orderDisplay'
import {
  changedOrderFields,
  createOrderDraft,
  createOrderLine,
  MAX_ORDER_ITEMS,
  MAX_ORDER_NOTE_LENGTH,
  orderEditConflicts,
  orderFieldStep,
  reapplyOrderChanges,
  usesOrderTaxSetting,
  validateOrderDraft,
} from '../../utils/orderDraft'

const props = defineProps({
  order: { type: Object, default: null },
})
const router = useRouter()
const auth = useAuthStore()
const heading = useTemplateRef('heading')
const stepHeading = useTemplateRef('step-heading')
const recoveryAlert = useTemplateRef('recovery-alert')
const steps = ['Customer', 'Line items', 'Order details', 'Review']
const reviewStep = steps.length - 1
const step = ref(0)
const fieldErrors = ref({})
const submitMessage = ref('')
const canRetrySave = ref(true)
const baseline = shallowRef(props.order)
const isEditing = computed(() => baseline.value !== null)
const editPending = ref(false)
const recoveryMessage = ref('')
const latestOrder = shallowRef(null)
const reloading = ref(false)
const reloadError = ref('')
const controller = new AbortController()
const { pricing, pricingPending, savePending, attempt, savedOrder, preview, clearPricing, save } =
  useOrderCreation({ request: auth.request, signal: controller.signal })

const canUseForm = computed(
  () => isEditing.value || (auth.canViewCustomers && auth.canViewProducts),
)
const busy = computed(() => savePending.value || editPending.value)
const detailRoute = computed(() =>
  baseline.value
    ? { name: 'order-detail', params: { orderId: baseline.value.id } }
    : { name: 'orders' },
)
const draft = reactive(createOrderDraft(baseline.value))
const savedOrderTaxRate = computed(() => baseline.value?.order_tax_rate_basis_points ?? null)
const lineTaxEnabled = computed(
  () => auth.canEditOrders && !usesOrderTaxSetting(draft, savedOrderTaxRate.value),
)
const orderTaxHint = computed(() => {
  if (draft.orderTaxRate.trim()) return 'Applies to the order total after discounts.'
  if (savedOrderTaxRate.value !== null) {
    return 'Save the blank rate to restore saved item rates. Item overrides can be edited after saving.'
  }
  return 'Leave blank to use item tax rates.'
})
const savedTaxRates = computed(
  () => new Map(baseline.value?.items.map((line) => [line.product_id, line.tax_rate_basis_points])),
)
let nextLineKey = draft.items.length + 1

const changes = computed(() =>
  baseline.value ? changedOrderFields(baseline.value, readDraft().body) : {},
)
const hasChanges = computed(() => Object.keys(changes.value).length > 0)
const conflictingFields = computed(() =>
  latestOrder.value ? orderEditConflicts(baseline.value, latestOrder.value, changes.value) : [],
)
const latestEditable = computed(() => isOrderEditable(latestOrder.value?.status))
const fieldLabels = {
  customer_id: 'Customer',
  items: 'Line items',
  order_discount_minor: 'Order discount',
  order_tax_rate_basis_points: 'Order tax rate',
  order_date: 'Order date',
  priority: 'Priority',
}

const priorityOptions = Object.entries(ORDER_PRIORITY).map(([value, title]) => ({ value, title }))
const name = (item) => item.name
const customerSubtitle = (item) => item.email ?? item.phone
const customerPage = (query, signal) =>
  loadCustomerPage(auth.request, { ...query, isActive: true }, signal)
const productPage = (query, signal) =>
  loadProductPage(auth.request, { ...query, isActive: true }, signal)
const assigneePage = (query, signal) => loadOrderAssigneePage(auth.request, query, signal)

function readDraft() {
  return validateOrderDraft(draft, {
    allowTaxOverride: auth.canEditOrders,
    savedOrderTaxRate: savedOrderTaxRate.value,
  })
}

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
    tax: errorsFor(path + '.tax_rate_basis_points'),
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
  const { fields, body } = readDraft()
  if (Object.keys(fields).length) {
    await showValidation(fields)
    return
  }

  await goToStep(reviewStep)
  try {
    await preview({
      ...body,
      ...(isEditing.value && { order_id: baseline.value.id }),
    })
  } catch (error) {
    await showError(error, 'Unable to calculate pricing. Try again.')
  }
}

async function advance() {
  submitMessage.value = ''
  const { fields } = readDraft()
  const current = Object.fromEntries(
    Object.entries(fields).filter(([field]) => orderFieldStep(field) === step.value),
  )
  fieldErrors.value = current
  if (Object.keys(current).length) return
  if (step.value === reviewStep - 1) await reviewPricing()
  else await goToStep(step.value + 1)
}

function previousStep() {
  if (busy.value || recoveryMessage.value) return

  clearPricing()
  fieldErrors.value = {}
  submitMessage.value = ''
  void goToStep(step.value - 1)
}

async function submitDraft() {
  submitMessage.value = ''
  const { fields, body } = readDraft()
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

async function submitEdit() {
  submitMessage.value = ''
  if (!hasChanges.value || recoveryMessage.value) return

  const original = baseline.value
  editPending.value = true
  let updated
  try {
    updated = await updateOrder(
      auth.request,
      original.id,
      {
        expected_version: original.version,
        ...changes.value,
      },
      controller.signal,
    )
  } catch (error) {
    if (controller.signal.aborted) return
    if (error.status === 409 && error.code === 'ORDER_VERSION_CONFLICT') {
      recoveryMessage.value =
        'This order changed while you were editing. Review the latest order before saving.'
    } else if ([0, 404].includes(error.status) || error.status >= 500 || error.fields?.status) {
      recoveryMessage.value =
        'The save could not be confirmed. Review the latest order before trying again.'
    } else {
      await showError(error, 'Unable to save changes. Try again.')
    }
  } finally {
    editPending.value = false
    if (recoveryMessage.value) {
      await nextTick()
      recoveryAlert.value?.$el?.focus()
    }
  }

  if (updated && !controller.signal.aborted) {
    await router.replace({ name: 'order-detail', params: { orderId: updated.id } })
  }
}

async function reviewLatest() {
  if (reloading.value) return
  reloading.value = true
  reloadError.value = ''
  try {
    latestOrder.value = await loadOrder(auth.request, baseline.value.id, controller.signal)
  } catch (error) {
    if (!controller.signal.aborted && error.status !== 401) {
      reloadError.value =
        error.status === 404
          ? 'This order is no longer available.'
          : failureMessage(error, 'Unable to load the latest order. Try again.')
    }
  } finally {
    reloading.value = false
  }
}

async function useLatest(keepChanges) {
  if (!latestEditable.value || (keepChanges && conflictingFields.value.length)) return

  const latest = latestOrder.value
  const next = keepChanges
    ? reapplyOrderChanges(latest, draft, changes.value)
    : createOrderDraft(latest)
  Object.assign(draft, next)
  nextLineKey = Math.max(0, ...draft.items.map(({ key }) => key)) + 1
  baseline.value = latest
  latestOrder.value = null
  recoveryMessage.value = ''
  reloadError.value = ''
  fieldErrors.value = {}
  clearPricing()
  if (keepChanges) await reviewPricing()
  else await goToStep(0)
}

function submitStep() {
  if (
    !canUseForm.value ||
    pricingPending.value ||
    busy.value ||
    savedOrder.value ||
    recoveryMessage.value
  )
    return
  if (step.value < reviewStep) return advance()
  if (attempt.value && !canRetrySave.value) return
  if (!pricing.value && !attempt.value) return reviewPricing()
  return isEditing.value ? submitEdit() : submitDraft()
}

onMounted(() => heading.value?.focus({ preventScroll: true }))
const canNavigate = () => !busy.value || !auth.isAuthenticated
onBeforeRouteLeave(canNavigate)
onBeforeRouteUpdate(canNavigate)
onScopeDispose(() => controller.abort())
</script>

<template>
  <section
    v-if="isEditing ? auth.canEditOrders : auth.canCreateOrders"
    class="order-form"
    aria-labelledby="order-form-heading"
  >
    <header class="create-header">
      <VBtn
        :to="detailRoute"
        :prepend-icon="aliases.prev"
        :disabled="busy"
        variant="text"
        color="primary"
        class="create-back text-none"
      >
        {{ isEditing ? 'Back to order' : 'Back to orders' }}
      </VBtn>
      <h1 id="order-form-heading" ref="heading" tabindex="-1">
        {{ isEditing ? 'Edit order' : 'Create order' }}
      </h1>
      <p v-if="isEditing" class="order-reference">{{ baseline.order_number }}</p>
    </header>

    <VAlert v-if="!canUseForm" type="warning" variant="tonal" :icon="false" role="alert">
      Customer and product view permissions are required to choose catalog records.
    </VAlert>

    <template v-else>
      <ol class="create-steps" aria-label="Order form steps" role="list">
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
        <VAlert
          v-if="recoveryMessage"
          ref="recovery-alert"
          class="order-recovery"
          tabindex="-1"
          type="warning"
          variant="tonal"
          :icon="false"
          role="alert"
        >
          <p class="recovery-text">{{ recoveryMessage }}</p>
          <p v-if="reloadError" class="recovery-text">{{ reloadError }}</p>
          <template v-if="latestOrder">
            <p v-if="!latestEditable" class="recovery-text">
              The latest order is {{ ORDER_STATUS[latestOrder.status] }}. Return to order details.
            </p>
            <p v-else-if="conflictingFields.length" class="recovery-text">
              Both versions changed
              {{ conflictingFields.map((field) => fieldLabels[field]).join(', ') }}. Your draft is
              still shown below. Start from the latest order to enter those changes again.
            </p>
            <p v-else class="recovery-text">
              You can keep your changes on the latest order and review pricing before saving again.
            </p>
          </template>
          <div class="recovery-actions">
            <VBtn
              v-if="!latestOrder"
              type="button"
              variant="outlined"
              color="primary"
              :loading="reloading"
              :disabled="reloading"
              class="text-none"
              @click="reviewLatest"
            >
              Review latest order
            </VBtn>
            <VBtn
              v-if="latestEditable"
              color="primary"
              type="button"
              variant="outlined"
              class="text-none"
              @click="useLatest(false)"
            >
              Use latest order
            </VBtn>
            <VBtn
              v-if="latestEditable && !conflictingFields.length"
              type="button"
              color="primary"
              variant="flat"
              class="text-none"
              @click="useLatest(true)"
            >
              Keep my changes
            </VBtn>
          </div>
        </VAlert>
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
              :disabled="!auth.canViewCustomers"
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
              v-model:tax-rate="line.taxRate"
              :position="index + 1"
              :errors="lineErrors(index)"
              :load-page="productPage"
              :product-disabled="!auth.canViewProducts"
              :tax-enabled="lineTaxEnabled"
              :saved-tax-rate="savedTaxRates.get(line.product?.id) ?? null"
              :removable="draft.items.length > 1"
              @update:product="clearLineError(index, 'product_id')"
              @update:quantity="clearLineError(index, 'quantity')"
              @update:discount="clearLineError(index, 'item_discount_minor')"
              @update:tax-rate="clearLineError(index, 'tax_rate_basis_points')"
              @remove="removeLine(index)"
            />
            <VBtn
              type="button"
              variant="outlined"
              color="primary"
              class="step-add text-none"
              :disabled="!auth.canViewProducts || draft.items.length >= MAX_ORDER_ITEMS"
              @click="addLine"
            >
              Add item
            </VBtn>
            <VTextField
              v-if="auth.canEditOrders"
              v-model="draft.orderTaxRate"
              label="Order tax rate (%)"
              inputmode="decimal"
              variant="outlined"
              density="comfortable"
              :hint="orderTaxHint"
              persistent-hint
              hide-details="auto"
              :error-messages="errorsFor('order_tax_rate_basis_points')"
              @update:model-value="clearFieldError('order_tax_rate_basis_points')"
              class="step-discount"
            />
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
              v-if="!isEditing && auth.canAssignOrders"
              v-model="draft.assignee"
              label="Assignee (optional)"
              resource="assignees"
              :load-page="assigneePage"
              :item-title="name"
              :item-subtitle="formatOrderAssigneeSubtitle"
              show-item-details
              :error-messages="errorsFor('assignee_id')"
              @update:model-value="clearFieldError('assignee_id')"
            />
            <VTextarea
              v-if="!isEditing && auth.canAddOrderNote"
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
                <dd>
                  <OrderAssigneeIdentity
                    :assignee="isEditing ? baseline.assignee : draft.assignee"
                    :show-details="auth.canAssignOrders"
                  />
                </dd>
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
              {{
                isEditing
                  ? 'Prices and taxes are recalculated when changes are saved.'
                  : 'Prices and taxes are recalculated when the draft is saved.'
              }}
            </p>
            <p v-if="isEditing && !hasChanges && !recoveryMessage" class="field-hint">
              No changes to save.
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
            v-if="step > 0 && !attempt && !savedOrder && !recoveryMessage"
            :disabled="busy"
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
            :disabled="
              pricingPending ||
              busy ||
              !!recoveryMessage ||
              (!!attempt && !canRetrySave) ||
              (isEditing && step === reviewStep && !!pricing && !hasChanges)
            "
            :loading="busy"
          >
            {{
              step < reviewStep
                ? 'Continue'
                : attempt
                  ? 'Retry save'
                  : pricing
                    ? isEditing
                      ? 'Save changes'
                      : 'Create draft'
                    : 'Review prices'
            }}
          </VBtn>
        </div>
      </form>
    </template>
  </section>
</template>

<style scoped>
.order-form {
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

.order-reference {
  margin: 5px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.77);
}

.order-recovery:focus {
  outline: none;
}

.recovery-text {
  margin: 0 0 8px;
  color: rgb(var(--v-theme-on-surface));
}

.recovery-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
