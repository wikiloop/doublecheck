<script setup lang="ts">
/* global chrome */
import { ref, onMounted } from "vue";
import { MessageType, type AuthStatusResponse } from "../background/messages.js";
import type { LeaderboardEntry } from "@doublecheck/core";

declare const __GIT_HASH__: string;

const appVersion = chrome.runtime.getManifest().version;
const gitHash = __GIT_HASH__;

const loading = ref(true);
const loggedIn = ref(false);
const username = ref("");
const todayCount = ref(0);
const recentActivity = ref<Array<{ revId: number; wiki: string; action: string; timestamp: string }>>([]);
const leaderboard = ref<LeaderboardEntry[]>([]);

onMounted(async () => {
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
    await loadUserData(response.userId!);
  }
  await loadLeaderboard();
}

async function login(): Promise<void> {
  loading.value = true;
  const response = (await chrome.runtime.sendMessage({
    type: MessageType.AUTH_LOGIN,
  })) as AuthStatusResponse;

  loggedIn.value = response.loggedIn;
  if (response.loggedIn && response.username) {
    username.value = response.username;
  }
  loading.value = false;
}

async function logout(): Promise<void> {
  await chrome.runtime.sendMessage({ type: MessageType.AUTH_LOGOUT });
  loggedIn.value = false;
  username.value = "";
  todayCount.value = 0;
  recentActivity.value = [];
}

async function loadUserData(userId: string): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.API_REQUEST,
      id: `popup_history_${Date.now()}`,
      method: "GET",
      path: `/api/user/${userId}/history`,
    });

    if (response?.data?.judgements) {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const judgements = response.data.judgements as Array<{
        revisionId: number;
        revisionWiki: string;
        action: string;
        timestamp: string;
      }>;

      todayCount.value = judgements.filter(
        (j) => new Date(j.timestamp) >= todayStart,
      ).length;

      recentActivity.value = judgements.slice(0, 5).map((j) => ({
        revId: j.revisionId,
        wiki: j.revisionWiki,
        action: j.action,
        timestamp: j.timestamp,
      }));
    }
  } catch {
    // Silently handle errors
  }
}

async function loadLeaderboard(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.API_REQUEST,
      id: `popup_leaderboard_${Date.now()}`,
      method: "GET",
      path: "/api/leaderboard",
    });

    if (response?.data?.entries) {
      leaderboard.value = (response.data.entries as LeaderboardEntry[]).slice(0, 10);
    }
  } catch {
    // Silently handle errors
  }
}

function formatAction(action: string): string {
  switch (action) {
    case "ShouldRevert": return "Should Revert";
    case "NotSure": return "Not Sure";
    case "LooksGood": return "Looks Good";
    default: return action;
  }
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const onWikipedia = ref(false);

onMounted(async () => {
  // Check if current tab is on Wikipedia
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    onWikipedia.value = !!tab?.url && /^https:\/\/\w+\.wikipedia\.org\//.test(tab.url);
  } catch { /* no permission */ }
});

async function startReviewing(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && onWikipedia.value) {
    // On Wikipedia: open modal via content script
    try {
      await chrome.tabs.sendMessage(tab.id, { type: MessageType.OPEN_MODAL });
      window.close();
      return;
    } catch { /* content script not loaded — fall through */ }
  }
  // Not on Wikipedia or content script unavailable: open dashboard
  await chrome.tabs.create({ url: "https://wikiloop-doublecheck.toolforge.org/review" });
  window.close();
}
</script>

<template>
  <div class="dc-popup">
    <header class="dc-popup-header">
      <h1>WikiLoop DoubleCheck</h1>
    </header>

    <div
      v-if="loading"
      class="dc-popup-loading"
    >
      Loading...
    </div>

    <template v-else>
      <!-- Auth Section -->
      <section class="dc-popup-auth">
        <template v-if="loggedIn">
          <div class="dc-popup-user">
            <span class="dc-popup-username">{{ username }}</span>
            <button
              class="dc-popup-btn dc-popup-btn--small"
              @click="logout"
            >
              Logout
            </button>
          </div>
          <div class="dc-popup-stats">
            <span class="dc-popup-stat">Today: <strong>{{ todayCount }}</strong> judgements</span>
          </div>
        </template>
        <template v-else>
          <p class="dc-popup-login-prompt">
            Log in to track your contributions
          </p>
          <button
            class="dc-popup-btn dc-popup-btn--primary"
            @click="login"
          >
            Login with Wikipedia
          </button>
        </template>
      </section>

      <!-- Start Reviewing -->
      <section class="dc-popup-section dc-popup-review">
        <button
          class="dc-popup-btn dc-popup-btn--review"
          @click="startReviewing"
        >
          Start Reviewing
        </button>
      </section>

      <!-- Recent Activity -->
      <section
        v-if="loggedIn && recentActivity.length > 0"
        class="dc-popup-section"
      >
        <h2>Recent Activity</h2>
        <ul class="dc-popup-activity">
          <li
            v-for="item in recentActivity"
            :key="`${item.wiki}-${item.revId}-${item.timestamp}`"
          >
            <span class="dc-popup-activity-action">{{ formatAction(item.action) }}</span>
            <span class="dc-popup-activity-rev">{{ item.wiki }}:{{ item.revId }}</span>
            <span class="dc-popup-activity-time">{{ formatTime(item.timestamp) }}</span>
          </li>
        </ul>
      </section>

      <!-- Mini Leaderboard -->
      <section
        v-if="leaderboard.length > 0"
        class="dc-popup-section"
      >
        <h2>Top Reviewers</h2>
        <ol class="dc-popup-leaderboard">
          <li
            v-for="entry in leaderboard"
            :key="entry.userId"
          >
            <span class="dc-popup-lb-rank">#{{ entry.rank }}</span>
            <span class="dc-popup-lb-name">{{ entry.username }}</span>
            <span class="dc-popup-lb-count">{{ entry.count }}</span>
          </li>
        </ol>
      </section>

      <!-- Quick Links -->
      <section class="dc-popup-section dc-popup-links">
        <a
          href="https://wikiloop-doublecheck.toolforge.org"
          target="_blank"
          rel="noopener"
        >
          Open Dashboard
        </a>
      </section>
    </template>

    <footer class="dc-popup-footer">
      v{{ appVersion }}{{ gitHash ? '+' + gitHash : '' }}
    </footer>
  </div>
</template>

<style scoped>
.dc-popup {
  width: 360px;
  min-height: 300px;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: #202122;
}

.dc-popup-header {
  padding: 12px 16px;
  background: #3366cc;
  color: #fff;
}

.dc-popup-header h1 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.dc-popup-loading {
  padding: 32px;
  text-align: center;
  color: #72777d;
}

.dc-popup-auth {
  padding: 12px 16px;
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

.dc-popup-stats {
  margin-top: 8px;
  color: #54595d;
}

.dc-popup-stat strong {
  color: #202122;
}

.dc-popup-login-prompt {
  margin: 0 0 8px;
  color: #54595d;
}

.dc-popup-btn {
  padding: 6px 12px;
  border: 1px solid #a2a9b1;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.dc-popup-btn:hover {
  background: #eaecf0;
}

.dc-popup-btn--primary {
  background: #3366cc;
  color: #fff;
  border-color: #3366cc;
}

.dc-popup-btn--primary:hover {
  background: #2a4b8d;
}

.dc-popup-btn--small {
  padding: 3px 8px;
  font-size: 12px;
}

.dc-popup-section {
  padding: 12px 16px;
  border-bottom: 1px solid #eaecf0;
}

.dc-popup-section h2 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #54595d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dc-popup-activity {
  list-style: none;
  margin: 0;
  padding: 0;
}

.dc-popup-activity li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
}

.dc-popup-activity-action {
  font-weight: 500;
  min-width: 90px;
}

.dc-popup-activity-rev {
  flex: 1;
  color: #3366cc;
}

.dc-popup-activity-time {
  color: #72777d;
}

.dc-popup-leaderboard {
  list-style: none;
  margin: 0;
  padding: 0;
  counter-reset: none;
}

.dc-popup-leaderboard li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 12px;
}

.dc-popup-lb-rank {
  min-width: 28px;
  font-weight: 600;
  color: #72777d;
}

.dc-popup-lb-name {
  flex: 1;
}

.dc-popup-lb-count {
  font-weight: 500;
  color: #54595d;
}

.dc-popup-links {
  text-align: center;
}

.dc-popup-links a {
  color: #3366cc;
  text-decoration: none;
}

.dc-popup-links a:hover {
  text-decoration: underline;
}

.dc-popup-review {
  text-align: center;
  padding: 16px;
}

.dc-popup-btn--review {
  width: 100%;
  padding: 10px 16px;
  background: #3366cc;
  color: #fff;
  border-color: #3366cc;
  font-size: 14px;
  font-weight: 600;
  border-radius: 6px;
}

.dc-popup-btn--review:hover {
  background: #2a4b8d;
}

.dc-popup-footer {
  padding: 8px 16px;
  text-align: center;
  font-size: 11px;
  color: #a2a9b1;
}
</style>
