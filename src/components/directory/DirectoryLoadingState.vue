<script setup>
import { VSkeletonLoader } from 'vuetify/components/VSkeletonLoader'
import { DIRECTORY_PAGE_SIZE } from '../../constants/pagination'

defineProps({
  message: { type: String, required: true },
  layout: { type: String, default: 'table' },
})

const skeletonTypes = {
  table: `table-thead, table-row-divider@${DIRECTORY_PAGE_SIZE}`,
  list: `list-item@${DIRECTORY_PAGE_SIZE}`,
  'list-two-line': `list-item-two-line@${DIRECTORY_PAGE_SIZE}`,
}
</script>

<template>
  <div class="directory-loading" role="status">
    <span class="d-sr-only">{{ message }}</span>
    <VSkeletonLoader :type="skeletonTypes[layout]" aria-hidden="true" />
  </div>
</template>
