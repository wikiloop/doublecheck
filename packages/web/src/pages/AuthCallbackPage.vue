<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const error = ref<string | null>(null);

onMounted(async () => {
  const code = route.query.code as string | undefined;
  const state = route.query.state as string | undefined;

  if (!code || !state) {
    error.value = "Missing OAuth parameters.";
    return;
  }

  try {
    const res = await fetch(
      `/api/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
      { credentials: "include" }
    );

    if (res.ok) {
      // Determine where to redirect
      const returnTo = route.query.returnTo as string | undefined;
      router.replace(returnTo || "/review");
    } else {
      error.value = "Authentication failed. Please try again.";
    }
  } catch {
    error.value = "Network error during authentication.";
  }
});
</script>

<template>
  <div class="dc-auth-callback">
    <div v-if="error" class="dc-auth-callback__error">
      <p>{{ error }}</p>
      <router-link to="/">Return to home</router-link>
    </div>
    <div v-else class="dc-auth-callback__loading">
      Completing login...
    </div>
  </div>
</template>

<style scoped>
.dc-auth-callback {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50vh;
  text-align: center;
}

.dc-auth-callback__error {
  color: #d33;
}

.dc-auth-callback__error a {
  color: #3366cc;
}

.dc-auth-callback__loading {
  color: #54595d;
  font-size: 1.1rem;
}
</style>
