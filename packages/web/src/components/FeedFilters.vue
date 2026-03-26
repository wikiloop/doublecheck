<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { CdxButton } from "@wikimedia/codex";

const { t } = useI18n();

const props = defineProps<{
  minScore: number;
  ipOnly: boolean;
}>();

const emit = defineEmits<{
  (e: "update:minScore", value: number): void;
  (e: "update:ipOnly", value: boolean): void;
}>();

const expanded = ref(false);

const scoreThresholds = [
  { label: "Label-ScoreAny", value: 0 },
  { label: "> 30%", value: 0.3 },
  { label: "> 50%", value: 0.5 },
  { label: "> 70%", value: 0.7 },
  { label: "> 90%", value: 0.9 },
];

const toggleLabel = computed(() =>
  expanded.value ? t("Label-HideFilters") : t("Label-ShowFilters"),
);

function onScoreChange(event: Event) {
  const value = parseFloat((event.target as HTMLSelectElement).value);
  emit("update:minScore", value);
}

function onIpToggle(value: boolean) {
  emit("update:ipOnly", value);
}
</script>

<template>
  <div class="dc-feed-filters">
    <CdxButton
      weight="quiet"
      class="dc-feed-filters__toggle"
      @click="expanded = !expanded"
    >
      {{ toggleLabel }}
      <span :class="expanded ? 'dc-chevron--up' : 'dc-chevron--down'" />
    </CdxButton>

    <div
      v-if="expanded"
      class="dc-feed-filters__panel"
    >
      <div class="dc-feed-filters__row">
        <label class="dc-feed-filters__label">
          {{ t("Label-MinDamageScore") }}
        </label>
        <select
          :value="props.minScore"
          class="dc-feed-filters__select"
          @change="onScoreChange"
        >
          <option
            v-for="th in scoreThresholds"
            :key="th.value"
            :value="th.value"
          >
            {{ th.value === 0 ? t(th.label) : th.label }}
          </option>
        </select>
      </div>

      <div class="dc-feed-filters__row">
        <label class="dc-feed-filters__checkbox-label">
          <input
            type="checkbox"
            :checked="props.ipOnly"
            @change="onIpToggle(($event.target as HTMLInputElement).checked)"
          >
          {{ t("Label-IPEditorsOnly") }}
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dc-feed-filters {
  margin-bottom: 0.5rem;
}

.dc-feed-filters__toggle {
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.dc-chevron--down::after,
.dc-chevron--up::after {
  content: "";
  display: inline-block;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
}

.dc-chevron--down::after {
  border-top: 5px solid currentColor;
}

.dc-chevron--up::after {
  border-bottom: 5px solid currentColor;
}

.dc-feed-filters__panel {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.75rem 0.5rem;
  border: 1px solid var(--border-color-subtle);
  border-radius: 4px;
  margin-top: 0.5rem;
  background: var(--background-color-neutral-subtle);
}

.dc-feed-filters__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dc-feed-filters__label {
  font-size: 0.85rem;
  color: var(--color-subtle);
  white-space: nowrap;
}

.dc-feed-filters__checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.dc-feed-filters__select {
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--border-color-base);
  border-radius: 4px;
  font-size: 0.85rem;
  background: var(--background-color-base);
}
</style>
