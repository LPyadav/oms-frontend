<script setup>
import { computed, onMounted, onScopeDispose, ref, shallowRef, useTemplateRef } from 'vue'
import { VBtn } from 'vuetify/components/VBtn'
import { VCard } from 'vuetify/components/VCard'
import { VDialog } from 'vuetify/components/VDialog'
import { loadAccessAuditLog } from '../../api/accessAudit'
import DirectoryState from '../directory/DirectoryState.vue'
import { useAuthStore } from '../../stores/auth'
import { formatAccessAuditAction, formatAccessAuditTime } from '../../utils/accessAudit'
import { formatAuditActor } from '../../utils/auditActor'

const props = defineProps({ id: { type: Number, required: true } })
const emit = defineEmits(['close'])
const auth = useAuthStore()
const heading = useTemplateRef('heading')
const requests = new AbortController()
const log = shallowRef(null)
const error = shallowRef(null)
const loading = ref(false)
const snapshotLabels = {
  name: 'Name',
  is_active: 'Account status',
  roles: 'Roles',
  permissions: 'Role permissions',
  direct_permissions: 'Direct permissions',
}

function makeSnapshot(title, snapshot) {
  const fields = Object.entries(snapshotLabels)
    .filter(([key]) => snapshot && Object.hasOwn(snapshot, key))
    .map(([key, label]) => ({ key, label, value: snapshot[key] }))
  return { title, recorded: snapshot !== null, fields }
}

const snapshots = computed(() =>
  log.value
    ? [
        makeSnapshot('Before', log.value.before_values),
        makeSnapshot('After', log.value.after_values),
      ]
    : [],
)
const unavailable = computed(() => [403, 404].includes(error.value?.status))

async function loadLog() {
  if (loading.value || requests.signal.aborted) return

  loading.value = true
  error.value = null
  try {
    const result = await loadAccessAuditLog(auth.request, props.id, requests.signal)
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
    aria-labelledby="audit-record-heading"
    @update:model-value="!$event && emit('close')"
    @after-enter="heading?.focus({ preventScroll: true })"
  >
    <VCard class="audit-dialog" rounded="xl">
      <header class="dialog-header">
        <h2 id="audit-record-heading" ref="heading" tabindex="-1">Audit record #{{ id }}</h2>
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
              <dd>{{ formatAccessAuditAction(log.action) }}</dd>
            </div>
            <div>
              <dt>Actor</dt>
              <dd>{{ formatAuditActor(log) }}</dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd>{{ log.target_type === 'user' ? 'User' : 'Role' }} #{{ log.target_id }}</dd>
            </div>
            <div>
              <dt>Occurred</dt>
              <dd>
                <time :datetime="log.created_at">{{ formatAccessAuditTime(log.created_at) }}</time>
              </dd>
            </div>
          </dl>

          <div class="record-snapshots">
            <section v-for="snapshot in snapshots" :key="snapshot.title" class="snapshot">
              <h3>{{ snapshot.title }}</h3>
              <p v-if="!snapshot.fields.length">
                {{ snapshot.recorded ? 'No tracked values.' : 'No snapshot recorded.' }}
              </p>
              <dl v-else>
                <div v-for="field in snapshot.fields" :key="field.key">
                  <dt>{{ field.label }}</dt>
                  <dd v-if="Array.isArray(field.value)">
                    <ul v-if="field.value.length">
                      <li v-for="value in field.value" :key="value">{{ value }}</li>
                    </ul>
                    <span v-else>None</span>
                  </dd>
                  <dd v-else-if="field.key === 'is_active'">
                    {{ field.value ? 'Active' : 'Disabled' }}
                  </dd>
                  <dd v-else>{{ field.value }}</dd>
                </div>
              </dl>
            </section>
          </div>
        </template>
      </div>
    </VCard>
  </VDialog>
</template>

<style scoped>
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.dialog-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.dialog-body {
  max-height: 68vh;
  overflow: auto;
  padding: 20px;
}

.record-meta,
.record-snapshots {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.record-meta {
  margin: 0 0 20px;
}

.snapshot {
  padding: 14px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 12px;
  background: rgb(var(--v-theme-background));
}

.snapshot h3 {
  margin: 0 0 10px;
}

.snapshot :is(dl, p) {
  margin: 0;
}

.snapshot dl > div + div {
  margin-top: 10px;
}

dt {
  color: rgba(var(--v-theme-on-surface), 0.74);
  font-size: 0.82rem;
}

dd {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
}

dd ul {
  margin: 0;
  padding-inline-start: 18px;
}

.dialog-header h2:focus {
  outline: none;
}

@media (max-width: 560px) {
  .record-meta,
  .record-snapshots {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
