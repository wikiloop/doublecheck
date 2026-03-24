<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { CdxButton, CdxSelect } from "@wikimedia/codex";
import type { Revision, FeedResponse } from "@doublecheck/core";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const items = ref<Revision[]>([]);
const loading = ref(false);
const nextCursor = ref<string | undefined>();
const selectedWiki = ref("enwiki");

const wikis = ["enwiki", "dewiki", "frwiki", "eswiki", "jawiki", "zhwiki", "ruwiki"];

async function loadFeed(feedName?: string, cursor?: string) {
  loading.value = true;
  try {
    const name = feedName || "default";
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    if (selectedWiki.value) params.set("wiki", selectedWiki.value);

    const res = await fetch(`/api/feed/${name}?${params}`);
    if (res.ok) {
      const data: FeedResponse = await res.json();
      if (cursor) {
        items.value = [...items.value, ...data.items];
      } else {
        items.value = data.items;
      }
      nextCursor.value = data.nextCursor;
    }
  } catch {
    // API not available yet
  } finally {
    loading.value = false;
  }
}

function goToReview(item: Revision) {
  router.push(`/review/${item.wiki}/${item.revId}`);
}

onMounted(() => {
  const feedName = route.params.feedName as string | undefined;
  loadFeed(feedName);
});

watch(selectedWiki, () => {
  loadFeed(route.params.feedName as string | undefined);
});
</script>

<template>
  <div class="dc-feed-page">
    <meta
      name="robots"
      content="noindex"
    >

    <div class="dc-feed-page__header">
      <h1>{{ t("Label-Feed") }}</h1>
      <select
        v-model="selectedWiki"
        class="dc-select"
      >
        <option
          v-for="wiki in wikis"
          :key="wiki"
          :value="wiki"
        >
          {{ wiki }}
        </option>
      </select>
    </div>

    <div
      v-if="loading && items.length === 0"
      class="dc-feed-page__loading"
    >
      {{ t("Label-Loading") }}...
    </div>

    <div
      v-else-if="items.length === 0"
      class="dc-feed-page__empty"
    >
      No revisions in this feed yet.
    </div>

    <ul
      v-else
      class="dc-feed-list"
    >
      <li
        v-for="item in items"
        :key="`${item.wiki}:${item.revId}`"
        class="dc-feed-item"
        @click="goToReview(item)"
      >
        <div class="dc-feed-item__main">
          <span class="dc-feed-item__title">{{ item.title }}</span>
          <span class="dc-feed-item__meta">
            {{ item.wiki }} &middot; rev {{ item.revId }} &middot; {{ item.user }}
          </span>
        </div>
        <span class="dc-feed-item__time">{{ item.timestamp }}</span>
      </li>
    </ul>

    <div
      v-if="nextCursor"
      class="dc-feed-page__more"
    >
      <CdxButton
        :disabled="loading"
        @click="loadFeed(route.params.feedName as string, nextCursor)"
      >
        Load more
      </CdxButton>
    </div>
  </div>
</template>

<style scoped>
.dc-feed-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.dc-feed-page__header h1 {
  font-size: 1.4rem;
  margin: 0;
}

.dc-select {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border-color-base);
  border-radius: 4px;
  font-size: 0.9rem;
}

.dc-feed-page__loading,
.dc-feed-page__empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-subtle);
}

.dc-feed-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.dc-feed-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border: 1px solid var(--background-color-neutral);
  border-radius: 4px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  background: var(--background-color-base);
}

.dc-feed-item:hover {
  background: var(--background-color-neutral-subtle);
}

.dc-feed-item__main {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.dc-feed-item__title {
  font-weight: 600;
  font-size: 0.95rem;
}

.dc-feed-item__meta {
  font-size: 0.8rem;
  color: var(--color-subtle);
}

.dc-feed-item__time {
  font-size: 0.8rem;
  color: var(--color-placeholder);
  white-space: nowrap;
}

.dc-feed-page__more {
  text-align: center;
  padding: 1rem 0;
}
</style>
