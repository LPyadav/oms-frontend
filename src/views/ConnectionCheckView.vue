<script setup>
import { onMounted, ref } from 'vue'

const status = ref('checking')

async function checkApi() {
  status.value = 'checking'

  try {
    const response = await fetch('/api/health', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })

    const payload = response.ok ? await response.json() : null
    const healthStatus = payload?.data?.status ?? payload?.status
    status.value = healthStatus === 'ok' ? 'connected' : 'unavailable'
  } catch {
    status.value = 'unavailable'
  }
}

onMounted(checkApi)
</script>

<template>
  <main>
    <h1>OMS Connection Check</h1>

    <div role="status">
      <p v-if="status === 'checking'">Checking connection…</p>
      <p v-else-if="status === 'connected'">API connected</p>
      <p v-else>API unavailable</p>
    </div>

    <button v-if="status === 'unavailable'" type="button" @click="checkApi">Try again</button>
  </main>
</template>
