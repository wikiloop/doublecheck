<script setup lang="ts">
// TODO: replace with @doublecheck/core component when available
import type { RevisionCardProps } from "@doublecheck/core";

defineProps<RevisionCardProps>();

function formatScore(score: number): string {
  return (score * 100).toFixed(0) + "%";
}

function scoreColor(score: number): string {
  if (score >= 0.7) return "var(--color-destructive)";
  if (score >= 0.4) return "var(--color-warning)";
  return "var(--color-success)";
}
</script>

<template>
  <div class="dc-revision-card">
    <div
      v-if="loading"
      class="dc-revision-card__loading"
    >
      Loading revision...
    </div>
    <template v-else>
      <div class="dc-revision-card__header">
        <h3 class="dc-revision-card__title">
          {{ revision.title }}
        </h3>
        <span class="dc-revision-card__wiki">{{ revision.wiki }}</span>
      </div>
      <div class="dc-revision-card__meta">
        <span>Rev {{ revision.revId }}</span>
        <span>by {{ revision.user }}</span>
        <span>{{ revision.timestamp }}</span>
      </div>
      <p
        v-if="revision.comment"
        class="dc-revision-card__comment"
      >
        {{ revision.comment }}
      </p>
      <div class="dc-revision-card__scores">
        <span v-if="revertRiskScore">
          Revert risk:
          <strong :style="{ color: scoreColor(revertRiskScore.revertRisk) }">
            {{ formatScore(revertRiskScore.revertRisk) }}
          </strong>
        </span>
        <template v-if="liftWingScore">
          <span>
            Damaging:
            <strong :style="{ color: scoreColor(liftWingScore.damaging) }">
              {{ formatScore(liftWingScore.damaging) }}
            </strong>
          </span>
          <span>
            Good faith:
            <strong :style="{ color: scoreColor(1 - liftWingScore.goodfaith) }">
              {{ formatScore(liftWingScore.goodfaith) }}
            </strong>
          </span>
        </template>
        <span
          v-else-if="liftWingLoading"
          class="dc-revision-card__scores-loading"
        >
          Loading detail scores...
        </span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dc-revision-card {
  border: 1px solid var(--border-color-subtle);
  border-radius: 4px;
  padding: 1rem;
  background: var(--background-color-base);
}

.dc-revision-card__loading {
  color: var(--color-placeholder);
  font-style: italic;
}

.dc-revision-card__header {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.dc-revision-card__title {
  margin: 0;
  font-size: 1.1rem;
}

.dc-revision-card__wiki {
  background: var(--background-color-neutral);
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.8rem;
}

.dc-revision-card__meta {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--color-subtle);
  margin-top: 0.5rem;
}

.dc-revision-card__comment {
  font-size: 0.9rem;
  color: var(--color-base);
  margin: 0.5rem 0 0;
  font-style: italic;
}

.dc-revision-card__scores {
  display: flex;
  gap: 1.5rem;
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

.dc-revision-card__scores-loading {
  color: var(--color-placeholder);
  font-style: italic;
}
</style>
