<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useAuth } from "../composables/useAuth";

const { t } = useI18n();
const { user, isLoggedIn, login, logout } = useAuth();
</script>

<template>
  <div class="dc-app-layout">
    <header class="dc-header">
      <div class="dc-header-inner">
        <router-link
          to="/"
          class="dc-logo-link"
        >
          <img
            src="/wikiloop-doublecheck-logo.svg"
            alt="WikiLoop DoubleCheck"
            class="dc-logo"
          >
        </router-link>
        <nav class="dc-nav">
          <router-link
            to="/review"
            class="dc-nav-link"
          >
            {{ t("Label-ReviewFeed") }}
          </router-link>
          <router-link
            to="/feed"
            class="dc-nav-link"
          >
            {{ t("Label-Feed") }}
          </router-link>
          <router-link
            to="/leaderboard"
            class="dc-nav-link"
          >
            {{ t("Label-TopUsers") }}
          </router-link>
          <router-link
            v-if="isLoggedIn"
            to="/history"
            class="dc-nav-link"
          >
            {{ t("Label-MyHistory") }}
          </router-link>
        </nav>
        <div class="dc-auth">
          <template v-if="isLoggedIn && user">
            <span class="dc-username">{{ user.username }}</span>
            <button
              class="dc-btn dc-btn--text"
              @click="logout()"
            >
              {{ t("Label-Logout") }}
            </button>
          </template>
          <template v-else>
            <button
              class="dc-btn dc-btn--primary"
              @click="login()"
            >
              {{ t("Label-Login") }}
            </button>
          </template>
        </div>
      </div>
    </header>

    <main class="dc-main">
      <slot />
    </main>

    <footer class="dc-footer">
      <div class="dc-footer-inner">
        <span>Powered by WikiLoop</span>
        <a
          href="https://github.com/wikiloop/doublecheck"
          target="_blank"
          rel="noopener"
        >
          GitHub
        </a>
        <a
          href="https://meta.wikimedia.org/wiki/WikiLoop"
          target="_blank"
          rel="noopener"
        >
          Meta-Wiki
        </a>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.dc-app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.dc-header {
  background: #fff;
  border-bottom: 1px solid #c8ccd1;
  padding: 0 1rem;
  position: sticky;
  top: 0;
  z-index: 100;
}

.dc-header-inner {
  display: flex;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
  height: 56px;
  gap: 1rem;
}

.dc-logo-link {
  display: flex;
  align-items: center;
  text-decoration: none;
}

.dc-logo {
  height: 32px;
}

.dc-nav {
  display: flex;
  gap: 0.5rem;
  flex: 1;
}

.dc-nav-link {
  padding: 0.5rem 0.75rem;
  text-decoration: none;
  color: #202122;
  border-radius: 4px;
  font-size: 0.9rem;
}

.dc-nav-link:hover {
  background: #eaecf0;
}

.dc-nav-link.router-link-active {
  color: #3366cc;
  font-weight: 600;
}

.dc-auth {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dc-username {
  font-size: 0.9rem;
  color: #54595d;
}

.dc-btn {
  border: none;
  border-radius: 4px;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.dc-btn--primary {
  background: #3366cc;
  color: #fff;
}

.dc-btn--primary:hover {
  background: #2a4b8d;
}

.dc-btn--text {
  background: transparent;
  color: #3366cc;
}

.dc-btn--text:hover {
  background: #eaecf0;
}

.dc-main {
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  padding: 1rem;
}

.dc-footer {
  border-top: 1px solid #c8ccd1;
  padding: 1rem;
  background: #f8f9fa;
}

.dc-footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  gap: 1.5rem;
  font-size: 0.85rem;
  color: #54595d;
}

.dc-footer-inner a {
  color: #3366cc;
  text-decoration: none;
}

@media (max-width: 600px) {
  .dc-header-inner {
    flex-wrap: wrap;
    height: auto;
    padding: 0.5rem 0;
  }

  .dc-nav {
    order: 3;
    width: 100%;
    overflow-x: auto;
  }
}
</style>
