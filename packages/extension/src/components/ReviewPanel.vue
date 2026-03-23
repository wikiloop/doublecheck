<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { JudgementAction, LiftWingScore } from "@doublecheck/core";
import { apiGet, apiPost } from "../content/api.js";

const props = defineProps<{
  wiki: string;
  revId: number;
}>();

const loading = ref(true);
const error = ref<string | null>(null);
const liftWingScore = ref<LiftWingScore | null>(null);
const tallies = ref<Record<JudgementAction, number>>({
  ShouldRevert: 0,
  NotSure: 0,
  LooksGood: 0,
});
const userAction = ref<JudgementAction | null>(null);

onMounted(async () => {
  await loadData();
});

async function loadData(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    // Fetch LiftWing scores and judgements in parallel
    const [scoreResult, judgementsResult] = await Promise.all([
      apiGet<LiftWingScore>(`/api/liftwing/${props.wiki}/${props.revId}`),
      apiGet<{ tallies: Record<JudgementAction, number> }>(
        `/api/judgements/${props.wiki}/${props.revId}`,
      ),
    ]);

    if (scoreResult.status === 200 && scoreResult.data) {
      liftWingScore.value = scoreResult.data;
    }

    if (judgementsResult.status === 200 && judgementsResult.data) {
      tallies.value = judgementsResult.data.tallies;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load data";
  } finally {
    loading.value = false;
  }
}

async function submitJudgement(action: JudgementAction): Promise<void> {
  if (userAction.value === action) return;

  const result = await apiPost("/api/judgement", {
    wiki: props.wiki,
    revId: props.revId,
    action,
  });

  if (result.status === 200 || result.status === 201) {
    userAction.value = action;
    // Refresh tallies
    const judgementsResult = await apiGet<{
      tallies: Record<JudgementAction, number>;
    }>(`/api/judgements/${props.wiki}/${props.revId}`);
    if (judgementsResult.status === 200 && judgementsResult.data) {
      tallies.value = judgementsResult.data.tallies;
    }
  }
}

function scoreLevel(score: number): string {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}
</script>

<template>
  <div class="dc-panel">
    <div class="dc-panel-header">
      <span class="dc-panel-title">WikiLoop DoubleCheck</span>
    </div>

    <div v-if="loading" class="dc-loading">Loading...</div>

    <div v-else-if="error" class="dc-error">{{ error }}</div>

    <template v-else>
      <!-- LiftWing Scores -->
      <div v-if="liftWingScore" class="dc-scores">
        <span :class="['dc-score', `dc-score--${scoreLevel(liftWingScore.damaging)}`]">
          Damaging: {{ Math.round(liftWingScore.damaging * 100) }}%
        </span>
        <span :class="['dc-score', `dc-score--${scoreLevel(1 - liftWingScore.goodfaith)}`]">
          Good faith: {{ Math.round(liftWingScore.goodfaith * 100) }}%
        </span>
      </div>

      <!-- Action Buttons -->
      <div class="dc-actions">
        <button
          :class="['dc-btn', 'dc-btn--revert', { 'dc-btn--active': userAction === 'ShouldRevert' }]"
          @click="submitJudgement('ShouldRevert')"
        >
          Should Revert
        </button>
        <button
          :class="['dc-btn', 'dc-btn--notsure', { 'dc-btn--active': userAction === 'NotSure' }]"
          @click="submitJudgement('NotSure')"
        >
          Not Sure
        </button>
        <button
          :class="['dc-btn', 'dc-btn--good', { 'dc-btn--active': userAction === 'LooksGood' }]"
          @click="submitJudgement('LooksGood')"
        >
          Looks Good
        </button>
      </div>

      <!-- Community Tallies -->
      <div class="dc-tallies">
        <span class="dc-tally">Should Revert: {{ tallies.ShouldRevert }}</span>
        <span class="dc-tally">Not Sure: {{ tallies.NotSure }}</span>
        <span class="dc-tally">Looks Good: {{ tallies.LooksGood }}</span>
      </div>
    </template>
  </div>
</template>
