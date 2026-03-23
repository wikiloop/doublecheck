<script setup lang="ts">
import type { JudgementAction } from "../types/index.js";
import type { JudgementPanelProps } from "../types/index.js";

const props = withDefaults(defineProps<JudgementPanelProps>(), {
  userAction: null,
});

const actionLabels: Record<JudgementAction, string> = {
  ShouldRevert: "Should Revert",
  NotSure: "Not Sure",
  LooksGood: "Looks Good",
};

const actionCssClasses: Record<JudgementAction, string> = {
  ShouldRevert: "dc-tally--revert",
  NotSure: "dc-tally--notsure",
  LooksGood: "dc-tally--good",
};

const actionKeys: JudgementAction[] = ["ShouldRevert", "NotSure", "LooksGood"];
</script>

<template>
  <div class="dc-judgement-panel">
    <div
      v-for="action in actionKeys"
      :key="action"
      class="dc-tally"
      :class="[
        actionCssClasses[action],
        { 'dc-tally--user': props.userAction === action },
      ]"
      :data-action="action"
    >
      <span class="dc-tally__label">{{ actionLabels[action] }}</span>
      <span class="dc-tally__count">{{ props.tallies[action] ?? 0 }}</span>
    </div>
  </div>
</template>

<style scoped>
.dc-judgement-panel {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.dc-tally {
  flex: 1;
  min-width: 90px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 12px;
  border: 2px solid transparent;
  border-radius: var(--dc-border-radius, 4px);
  background: var(--dc-tag-bg, #eaecf0);
}

.dc-tally--user {
  border-color: var(--dc-text-color, #202122);
  font-weight: 600;
}

.dc-tally--revert {
  background: var(--dc-color-revert-bg, #fee7e6);
}

.dc-tally--notsure {
  background: var(--dc-color-notsure-bg, #fef6e7);
}

.dc-tally--good {
  background: var(--dc-color-good-bg, #d5fdf4);
}

.dc-tally__label {
  font-size: 0.85em;
  color: var(--dc-text-subtle, #54595d);
}

.dc-tally__count {
  font-size: 1.3em;
  font-weight: 700;
  margin-top: 4px;
}
</style>
