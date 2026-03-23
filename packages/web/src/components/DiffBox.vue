<script setup lang="ts">
// TODO: replace with @doublecheck/core component when available
import type { DiffBoxProps } from "@doublecheck/core";

defineProps<DiffBoxProps>();
</script>

<template>
  <div class="dc-diff-box">
    <div v-if="loading" class="dc-diff-box__loading">Loading diff...</div>
    <div v-else-if="diffHtml" class="dc-diff-box__content" v-html="diffHtml" />
    <div v-else class="dc-diff-box__empty">No diff available</div>
  </div>
</template>

<style scoped>
.dc-diff-box {
  border: 1px solid #c8ccd1;
  border-radius: 4px;
  padding: 1rem;
  background: #fff;
  overflow-x: auto;
}

.dc-diff-box__loading,
.dc-diff-box__empty {
  color: #72777d;
  font-style: italic;
}

.dc-diff-box__content :deep(ins) {
  background: #a3d3a3;
  text-decoration: none;
}

.dc-diff-box__content :deep(del) {
  background: #e88e8e;
  text-decoration: none;
}
</style>
