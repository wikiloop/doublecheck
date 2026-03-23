<script setup lang="ts">
import { ref, onMounted } from "vue";

const status = ref<{ status: string; version: string } | null>(null);

onMounted(async () => {
  const res = await fetch("/api/health");
  status.value = await res.json();
});
</script>

<template>
  <main>
    <h1>WikiLoop DoubleCheck</h1>
    <p>Community tool for reviewing Wikipedia edits</p>
    <p v-if="status">API: {{ status.status }} &middot; v{{ status.version }}</p>
    <p v-else>Connecting to API...</p>
  </main>
</template>
