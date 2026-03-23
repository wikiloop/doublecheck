<script setup lang="ts">
// TODO: replace with @doublecheck/core component when available
import type { RevisionCardProps } from "@doublecheck/core";

defineProps<RevisionCardProps>();

function formatScore(score: number): string {
  return (score * 100).toFixed(0) + "%";
}

function scoreColor(score: number): string {
  if (score >= 0.7) return "#d33";
  if (score >= 0.4) return "#fc3";
  return "#14866d";
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
      <div
        v-if="liftWingScore"
        class="dc-revision-card__scores"
      >
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
      </div>
    </template>
  </div>
</template>

<style scoped>
.dc-revision-card {
  border: 1px solid #c8ccd1;
  border-radius: 4px;
  padding: 1rem;
  background: #fff;
}

.dc-revision-card__loading {
  color: #72777d;
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
  background: #eaecf0;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.8rem;
}

.dc-revision-card__meta {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: #54595d;
  margin-top: 0.5rem;
}

.dc-revision-card__comment {
  font-size: 0.9rem;
  color: #202122;
  margin: 0.5rem 0 0;
  font-style: italic;
}

.dc-revision-card__scores {
  display: flex;
  gap: 1.5rem;
  margin-top: 0.5rem;
  font-size: 0.85rem;
}
</style>
