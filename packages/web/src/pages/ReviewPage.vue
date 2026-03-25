<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import type {
  Revision,
  LiftWingScore,
  RevertRiskScore,
  JudgementAction,
  RevisionResponse,
  JudgementsResponse,
  ScoredRevision,
} from "@doublecheck/core";
import { CdxButton, CdxMessage } from "@wikimedia/codex";
import RevisionCard from "../components/RevisionCard.vue";
import DiffBox from "../components/DiffBox.vue";
import ActionPanel from "../components/ActionPanel.vue";
import JudgementPanel from "../components/JudgementPanel.vue";
import DirectRevertPanel from "../components/DirectRevertPanel.vue";
import { useAuth } from "../composables/useAuth";

const STREAM_URL =
  "https://stream.wikimedia.org/v2/stream/mediawiki.page_revert_risk_prediction_change.v1";
const POOL_MAX = 200;
const MIN_POOL_BEFORE_SHOW = 1; // show first revision as soon as we get one
const CACHE_KEY = "dc-ranked-pool";

const route = useRoute();
const { t } = useI18n();
const { user, isLoggedIn, checkAuth } = useAuth();

const revision = ref<Revision | null>(null);
const diffHtml = ref<string>("");
const diffLoading = ref(false);
const revertRiskScore = ref<RevertRiskScore | undefined>();
const liftWingScore = ref<LiftWingScore | undefined>();
const liftWingLoading = ref(false);
const tallies = ref<Record<JudgementAction, number>>({
  ShouldRevert: 0,
  NotSure: 0,
  LooksGood: 0,
});
const currentAction = ref<JudgementAction | null>(null);
const loading = ref(false);
const submitting = ref(false);

// History stack for Prev navigation
const revisionHistory = ref<ScoredRevision[]>([]);

// Stream-based pool state
const rankedPool = ref<ScoredRevision[]>([]);
const reviewedIds = ref<Set<string>>(new Set());
const poolLoading = ref(false);
const poolStreamStatus = ref<"connecting" | "waiting" | "ready">("connecting");
const selectedWiki = ref("enwiki");
const streamConnected = ref(false);

// Consecutive edit grouping state
const consecutiveRevIds = ref<number[]>([]);
const baseRevId = ref<number | undefined>();
const consecutiveEditUser = ref<string | undefined>();

// Page status: detect when the current revision's page gets new edits
const pageStatus = ref<"current" | "reverted" | "new_edits" | null>(null);
const revertedByUser = ref<string | undefined>();
let pageStatusTimer: ReturnType<typeof setInterval> | null = null;

let eventSource: EventSource | null = null;
let initialPoolResolve: (() => void) | null = null;
let initialPoolPromise: Promise<void> | null = null;

/** Fetch the user's recently reviewed revision IDs from the server. */
async function seedReviewedIds() {
  try {
    await checkAuth();
    if (!isLoggedIn.value || !user.value) return;
    const res = await fetch(
      `/api/user/${user.value.userId}/reviewed-ids?limit=200`,
      { credentials: "include" },
    );
    if (!res.ok) return;
    const data: { ids: string[] } = await res.json();
    for (const id of data.ids) {
      reviewedIds.value.add(id);
    }
  } catch {
    // Server unavailable — fall back to localStorage cache
  }
}

/** Restore cached pool from localStorage for instant reload. */
function restoreCachedPool(): boolean {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const cached = JSON.parse(raw) as {
      pool: ScoredRevision[];
      reviewed: string[];
      wiki: string;
      ts: number;
    };
    if (cached.wiki !== selectedWiki.value) return false;
    if (cached.pool.length === 0) return false;
    // Expire cache after 30 minutes
    if (cached.ts && Date.now() - cached.ts > 30 * 60 * 1000) return false;
    rankedPool.value = cached.pool;
    reviewedIds.value = new Set(cached.reviewed);
    return poolRemaining.value.length > 0;
  } catch {
    return false;
  }
}

/** Save pool to localStorage so it survives page reloads. */
function persistPool() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      pool: rankedPool.value.slice(0, 100), // keep cache small
      reviewed: [...reviewedIds.value],
      wiki: selectedWiki.value,
      ts: Date.now(),
    }));
  } catch {
    // storage full or unavailable
  }
}

const poolRemaining = computed(() =>
  rankedPool.value.filter((r) => !reviewedIds.value.has(`${r.wiki}:${r.revId}`))
);

/**
 * Compute a human-review priority score from raw revert risk.
 * Very high risk (>0.95) gets auto-reverted by patrol bots — deprioritize.
 * The sweet spot for human review is ~0.6-0.95 (under bot threshold but still risky).
 */
function humanPriorityScore(revertRisk: number): number {
  if (revertRisk >= 0.95) {
    // Above bot threshold: still include but rank below the sweet spot
    // Maps 0.95-1.0 → 0.55-0.50 (below the gray zone)
    return 0.55 - (revertRisk - 0.95) * 1.0;
  }
  // Below bot threshold: use raw score (higher risk = higher priority)
  return revertRisk;
}

/** Parse a Wikimedia revert-risk prediction event into a ScoredRevision. */
function parseStreamEvent(data: Record<string, unknown>): ScoredRevision | null {
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
    revertRisk: {
      revertRisk: revertRiskProb,
      modelName: prediction.model_name as string | undefined,
      modelVersion: prediction.model_version as string | undefined,
    },
    rankScore: humanPriorityScore(revertRiskProb),
  };
}

/** Start subscribing to the Wikimedia revert-risk stream. */
function startStream() {
  if (eventSource) return;

  poolStreamStatus.value = "connecting";
  eventSource = new EventSource(STREAM_URL);
  streamConnected.value = false;

  eventSource.onopen = () => {
    streamConnected.value = true;
    if (poolStreamStatus.value === "connecting") {
      poolStreamStatus.value = "waiting";
    }
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const scored = parseStreamEvent(data);
      if (!scored) return;

      // Skip if already in pool or already reviewed
      const key = `${scored.wiki}:${scored.revId}`;
      if (reviewedIds.value.has(key)) return;
      if (rankedPool.value.some((r) => r.wiki === scored.wiki && r.revId === scored.revId)) return;

      // Insert into pool maintaining sorted order (highest risk first)
      const pool = rankedPool.value;
      let i = 0;
      while (i < pool.length && pool[i].rankScore >= scored.rankScore) i++;
      pool.splice(i, 0, scored);

      // Trim to max size
      if (pool.length > POOL_MAX) {
        pool.length = POOL_MAX;
      }

      rankedPool.value = pool;
      persistPool();

      // Resolve initial pool promise once we have enough items
      if (initialPoolResolve && poolRemaining.value.length >= MIN_POOL_BEFORE_SHOW) {
        initialPoolResolve();
        initialPoolResolve = null;
      }
    } catch {
      // ignore parse errors
    }
  };

  eventSource.onerror = () => {
    streamConnected.value = false;
    // EventSource auto-reconnects
  };
}

function stopStream() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
    streamConnected.value = false;
  }
}

/** Wait for the initial pool to fill up. */
function waitForInitialPool(): Promise<void> {
  if (poolRemaining.value.length >= MIN_POOL_BEFORE_SHOW) {
    return Promise.resolve();
  }
  if (!initialPoolPromise) {
    initialPoolPromise = new Promise<void>((resolve) => {
      initialPoolResolve = resolve;
      // Timeout: don't wait forever, show whatever we have after 3s
      setTimeout(() => {
        if (initialPoolResolve) {
          initialPoolResolve();
          initialPoolResolve = null;
        }
      }, 3_000);
    });
  }
  return initialPoolPromise;
}

/** Poll MediaWiki to check if the current page has new revisions since ours. */
async function checkPageStatus() {
  const rev = revision.value;
  if (!rev || !rev.title) return;

  try {
    const url = new URL(mwApiUrl(rev.wiki));
    url.searchParams.set("action", "query");
    url.searchParams.set("prop", "revisions");
    url.searchParams.set("titles", rev.title);
    url.searchParams.set("rvlimit", "3");
    url.searchParams.set("rvprop", "ids|user|comment");
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");
    url.searchParams.set("origin", "*");

    const res = await fetch(url.toString());
    if (!res.ok) return;
    const data = await res.json();
    const page = data?.query?.pages?.[0];
    if (!page?.revisions?.length) return;

    const latestRevId = page.revisions[0].revid as number;
    if (latestRevId === rev.revId) {
      pageStatus.value = "current";
      return;
    }

    // Page has newer edits — check if our revision was reverted
    const reverter = page.revisions.find((r: { comment?: string; user?: string }) => {
      const c = (r.comment ?? "").toLowerCase();
      return (
        c.includes("revert") ||
        c.includes("undid revision") ||
        c.includes("undo revision") ||
        c.includes("rv ") ||
        c.includes("reverted")
      );
    });

    if (reverter) {
      revertedByUser.value = reverter.user;
      pageStatus.value = "reverted";
    } else {
      revertedByUser.value = undefined;
      pageStatus.value = "new_edits";
    }
  } catch {
    // Network error — ignore
  }
}

function startPageStatusPolling() {
  stopPageStatusPolling();
  pageStatus.value = null;
  // Check immediately, then every 15 seconds
  checkPageStatus();
  pageStatusTimer = setInterval(checkPageStatus, 15_000);
}

function stopPageStatusPolling() {
  if (pageStatusTimer) {
    clearInterval(pageStatusTimer);
    pageStatusTimer = null;
  }
}

function mwApiUrl(wiki: string): string {
  if (wiki === "enwiki" || wiki === "en.wikipedia.org") {
    return "https://en.wikipedia.org/w/api.php";
  }
  const match = wiki.match(/^(\w+)wiki$/);
  if (match) {
    return `https://${match[1]}.wikipedia.org/w/api.php`;
  }
  return `https://${wiki}/w/api.php`;
}

async function fetchDiff(wiki: string, revId: number, parentRevId: number) {
  diffLoading.value = true;
  diffHtml.value = "";
  try {
    const url = new URL(mwApiUrl(wiki));
    url.searchParams.set("action", "compare");
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");
    url.searchParams.set("origin", "*");
    if (parentRevId > 0) {
      url.searchParams.set("fromrev", String(parentRevId));
    } else {
      url.searchParams.set("fromslots", "main");
      url.searchParams.set("fromcontentmodel", "wikitext");
      url.searchParams.set("fromtext", "");
    }
    url.searchParams.set("torev", String(revId));
    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      const body = data?.compare?.body ?? "";
      diffHtml.value = body
        ? `<table class="diff diff-contentalign-ltr"><tbody>${body}</tbody></table>`
        : "";
    }
  } catch {
    // MediaWiki API unavailable
  } finally {
    diffLoading.value = false;
  }
}

/** Check for consecutive edits and re-fetch combined diff if needed */
async function checkConsecutiveEdits(wiki: string, revId: number, initialParentRevId: number) {
  consecutiveRevIds.value = [];
  baseRevId.value = undefined;
  consecutiveEditUser.value = undefined;
  try {
    const res = await fetch(
      `/api/revert/check/${encodeURIComponent(wiki)}/${revId}`,
      { credentials: "include" },
    );
    if (!res.ok) return;
    const data = await res.json();
    if (data.consecutiveRevIds?.length > 1 && data.baseRevId) {
      consecutiveRevIds.value = data.consecutiveRevIds;
      baseRevId.value = data.baseRevId;
      consecutiveEditUser.value = data.consecutiveEditUser;
      // Re-fetch diff spanning the full consecutive range
      fetchDiff(wiki, revId, data.baseRevId);
    }
  } catch {
    // Non-critical — single-revision diff is already loaded
  }
}

/** Lazy-load LiftWing damaging/goodfaith scores for the current revision */
async function lazyLoadLiftWing(wiki: string, revId: number) {
  liftWingLoading.value = true;
  liftWingScore.value = undefined;
  try {
    const res = await fetch(`/api/liftwing/${wiki}/${revId}`);
    if (res.ok) {
      liftWingScore.value = await res.json();
    }
  } catch {
    // LiftWing unavailable — revert risk is still shown
  } finally {
    liftWingLoading.value = false;
  }
}

async function loadRevision(wiki?: string, revId?: string | number) {
  loading.value = true;
  currentAction.value = null;
  revertRiskScore.value = undefined;
  liftWingScore.value = undefined;
  try {
    if (wiki && revId) {
      const res = await fetch(`/api/revision/${wiki}/${revId}`);
      if (res.ok) {
        const data: RevisionResponse = await res.json();
        revision.value = data;
        liftWingScore.value = data.liftWing;
        fetchDiff(wiki, Number(revId), data.parentRevId ?? 0);
        checkConsecutiveEdits(wiki, Number(revId), data.parentRevId ?? 0);
        await loadJudgements(wiki, Number(revId));
        if (!data.liftWing) {
          lazyLoadLiftWing(wiki, Number(revId));
        }
      }
      startPageStatusPolling();
      // Start stream in background so pool fills for Next button
      restoreCachedPool();
      startStream();
    } else {
      // No specific revision — try cache first for instant display
      const hasCache = restoreCachedPool();
      // Always start stream in background to replenish pool
      startStream();
      if (hasCache) {
        poolLoading.value = false;
        poolStreamStatus.value = "ready";
        loadNextFromPool();
      } else {
        poolLoading.value = true;
        poolStreamStatus.value = "connecting";
        await waitForInitialPool();
        poolLoading.value = false;
        poolStreamStatus.value = "ready";
        loadNextFromPool();
      }
    }
  } catch {
    // API not available yet
  } finally {
    loading.value = false;
  }
}

function loadNextFromPool() {
  const remaining = poolRemaining.value;
  if (remaining.length === 0) return;

  // Push current revision onto history stack for Prev navigation
  if (revision.value) {
    const cur = revision.value as ScoredRevision;
    revisionHistory.value.push(cur);
  }

  const next = remaining[0];
  revision.value = next;
  revertRiskScore.value = next.revertRisk;
  liftWingScore.value = next.liftWing;
  currentAction.value = null;
  consecutiveRevIds.value = [];
  baseRevId.value = undefined;
  consecutiveEditUser.value = undefined;
  tallies.value = { ShouldRevert: 0, NotSure: 0, LooksGood: 0 };
  // Stay on /review — no URL redirect
  fetchDiff(next.wiki, next.revId, next.parentRevId ?? 0);
  checkConsecutiveEdits(next.wiki, next.revId, next.parentRevId ?? 0);
  loadJudgements(next.wiki, next.revId);
  if (!next.liftWing) {
    lazyLoadLiftWing(next.wiki, next.revId);
  }
  startPageStatusPolling();
}

async function loadJudgements(wiki: string, revId: number) {
  try {
    const res = await fetch(`/api/judgements/${wiki}/${revId}`);
    if (res.ok) {
      const data: JudgementsResponse = await res.json();
      tallies.value = data.tallies;
    }
  } catch {
    // ignore
  }
}

async function onJudge(action: JudgementAction) {
  if (!revision.value || submitting.value) return;
  submitting.value = true;
  currentAction.value = action;
  try {
    const judgeBody: Record<string, unknown> = {
      wiki: revision.value.wiki,
      revId: revision.value.revId,
      action,
    };
    // Batch-apply judgement to all consecutive revisions if present
    if (consecutiveRevIds.value.length > 1) {
      judgeBody.additionalRevIds = consecutiveRevIds.value.filter(
        (id) => id !== revision.value!.revId,
      );
    }
    await fetch("/api/judgement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(judgeBody),
    });
    await loadJudgements(revision.value.wiki, revision.value.revId);

    // Track this revision as reviewed
    reviewedIds.value.add(`${revision.value.wiki}:${revision.value.revId}`);
    persistPool();
  } catch {
    // ignore
  } finally {
    submitting.value = false;
  }
}

async function loadNext() {
  // Mark current revision as reviewed so pool skips it
  if (revision.value) {
    reviewedIds.value.add(`${revision.value.wiki}:${revision.value.revId}`);
    persistPool();
  }
  if (poolRemaining.value.length === 0) {
    // Pool empty — wait for stream to deliver something
    poolLoading.value = true;
    initialPoolPromise = null; // reset so waitForInitialPool creates a fresh promise
    await waitForInitialPool();
    poolLoading.value = false;
  }
  loadNextFromPool();
}

function loadPrev() {
  if (revisionHistory.value.length === 0) return;
  const prev = revisionHistory.value.pop()!;
  revision.value = prev;
  revertRiskScore.value = prev.revertRisk;
  liftWingScore.value = prev.liftWing;
  currentAction.value = null;
  consecutiveRevIds.value = [];
  baseRevId.value = undefined;
  consecutiveEditUser.value = undefined;
  tallies.value = { ShouldRevert: 0, NotSure: 0, LooksGood: 0 };
  fetchDiff(prev.wiki, prev.revId, prev.parentRevId ?? 0);
  checkConsecutiveEdits(prev.wiki, prev.revId, prev.parentRevId ?? 0);
  loadJudgements(prev.wiki, prev.revId);
  if (!prev.liftWing) {
    lazyLoadLiftWing(prev.wiki, prev.revId);
  }
  startPageStatusPolling();
}

const hasPrev = computed(() => revisionHistory.value.length > 0);

function onKeydown(e: KeyboardEvent) {
  // Ignore when typing in an input/textarea
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (!revision.value || submitting.value) return;

  switch (e.key.toLowerCase()) {
    case "r":
      onJudge("ShouldRevert");
      break;
    case "n":
      // N = Not Sure + advance to next
      onJudge("NotSure");
      loadNext();
      break;
    case "g":
      onJudge("LooksGood");
      break;
    case "arrowright":
      loadNext();
      break;
    case "arrowleft":
      loadPrev();
      break;
  }
}

onMounted(async () => {
  const wiki = route.params.wiki as string | undefined;
  const revId = route.params.revId as string | undefined;
  if (wiki) selectedWiki.value = wiki;
  await seedReviewedIds();
  loadRevision(wiki, revId);
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  stopStream();
  stopPageStatusPolling();
  window.removeEventListener("keydown", onKeydown);
});

// Direct revision URLs (/review/enwiki/12345) still work via onMounted
</script>

<template>
  <div class="dc-review-page">
    <meta
      name="robots"
      content="noindex"
    >

    <div
      v-if="loading || poolLoading"
      class="dc-review-page__loading"
    >
      <div class="dc-review-page__loading-spinner" />
      <p v-if="poolStreamStatus === 'connecting'">
        Connecting to Wikimedia stream...
      </p>
      <p v-else-if="poolStreamStatus === 'waiting'">
        Connected. Waiting for revisions (usually a few seconds)...
      </p>
      <p v-else>
        {{ t("Label-Loading") }}...
      </p>
      <p class="dc-review-page__loading-hint">
        Listening for new edits on {{ selectedWiki }}
      </p>
    </div>

    <template v-else-if="revision">
      <div class="dc-review-page__pool-status">
        <span>{{ poolRemaining.length }} ranked revisions in pool</span>
        <span>&middot;</span>
        <span
          :class="streamConnected ? 'dc-stream--connected' : 'dc-stream--disconnected'"
        >
          {{ streamConnected ? 'stream connected' : 'stream reconnecting...' }}
        </span>
      </div>

      <CdxMessage
        v-if="pageStatus === 'reverted'"
        type="success"
        class="dc-review-page__page-status"
      >
        Good news! <strong>{{ revertedByUser ?? 'Someone' }}</strong> beat you to it, and already reverted it!
      </CdxMessage>

      <CdxMessage
        v-else-if="pageStatus === 'new_edits'"
        type="notice"
        class="dc-review-page__page-status"
      >
        New edits have been made to this page since this revision. Direct revert may not be possible.
      </CdxMessage>

      <CdxMessage
        v-if="consecutiveRevIds.length > 1"
        type="notice"
        class="dc-review-page__page-status"
      >
        {{ t("Message-ConsecutiveEditsCombinedDiff", { count: consecutiveRevIds.length, user: consecutiveEditUser }) }}
      </CdxMessage>

      <RevisionCard
        :revision="revision"
        :revert-risk-score="revertRiskScore"
        :lift-wing-score="liftWingScore"
        :lift-wing-loading="liftWingLoading"
        :loading="false"
      />

      <DiffBox
        :diff-html="diffHtml"
        :loading="diffLoading"
        :wiki="revision.wiki"
        :rev-id="revision.revId"
        :parent-rev-id="revision.parentRevId"
        class="dc-review-page__diff"
      />

      <div class="dc-review-page__panels">
        <ActionPanel
          :revision-wiki="revision.wiki"
          :revision-id="revision.revId"
          :current-action="currentAction"
          :disabled="submitting"
          @judge="onJudge"
        />

        <JudgementPanel
          :tallies="tallies"
          :user-action="currentAction"
        />
      </div>

      <CdxMessage
        v-if="currentAction === 'ShouldRevert' && pageStatus === 'reverted'"
        type="success"
        class="dc-review-page__page-status"
      >
        Good news! <strong>{{ revertedByUser ?? 'Someone' }}</strong> beat you to it, and already reverted it!
      </CdxMessage>

      <DirectRevertPanel
        v-if="currentAction === 'ShouldRevert' && pageStatus !== 'reverted'"
        :wiki="revision.wiki"
        :rev-id="revision.revId"
        :revision-user="revision.user"
        :title="revision.title"
        :consecutive-rev-ids="consecutiveRevIds"
        :base-rev-id="baseRevId"
      />

      <div class="dc-review-page__nav">
        <CdxButton
          v-if="hasPrev"
          action="progressive"
          weight="quiet"
          @click="loadPrev"
        >
          &larr; Prev
        </CdxButton>
        <CdxButton
          action="progressive"
          weight="primary"
          @click="loadNext"
        >
          Next &rarr;
        </CdxButton>
      </div>
    </template>

    <div
      v-else
      class="dc-review-page__empty"
    >
      <p>No revision loaded. Waiting for stream data...</p>
      <CdxButton
        action="progressive"
        weight="primary"
        @click="loadNext"
      >
        Next &rarr;
      </CdxButton>
    </div>
  </div>
</template>

<style scoped>
.dc-review-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dc-review-page__loading,
.dc-review-page__empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-subtle);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.dc-review-page__loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color-subtle);
  border-top-color: var(--color-progressive);
  border-radius: 50%;
  animation: dc-spin 0.8s linear infinite;
}

@keyframes dc-spin {
  to { transform: rotate(360deg); }
}

.dc-review-page__loading-hint {
  font-size: 0.8rem;
  color: var(--color-placeholder);
}

.dc-review-page__pool-status {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  font-size: 0.8rem;
  color: var(--color-subtle);
  padding: 0.25rem 0;
}

.dc-stream--connected {
  color: var(--color-success);
}

.dc-stream--disconnected {
  color: var(--color-warning);
}

.dc-review-page__page-status {
  margin: 0;
}

.dc-review-page__diff {
  margin-top: 0.5rem;
}

.dc-review-page__panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.dc-review-page__nav {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 0;
}

@media (max-width: 600px) {
  .dc-review-page__panels {
    grid-template-columns: 1fr;
  }
}
</style>
