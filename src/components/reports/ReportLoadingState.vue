<script setup>
import { VSkeletonLoader } from 'vuetify/components/VSkeletonLoader'
import { DIRECTORY_PAGE_SIZE } from '../../constants/pagination'

const skeletonType = `table-thead, table-row-divider@${DIRECTORY_PAGE_SIZE}`
</script>

<template>
  <div role="status">
    <span class="d-sr-only">Loading report…</span>
    <VSkeletonLoader :type="skeletonType" aria-hidden="true" />
  </div>
</template>
