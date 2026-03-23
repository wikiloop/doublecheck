<script setup lang="ts">
import type { JudgementAction } from "../types/index.js";
import type { ActionPanelProps, ActionPanelEmits } from "../types/index.js";

const props = withDefaults(defineProps<ActionPanelProps>(), {
  disabled: false,
  currentAction: null,
});

const emit = defineEmits<{
  (e: "judge", action: JudgementAction): void;
}>();

const actions: { key: JudgementAction; label: string; cssClass: string }[] = [
  { key: "ShouldRevert", label: "Should Revert", cssClass: "dc-action-btn--revert" },
  { key: "NotSure", label: "Not Sure", cssClass: "dc-action-btn--notsure" },
  { key: "LooksGood", label: "Looks Good", cssClass: "dc-action-btn--good" },
];

function handleClick(action: JudgementAction) {
  if (props.disabled || props.currentAction) return;
  emit("judge", action);
}
</script>

<template>
  <div class="dc-action-panel">
    <button
      v-for="action in actions"
      :key="action.key"
      class="dc-action-btn"
      :class="[
        action.cssClass,
        { 'dc-action-btn--active': props.currentAction === action.key },
      ]"
      :disabled="props.disabled || !!props.currentAction"
      :data-action="action.key"
      @click="handleClick(action.key)"
    >
      {{ action.label }}
    </button>
  </div>
</template>

<style scoped>
.dc-action-panel {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.dc-action-btn {
  flex: 1;
  min-width: 100px;
  padding: 10px 16px;
  border: 2px solid transparent;
  border-radius: var(--dc-border-radius, 4px);
  font-size: 0.95em;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;
}

.dc-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dc-action-btn--revert {
  background: var(--dc-color-revert-bg, #fee7e6);
  color: var(--dc-color-revert-text, #d33);
}

.dc-action-btn--revert.dc-action-btn--active {
  border-color: var(--dc-color-revert-text, #d33);
  background: var(--dc-color-revert-text, #d33);
  color: #fff;
}

.dc-action-btn--notsure {
  background: var(--dc-color-notsure-bg, #fef6e7);
  color: var(--dc-color-notsure-text, #ac6600);
}

.dc-action-btn--notsure.dc-action-btn--active {
  border-color: var(--dc-color-notsure-text, #ac6600);
  background: var(--dc-color-notsure-text, #ac6600);
  color: #fff;
}

.dc-action-btn--good {
  background: var(--dc-color-good-bg, #d5fdf4);
  color: var(--dc-color-good-text, #14866d);
}

.dc-action-btn--good.dc-action-btn--active {
  border-color: var(--dc-color-good-text, #14866d);
  background: var(--dc-color-good-text, #14866d);
  color: #fff;
}
</style>
