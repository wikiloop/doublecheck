<script setup lang="ts">
import type { RevisionCardProps } from "../types/index.js";

const props = withDefaults(defineProps<RevisionCardProps>(), {
  loading: false,
});

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
</script>

<template>
  <div class="dc-revision-card">
    <template v-if="props.loading">
      <div class="dc-revision-card__skeleton">
        <div class="dc-skeleton-line dc-skeleton-line--wide" />
        <div class="dc-skeleton-line dc-skeleton-line--medium" />
        <div class="dc-skeleton-line dc-skeleton-line--narrow" />
      </div>
    </template>
    <template v-else>
      <div class="dc-revision-card__header">
        <span class="dc-revision-card__wiki">{{ props.revision.wiki }}</span>
        <span class="dc-revision-card__title">{{ props.revision.title }}</span>
      </div>
      <div class="dc-revision-card__meta">
        <span class="dc-revision-card__user">{{ props.revision.user }}</span>
        <time
          class="dc-revision-card__time"
          :datetime="props.revision.timestamp"
        >
          {{ formatDate(props.revision.timestamp) }}
        </time>
      </div>
      <p
        v-if="props.revision.comment"
        class="dc-revision-card__comment"
      >
        {{ props.revision.comment }}
      </p>
      <div
        v-if="props.revertRiskScore || props.liftWingScore || props.liftWingLoading"
        class="dc-revision-card__scores"
      >
        <div
          v-if="props.revertRiskScore"
          class="dc-score"
        >
          <label class="dc-score__label">Revert risk</label>
          <div class="dc-score__bar">
            <div
              class="dc-score__fill dc-score__fill--revert-risk"
              :style="{ width: pct(props.revertRiskScore.revertRisk) }"
            />
          </div>
          <span class="dc-score__value">{{ pct(props.revertRiskScore.revertRisk) }}</span>
        </div>
        <template v-if="props.liftWingScore">
          <div class="dc-score">
            <label class="dc-score__label">Damaging</label>
            <div class="dc-score__bar">
              <div
                class="dc-score__fill dc-score__fill--damaging"
                :style="{ width: pct(props.liftWingScore.damaging) }"
              />
            </div>
            <span class="dc-score__value">{{ pct(props.liftWingScore.damaging) }}</span>
          </div>
          <div class="dc-score">
            <label class="dc-score__label">Good faith</label>
            <div class="dc-score__bar">
              <div
                class="dc-score__fill dc-score__fill--goodfaith"
                :style="{ width: pct(props.liftWingScore.goodfaith) }"
              />
            </div>
            <span class="dc-score__value">{{ pct(props.liftWingScore.goodfaith) }}</span>
          </div>
        </template>
        <div
          v-else-if="props.liftWingLoading"
          class="dc-score dc-score--loading"
        >
          <div class="dc-skeleton-line dc-skeleton-line--wide" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dc-revision-card {
  padding: var(--dc-spacing-md, 16px);
  border: 1px solid var(--dc-border-color, #a2a9b1);
  border-radius: var(--dc-border-radius, 4px);
  background: var(--dc-surface-color, #fff);
}

.dc-revision-card__header {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 8px;
}

.dc-revision-card__wiki {
  font-size: 0.85em;
  color: var(--dc-text-subtle, #54595d);
  background: var(--dc-tag-bg, #eaecf0);
  padding: 2px 6px;
  border-radius: 3px;
}

.dc-revision-card__title {
  font-weight: 600;
  color: var(--dc-text-color, #202122);
}

.dc-revision-card__meta {
  display: flex;
  gap: 12px;
  font-size: 0.9em;
  color: var(--dc-text-subtle, #54595d);
  margin-bottom: 8px;
}

.dc-revision-card__comment {
  font-style: italic;
  color: var(--dc-text-subtle, #54595d);
  margin: 8px 0;
}

.dc-revision-card__scores {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.dc-score {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dc-score__label {
  width: 80px;
  font-size: 0.85em;
}

.dc-score__bar {
  flex: 1;
  height: 8px;
  background: var(--dc-score-bar-bg, #eaecf0);
  border-radius: 4px;
  overflow: hidden;
}

.dc-score__fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.dc-score__fill--revert-risk {
  background: var(--dc-color-revert-risk, #f0a);
}

.dc-score__fill--damaging {
  background: var(--dc-color-damaging, #d33);
}

.dc-score__fill--goodfaith {
  background: var(--dc-color-goodfaith, #36c);
}

.dc-score__value {
  width: 50px;
  text-align: right;
  font-size: 0.85em;
}

/* Skeleton loading */
.dc-revision-card__skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dc-skeleton-line {
  height: 16px;
  background: var(--dc-skeleton-bg, #eaecf0);
  border-radius: 4px;
  animation: dc-pulse 1.5s ease-in-out infinite;
}

.dc-skeleton-line--wide { width: 80%; }
.dc-skeleton-line--medium { width: 60%; }
.dc-skeleton-line--narrow { width: 40%; }

@keyframes dc-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
