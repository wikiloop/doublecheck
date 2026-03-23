<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { LeaderboardEntry, LeaderboardResponse } from "@doublecheck/core";

const { t } = useI18n();

type TimePeriod = "day" | "week" | "month" | "all";

const entries = ref<LeaderboardEntry[]>([]);
const loading = ref(false);
const period = ref<TimePeriod>("week");

const periodLabels: Record<TimePeriod, string> = {
  day: "Label-Day",
  week: "Label-Week",
  month: "Label-Month",
  all: "Label-AllTime",
};

async function loadLeaderboard() {
  loading.value = true;
  try {
    const res = await fetch(`/api/leaderboard?period=${period.value}`);
    if (res.ok) {
      const data: LeaderboardResponse = await res.json();
      entries.value = data.entries;
    }
  } catch {
    // API not available yet
  } finally {
    loading.value = false;
  }
}

onMounted(loadLeaderboard);
watch(period, loadLeaderboard);
</script>

<template>
  <div class="dc-leaderboard-page">
    <meta name="robots" content="noindex" />

    <div class="dc-leaderboard-page__header">
      <h1>{{ t("Label-TopUsers") }}</h1>
      <div class="dc-period-filter">
        <button
          v-for="(label, key) in periodLabels"
          :key="key"
          class="dc-period-btn"
          :class="{ 'dc-period-btn--active': period === key }"
          @click="period = key as TimePeriod"
        >
          {{ t(label) }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="dc-leaderboard-page__loading">
      {{ t("Label-Loading") }}...
    </div>

    <table v-else-if="entries.length > 0" class="dc-leaderboard-table">
      <thead>
        <tr>
          <th>{{ t("Label-Rank") }}</th>
          <th>{{ t("Label-User") }}</th>
          <th>{{ t("Label-CountOfJudgements") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in entries" :key="entry.userId">
          <td class="dc-rank">{{ entry.rank }}</td>
          <td>{{ entry.username }}</td>
          <td class="dc-count">{{ entry.count }}</td>
        </tr>
      </tbody>
    </table>

    <div v-else class="dc-leaderboard-page__empty">
      No leaderboard data available yet.
    </div>
  </div>
</template>

<style scoped>
.dc-leaderboard-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.dc-leaderboard-page__header h1 {
  font-size: 1.4rem;
  margin: 0;
}

.dc-period-filter {
  display: flex;
  gap: 0.25rem;
}

.dc-period-btn {
  padding: 0.35rem 0.7rem;
  border: 1px solid #a2a9b1;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 0.85rem;
}

.dc-period-btn--active {
  background: #3366cc;
  color: #fff;
  border-color: #3366cc;
}

.dc-leaderboard-page__loading,
.dc-leaderboard-page__empty {
  text-align: center;
  padding: 3rem 1rem;
  color: #54595d;
}

.dc-leaderboard-table {
  width: 100%;
  border-collapse: collapse;
}

.dc-leaderboard-table th,
.dc-leaderboard-table td {
  padding: 0.6rem 1rem;
  text-align: left;
  border-bottom: 1px solid #eaecf0;
}

.dc-leaderboard-table th {
  background: #f8f9fa;
  font-size: 0.85rem;
  color: #54595d;
}

.dc-rank {
  font-weight: bold;
  width: 60px;
}

.dc-count {
  font-variant-numeric: tabular-nums;
}
</style>
