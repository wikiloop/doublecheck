<script setup lang="ts">
// TODO: replace with @doublecheck/core component when available
import type { ActionPanelProps } from "@doublecheck/core";
import type { JudgementAction } from "@doublecheck/core";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

defineProps<ActionPanelProps>();
const emit = defineEmits<{ judge: [action: JudgementAction] }>();

const actions: { key: JudgementAction; label: string; color: string }[] = [
  { key: "ShouldRevert", label: "Label-ShouldRevert", color: "#d33" },
  { key: "NotSure", label: "Label-NotSure", color: "#72777d" },
  { key: "LooksGood", label: "Label-LooksGood", color: "#14866d" },
];
</script>

<template>
  <div class="dc-action-panel">
    <h4 class="dc-action-panel__title">
      {{ t("Label-YourJudgement") }}
    </h4>
    <div class="dc-action-panel__buttons">
      <button
        v-for="action in actions"
        :key="action.key"
        class="dc-action-btn"
        :class="{
          'dc-action-btn--active': currentAction === action.key,
        }"
        :style="currentAction === action.key ? { background: action.color, color: '#fff' } : {}"
        :disabled="disabled"
        @click="emit('judge', action.key)"
      >
        {{ t(action.label) }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.dc-action-panel {
  border: 1px solid #c8ccd1;
  border-radius: 4px;
  padding: 1rem;
  background: #fff;
}

.dc-action-panel__title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.dc-action-panel__buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.dc-action-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #a2a9b1;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 0.9rem;
}

.dc-action-btn:hover:not(:disabled) {
  background: #eaecf0;
}

.dc-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
