/// <reference path="./types/mediawiki.d.ts" />

import { initI18n } from "./i18n.js";

// Inline CSS at build time
import "./styles/panel.css";
import "./styles/badges.css";

const VENDOR_BASE = "https://wikiloop-doublecheck.toolforge.org/vendor";
const LOG_PREFIX = "[DoubleCheck]";

/**
 * Check if a ResourceLoader module is available.
 */
function hasRLModule(name: string): boolean {
  try {
    const state = mw.loader.getState(name);
    return state !== null && state !== "error";
  } catch {
    return false;
  }
}

/**
 * Load Vue via ResourceLoader if available, otherwise from self-hosted vendor.
 */
async function ensureVue(): Promise<typeof import("vue")> {
  // Check if Vue is already globally available
  if (window.Vue) return window.Vue;

  // Try ResourceLoader first
  if (hasRLModule("vue")) {
    try {
      await mw.loader.using(["vue"]);
      if (window.Vue) return window.Vue;
    } catch {
      console.warn(`${LOG_PREFIX} ResourceLoader failed to load vue, trying vendor fallback`);
    }
  }

  // Self-hosted fallback
  try {
    await loadScript(`${VENDOR_BASE}/vue.global.prod.js`);
    if (window.Vue) return window.Vue;
  } catch {
    // CSP or network error
  }

  throw new Error(`${LOG_PREFIX} Could not load Vue — cannot initialize`);
}

/**
 * Dynamically load an external script.
 * Rejects if CSP blocks the script or it fails to load.
 */
function loadScript(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Detect which page type we're on and bootstrap accordingly.
 */
function detectPageType(): "diff" | "recentchanges" | "watchlist" | "unknown" {
  const url = window.location.href;

  // Check for diff pages
  if (url.includes("Special:Diff/") || url.includes("diff=")) {
    return "diff";
  }

  // Check for RecentChanges
  try {
    const specialPage = mw.config.get("wgCanonicalSpecialPageName") as string | null;
    if (specialPage === "Recentchanges") return "recentchanges";
    if (specialPage === "Watchlist") return "watchlist";
  } catch {
    // Fallback to URL detection
  }

  if (url.includes("Special:RecentChanges")) return "recentchanges";
  if (url.includes("Special:Watchlist")) return "watchlist";

  return "unknown";
}

/**
 * Main entry point. Runs after DOM is ready.
 */
async function bootstrap(): Promise<void> {
  initI18n();

  const pageType = detectPageType();
  if (pageType === "unknown") return;

  try {
    await ensureVue();
  } catch (err) {
    console.warn(`${LOG_PREFIX} ${err instanceof Error ? err.message : err}`);
    console.warn(`${LOG_PREFIX} Aborting — no DOM injection will occur`);
    return;
  }

  if (pageType === "diff") {
    const { mountDiffPanel } = await import("./injection/diff-panel.js");
    mountDiffPanel();
  } else {
    const { injectBadges } = await import("./injection/badges.js");
    await injectBadges();
  }
}

// Wait for DOM to be ready, then bootstrap
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void bootstrap());
} else {
  void bootstrap();
}

// Exports for testing
export { ensureVue, detectPageType, bootstrap, hasRLModule, loadScript };
