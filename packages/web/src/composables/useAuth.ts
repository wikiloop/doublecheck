import { ref, readonly } from "vue";
import type { AuthMeResponse } from "@doublecheck/core";

const user = ref<AuthMeResponse | null>(null);
const isLoggedIn = ref(false);
const loading = ref(false);

export function useAuth() {
  async function checkAuth() {
    loading.value = true;
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json();
      if (data.loggedIn) {
        user.value = data as AuthMeResponse;
        isLoggedIn.value = true;
      } else {
        user.value = null;
        isLoggedIn.value = false;
      }
    } catch {
      user.value = null;
      isLoggedIn.value = false;
    } finally {
      loading.value = false;
    }
  }

  function login(returnTo?: string) {
    const params = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
    window.location.href = `/api/auth/login${params}`;
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "GET", credentials: "include" });
    } finally {
      user.value = null;
      isLoggedIn.value = false;
    }
  }

  return {
    user: readonly(user),
    isLoggedIn: readonly(isLoggedIn),
    loading: readonly(loading),
    checkAuth,
    login,
    logout,
  };
}
