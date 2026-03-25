<script setup lang="ts">
// TODO: replace with @doublecheck/core component when available
import type { ActionPanelProps } from "@doublecheck/core";
import type { JudgementAction } from "@doublecheck/core";
import { useI18n } from "vue-i18n";
import { CdxButton } from "@wikimedia/codex";

const { t } = useI18n();

defineProps<ActionPanelProps>();
const emit = defineEmits<{ judge: [action: JudgementAction] }>();

const actions: { key: JudgementAction; label: string; color: string; shortcut: string }[] = [
  { key: "ShouldRevert", label: "Label-ShouldRevert", color: "var(--color-destructive)", shortcut: "R" },
  { key: "NotSure", label: "Label-NotSure", color: "var(--color-placeholder)", shortcut: "N" },
  { key: "LooksGood", label: "Label-LooksGood", color: "var(--color-success)", shortcut: "G" },
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
        <kbd class="dc-action-panel__kbd">{{ action.shortcut }}</kbd>
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

.dc-action-panel__kbd {
  display: inline-block;
  margin-left: 0.4em;
  padding: 0 0.3em;
  font-size: 0.75em;
  font-family: inherit;
  border: 1px solid currentColor;
  border-radius: 3px;
  opacity: 0.6;
  line-height: 1.4;
}
</style>
