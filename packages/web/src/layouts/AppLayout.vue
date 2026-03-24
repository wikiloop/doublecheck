<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { CdxButton } from "@wikimedia/codex";
import { useAuth } from "../composables/useAuth";

declare const __APP_VERSION__: string;
declare const __GIT_HASH__: string;

const { t } = useI18n();
const { user, isLoggedIn, login, logout } = useAuth();
const appVersion = __APP_VERSION__;
const gitHash = __GIT_HASH__;
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
            <CdxButton
              weight="quiet"
              @click="logout()"
            >
              {{ t("Label-Logout") }}
            </CdxButton>
          </template>
          <template v-else>
            <CdxButton
              action="progressive"
              weight="primary"
              @click="login()"
            >
              {{ t("Label-Login") }}
            </CdxButton>
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
        <router-link to="/tos">
          Terms &amp; Privacy
        </router-link>
        <span class="dc-footer-version">v{{ appVersion }} ({{ gitHash }})</span>
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
  background: var(--background-color-base);
  border-bottom: 1px solid var(--border-color-subtle);
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
  color: var(--color-base);
  border-radius: 4px;
  font-size: 0.9rem;
}

.dc-nav-link:hover {
  background: var(--background-color-neutral);
}

.dc-nav-link.router-link-active {
  color: var(--color-progressive);
  font-weight: 600;
}

.dc-auth {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dc-username {
  font-size: 0.9rem;
  color: var(--color-subtle);
}

.dc-main {
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  padding: 1rem;
}

.dc-footer {
  border-top: 1px solid var(--border-color-subtle);
  padding: 1rem;
  background: var(--background-color-neutral-subtle);
}

.dc-footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  gap: 1.5rem;
  font-size: 0.85rem;
  color: var(--color-subtle);
}

.dc-footer-inner a {
  color: var(--color-progressive);
  text-decoration: none;
}

.dc-footer-version {
  margin-left: auto;
  opacity: 0.6;
  font-family: monospace;
  font-size: 0.75rem;
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
