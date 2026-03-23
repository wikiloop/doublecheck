<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAuth } from "../composables/useAuth";
import type { Judgement, UserHistoryResponse } from "@doublecheck/core";

const { t } = useI18n();
const router = useRouter();
const { user, isLoggedIn, checkAuth } = useAuth();

const judgements = ref<Judgement[]>([]);
const loading = ref(false);
const nextCursor = ref<string | undefined>();

async function loadHistory(cursor?: string) {
  if (!user.value) return;
  loading.value = true;
  try {
    const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const res = await fetch(`/api/user/${user.value.userId}/history${params}`, {
      credentials: "include",
    });
    if (res.ok) {
      const data: UserHistoryResponse = await res.json();
      if (cursor) {
        judgements.value = [...judgements.value, ...data.judgements];
      } else {
        judgements.value = data.judgements;
      }
      nextCursor.value = data.nextCursor;
    }
  } catch {
    // API not available yet
  } finally {
    loading.value = false;
  }
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    ShouldRevert: "Label-ShouldRevert",
    NotSure: "Label-NotSure",
    LooksGood: "Label-LooksGood",
  };
  return map[action] ?? action;
}

function actionColor(action: string): string {
  if (action === "ShouldRevert") return "#d33";
  if (action === "LooksGood") return "#14866d";
  return "#72777d";
}

onMounted(async () => {
  await checkAuth();
  if (!isLoggedIn.value) {
    router.push("/");
    return;
  }
  loadHistory();
});
</script>

<template>
  <div class="dc-history-page">
    <meta name="robots" content="noindex" />

    <h1>{{ t("Label-MyHistory") }}</h1>

    <div v-if="loading && judgements.length === 0" class="dc-history-page__loading">
      {{ t("Label-Loading") }}...
    </div>

    <div v-else-if="judgements.length === 0" class="dc-history-page__empty">
      No judgement history yet. Start reviewing!
    </div>

    <ul v-else class="dc-history-list">
      <li v-for="(j, i) in judgements" :key="i" class="dc-history-item">
        <router-link
          :to="`/review/${j.revisionWiki}/${j.revisionId}`"
          class="dc-history-item__link"
        >
          {{ j.revisionWiki }}:{{ j.revisionId }}
        </router-link>
        <span
          class="dc-history-item__action"
          :style="{ color: actionColor(j.action) }"
        >
          {{ t(actionLabel(j.action)) }}
        </span>
        <span class="dc-history-item__time">{{ j.timestamp }}</span>
      </li>
    </ul>

    <div v-if="nextCursor" class="dc-history-page__more">
      <button
        class="dc-btn dc-btn--secondary"
        :disabled="loading"
        @click="loadHistory(nextCursor)"
      >
        Load more
      </button>
    </div>
  </div>
</template>

<style scoped>
.dc-history-page h1 {
  font-size: 1.4rem;
  margin-bottom: 1rem;
}

.dc-history-page__loading,
.dc-history-page__empty {
  text-align: center;
  padding: 3rem 1rem;
  color: #54595d;
}

.dc-history-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.dc-history-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 1rem;
  border: 1px solid #eaecf0;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.dc-history-item__link {
  color: #3366cc;
  text-decoration: none;
  font-weight: 600;
}

.dc-history-item__action {
  font-size: 0.85rem;
  font-weight: 600;
}

.dc-history-item__time {
  margin-left: auto;
  font-size: 0.8rem;
  color: #72777d;
}

.dc-history-page__more {
  text-align: center;
  padding: 1rem 0;
}

.dc-btn {
  padding: 0.5rem 1.2rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
}

.dc-btn--secondary {
  background: #fff;
  color: #3366cc;
  border: 1px solid #3366cc;
}
</style>
