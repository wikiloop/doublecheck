<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
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
  RankedFeedResponse,
} from "@doublecheck/core";
import { CdxButton } from "@wikimedia/codex";
import RevisionCard from "../components/RevisionCard.vue";
import DiffBox from "../components/DiffBox.vue";
import ActionPanel from "../components/ActionPanel.vue";
import JudgementPanel from "../components/JudgementPanel.vue";
import DirectRevertPanel from "../components/DirectRevertPanel.vue";

const REVIEWS_PER_BATCH = 25;

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

// Ranked feed pool state
const rankedPool = ref<ScoredRevision[]>([]);
const reviewedIds = ref<Set<string>>(new Set());
const reviewedSinceBatch = ref(0);
const nextCursor = ref<string | undefined>();
const poolLoading = ref(false);
const selectedWiki = ref("enwiki");

const poolRemaining = computed(() =>
  rankedPool.value.filter((r) => !reviewedIds.value.has(`${r.wiki}:${r.revId}`))
);

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

/** Fetch a ranked batch from the server */
async function fetchRankedBatch() {
  poolLoading.value = true;
  try {
    const params = new URLSearchParams();
    params.set("wiki", selectedWiki.value);
    if (nextCursor.value) params.set("cursor", nextCursor.value);

    const res = await fetch(`/api/feed/ranked?${params}`);
    if (!res.ok) return;
    const data: RankedFeedResponse = await res.json();

    // Merge new items with unreviewed remaining from current pool
    const remaining = poolRemaining.value;
    const existingKeys = new Set(remaining.map((r) => `${r.wiki}:${r.revId}`));
    const newItems = data.items.filter((r) => !existingKeys.has(`${r.wiki}:${r.revId}`));
    const merged = [...remaining, ...newItems];

    // Re-rank the merged set
    merged.sort((a, b) => b.rankScore - a.rankScore);

    rankedPool.value = merged;
    nextCursor.value = data.nextCursor;
    reviewedSinceBatch.value = 0;
  } catch {
    // API not available
  } finally {
    poolLoading.value = false;
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
        // If no LiftWing score came with the revision, lazy-load it
        if (!data.liftWing) {
          lazyLoadLiftWing(wiki, Number(revId));
        }
      }
    } else {
      // No specific revision — load from ranked pool
      await ensurePool();
      loadNextFromPool();
    }
  } catch {
    // API not available yet
  } finally {
    loading.value = false;
  }
}

async function ensurePool() {
  if (rankedPool.value.length === 0 || poolRemaining.value.length === 0) {
    await fetchRankedBatch();
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
    reviewedSinceBatch.value++;
  } catch {
    // ignore
  } finally {
    submitting.value = false;
  }
}

async function loadNext() {
  // If user has reviewed 25 since last batch, fetch a new batch
  if (reviewedSinceBatch.value >= REVIEWS_PER_BATCH || poolRemaining.value.length === 0) {
    await fetchRankedBatch();
  }

  loadNextFromPool();
}

onMounted(() => {
  const wiki = route.params.wiki as string | undefined;
  const revId = route.params.revId as string | undefined;
  if (wiki) selectedWiki.value = wiki;
  loadRevision(wiki, revId);
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
      {{ poolLoading ? 'Loading ranked revisions...' : t("Label-Loading") }}...
    </div>

    <template v-else-if="revision">
      <div class="dc-review-page__pool-status">
        <span>{{ poolRemaining.length }} ranked revisions remaining</span>
        <span>&middot;</span>
        <span>{{ reviewedSinceBatch }} / {{ REVIEWS_PER_BATCH }} reviewed this batch</span>
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
      <p>No revision loaded. Waiting for feed data...</p>
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
