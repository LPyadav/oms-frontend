<script setup>
import { computed, nextTick, onMounted, onScopeDispose, ref, useTemplateRef, watch } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VChip } from 'vuetify/components/VChip'
import { VDialog } from 'vuetify/components/VDialog'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'
import { VTextField } from 'vuetify/components/VTextField'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { useProductProfile } from '../../composables/useProductProfile'
import { useStockAdjustment } from '../../composables/useStockAdjustment'
import { useAuthStore } from '../../stores/auth'
import ProductStockAdjustmentFields from './ProductStockAdjustmentFields.vue'

const props = defineProps({
  productId: { type: Number, default: null },
})
const emit = defineEmits(['close', 'changed'])
const auth = useAuthStore()
const heading = useTemplateRef('heading')
const requests = new AbortController()
const notice = ref('')
const {
  mode,
  product,
  draft,
  loading,
  saving,
  readError,
  writeError,
  canSubmit,
  load,
  openEdit,
  openDeactivation,
  showProfile,
  save,
} = useProductProfile({
  request: auth.request,
  productId: props.productId,
  canManage: () => auth.canManageProducts,
  signal: requests.signal,
})

const {
  countedQuantity,
  reason,
  saving: savingStock,
  reloading: reloadingStock,
  error: stockError,
  reloadError,
  reloadReason,
  reloaded,
  matchesCurrent,
  quantityMessages,
  reasonMessages,
  canSubmit: canSubmitStock,
  reset: resetStock,
  save: saveStock,
  reload: reloadStock,
} = useStockAdjustment({
  request: auth.request,
  product,
  canManage: () => auth.canManageProducts,
  signal: requests.signal,
})
const stockAdjustment = useTemplateRef('stockAdjustment')
const busy = computed(() => saving.value || savingStock.value || reloadingStock.value)
const activeError = computed(() => (mode.value === 'stock' ? stockError.value : writeError.value))
const canSave = computed(() => (mode.value === 'stock' ? canSubmitStock.value : canSubmit.value))

const titles = {
  stock: 'Adjust stock',
  create: 'New product',
  edit: 'Edit product',
  deactivate: 'Deactivate product',
}
const submitLabels = {
  stock: 'Save adjustment',
  create: 'Create product',
  edit: 'Save changes',
  deactivate: 'Deactivate',
}
const fields = [
  { key: 'name', label: 'Product name', maxLength: 255, wide: true },
  { key: 'sku', label: 'SKU', maxLength: 64, wide: true },
  { key: 'price', label: 'Unit price', maxLength: 13, inputmode: 'decimal' },
  { key: 'tax_rate', label: 'Tax rate', maxLength: 6, inputmode: 'decimal', suffix: '%' },
]
const savedNotices = {
  create: 'Product created.',
  edit: 'Product updated.',
  deactivate: 'Product deactivated.',
}
const title = computed(() => titles[mode.value] ?? product.value?.name ?? 'Product profile')
const editing = computed(() => mode.value === 'create' || mode.value === 'edit')
const fieldErrors = computed(() => writeError.value?.fields ?? {})
const stockReloadErrorMessage = computed(() =>
  reloadError.value
    ? failureMessage(reloadError.value, 'Unable to reload current stock. Try again.')
    : '',
)

function failureMessage(failure, fallback) {
  if (failure.status === 403) return 'You no longer have access to perform this action.'
  if (failure.status === 404) return 'This product could not be found.'
  if (failure.status === 409 && failure.fields?.sku?.length) {
    return 'This SKU is already in use. Enter a different SKU.'
  }
  if (failure.status === 422) return 'Check the highlighted fields and try again.'
  if (failure.status === 429) return 'Too many requests. Try again shortly.'
  if (failure.code === 'WRITE_CONTENTION') {
    const seconds = Number(failure.retryAfter)
    return seconds > 0
      ? `The service is busy. Try again in ${seconds} seconds.`
      : 'The service is busy. Try again shortly.'
  }
  return fallback
}

function focusHeading() {
  heading.value?.focus({ preventScroll: true })
}

function close() {
  if (!busy.value) emit('close')
}

function openStockAdjustment() {
  if (mode.value !== 'profile' || !product.value || !auth.canManageProducts || busy.value) return
  resetStock()
  mode.value = 'stock'
}

async function reloadCurrentStock() {
  if (!(await reloadStock())) return
  emit('changed')
  await nextTick()
  focusHeading()
}

async function submitStock() {
  if (await saveStock()) {
    showProfile()
    notice.value = 'Stock adjusted.'
    emit('changed')
    return
  }

  if (reloadReason.value) {
    await nextTick()
    stockAdjustment.value?.focusReloadButton()
  }
}

async function submit() {
  if (mode.value === 'stock') return submitStock()

  const operation = mode.value
  const saved = await save()
  if (!saved) return
  notice.value = savedNotices[operation]
  emit('changed')
}

watch(mode, focusHeading, { flush: 'post' })
onMounted(() => void load())
onScopeDispose(() => requests.abort())
</script>

<template>
  <VDialog
    :model-value="true"
    :persistent="busy"
    max-width="608"
    aria-labelledby="product-profile-title"
    @update:model-value="(open) => !open && close()"
    @after-enter="focusHeading"
  >
    <VCard color="surface" rounded="lg">
      <form class="product-dialog" novalidate @submit.prevent="submit">
        <header class="product-dialog-header">
          <h2 id="product-profile-title" ref="heading" tabindex="-1">{{ title }}</h2>
          <VBtn
            :icon="aliases.close"
            aria-label="Close dialog"
            type="button"
            variant="text"
            size="small"
            :disabled="busy"
            @click="close"
          />
        </header>

        <div class="product-dialog-body">
          <div v-if="loading" class="product-dialog-state" role="status">
            <VProgressLinear color="primary" indeterminate aria-hidden="true" />
            <span>Loading product…</span>
          </div>
          <div v-else-if="readError" class="product-dialog-state">
            <VAlert type="error" variant="tonal" :icon="false" role="alert">
              {{ failureMessage(readError, 'Unable to load this product.') }}
            </VAlert>
            <VBtn
              v-if="![403, 404].includes(readError.status)"
              type="button"
              variant="outlined"
              class="text-none"
              @click="load"
            >
              Try again
            </VBtn>
          </div>
          <template v-else>
            <VAlert v-if="activeError" type="error" variant="tonal" :icon="false" role="alert">
              {{
                failureMessage(
                  activeError,
                  'Could not confirm the change. Check the directory before retrying.',
                )
              }}
            </VAlert>
            <div v-if="editing" class="product-dialog-fields">
              <VTextField
                v-for="field in fields"
                :key="field.key"
                v-model="draft[field.key]"
                :class="{ 'product-detail-wide': field.wide }"
                :label="field.label"
                :maxlength="field.maxLength"
                :inputmode="field.inputmode"
                :suffix="field.suffix"
                :required="field.key !== 'tax_rate' || mode === 'edit'"
                :hint="
                  field.key === 'tax_rate' && mode === 'create' ? 'Defaults to 0%.' : undefined
                "
                :persistent-hint="field.key === 'tax_rate' && mode === 'create'"
                :disabled="saving"
                :error-messages="fieldErrors[field.key] ?? []"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
              />
            </div>
            <ProductStockAdjustmentFields
              v-else-if="mode === 'stock'"
              ref="stockAdjustment"
              v-model:counted-quantity="countedQuantity"
              v-model:reason="reason"
              :product="product"
              :busy="busy"
              :reloading="reloadingStock"
              :reload-reason="reloadReason"
              :reload-error-message="stockReloadErrorMessage"
              :reloaded="reloaded"
              :matches-current="matchesCurrent"
              :quantity-messages="quantityMessages"
              :reason-messages="reasonMessages"
              @reload="reloadCurrentStock"
            />
            <p v-else-if="mode === 'deactivate'">
              Deactivate <strong>{{ product.name }}</strong>? The product will appear as Inactive in
              the directory and its stock balance will be preserved.
            </p>
            <template v-else-if="product">
              <VAlert v-if="notice" color="primary" variant="tonal" :icon="false" role="status">
                {{ notice }}
              </VAlert>
              <dl class="product-dialog-fields product-profile">
                <div>
                  <dt>SKU</dt>
                  <dd>{{ product.sku }}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <VChip
                      :color="product.is_active ? 'primary' : undefined"
                      size="small"
                      variant="tonal"
                      label
                    >
                      {{ product.is_active ? 'Active' : 'Inactive' }}
                    </VChip>
                  </dd>
                </div>
                <div>
                  <dt>Unit price</dt>
                  <dd>{{ product.price }}</dd>
                </div>
                <div>
                  <dt>Tax rate</dt>
                  <dd>{{ product.tax_rate }}%</dd>
                </div>
                <div class="product-detail-wide">
                  <dt>Stock</dt>
                  <dd class="product-stock-balance">
                    <span>{{ product.stock_quantity }}</span>
                    <VBtn
                      v-if="auth.canManageProducts"
                      type="button"
                      color="primary"
                      variant="outlined"
                      size="small"
                      class="text-none"
                      @click="openStockAdjustment"
                    >
                      Adjust stock
                    </VBtn>
                  </dd>
                </div>
              </dl>
            </template>
          </template>
        </div>

        <footer class="product-dialog-footer">
          <VBtn
            type="button"
            variant="text"
            class="text-none"
            :disabled="busy"
            @click="mode === 'create' || mode === 'profile' ? close() : showProfile()"
          >
            {{ mode === 'profile' ? 'Close' : 'Cancel' }}
          </VBtn>
          <template v-if="mode === 'profile'">
            <template v-if="product && auth.canManageProducts">
              <VBtn
                v-if="product.is_active"
                type="button"
                color="error"
                variant="text"
                class="text-none"
                @click="openDeactivation"
              >
                Deactivate
              </VBtn>
              <VBtn
                type="button"
                color="primary"
                variant="flat"
                class="text-none"
                @click="openEdit"
              >
                Edit product
              </VBtn>
            </template>
          </template>
          <VBtn
            v-else
            type="submit"
            :color="mode === 'deactivate' ? 'error' : 'primary'"
            variant="flat"
            class="text-none"
            :loading="saving || savingStock"
            :disabled="!canSave"
          >
            {{ submitLabels[mode] }}
          </VBtn>
        </footer>
      </form>
    </VCard>
  </VDialog>
</template>

<style scoped>
.product-dialog {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  max-block-size: min(42rem, calc(100dvh - 48px));
}

.product-dialog-header,
.product-dialog-footer {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  padding: 14px 20px;
}

.product-dialog-header {
  justify-content: space-between;
  flex-wrap: nowrap;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.product-dialog-header h2 {
  min-inline-size: 0;
  margin: 0;
  font-size: 1.25rem;
  overflow-wrap: anywhere;
}

.product-dialog-header h2:focus {
  outline: none;
}

.product-dialog-body {
  display: grid;
  gap: 16px;
  align-content: start;
  padding: 16px 20px;
  overflow-y: auto;
  overscroll-behavior-y: contain;
}

.product-dialog-body p {
  margin: 0;
  overflow-wrap: anywhere;
}

.product-dialog-state {
  display: grid;
  gap: 12px;
  justify-items: start;
}

.product-dialog-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.product-detail-wide {
  grid-column: 1 / -1;
}

.product-profile {
  margin: 0;
}

.product-profile dt {
  margin-bottom: 3px;
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
  font-weight: 500;
}

.product-profile dd {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.product-stock-balance {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.product-dialog-footer {
  justify-content: flex-end;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

@media (max-width: 500px) {
  .product-dialog-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
