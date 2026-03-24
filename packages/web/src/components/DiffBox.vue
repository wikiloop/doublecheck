<script setup lang="ts">
// TODO: replace with @doublecheck/core component when available
import type { DiffBoxProps } from "@doublecheck/core";

defineProps<DiffBoxProps>();
</script>

<template>
  <div class="dc-diff-box">
    <div
      v-if="loading"
      class="dc-diff-box__loading"
    >
      Loading diff...
    </div>
    <div
      v-else-if="diffHtml"
      class="dc-diff-box__content"
      v-html="diffHtml"
    />
    <div
      v-else
      class="dc-diff-box__empty"
    >
      No diff available
    </div>
  </div>
</template>

<style scoped>
.dc-diff-box {
  border: 1px solid var(--border-color-subtle);
  border-radius: 4px;
  padding: 1rem;
  background: var(--background-color-base);
  overflow-x: auto;
}

.dc-diff-box__loading,
.dc-diff-box__empty {
  color: var(--color-placeholder);
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

/* MediaWiki action=compare diff table styles */
.dc-diff-box__content :deep(.diff) {
  width: 100%;
  border-collapse: collapse;
}

.dc-diff-box__content :deep(.diff td) {
  padding: 2px 8px;
  font-family: monospace;
  font-size: 0.85rem;
  vertical-align: top;
}

.dc-diff-box__content :deep(.diff-addedline) {
  background: #d4edda;
}

.dc-diff-box__content :deep(.diff-deletedline) {
  background: #f8d7da;
}

.dc-diff-box__content :deep(.diff-context) {
  color: var(--color-subtle);
}

.dc-diff-box__content :deep(.diff-marker) {
  width: 20px;
  text-align: center;
  user-select: none;
}

.dc-diff-box__content :deep(td.diff-lineno) {
  font-weight: bold;
  background: var(--background-color-neutral-subtle);
  border-bottom: 1px solid var(--border-color-subtle);
  padding: 4px 8px;
}
</style>
