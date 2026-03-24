<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import type {
  Revision,
  LiftWingScore,
  JudgementAction,
  RevisionResponse,
  JudgementsResponse,
} from "@doublecheck/core";
import { CdxButton } from "@wikimedia/codex";
import RevisionCard from "../components/RevisionCard.vue";
import DiffBox from "../components/DiffBox.vue";
import ActionPanel from "../components/ActionPanel.vue";
import JudgementPanel from "../components/JudgementPanel.vue";
import DirectRevertPanel from "../components/DirectRevertPanel.vue";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const revision = ref<Revision | null>(null);
const diffHtml = ref<string>("");
const diffLoading = ref(false);
const liftWingScore = ref<LiftWingScore | undefined>();
const tallies = ref<Record<JudgementAction, number>>({
  ShouldRevert: 0,
  NotSure: 0,
  LooksGood: 0,
});
const currentAction = ref<JudgementAction | null>(null);
const loading = ref(false);
const submitting = ref(false);

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

/** Fetch diff HTML directly from the MediaWiki API in the browser */
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

async function loadRevision(wiki?: string, revId?: string | number) {
  loading.value = true;
  currentAction.value = null;
  try {
    if (wiki && revId) {
      const res = await fetch(`/api/revision/${wiki}/${revId}`);
      if (res.ok) {
        const data: RevisionResponse = await res.json();
        revision.value = data;
        liftWingScore.value = data.liftWing;
        // Fetch diff directly from MediaWiki (don't wait — load in parallel)
        fetchDiff(wiki, Number(revId), data.parentRevId ?? 0);
        await loadJudgements(wiki, Number(revId));
      }
    } else {
      // Load next from default feed
      const res = await fetch("/api/feed/default");
      if (res.ok) {
        const data = await res.json();
        if (data.items?.length > 0) {
          const item = data.items[0];
          revision.value = item;
          router.replace(`/review/${item.wiki}/${item.revId}`);
          fetchDiff(item.wiki, item.revId, item.parentRevId ?? 0);
          await loadJudgements(item.wiki, item.revId);
        }
      }
    }
  } catch {
    // API not available yet
  } finally {
    loading.value = false;
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
    // Refresh tallies
    await loadJudgements(revision.value.wiki, revision.value.revId);
  } catch {
    // ignore
  } finally {
    submitting.value = false;
  }
}

async function loadNext() {
  const feedName = "default";
  try {
    const res = await fetch(`/api/feed/${feedName}`);
    if (res.ok) {
      const data = await res.json();
      if (data.items?.length > 0) {
        const item = data.items[0];
        router.push(`/review/${item.wiki}/${item.revId}`);
      }
    }
  } catch {
    // ignore
  }
}

onMounted(() => {
  const wiki = route.params.wiki as string | undefined;
  const revId = route.params.revId as string | undefined;
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
      v-if="loading"
      class="dc-review-page__loading"
    >
      {{ t("Label-Loading") }}...
    </div>

    <template v-else-if="revision">
      <RevisionCard
        :revision="revision"
        :lift-wing-score="liftWingScore"
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
