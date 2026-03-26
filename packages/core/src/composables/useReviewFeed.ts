/**
 * Shared review feed composable — stream-based ranked pool of revisions.
 * Used by both the web app (ReviewPage.vue) and the userscript (ReviewModal.vue).
 */
import { ref, computed, type Ref } from "vue";
import type { ScoredRevision, JudgementAction } from "../types/index.js";

const STREAM_URL =
  "https://stream.wikimedia.org/v2/stream/mediawiki.page_revert_risk_prediction_change.v1";
const POOL_MAX = 200;
const MIN_POOL_BEFORE_SHOW = 1;
const CACHE_KEY = "dc-ranked-pool";

export interface ReviewFeedOptions {
  selectedWiki: Ref<string>;
}

export function useReviewFeed(options: ReviewFeedOptions) {
  const { selectedWiki } = options;

  const rankedPool = ref<ScoredRevision[]>([]);
  const reviewedIds = ref<Set<string>>(new Set());
  const poolStreamStatus = ref<"connecting" | "waiting" | "ready">("connecting");
  const streamConnected = ref(false);
  const revisionHistory = ref<ScoredRevision[]>([]);

  let eventSource: EventSource | null = null;
  let initialPoolResolve: (() => void) | null = null;
  let initialPoolPromise: Promise<void> | null = null;

  // ── Filtering ──

  const filterMinScore = ref(0);
  const filterIpOnly = ref(false);

  function isIPUser(user: string): boolean {
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(user)) return true;
    if (/^[0-9a-fA-F:]+$/.test(user) && user.includes(":")) return true;
    return false;
  }

  const poolRemaining = computed(() =>
    rankedPool.value.filter((r) => {
      if (reviewedIds.value.has(`${r.wiki}:${r.revId}`)) return false;
      if (filterMinScore.value > 0 && r.revertRisk.revertRisk < filterMinScore.value) return false;
      if (filterIpOnly.value && !isIPUser(r.user)) return false;
      return true;
    }),
  );

  const hasPrev = computed(() => revisionHistory.value.length > 0);

  // ── Priority scoring ──

  function humanPriorityScore(revertRisk: number): number {
    if (revertRisk >= 0.95) {
      return 0.55 - (revertRisk - 0.95) * 1.0;
    }
    return revertRisk;
  }

  // ── Stream event parsing ──

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

  // ── Pool persistence ──

  function persistPool() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        pool: rankedPool.value.slice(0, 100),
        reviewed: [...reviewedIds.value],
        wiki: selectedWiki.value,
        ts: Date.now(),
      }));
    } catch { /* storage full or unavailable */ }
  }

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
      if (cached.ts && Date.now() - cached.ts > 30 * 60 * 1000) return false;
      rankedPool.value = cached.pool;
      reviewedIds.value = new Set(cached.reviewed);
      return poolRemaining.value.length > 0;
    } catch {
      return false;
    }
  }

  // ── Stream connection ──

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

        const key = `${scored.wiki}:${scored.revId}`;
        if (reviewedIds.value.has(key)) return;
        if (rankedPool.value.some((r) => r.wiki === scored.wiki && r.revId === scored.revId)) return;

        const pool = rankedPool.value;
        let i = 0;
        while (i < pool.length && pool[i].rankScore >= scored.rankScore) i++;
        pool.splice(i, 0, scored);

        if (pool.length > POOL_MAX) {
          pool.length = POOL_MAX;
        }

        rankedPool.value = pool;
        persistPool();

        if (initialPoolResolve && poolRemaining.value.length >= MIN_POOL_BEFORE_SHOW) {
          initialPoolResolve();
          initialPoolResolve = null;
        }
      } catch { /* ignore parse errors */ }
    };

    eventSource.onerror = () => {
      streamConnected.value = false;
    };
  }

  function stopStream() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
      streamConnected.value = false;
    }
  }

  function waitForInitialPool(): Promise<void> {
    if (poolRemaining.value.length >= MIN_POOL_BEFORE_SHOW) {
      return Promise.resolve();
    }
    if (!initialPoolPromise) {
      initialPoolPromise = new Promise<void>((resolve) => {
        initialPoolResolve = resolve;
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

  // ── Navigation ──

  function loadNextFromPool(): ScoredRevision | null {
    const remaining = poolRemaining.value;
    if (remaining.length === 0) return null;
    return remaining[0];
  }

  function markReviewed(wiki: string, revId: number) {
    reviewedIds.value.add(`${wiki}:${revId}`);
    persistPool();
  }

  function pushHistory(rev: ScoredRevision) {
    revisionHistory.value.push(rev);
  }

  function popHistory(): ScoredRevision | undefined {
    return revisionHistory.value.pop();
  }

  return {
    // State
    rankedPool,
    reviewedIds,
    poolStreamStatus,
    streamConnected,
    poolRemaining,
    revisionHistory,
    hasPrev,
    filterMinScore,
    filterIpOnly,

    // Actions
    startStream,
    stopStream,
    waitForInitialPool,
    restoreCachedPool,
    persistPool,
    loadNextFromPool,
    markReviewed,
    pushHistory,
    popHistory,

    // Utilities
    humanPriorityScore,
    parseStreamEvent,
  };
}
