<script setup lang="ts">
// TODO: replace with @doublecheck/core component when available
import type { ActionPanelProps } from "@doublecheck/core";
import type { JudgementAction } from "@doublecheck/core";
import { useI18n } from "vue-i18n";
import { CdxButton } from "@wikimedia/codex";

const { t } = useI18n();

defineProps<ActionPanelProps>();
const emit = defineEmits<{ judge: [action: JudgementAction] }>();

const actions: { key: JudgementAction; label: string; color: string }[] = [
  { key: "ShouldRevert", label: "Label-ShouldRevert", color: "var(--color-destructive)" },
  { key: "NotSure", label: "Label-NotSure", color: "var(--color-placeholder)" },
  { key: "LooksGood", label: "Label-LooksGood", color: "var(--color-success)" },
];
</script>

<template>
  <div class="dc-action-panel">
    <h4 class="dc-action-panel__title">
      {{ t("Label-YourJudgement") }}
    </h4>
    <div class="dc-action-panel__buttons">
      <CdxButton
        v-for="action in actions"
        :key="action.key"
        :weight="currentAction === action.key ? 'primary' : 'normal'"
        :style="currentAction === action.key ? { background: action.color, borderColor: action.color, color: '#fff' } : {}"
        :disabled="disabled"
        @click="emit('judge', action.key)"
      >
        {{ t(action.label) }}
      </CdxButton>
    </div>
  </div>
</template>

<style scoped>
.dc-action-panel {
  border: 1px solid var(--border-color-subtle);
  border-radius: 4px;
  padding: 1rem;
  background: var(--background-color-base);
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
</style>
