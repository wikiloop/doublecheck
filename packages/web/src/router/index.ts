import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "landing",
    component: () => import("../pages/LandingPage.vue"),
  },
  {
    path: "/review/:wiki?/:revId?",
    name: "review",
    component: () => import("../pages/ReviewPage.vue"),
  },
  {
    path: "/feed/:feedName?",
    name: "feed",
    component: () => import("../pages/FeedPage.vue"),
  },
  {
    path: "/leaderboard",
    name: "leaderboard",
    component: () => import("../pages/LeaderboardPage.vue"),
  },
  {
    path: "/history",
    name: "history",
    component: () => import("../pages/HistoryPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/auth/callback",
    name: "auth-callback",
    component: () => import("../pages/AuthCallbackPage.vue"),
  },
  {
    path: "/tos",
    name: "tos",
    component: () => import("../pages/TosPage.vue"),
  },
  {
    path: "/privacy",
    name: "privacy",
    component: () => import("../pages/PrivacyPage.vue"),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
