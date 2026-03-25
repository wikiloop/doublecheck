<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
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
import { CdxButton } from "@wikimedia/codex";
import RevisionCard from "../components/RevisionCard.vue";
import DiffBox from "../components/DiffBox.vue";
import ActionPanel from "../components/ActionPanel.vue";
import JudgementPanel from "../components/JudgementPanel.vue";
import DirectRevertPanel from "../components/DirectRevertPanel.vue";

const STREAM_URL =
  "https://stream.wikimedia.org/v2/stream/mediawiki.page_revert_risk_prediction_change.v1";
const POOL_MAX = 200;
const MIN_POOL_BEFORE_SHOW = 1; // show first revision as soon as we get one
const CACHE_KEY = "dc-ranked-pool";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

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

// Stream-based pool state
const rankedPool = ref<ScoredRevision[]>([]);
const reviewedIds = ref<Set<string>>(new Set());
const poolLoading = ref(false);
const selectedWiki = ref("enwiki");
const streamConnected = ref(false);

let eventSource: EventSource | null = null;
let initialPoolResolve: (() => void) | null = null;
let initialPoolPromise: Promise<void> | null = null;

/** Restore cached pool from sessionStorage for instant second load. */
function restoreCachedPool(): boolean {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const cached = JSON.parse(raw) as { pool: ScoredRevision[]; reviewed: string[]; wiki: string };
    if (cached.wiki !== selectedWiki.value) return false;
    // Only use cache if it has items and is less than 5 minutes old
    if (cached.pool.length === 0) return false;
    rankedPool.value = cached.pool;
    reviewedIds.value = new Set(cached.reviewed);
    return poolRemaining.value.length > 0;
  } catch {
    return false;
  }
}

/** Save pool to sessionStorage. */
function persistPool() {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      pool: rankedPool.value.slice(0, 100), // keep cache small
      reviewed: [...reviewedIds.value],
      wiki: selectedWiki.value,
    }));
  } catch {
    // storage full or unavailable
  }
}

const poolRemaining = computed(() =>
  rankedPool.value.filter((r) => !reviewedIds.value.has(`${r.wiki}:${r.revId}`))
);

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
    rankScore: revertRiskProb,
  };
}

/** Start subscribing to the Wikimedia revert-risk stream. */
function startStream() {
  if (eventSource) return;

  eventSource = new EventSource(STREAM_URL);
  streamConnected.value = false;

  eventSource.onopen = () => {
    streamConnected.value = true;
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
      diffHtml.value = data?.compare?.body ?? "";
    }
  } catch {
    // MediaWiki API unavailable
  } finally {
    diffLoading.value = false;
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
        await loadJudgements(wiki, Number(revId));
        if (!data.liftWing) {
          lazyLoadLiftWing(wiki, Number(revId));
        }
      }
    } else {
      // No specific revision — try cache first, then stream
      startStream();
      if (restoreCachedPool()) {
        poolLoading.value = false;
        loadNextFromPool();
      } else {
        poolLoading.value = true;
        await waitForInitialPool();
        poolLoading.value = false;
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

  const next = remaining[0];
  revision.value = next;
  revertRiskScore.value = next.revertRisk;
  liftWingScore.value = next.liftWing;
  router.replace(`/review/${next.wiki}/${next.revId}`);
  fetchDiff(next.wiki, next.revId, next.parentRevId ?? 0);
  loadJudgements(next.wiki, next.revId);
  // Lazy-load detailed damaging/goodfaith scores
  if (!next.liftWing) {
    lazyLoadLiftWing(next.wiki, next.revId);
  }
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
    await fetch("/api/judgement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        wiki: revision.value.wiki,
        revId: revision.value.revId,
        action,
      }),
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

function loadNext() {
  loadNextFromPool();
}

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
  }
}

onMounted(() => {
  const wiki = route.params.wiki as string | undefined;
  const revId = route.params.revId as string | undefined;
  if (wiki) selectedWiki.value = wiki;
  loadRevision(wiki, revId);
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  stopStream();
  window.removeEventListener("keydown", onKeydown);
});

watch(
  () => [route.params.wiki, route.params.revId],
  ([wiki, revId]) => {
    if (wiki && revId) {
      loadRevision(wiki as string, revId as string);
    }
  }
);
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
      {{ poolLoading ? 'Receiving revisions from stream...' : t("Label-Loading") }}...
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

      <DirectRevertPanel
        v-if="currentAction === 'ShouldRevert'"
        :wiki="revision.wiki"
        :rev-id="revision.revId"
        :revision-user="revision.user"
        :title="revision.title"
      />

      <div class="dc-review-page__nav">
        <CdxButton
          action="progressive"
          weight="primary"
          @click="loadNext"
        >
          {{ t("Button-Next") }}
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
        {{ t("Button-Next") }}
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
  padding: 1rem 0;
}

@media (max-width: 600px) {
  .dc-review-page__panels {
    grid-template-columns: 1fr;
  }
}
</style>
