<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { JudgementAction, ScoredRevision } from "@doublecheck/core";
import {
  ActionPanel, JudgementPanel, RevisionCard, DiffBox,
  useReviewFeed, useJudgement, useLiftWing,
  getApiClient, createApiClient,
} from "@doublecheck/core";
import DirectRevertPanel from "./DirectRevertPanel.vue";
import ThankAuthorPanel from "./ThankAuthorPanel.vue";
import { fetchDiffHtml, getWikiUser } from "../composables/useWikiAction.js";
import { fetchRevision } from "../api.js";

const HISTORY_BATCH = 5;
const API_BASE = "https://wikiloop-doublecheck.toolforge.org";

const props = defineProps<{
  wiki?: string;
  revId?: number;
  onClose?: () => void;
}>();

// Initialize the API client for core composables
createApiClient({ baseUrl: API_BASE });

const selectedWiki = ref(props.wiki || "enwiki");

// ── Shared feed from core ──
const feed = useReviewFeed({ selectedWiki });

// ── Current revision state ──
const revision = ref<Record<string, unknown> | null>(null);
const currentRevWiki = ref("");
const currentRevId = ref(0);
const diffHtml = ref("");
const diffLoading = ref(false);
const currentAction = ref<JudgementAction | null>(null);
const loading = ref(true);
const submitting = ref(false);

// ── Use core composables for judgements and scores ──
const judgement = useJudgement(currentRevWiki, currentRevId);
const liftWing = useLiftWing(currentRevWiki, currentRevId);

// ── Article history mode ──
const articleHistoryMode = ref(false);
const articleHistoryQueue = ref<number[]>([]);
const articleHistoryReviewed = ref(0);
const articleHistoryTitle = ref("");
const showArticlePrompt = ref(false);

const wikiUser = getWikiUser();

// ── Load a specific revision ──

async function showRevision(w: string, rId: number) {
  loading.value = true;
  currentAction.value = null;
  diffHtml.value = "";

  try {
    const revData = await fetchRevision(w, rId);
    revision.value = revData;
    currentRevWiki.value = w;
    currentRevId.value = rId;

    // Diff from same-origin MW API
    diffLoading.value = true;
    fetchDiffHtml(rId, (revData.parentRevId as number) ?? 0)
      .then((html) => { diffHtml.value = html; })
      .finally(() => { diffLoading.value = false; });
  } catch { /* ignore */ }
  finally { loading.value = false; }
}

// ── Navigation using shared feed ──

async function loadNext() {
  if (revision.value) {
    feed.markReviewed(
      (revision.value as Record<string, unknown>).wiki as string,
      (revision.value as Record<string, unknown>).revId as number,
    );
    feed.pushHistory(revision.value as ScoredRevision);
  }

  // Article history mode
  if (articleHistoryMode.value && articleHistoryQueue.value.length > 0) {
    articleHistoryReviewed.value++;
    if (articleHistoryReviewed.value >= HISTORY_BATCH && articleHistoryQueue.value.length > 0) {
      showArticlePrompt.value = true;
      return;
    }
    await showRevision(selectedWiki.value, articleHistoryQueue.value.shift()!);
    return;
  }

  // Stream feed
  if (feed.poolRemaining.value.length === 0) {
    loading.value = true;
    feed.startStream();
    await feed.waitForInitialPool();
    loading.value = false;
  }
  const next = feed.loadNextFromPool();
  if (next) {
    await showRevision(next.wiki, next.revId);
  }
}

function loadPrev() {
  const prev = feed.popHistory();
  if (prev) {
    showRevision(prev.wiki, prev.revId);
  }
}

async function onJudge(action: JudgementAction) {
  if (!revision.value || submitting.value) return;
  submitting.value = true;
  currentAction.value = action;
  try {
    await judgement.submit(action);
  } catch { /* ignore */ }
  finally { submitting.value = false; }
}

// ── Article history: fetch recent revisions from MW API ──

async function loadArticleHistory(): Promise<boolean> {
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
  loadNext();
}

function switchToGlobalFeed() {
  showArticlePrompt.value = false;
  articleHistoryMode.value = false;
  articleHistoryQueue.value = [];
  feed.startStream();
  loadNext();
}

// ── Bootstrap ──

onMounted(async () => {
  feed.startStream();

  if (props.revId && props.revId > 0) {
    await showRevision(selectedWiki.value, props.revId);
  } else {
    const isHistoryPage = typeof mw !== "undefined" && mw.config.get("wgAction") === "history";
    if (isHistoryPage) {
      const ok = await loadArticleHistory();
      if (ok && articleHistoryQueue.value.length > 0) {
        await showRevision(selectedWiki.value, articleHistoryQueue.value.shift()!);
        return;
      }
    }
    // Default: stream feed
    loading.value = true;
    await feed.waitForInitialPool();
    loading.value = false;
    const next = feed.loadNextFromPool();
    if (next) await showRevision(next.wiki, next.revId);
  }
});

onUnmounted(() => { feed.stopStream(); });
</script>

<template>
  <div class="dc-review-modal">
    <!-- Header bar -->
    <div class="dc-review-modal__header">
      <span class="dc-review-modal__title">WikiLoop DoubleCheck</span>
      <span class="dc-review-modal__pool-info">
        {{ feed.poolRemaining.value.length }} in pool
        <span :style="{ color: feed.streamConnected.value ? '#14866d' : '#ac6600' }">
          {{ feed.streamConnected.value ? 'stream connected' : 'connecting...' }}
        </span>
      </span>
      <span v-if="wikiUser?.username" class="dc-review-modal__user">{{ wikiUser.username }}</span>
      <button class="dc-review-modal__close" title="Close (Esc)" @click="onClose?.()">&#x2715;</button>
    </div>

    <!-- Content area -->
    <div class="dc-review-modal__content">
      <!-- Article history prompt -->
      <div v-if="showArticlePrompt" class="dc-review-modal__prompt">
        <p>You've reviewed {{ articleHistoryReviewed }} revisions of <strong>{{ articleHistoryTitle }}</strong>.</p>
        <div class="dc-review-modal__prompt-actions">
          <button class="dc-btn dc-btn--primary" @click="continueArticleHistory">Review more of this article</button>
          <button class="dc-btn" @click="switchToGlobalFeed">Switch to global feed</button>
        </div>
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="dc-review-modal__loading">
        <div class="dc-review-modal__spinner" />
        <p v-if="feed.poolStreamStatus.value === 'connecting'">Connecting to Wikimedia stream...</p>
        <p v-else-if="feed.poolStreamStatus.value === 'waiting'">Connected. Waiting for revisions...</p>
        <p v-else>Loading...</p>
      </div>

      <!-- Review UI -->
      <template v-else-if="revision">
        <div v-if="articleHistoryMode" class="dc-review-modal__mode-badge">
          Reviewing: {{ articleHistoryTitle }} ({{ articleHistoryReviewed + 1 }}/{{ HISTORY_BATCH }})
        </div>

        <RevisionCard
          :revision="revision as any"
          :lift-wing-score="liftWing.score.value as any"
          :lift-wing-loading="liftWing.loading.value"
          :loading="false"
        />

        <DiffBox :diff-html="diffHtml" :loading="diffLoading" />

        <div class="dc-review-modal__panels">
          <ActionPanel
            :revision-wiki="currentRevWiki"
            :revision-id="currentRevId"
            :current-action="currentAction"
            :disabled="submitting"
            @judge="onJudge"
          />
          <JudgementPanel :tallies="judgement.tallies.value" :user-action="currentAction" />
        </div>

        <DirectRevertPanel
          v-if="currentAction === 'ShouldRevert'"
          :wiki="currentRevWiki"
          :rev-id="currentRevId"
          :revision-user="(revision as any).user || ''"
          :title="(revision as any).title || ''"
        />

        <ThankAuthorPanel
          v-if="currentAction === 'LooksGood'"
          :wiki="currentRevWiki"
          :rev-id="currentRevId"
          :revision-user="(revision as any).user || ''"
        />

        <div class="dc-review-modal__nav">
          <button v-if="feed.hasPrev.value" class="dc-btn" @click="loadPrev">&larr; Prev</button>
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
.dc-review-modal { display: flex; flex-direction: column; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; color: #202122; }
.dc-review-modal__header { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: #eaecf0; border-bottom: 1px solid #a2a9b1; flex-shrink: 0; }
.dc-review-modal__title { font-weight: 700; font-size: 15px; color: #36c; }
.dc-review-modal__pool-info { font-size: 12px; color: #54595d; }
.dc-review-modal__user { margin-left: auto; font-size: 13px; color: #54595d; }
.dc-review-modal__close { margin-left: 8px; background: none; border: 1px solid #a2a9b1; border-radius: 50%; width: 28px; height: 28px; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #202122; }
.dc-review-modal__close:hover { background: #f8f9fa; }
.dc-review-modal__content { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.dc-review-modal__loading, .dc-review-modal__empty { text-align: center; padding: 3rem 1rem; color: #54595d; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.dc-review-modal__spinner { width: 28px; height: 28px; border: 3px solid #c8ccd1; border-top-color: #36c; border-radius: 50%; animation: dc-spin 0.8s linear infinite; }
@keyframes dc-spin { to { transform: rotate(360deg); } }
.dc-review-modal__panels { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 600px) { .dc-review-modal__panels { grid-template-columns: 1fr; } }
.dc-review-modal__nav { display: flex; justify-content: center; gap: 8px; padding: 12px 0; }
.dc-review-modal__mode-badge { font-size: 12px; color: #36c; background: #eaf3ff; padding: 4px 10px; border-radius: 4px; text-align: center; }
.dc-review-modal__prompt { text-align: center; padding: 2rem 1rem; }
.dc-review-modal__prompt-actions { display: flex; gap: 8px; justify-content: center; margin-top: 12px; }
.dc-btn { padding: 8px 16px; border: 1px solid #a2a9b1; border-radius: 4px; background: #f8f9fa; cursor: pointer; font-size: 13px; font-weight: 500; font-family: inherit; }
.dc-btn:hover { background: #eaecf0; }
.dc-btn--primary { background: #36c; color: #fff; border-color: #36c; }
.dc-btn--primary:hover { background: #2a4b8d; }
</style>
