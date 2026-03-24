<script setup lang="ts">
// TODO: replace with @doublecheck/core component when available
import type { JudgementPanelProps } from "@doublecheck/core";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
defineProps<JudgementPanelProps>();
</script>

<template>
  <div class="dc-judgement-panel">
    <h4 class="dc-judgement-panel__title">
      {{ t("Label-Judgement") }}
    </h4>
    <div class="dc-judgement-panel__tallies">
      <div class="dc-tally dc-tally--revert">
        <span class="dc-tally__label">{{ t("Label-ShouldRevert") }}</span>
        <span class="dc-tally__count">{{ tallies.ShouldRevert ?? 0 }}</span>
      </div>
      <div class="dc-tally dc-tally--notsure">
        <span class="dc-tally__label">{{ t("Label-NotSure") }}</span>
        <span class="dc-tally__count">{{ tallies.NotSure ?? 0 }}</span>
      </div>
      <div class="dc-tally dc-tally--good">
        <span class="dc-tally__label">{{ t("Label-LooksGood") }}</span>
        <span class="dc-tally__count">{{ tallies.LooksGood ?? 0 }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dc-judgement-panel {
  border: 1px solid var(--border-color-subtle);
  border-radius: 4px;
  padding: 1rem;
  background: var(--background-color-base);
}

.dc-judgement-panel__title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.dc-judgement-panel__tallies {
  display: flex;
  gap: 1rem;
}

.dc-tally {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  min-width: 80px;
}

.dc-tally--revert { background: #fee7e6; }
.dc-tally--notsure { background: var(--background-color-neutral); }
.dc-tally--good { background: #d5fdf4; }

.dc-tally__label {
  font-size: 0.75rem;
  color: var(--color-subtle);
}

.dc-tally__count {
  font-size: 1.5rem;
  font-weight: bold;
}
</style>
