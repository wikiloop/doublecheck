<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import type { JudgementAction } from "@doublecheck/core";
import { ActionPanel, JudgementPanel, RevisionCard, DiffBox } from "@doublecheck/core";
import DirectRevertPanel from "./DirectRevertPanel.vue";
import ThankAuthorPanel from "./ThankAuthorPanel.vue";
import { fetchLiftWingScore, fetchJudgements, submitJudgement, fetchRevision } from "../api.js";
import { fetchDiffHtml, getWikiUser } from "../composables/useWikiAction.js";

const props = defineProps<{
  wiki?: string;
  revId?: number;
  onClose?: () => void;
}>();

const wiki = ref(props.wiki || "enwiki");
const revId = ref(props.revId || 0);

// Revision data
const revision = ref<Record<string, unknown> | null>(null);
const diffHtml = ref("");
const diffLoading = ref(false);
const liftWingScore = ref<{ damaging: number; goodfaith: number } | undefined>();
const liftWingLoading = ref(false);
const tallies = ref<Record<JudgementAction, number>>({
  ShouldRevert: 0,
  NotSure: 0,
  LooksGood: 0,
});
const currentAction = ref<JudgementAction | null>(null);
const loading = ref(true);
const submitting = ref(false);
const error = ref<string | null>(null);

const wikiUser = getWikiUser();

async function loadRevision() {
  if (!revId.value) {
    loading.value = false;
    error.value = "No revision specified. Navigate to a diff page and click DoubleCheck.";
    return;
  }

  loading.value = true;
  error.value = null;
  currentAction.value = null;
  diffHtml.value = "";

  try {
    // Fetch revision metadata from Toolforge
    const revData = await fetchRevision(wiki.value, revId.value);
    revision.value = revData;

    // Fetch diff HTML from same-origin MW API
    diffLoading.value = true;
    fetchDiffHtml(revId.value, revData.parentRevId ?? 0)
      .then((html) => { diffHtml.value = html; })
      .finally(() => { diffLoading.value = false; });

    // Fetch LiftWing scores
    liftWingLoading.value = true;
    fetchLiftWingScore(wiki.value, revId.value)
      .then((score) => { liftWingScore.value = score; })
      .catch(() => { /* optional */ })
      .finally(() => { liftWingLoading.value = false; });

    // Fetch existing judgements
    fetchJudgements(wiki.value, revId.value)
      .then((data) => { tallies.value = data.tallies; })
      .catch(() => { /* optional */ });
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load revision";
  } finally {
    loading.value = false;
  }
}

async function onJudge(action: JudgementAction) {
  if (!revId.value || submitting.value) return;
  submitting.value = true;
  currentAction.value = action;
  try {
    await submitJudgement(wiki.value, revId.value, action);
    // Refresh tallies
    const data = await fetchJudgements(wiki.value, revId.value);
    tallies.value = data.tallies;
  } catch {
    // Silently fail — user can retry
  } finally {
    submitting.value = false;
  }
}

onMounted(loadRevision);
</script>

<template>
  <div class="dc-review-modal">
    <!-- Header bar -->
    <div class="dc-review-modal__header">
      <span class="dc-review-modal__title">WikiLoop DoubleCheck</span>
      <span v-if="wikiUser?.username" class="dc-review-modal__user">
        {{ wikiUser.username }}
      </span>
      <button
        class="dc-review-modal__close"
        title="Close (Esc)"
        @click="onClose?.()"
      >
        &#x2715;
      </button>
    </div>

    <!-- Content area -->
    <div class="dc-review-modal__content">
      <!-- Loading -->
      <div v-if="loading" class="dc-review-modal__loading">
        <div class="dc-review-modal__spinner" />
        <p>Loading revision...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="dc-review-modal__error">
        {{ error }}
      </div>

      <!-- Review UI -->
      <template v-else-if="revision">
        <RevisionCard
          :revision="revision as any"
          :lift-wing-score="liftWingScore as any"
          :lift-wing-loading="liftWingLoading"
          :loading="false"
        />

        <DiffBox
          :diff-html="diffHtml"
          :loading="diffLoading"
        />

        <div class="dc-review-modal__panels">
          <ActionPanel
            :revision-wiki="wiki"
            :revision-id="revId"
            :current-action="currentAction"
            :disabled="submitting"
            @judge="onJudge"
          />

          <JudgementPanel
            :tallies="tallies"
            :user-action="currentAction"
          />
        </div>

        <!-- Conditional panels based on judgement -->
        <DirectRevertPanel
          v-if="currentAction === 'ShouldRevert'"
          :wiki="wiki"
          :rev-id="revId"
          :revision-user="(revision as any).user || ''"
          :title="(revision as any).title || ''"
        />

        <ThankAuthorPanel
          v-if="currentAction === 'LooksGood'"
          :wiki="wiki"
          :rev-id="revId"
          :revision-user="(revision as any).user || ''"
        />
      </template>

      <!-- No revision -->
      <div v-else class="dc-review-modal__empty">
        <p>No revision to review. Navigate to a diff page to use DoubleCheck.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dc-review-modal {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  color: #202122;
}

.dc-review-modal__header {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: #eaecf0;
  border-bottom: 1px solid #a2a9b1;
  flex-shrink: 0;
}

.dc-review-modal__title {
  font-weight: 700;
  font-size: 15px;
  color: #36c;
}

.dc-review-modal__user {
  margin-left: auto;
  font-size: 13px;
  color: #54595d;
}

.dc-review-modal__close {
  margin-left: 12px;
  background: none;
  border: 1px solid #a2a9b1;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #202122;
}

.dc-review-modal__close:hover {
  background: #f8f9fa;
}

.dc-review-modal__content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dc-review-modal__loading,
.dc-review-modal__error,
.dc-review-modal__empty {
  text-align: center;
  padding: 3rem 1rem;
  color: #54595d;
}

.dc-review-modal__error {
  color: #d33;
}

.dc-review-modal__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #c8ccd1;
  border-top-color: #36c;
  border-radius: 50%;
  animation: dc-spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

@keyframes dc-spin {
  to { transform: rotate(360deg); }
}

.dc-review-modal__panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 600px) {
  .dc-review-modal__panels {
    grid-template-columns: 1fr;
  }
}
</style>
