<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView v-slot="{ Component }">
    <KeepAlive include="OrderDirectoryView">
      <component :is="Component" />
    </KeepAlive>
  </RouterView>
</template>
