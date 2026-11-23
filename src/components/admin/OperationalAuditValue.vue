<script setup>
import { operationalAuditItemFields } from '../../utils/operationalAudit'

defineProps({ value: { type: [String, Number, Boolean, Array, null], default: undefined } })
</script>

<template>
  <details v-if="Array.isArray(value) && value.length" class="audit-items">
    <summary>{{ value.length }} {{ value.length === 1 ? 'item' : 'items' }}</summary>
    <ol>
      <li v-for="(item, index) in value" :key="index">
        <strong>{{ item.product_name ?? 'Item ' + (index + 1) }}</strong>
        <dl>
          <template v-for="(label, key) in operationalAuditItemFields" :key="key">
            <div v-if="Object.hasOwn(item, key)">
              <dt>{{ label }}</dt>
              <dd>{{ item[key] ?? 'Empty' }}</dd>
            </div>
          </template>
        </dl>
      </li>
    </ol>
  </details>
  <span v-else-if="Array.isArray(value)">No items</span>
  <span v-else-if="value === undefined" class="muted">—</span>
  <span v-else-if="value === null" class="muted">Empty</span>
  <span v-else-if="value === '[redacted]'" class="muted">Redacted</span>
  <span v-else-if="typeof value === 'boolean'">{{ value ? 'Yes' : 'No' }}</span>
  <span v-else>{{ value }}</span>
</template>

<style scoped>
.audit-items summary {
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
}

.audit-items ol {
  padding-inline-start: 20px;
}

.audit-items li {
  margin-block: 8px;
}

.audit-items dl {
  display: grid;
  gap: 4px;
  margin-top: 6px;
}

.audit-items dl div {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.audit-items dd {
  margin: 0;
}

.audit-items dt,
.muted {
  color: rgba(var(--v-theme-on-surface), 0.72);
}
</style>
