<script setup lang="ts">
import type { DiffBoxProps } from "../types/index.js";

const props = withDefaults(defineProps<DiffBoxProps>(), {
  loading: false,
  diffHtml: "",
});
</script>

<template>
  <div class="dc-diff-box">
    <template v-if="props.loading">
      <div class="dc-diff-box__skeleton">
        <div class="dc-skeleton-line dc-skeleton-line--wide" />
        <div class="dc-skeleton-line dc-skeleton-line--full" />
        <div class="dc-skeleton-line dc-skeleton-line--medium" />
        <div class="dc-skeleton-line dc-skeleton-line--full" />
        <div class="dc-skeleton-line dc-skeleton-line--wide" />
      </div>
    </template>
    <template v-else-if="!props.diffHtml">
      <p class="dc-diff-box__empty">
        No diff available for this revision.
      </p>
    </template>
    <template v-else>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div
        class="dc-diff-box__content"
        v-html="props.diffHtml"
      />
    </template>
  </div>
</template>

<style scoped>
.dc-diff-box {
  border: 1px solid var(--dc-border-color, #a2a9b1);
  border-radius: var(--dc-border-radius, 4px);
  background: var(--dc-surface-color, #fff);
  overflow: auto;
}

.dc-diff-box__content {
  padding: var(--dc-spacing-md, 16px);
  font-family: monospace;
  font-size: 0.9em;
  line-height: 1.5;
}

.dc-diff-box__empty {
  padding: var(--dc-spacing-md, 16px);
  text-align: center;
  color: var(--dc-text-subtle, #54595d);
  font-style: italic;
}

/* Skeleton loading */
.dc-diff-box__skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: var(--dc-spacing-md, 16px);
}

.dc-skeleton-line {
  height: 14px;
  background: var(--dc-skeleton-bg, #eaecf0);
  border-radius: 4px;
  animation: dc-pulse 1.5s ease-in-out infinite;
}

.dc-skeleton-line--full { width: 100%; }
.dc-skeleton-line--wide { width: 85%; }
.dc-skeleton-line--medium { width: 60%; }

@keyframes dc-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
