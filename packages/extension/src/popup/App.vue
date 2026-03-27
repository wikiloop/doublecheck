<script setup lang="ts">
/* global chrome */
import { ref, computed, onMounted } from "vue";
import { MessageType, type AuthStatusResponse } from "../background/messages.js";

declare const __GIT_HASH__: string;

const appVersion = chrome.runtime.getManifest().version;
const gitHash = __GIT_HASH__;

const loading = ref(true);
const loggedIn = ref(false);
const username = ref("");
const onWikipedia = ref(false);

// Heatmap: map of "YYYY-MM-DD" → count
const dayCounts = ref<Map<string, number>>(new Map());

onMounted(async () => {
  // Check if on Wikipedia
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    onWikipedia.value = !!tab?.url && /^https:\/\/\w+\.wikipedia\.org\//.test(tab.url);
  } catch { /* no permission */ }

  await checkAuth();
  loading.value = false;
});

async function checkAuth(): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    type: MessageType.AUTH_STATUS,
  })) as AuthStatusResponse;

  loggedIn.value = response.loggedIn;
  if (response.loggedIn && response.username) {
    username.value = response.username;
    await loadHeatmapData(response.userId!);
  }
}

async function login(): Promise<void> {
  loading.value = true;
  const response = (await chrome.runtime.sendMessage({
    type: MessageType.AUTH_LOGIN,
  })) as AuthStatusResponse;

  loggedIn.value = response.loggedIn;
  if (response.loggedIn && response.username) {
    username.value = response.username;
    await loadHeatmapData(response.userId!);
  }
  loading.value = false;
}

async function logout(): Promise<void> {
  await chrome.runtime.sendMessage({ type: MessageType.AUTH_LOGOUT });
  loggedIn.value = false;
  username.value = "";
  dayCounts.value = new Map();
}

async function loadHeatmapData(userId: string): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.API_REQUEST,
      id: `popup_history_${Date.now()}`,
      method: "GET",
      path: `/api/user/${userId}/history?limit=5000`,
    });

    if (response?.data?.judgements) {
      const counts = new Map<string, number>();
      for (const j of response.data.judgements as Array<{ timestamp: string }>) {
        const day = j.timestamp.slice(0, 10); // "YYYY-MM-DD"
        counts.set(day, (counts.get(day) || 0) + 1);
      }
      dayCounts.value = counts;
    }
  } catch {
    // Silently handle errors
  }
}

async function startReviewing(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && onWikipedia.value) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: MessageType.OPEN_MODAL });
      window.close();
      return;
    } catch { /* content script not loaded — fall through */ }
  }
  // Not on Wikipedia: open dashboard in current tab
  await chrome.tabs.create({ url: "https://wikiloop-doublecheck.toolforge.org/review" });
  window.close();
}

// ---- Heatmap grid computation ----

interface HeatmapCell {
  date: string; // "YYYY-MM-DD"
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

const heatmapWeeks = computed<HeatmapCell[][]>(() => {
  const today = new Date();
  const cells: HeatmapCell[][] = [];

  // Start from 52 weeks ago, aligned to Sunday
  const start = new Date(today);
  start.setDate(start.getDate() - 363 - start.getDay());

  for (let w = 0; w < 53; w++) {
    const week: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      if (date > today) {
        week.push({ date: "", count: 0, level: 0 });
        continue;
      }
      const key = date.toISOString().slice(0, 10);
      const count = dayCounts.value.get(key) || 0;
      const level: 0 | 1 | 2 | 3 | 4 =
        count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4;
      week.push({ date: key, count, level });
    }
    cells.push(week);
  }
  return cells;
});

const monthLabels = computed(() => {
  const labels: { label: string; col: number }[] = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 363 - start.getDay());

  let lastMonth = -1;
  for (let w = 0; w < 53; w++) {
    const date = new Date(start);
    date.setDate(start.getDate() + w * 7);
    const month = date.getMonth();
    if (month !== lastMonth) {
      labels.push({
        label: date.toLocaleString("default", { month: "short" }),
        col: w,
      });
      lastMonth = month;
    }
  }
  return labels;
});

const totalContributions = computed(() => {
  let total = 0;
  for (const count of dayCounts.value.values()) {
    total += count;
  }
  return total;
});
</script>

<template>
  <div class="dc-popup">
    <header class="dc-popup-header">
      <span class="dc-popup-title">DoubleCheck</span>
      <span class="dc-popup-version">v{{ appVersion }}+{{ gitHash }}</span>
    </header>

    <div v-if="loading" class="dc-popup-loading">Loading...</div>

    <template v-else>
      <!-- Auth -->
      <section class="dc-popup-auth">
        <template v-if="loggedIn">
          <div class="dc-popup-user">
            <span class="dc-popup-username">{{ username }}</span>
            <button class="dc-popup-btn dc-popup-btn--small" @click="logout">Logout</button>
          </div>
        </template>
        <template v-else>
          <button class="dc-popup-btn dc-popup-btn--login" @click="login">
            Login with Wikipedia
          </button>
        </template>
      </section>

      <!-- Contribution Heatmap -->
      <section v-if="loggedIn" class="dc-popup-heatmap">
        <div class="dc-heatmap-summary">
          <strong>{{ totalContributions }}</strong> contributions this year
        </div>
        <div class="dc-heatmap-months">
          <span
            v-for="m in monthLabels"
            :key="m.col"
            class="dc-heatmap-month"
            :style="{ gridColumn: m.col + 1 }"
          >{{ m.label }}</span>
        </div>
        <div class="dc-heatmap-grid">
          <template v-for="(week, wi) in heatmapWeeks" :key="wi">
            <div
              v-for="(cell, di) in week"
              :key="`${wi}-${di}`"
              class="dc-heatmap-cell"
              :class="`dc-heatmap-level-${cell.level}`"
              :title="cell.date ? `${cell.date}: ${cell.count} reviews` : ''"
              :style="{ gridColumn: wi + 1, gridRow: di + 1 }"
            />
          </template>
        </div>
        <div class="dc-heatmap-legend">
          <span class="dc-heatmap-legend-label">Less</span>
          <div class="dc-heatmap-cell dc-heatmap-level-0" />
          <div class="dc-heatmap-cell dc-heatmap-level-1" />
          <div class="dc-heatmap-cell dc-heatmap-level-2" />
          <div class="dc-heatmap-cell dc-heatmap-level-3" />
          <div class="dc-heatmap-cell dc-heatmap-level-4" />
          <span class="dc-heatmap-legend-label">More</span>
        </div>
      </section>

      <!-- Review Now -->
      <section class="dc-popup-review">
        <button class="dc-popup-btn dc-popup-btn--review" @click="startReviewing">
          Review Now
        </button>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dc-popup {
  width: 380px;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: #202122;
}

.dc-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #36c;
  color: #fff;
}

.dc-popup-title {
  font-size: 15px;
  font-weight: 700;
}

.dc-popup-version {
  font-size: 11px;
  opacity: 0.8;
}

.dc-popup-loading {
  padding: 32px;
  text-align: center;
  color: #72777d;
}

.dc-popup-auth {
  padding: 10px 16px;
  border-bottom: 1px solid #eaecf0;
}

.dc-popup-user {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dc-popup-username {
  font-weight: 600;
  font-size: 14px;
}

.dc-popup-btn {
  padding: 6px 12px;
  border: 1px solid #a2a9b1;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
}

.dc-popup-btn:hover {
  background: #eaecf0;
}

.dc-popup-btn--small {
  padding: 3px 8px;
  font-size: 12px;
}

.dc-popup-btn--login {
  width: 100%;
  padding: 8px 12px;
  background: #36c;
  color: #fff;
  border-color: #36c;
  font-weight: 500;
}

.dc-popup-btn--login:hover {
  background: #2a4b8d;
}

/* ---- Heatmap ---- */
.dc-popup-heatmap {
  padding: 12px 16px;
  border-bottom: 1px solid #eaecf0;
}

.dc-heatmap-summary {
  font-size: 12px;
  color: #54595d;
  margin-bottom: 6px;
}

.dc-heatmap-summary strong {
  color: #202122;
}

.dc-heatmap-months {
  display: grid;
  grid-template-columns: repeat(53, 1fr);
  margin-bottom: 2px;
  font-size: 9px;
  color: #72777d;
}

.dc-heatmap-grid {
  display: grid;
  grid-template-columns: repeat(53, 1fr);
  grid-template-rows: repeat(7, 1fr);
  gap: 1.5px;
}

.dc-heatmap-cell {
  width: 5.5px;
  height: 5.5px;
  border-radius: 1px;
}

.dc-heatmap-level-0 { background: #ebedf0; }
.dc-heatmap-level-1 { background: #9be9a8; }
.dc-heatmap-level-2 { background: #40c463; }
.dc-heatmap-level-3 { background: #30a14e; }
.dc-heatmap-level-4 { background: #216e39; }

.dc-heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  margin-top: 4px;
}

.dc-heatmap-legend-label {
  font-size: 9px;
  color: #72777d;
  margin: 0 3px;
}

/* ---- Review button ---- */
.dc-popup-review {
  padding: 12px 16px;
}

.dc-popup-btn--review {
  width: 100%;
  padding: 10px 16px;
  background: #36c;
  color: #fff;
  border-color: #36c;
  font-size: 14px;
  font-weight: 600;
  border-radius: 6px;
}

.dc-popup-btn--review:hover {
  background: #2a4b8d;
}
</style>
