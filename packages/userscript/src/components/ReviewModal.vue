<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { JudgementAction } from "@doublecheck/core";
import { ActionPanel, JudgementPanel, RevisionCard, DiffBox } from "@doublecheck/core";
import DirectRevertPanel from "./DirectRevertPanel.vue";
import ThankAuthorPanel from "./ThankAuthorPanel.vue";
import { fetchLiftWingScore, fetchJudgements, submitJudgement, fetchRevision } from "../api.js";
import { fetchDiffHtml, getWikiUser } from "../composables/useWikiAction.js";

// ── Same constants as ReviewPage.vue ──
const STREAM_URL = "https://stream.wikimedia.org/v2/stream/mediawiki.page_revert_risk_prediction_change.v1";
const POOL_MAX = 200;
const MIN_POOL_BEFORE_SHOW = 1;
const CACHE_KEY = "dc-ranked-pool";
const HISTORY_BATCH = 5;

const props = defineProps<{
  wiki?: string;
  revId?: number;
  onClose?: () => void;
}>();

const selectedWiki = ref(props.wiki || "enwiki");

// ── Current revision state ──
const revision = ref<Record<string, unknown> | null>(null);
const diffHtml = ref("");
const diffLoading = ref(false);
const liftWingScore = ref<{ damaging: number; goodfaith: number } | undefined>();
const liftWingLoading = ref(false);
const tallies = ref<Record<JudgementAction, number>>({ ShouldRevert: 0, NotSure: 0, LooksGood: 0 });
const currentAction = ref<JudgementAction | null>(null);
const loading = ref(true);
const submitting = ref(false);

// ── Stream pool state (ported from ReviewPage.vue) ──
const rankedPool = ref<Record<string, unknown>[]>([]);
const reviewedIds = ref<Set<string>>(new Set());
const poolStreamStatus = ref<"connecting" | "waiting" | "ready">("connecting");
const streamConnected = ref(false);
const revisionHistory = ref<Record<string, unknown>[]>([]);

// ── Article history mode ──
const articleHistoryMode = ref(false);
const articleHistoryQueue = ref<number[]>([]);
const articleHistoryReviewed = ref(0);
const articleHistoryTitle = ref("");
const showArticlePrompt = ref(false);

let eventSource: EventSource | null = null;
let initialPoolResolve: (() => void) | null = null;
let initialPoolPromise: Promise<void> | null = null;

const wikiUser = getWikiUser();

const poolRemaining = computed(() =>
  rankedPool.value.filter((r: Record<string, unknown>) => {
    const key = `${r.wiki}:${r.revId}`;
    return !reviewedIds.value.has(key);
  }),
);

const hasPrev = computed(() => revisionHistory.value.length > 0);

// ── Stream logic (ported directly from ReviewPage.vue) ──

function humanPriorityScore(revertRisk: number): number {
  if (revertRisk >= 0.95) return 0.55 - (revertRisk - 0.95) * 1.0;
  return revertRisk;
}

function parseStreamEvent(data: Record<string, unknown>): Record<string, unknown> | null {
  const wikiId = data.wiki_id as string | undefined;
  if (!wikiId || wikiId !== selectedWiki.value) return null;

  const rev = data.revision as Record<string, unknown> | undefined;
  const page = data.page as Record<string, unknown> | undefined;
  const performer = data.performer as Record<string, unknown> | undefined;
  const prediction = data.predicted_classification as Record<string, unknown> | undefined;
  if (!rev || !page || !prediction) return null;

  const probabilities = prediction.probabilities as Record<string, number> | undefined;
  const revertRiskProb = probabilities?.["true"] ?? 0;
  const revId = rev.rev_id as number | undefined;
  if (!revId) return null;

  return {
    wiki: wikiId,
    revId,
    parentRevId: (rev.rev_parent_id as number) ?? 0,
    title: ((page.page_title as string) ?? "").replace(/_/g, " "),
    timestamp: (rev.rev_dt as string) ?? new Date().toISOString(),
    user: (performer?.user_text as string) ?? "",
    comment: (rev.comment as string) ?? "",
    pageId: (page.page_id as number) ?? 0,
    revertRisk: { revertRisk: revertRiskProb },
    rankScore: humanPriorityScore(revertRiskProb),
  };
}

function startStream() {
  if (eventSource) return;
  poolStreamStatus.value = "connecting";
  eventSource = new EventSource(STREAM_URL);
  streamConnected.value = false;

  eventSource.onopen = () => {
    streamConnected.value = true;
    if (poolStreamStatus.value === "connecting") poolStreamStatus.value = "waiting";
  };

  eventSource.onmessage = (event) => {
    try {
      const scored = parseStreamEvent(JSON.parse(event.data));
      if (!scored) return;
      const key = `${scored.wiki}:${scored.revId}`;
      if (reviewedIds.value.has(key)) return;
      if (rankedPool.value.some((r) => r.wiki === scored.wiki && r.revId === scored.revId)) return;

      const pool = rankedPool.value;
      let i = 0;
      while (i < pool.length && ((pool[i].rankScore as number) >= (scored.rankScore as number))) i++;
      pool.splice(i, 0, scored);
      if (pool.length > POOL_MAX) pool.length = POOL_MAX;
      rankedPool.value = pool;

      if (initialPoolResolve && poolRemaining.value.length >= MIN_POOL_BEFORE_SHOW) {
        initialPoolResolve();
        initialPoolResolve = null;
      }
    } catch { /* ignore */ }
  };

  eventSource.onerror = () => { streamConnected.value = false; };
}

function stopStream() {
  if (eventSource) { eventSource.close(); eventSource = null; streamConnected.value = false; }
}

function waitForInitialPool(): Promise<void> {
  if (poolRemaining.value.length >= MIN_POOL_BEFORE_SHOW) return Promise.resolve();
  if (!initialPoolPromise) {
    initialPoolPromise = new Promise<void>((resolve) => {
      initialPoolResolve = resolve;
      setTimeout(() => { if (initialPoolResolve) { initialPoolResolve(); initialPoolResolve = null; } }, 3000);
    });
  }
  return initialPoolPromise;
}

// ── Load a specific revision ──

async function showRevision(w: string, rId: number) {
  loading.value = true;
  currentAction.value = null;
  diffHtml.value = "";
  liftWingScore.value = undefined;
  tallies.value = { ShouldRevert: 0, NotSure: 0, LooksGood: 0 };

  try {
    const revData = await fetchRevision(w, rId);
    revision.value = revData;
    selectedWiki.value = w;

    diffLoading.value = true;
    fetchDiffHtml(rId, (revData.parentRevId as number) ?? 0)
      .then((html) => { diffHtml.value = html; })
      .finally(() => { diffLoading.value = false; });

    liftWingLoading.value = true;
    fetchLiftWingScore(w, rId)
      .then((s) => { liftWingScore.value = s; })
      .catch(() => {})
      .finally(() => { liftWingLoading.value = false; });

    fetchJudgements(w, rId)
      .then((d) => { tallies.value = d.tallies; })
      .catch(() => {});
  } catch { /* ignore */ }
  finally { loading.value = false; }
}

// ── Pool navigation (same as ReviewPage.vue) ──

function loadNextFromPool() {
  const remaining = poolRemaining.value;
  if (remaining.length === 0) return;
  if (revision.value) revisionHistory.value.push(revision.value);

  const next = remaining[0];
  revision.value = next;
  currentAction.value = null;
  tallies.value = { ShouldRevert: 0, NotSure: 0, LooksGood: 0 };
  liftWingScore.value = undefined;

  const w = next.wiki as string;
  const rId = next.revId as number;
  diffLoading.value = true;
  fetchDiffHtml(rId, (next.parentRevId as number) ?? 0)
    .then((html) => { diffHtml.value = html; })
    .finally(() => { diffLoading.value = false; });
  fetchJudgements(w, rId).then((d) => { tallies.value = d.tallies; }).catch(() => {});
  liftWingLoading.value = true;
  fetchLiftWingScore(w, rId).then((s) => { liftWingScore.value = s; }).catch(() => {}).finally(() => { liftWingLoading.value = false; });
}

async function loadNext() {
  if (revision.value) {
    reviewedIds.value.add(`${(revision.value as Record<string, unknown>).wiki}:${(revision.value as Record<string, unknown>).revId}`);
  }

  // Article history mode: serve from queue
  if (articleHistoryMode.value && articleHistoryQueue.value.length > 0) {
    articleHistoryReviewed.value++;
    if (articleHistoryReviewed.value >= HISTORY_BATCH && articleHistoryQueue.value.length > 0) {
      showArticlePrompt.value = true;
      return;
    }
    const nextRevId = articleHistoryQueue.value.shift()!;
    await showRevision(selectedWiki.value, nextRevId);
    return;
  }

  // Normal feed mode
  if (poolRemaining.value.length === 0) {
    loading.value = true;
    initialPoolPromise = null;
    await waitForInitialPool();
    loading.value = false;
  }
  loadNextFromPool();
}

function loadPrev() {
  if (revisionHistory.value.length === 0) return;
  const prev = revisionHistory.value.pop()!;
  revision.value = prev;
  currentAction.value = null;
  tallies.value = { ShouldRevert: 0, NotSure: 0, LooksGood: 0 };
  liftWingScore.value = undefined;
  const w = prev.wiki as string;
  const rId = prev.revId as number;
  diffLoading.value = true;
  fetchDiffHtml(rId, (prev.parentRevId as number) ?? 0).then((html) => { diffHtml.value = html; }).finally(() => { diffLoading.value = false; });
  fetchJudgements(w, rId).then((d) => { tallies.value = d.tallies; }).catch(() => {});
  liftWingLoading.value = true;
  fetchLiftWingScore(w, rId).then((s) => { liftWingScore.value = s; }).catch(() => {}).finally(() => { liftWingLoading.value = false; });
}

async function onJudge(action: JudgementAction) {
  const rev = revision.value;
  if (!rev || submitting.value) return;
  submitting.value = true;
  currentAction.value = action;
  try {
    await submitJudgement(rev.wiki as string, rev.revId as number, action);
    const data = await fetchJudgements(rev.wiki as string, rev.revId as number);
    tallies.value = data.tallies;
    reviewedIds.value.add(`${rev.wiki}:${rev.revId}`);
  } catch { /* ignore */ }
  finally { submitting.value = false; }
}

// ── Article history: fetch recent revisions from MW API ──

async function loadArticleHistory() {
  try {
    const title = mw.config.get("wgPageName") as string;
    articleHistoryTitle.value = title.replace(/_/g, " ");
    const res = await fetch(
      `/w/api.php?action=query&prop=revisions&titles=${encodeURIComponent(title)}&rvlimit=${HISTORY_BATCH}&rvprop=ids&format=json&formatversion=2`,
      { credentials: "include" },
    );
    const data = await res.json();
    const page = data?.query?.pages?.[0];
    if (!page?.revisions?.length) return false;
    articleHistoryQueue.value = page.revisions.map((r: { revid: number }) => r.revid);
    articleHistoryMode.value = true;
    return true;
  } catch { return false; }
}

function continueArticleHistory() {
  showArticlePrompt.value = false;
  articleHistoryReviewed.value = 0;
  // Load next batch of older revisions
  loadNext();
}

function switchToGlobalFeed() {
  showArticlePrompt.value = false;
  articleHistoryMode.value = false;
  articleHistoryQueue.value = [];
  // Start stream feed
  startStream();
  loadNext();
}

// ── Bootstrap ──

onMounted(async () => {
  // Always start stream in background for feed
  startStream();

  if (props.revId && props.revId > 0) {
    // Specific revision (diff page)
    await showRevision(selectedWiki.value, props.revId);
  } else {
    // Check if on article history page
    const isHistoryPage = typeof mw !== "undefined" && mw.config.get("wgAction") === "history";
    if (isHistoryPage) {
      const hasHistory = await loadArticleHistory();
      if (hasHistory && articleHistoryQueue.value.length > 0) {
        const firstRevId = articleHistoryQueue.value.shift()!;
        await showRevision(selectedWiki.value, firstRevId);
        return;
      }
    }

    // Default: wait for stream pool
    loading.value = true;
    poolStreamStatus.value = "connecting";
    await waitForInitialPool();
    poolStreamStatus.value = "ready";
    loading.value = false;
    loadNextFromPool();
  }
});

onUnmounted(() => { stopStream(); });
</script>

<template>
  <div class="dc-review-modal">
    <!-- Header bar -->
    <div class="dc-review-modal__header">
      <span class="dc-review-modal__title">WikiLoop DoubleCheck</span>
      <span class="dc-review-modal__pool-info">
        {{ poolRemaining.length }} in pool
        <span :style="{ color: streamConnected ? '#14866d' : '#ac6600' }">
          {{ streamConnected ? 'stream connected' : 'connecting...' }}
        </span>
      </span>
      <span v-if="wikiUser?.username" class="dc-review-modal__user">
        {{ wikiUser.username }}
      </span>
      <button class="dc-review-modal__close" title="Close (Esc)" @click="onClose?.()">&#x2715;</button>
    </div>

    <!-- Content area -->
    <div class="dc-review-modal__content">
      <!-- Article history prompt -->
      <div v-if="showArticlePrompt" class="dc-review-modal__prompt">
        <p>You've reviewed {{ articleHistoryReviewed }} revisions of <strong>{{ articleHistoryTitle }}</strong>.</p>
        <div class="dc-review-modal__prompt-actions">
          <button class="dc-btn dc-btn--primary" @click="continueArticleHistory">
            Review more of this article
          </button>
          <button class="dc-btn" @click="switchToGlobalFeed">
            Switch to global feed
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="dc-review-modal__loading">
        <div class="dc-review-modal__spinner" />
        <p v-if="poolStreamStatus === 'connecting'">Connecting to Wikimedia stream...</p>
        <p v-else-if="poolStreamStatus === 'waiting'">Connected. Waiting for revisions...</p>
        <p v-else>Loading...</p>
      </div>

      <!-- Review UI -->
      <template v-else-if="revision">
        <div v-if="articleHistoryMode" class="dc-review-modal__mode-badge">
          Reviewing: {{ articleHistoryTitle }} ({{ articleHistoryReviewed + 1 }}/{{ HISTORY_BATCH }})
        </div>

        <RevisionCard
          :revision="revision as any"
          :lift-wing-score="liftWingScore as any"
          :lift-wing-loading="liftWingLoading"
          :loading="false"
        />

        <DiffBox :diff-html="diffHtml" :loading="diffLoading" />

        <div class="dc-review-modal__panels">
          <ActionPanel
            :revision-wiki="(revision as any).wiki || selectedWiki"
            :revision-id="(revision as any).revId || 0"
            :current-action="currentAction"
            :disabled="submitting"
            @judge="onJudge"
          />
          <JudgementPanel :tallies="tallies" :user-action="currentAction" />
        </div>

        <DirectRevertPanel
          v-if="currentAction === 'ShouldRevert'"
          :wiki="(revision as any).wiki || selectedWiki"
          :rev-id="(revision as any).revId || 0"
          :revision-user="(revision as any).user || ''"
          :title="(revision as any).title || ''"
        />

        <ThankAuthorPanel
          v-if="currentAction === 'LooksGood'"
          :wiki="(revision as any).wiki || selectedWiki"
          :rev-id="(revision as any).revId || 0"
          :revision-user="(revision as any).user || ''"
        />

        <!-- Navigation -->
        <div class="dc-review-modal__nav">
          <button v-if="hasPrev" class="dc-btn" @click="loadPrev">&larr; Prev</button>
          <button class="dc-btn dc-btn--primary" @click="loadNext">Next &rarr;</button>
        </div>
      </template>

      <!-- Empty -->
      <div v-else class="dc-review-modal__empty">
        <p>Waiting for revisions from the stream...</p>
        <button class="dc-btn dc-btn--primary" @click="loadNext">Next &rarr;</button>
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
  gap: 12px;
  padding: 10px 16px;
  background: #eaecf0;
  border-bottom: 1px solid #a2a9b1;
  flex-shrink: 0;
}

.dc-review-modal__title { font-weight: 700; font-size: 15px; color: #36c; }
.dc-review-modal__pool-info { font-size: 12px; color: #54595d; }
.dc-review-modal__user { margin-left: auto; font-size: 13px; color: #54595d; }

.dc-review-modal__close {
  margin-left: 8px; background: none; border: 1px solid #a2a9b1; border-radius: 50%;
  width: 28px; height: 28px; font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; color: #202122;
}
.dc-review-modal__close:hover { background: #f8f9fa; }

.dc-review-modal__content {
  flex: 1; overflow-y: auto; padding: 16px;
  display: flex; flex-direction: column; gap: 12px;
}

.dc-review-modal__loading, .dc-review-modal__empty {
  text-align: center; padding: 3rem 1rem; color: #54595d;
  display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
}

.dc-review-modal__spinner {
  width: 28px; height: 28px; border: 3px solid #c8ccd1; border-top-color: #36c;
  border-radius: 50%; animation: dc-spin 0.8s linear infinite;
}
@keyframes dc-spin { to { transform: rotate(360deg); } }

.dc-review-modal__panels { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 600px) { .dc-review-modal__panels { grid-template-columns: 1fr; } }

.dc-review-modal__nav {
  display: flex; justify-content: center; gap: 8px; padding: 12px 0;
}

.dc-review-modal__mode-badge {
  font-size: 12px; color: #36c; background: #eaf3ff;
  padding: 4px 10px; border-radius: 4px; text-align: center;
}

.dc-review-modal__prompt {
  text-align: center; padding: 2rem 1rem;
}
.dc-review-modal__prompt-actions {
  display: flex; gap: 8px; justify-content: center; margin-top: 12px;
}

.dc-btn {
  padding: 8px 16px; border: 1px solid #a2a9b1; border-radius: 4px;
  background: #f8f9fa; cursor: pointer; font-size: 13px; font-weight: 500; font-family: inherit;
}
.dc-btn:hover { background: #eaecf0; }
.dc-btn--primary { background: #36c; color: #fff; border-color: #36c; }
.dc-btn--primary:hover { background: #2a4b8d; }
</style>
