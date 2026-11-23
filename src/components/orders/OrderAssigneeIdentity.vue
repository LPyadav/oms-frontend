<script setup>
import { computed } from 'vue'
import { formatOrderAssigneeSubtitle } from '../../utils/orderDisplay'

const props = defineProps({
  assignee: { type: Object, default: null },
  showDetails: Boolean,
})

const details = computed(() =>
  props.showDetails && props.assignee ? formatOrderAssigneeSubtitle(props.assignee) : undefined,
)
</script>

<template>
  <span class="assignee-identity">
    <span>{{ assignee?.name ?? 'Unassigned' }}</span>
    <span v-if="details" class="assignee-details">{{ details }}</span>
  </span>
</template>

<style scoped>
.assignee-identity {
  display: grid;
  min-inline-size: 0;
  max-inline-size: 100%;
  gap: 2px;
  overflow-wrap: anywhere;
}

.assignee-details {
  color: rgba(var(--v-theme-on-surface), 0.77);
  font-size: 0.8125rem;
  font-weight: 400;
}
</style>
