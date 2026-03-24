<script setup lang="ts">
import { onMounted } from "vue";
import AppLayout from "./layouts/AppLayout.vue";
import { useAuth } from "./composables/useAuth";

const { checkAuth } = useAuth();

onMounted(() => {
  checkAuth();
});
</script>

<template>
  <AppLayout>
    <router-view />
  </AppLayout>
</template>

<style>
/* Global reset and base styles */
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  color: var(--color-base);
  background: var(--background-color-neutral-subtle);
  line-height: 1.5;
}

a {
  color: var(--color-progressive);
}
</style>
