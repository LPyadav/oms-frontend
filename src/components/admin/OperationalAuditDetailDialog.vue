<script setup>
import { computed, onMounted, onScopeDispose, ref, shallowRef, useTemplateRef } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VDialog } from 'vuetify/components/VDialog'
import { loadOperationalAuditLog } from '../../api/operationalAudit'
import { useAuthStore } from '../../stores/auth'
import {
  formatOperationalAuditAction,
  formatOperationalAuditTime,
  operationalAuditChanges,
} from '../../utils/operationalAudit'
import DirectoryState from '../directory/DirectoryState.vue'
import OperationalAuditValue from './OperationalAuditValue.vue'

const props = defineProps({ id: { type: Number, required: true } })
const emit = defineEmits(['close'])
const auth = useAuthStore()
const heading = useTemplateRef('heading')
const requests = new AbortController()
const log = shallowRef(null)
const error = shallowRef(null)
const loading = ref(false)

const changes = computed(() =>
  log.value ? operationalAuditChanges(log.value.before_values, log.value.after_values) : [],
)
const unavailable = computed(() => [403, 404].includes(error.value?.status))

async function loadLog() {
  if (loading.value || requests.signal.aborted) return

  loading.value = true
  error.value = null
  try {
    const result = await loadOperationalAuditLog(auth.request, props.id, requests.signal)
    if (!requests.signal.aborted) log.value = result
  } catch (failure) {
    if (!requests.signal.aborted && failure?.status !== 401) error.value = failure
  } finally {
    loading.value = false
  }
}

onMounted(loadLog)
onScopeDispose(() => requests.abort())
</script>

<template>
  <VDialog
    :model-value="true"
    max-width="760"
    aria-labelledby="operational-audit-detail-title"
    @update:model-value="!$event && emit('close')"
    @after-enter="heading?.focus({ preventScroll: true })"
  >
    <VCard rounded="lg">
      <header class="dialog-header">
        <h2 id="operational-audit-detail-title" ref="heading" tabindex="-1">
          Audit record #{{ id }}
        </h2>
        <VBtn type="button" variant="text" class="text-none" @click="emit('close')">Close</VBtn>
      </header>
      <div class="dialog-body">
        <DirectoryState v-if="loading" kind="loading" message="Loading audit record…" />
        <DirectoryState
          v-else-if="error"
          kind="error"
          :message="
            unavailable ? 'This audit record is unavailable.' : 'Unable to load this audit record.'
          "
        >
          <template #actions>
            <VBtn
              v-if="!unavailable"
              type="button"
              variant="outlined"
              class="text-none"
              @click="loadLog"
            >
              Try again
            </VBtn>
          </template>
        </DirectoryState>
        <template v-else-if="log">
          <dl class="record-meta">
            <div>
              <dt>Action</dt>
              <dd>{{ formatOperationalAuditAction(log.action) }}</dd>
            </div>
            <div>
              <dt>Actor</dt>
              <dd>{{ log.actor_name ?? 'User' }} #{{ log.actor_id }}</dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd class="target">{{ log.target_type }} #{{ log.target_id }}</dd>
            </div>
            <div>
              <dt>Occurred</dt>
              <dd>
                <time :datetime="log.created_at">{{
                  formatOperationalAuditTime(log.created_at)
                }}</time>
              </dd>
            </div>
          </dl>

          <section aria-labelledby="operational-audit-changes-title">
            <h3 id="operational-audit-changes-title">Recorded changes</h3>
            <p v-if="!changes.length">No changed values are available for this record.</p>
            <dl v-else class="changes">
              <div v-for="field in changes" :key="field.key" class="change-row">
                <dt>{{ field.label }}</dt>
                <dd>
                  <span class="value-label">Before</span>
                  <OperationalAuditValue :value="field.before" />
                </dd>
                <dd>
                  <span class="value-label">After</span>
                  <OperationalAuditValue :value="field.after" />
                </dd>
              </div>
            </dl>
          </section>
        </template>
      </div>
    </VCard>
  </VDialog>
</template>

<style scoped>
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.dialog-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.dialog-header h2:focus {
  outline: none;
}

.dialog-body {
  max-height: min(70dvh, 720px);
  overflow: auto;
  padding: 20px;
}

.record-meta,
.change-row {
  display: grid;
  gap: 12px 20px;
}

.record-meta {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0 0 20px;
}

.record-meta dt,
.value-label {
  color: rgba(var(--v-theme-on-surface), 0.72);
  font-size: 0.8rem;
}

.value-label {
  display: block;
  margin-bottom: 2px;
}

.target {
  text-transform: capitalize;
}

.changes {
  margin-top: 8px;
}

.change-row {
  grid-template-columns: minmax(0, 1fr) repeat(2, minmax(0, 1.4fr));
  padding: 10px 0;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.change-row dt {
  font-weight: 600;
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
}

@media (max-width: 600px) {
  .change-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .change-row dt {
    grid-column: 1 / -1;
  }
}
</style>
