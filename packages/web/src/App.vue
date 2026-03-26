<script setup lang="ts">
import { onMounted } from "vue";
import AppLayout from "./layouts/AppLayout.vue";
import { useAuth } from "./composables/useAuth";
import { useEmbed } from "./composables/useEmbed";

const { checkAuth } = useAuth();
const { isEmbed, init: initEmbed } = useEmbed();

initEmbed();

onMounted(() => {
  checkAuth();
});
</script>

<template>
  <!-- Embed mode: no header/footer, just the page content -->
  <div v-if="isEmbed" class="dc-embed-root">
    <router-view />
  </div>
  <AppLayout v-else>
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

.dc-embed-root {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0.5rem 1rem;
}
</style>
