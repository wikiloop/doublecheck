<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
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
import { useReviewFeed } from "@doublecheck/core";
import { CdxButton, CdxMessage } from "@wikimedia/codex";
import RevisionCard from "../components/RevisionCard.vue";
import DiffBox from "../components/DiffBox.vue";
import ActionPanel from "../components/ActionPanel.vue";
import JudgementPanel from "../components/JudgementPanel.vue";
import DirectRevertPanel from "../components/DirectRevertPanel.vue";
import ThankAuthorPanel from "../components/ThankAuthorPanel.vue";
import GoogleSearchPanel from "../components/GoogleSearchPanel.vue";
import TagArticlePanel from "../components/TagArticlePanel.vue";
import FeedFilters from "../components/FeedFilters.vue";
import { useAuth } from "../composables/useAuth";

// Stream/pool constants now in @doublecheck/core useReviewFeed

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

const selectedWiki = ref("enwiki");
const poolLoading = ref(false);

// ── Shared review feed from @doublecheck/core ──
const feed = useReviewFeed({ selectedWiki });
// Aliases for template compatibility
const rankedPool = feed.rankedPool;
const reviewedIds = feed.reviewedIds;
const poolStreamStatus = feed.poolStreamStatus;
const streamConnected = feed.streamConnected;
const poolRemaining = feed.poolRemaining;
const revisionHistory = feed.revisionHistory;
const filterMinScore = feed.filterMinScore;
const filterIpOnly = feed.filterIpOnly;

// Consecutive edit grouping state
const consecutiveRevIds = ref<number[]>([]);
const baseRevId = ref<number | undefined>();
const consecutiveEditUser = ref<string | undefined>();

// Page status: detect when the current revision's page gets new edits
const pageStatus = ref<"current" | "reverted" | "new_edits" | null>(null);
const revertedByUser = ref<string | undefined>();
let pageStatusTimer: ReturnType<typeof setInterval> | null = null;

// Stream lifecycle managed by feed composable
// Local aliases for functions used in this page
const startStream = feed.startStream;
const stopStream = feed.stopStream;
const waitForInitialPool = feed.waitForInitialPool;
const restoreCachedPool = feed.restoreCachedPool;
const persistPool = feed.persistPool;

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

// Pool/stream functions removed — now provided by useReviewFeed via `feed.*`

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
  const next = feed.loadNextFromPool();
  if (!next) return;

  // Push current revision onto history stack for Prev navigation
  if (revision.value) {
    feed.pushHistory(revision.value as ScoredRevision);
  }
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
    feed.markReviewed(revision.value.wiki, revision.value.revId);
  } catch {
    // ignore
  } finally {
    submitting.value = false;
  }
}

async function loadNext() {
  // Mark current revision as reviewed so pool skips it
  if (revision.value) {
    feed.markReviewed(revision.value.wiki, revision.value.revId);
  }
  if (poolRemaining.value.length === 0) {
    poolLoading.value = true;
    await waitForInitialPool();
    poolLoading.value = false;
  }
  loadNextFromPool();
}

function loadPrev() {
  const prev = feed.popHistory();
  if (!prev) return;;
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

const hasPrev = feed.hasPrev;

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

      <FeedFilters
        v-model:min-score="filterMinScore"
        v-model:ip-only="filterIpOnly"
      />

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

      <TagArticlePanel
        :wiki="revision.wiki"
        :title="revision.title"
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

      <ThankAuthorPanel
        v-if="currentAction === 'LooksGood'"
        :wiki="revision.wiki"
        :rev-id="revision.revId"
        :revision-user="revision.user"
      />

      <GoogleSearchPanel
        v-if="currentAction === 'NotSure'"
        :title="revision.title"
        :comment="revision.comment"
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
