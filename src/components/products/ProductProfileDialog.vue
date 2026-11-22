<script setup>
import { computed, onMounted, onScopeDispose, ref, useTemplateRef, watch } from 'vue'
import { VAlert } from 'vuetify/components/VAlert'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VChip } from 'vuetify/components/VChip'
import { VDialog } from 'vuetify/components/VDialog'
import { VProgressLinear } from 'vuetify/components/VProgressLinear'
import { VTextField } from 'vuetify/components/VTextField'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { useProductProfile } from '../../composables/useProductProfile'
import { useAuthStore } from '../../stores/auth'

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

const titles = { create: 'New product', edit: 'Edit product', deactivate: 'Deactivate product' }
const submitLabels = { create: 'Create product', edit: 'Save changes', deactivate: 'Deactivate' }
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
  if (!saving.value) emit('close')
}

async function submit() {
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
    :persistent="saving"
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
            :disabled="saving"
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
            <VAlert v-if="writeError" type="error" variant="tonal" :icon="false" role="alert">
              {{
                failureMessage(
                  writeError,
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
                  <dd>{{ product.stock_quantity }}</dd>
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
            :disabled="saving"
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
            :loading="saving"
            :disabled="!canSubmit"
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
