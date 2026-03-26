// Type declarations for mediawiki are included via tsconfig
import { initI18n } from "./i18n.js";

// Inline CSS at build time
import "./styles/panel.css";
import "./styles/badges.css";

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
  if (window.Vue) return window.Vue;

  if (hasRLModule("vue")) {
    try {
      await mw.loader.using(["vue"]);
      if (window.Vue) return window.Vue;
    } catch {
      console.warn(`${LOG_PREFIX} ResourceLoader failed to load vue`);
    }
  }

  throw new Error(`${LOG_PREFIX} Could not load Vue`);
}

/**
 * Dynamically load an external script.
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
 * Detect which page type we're on.
 */
function detectPageType(): "diff" | "recentchanges" | "watchlist" | "other" {
  const url = window.location.href;

  if (url.includes("Special:Diff/") || url.includes("diff=")) {
    return "diff";
  }

  try {
    const specialPage = mw.config.get("wgCanonicalSpecialPageName") as string | null;
    if (specialPage === "Recentchanges") return "recentchanges";
    if (specialPage === "Watchlist") return "watchlist";
  } catch {
    // Fallback to URL detection
  }

  if (url.includes("Special:RecentChanges")) return "recentchanges";
  if (url.includes("Special:Watchlist")) return "watchlist";

  return "other";
}

/**
 * Add a "DoubleCheck" tab to the Wikipedia page tabs (same level as Read, Edit, History, TW).
 * Uses mw.util.addPortletLink with p-views for top-level visibility.
 */
function addToolbarLink(): void {
  try {
    mw.loader.using(["mediawiki.util"], () => {
      const pageType = detectPageType();
      const wiki = getWikiId();
      const revId = pageType === "diff" ? getRevisionId() : null;

      // p-views = top-level page tabs (Read, Edit, View history) — always visible
      const li = mw.util.addPortletLink(
        "p-views",
        "#",
        "DoubleCheck",
        "ca-doublecheck",
        revId
          ? "Review this edit with WikiLoop DoubleCheck"
          : "Open WikiLoop DoubleCheck review feed",
      );
      if (!li) return;

      // Attach click handler to the <a> inside the <li> to properly prevent navigation
      const anchor = li.querySelector("a");
      if (anchor) {
        anchor.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const { openReviewModal, isModalOpen, closeReviewModal } = await import("./injection/modal.js");
          if (isModalOpen()) {
            closeReviewModal();
          } else {
            openReviewModal(wiki, revId ?? 0);
          }
        });
      }
    });
  } catch (err) {
    console.warn(`${LOG_PREFIX} Could not add toolbar link:`, err);
  }
}

/** Get wiki ID from the current page. */
function getWikiId(): string {
  try {
    const dbName = mw.config.get("wgDBname") as string;
    return dbName || "enwiki";
  } catch {
    const host = window.location.hostname;
    const match = host.match(/^(\w+)\.wikipedia\.org$/);
    return match ? `${match[1]}wiki` : "enwiki";
  }
}

/** Get the revision ID from the current page (diff pages only). */
function getRevisionId(): number | null {
  try {
    const diffNewId = mw.config.get("wgDiffNewId") as number | null;
    if (diffNewId) return diffNewId;
    const revId = mw.config.get("wgRevisionId") as number;
    if (revId) return revId;
  } catch { /* fall through */ }

  const url = new URL(window.location.href);
  const diffParam = url.searchParams.get("diff");
  if (diffParam) return parseInt(diffParam, 10) || null;

  const pathMatch = url.pathname.match(/Special:Diff\/(\d+)/);
  if (pathMatch) return parseInt(pathMatch[1], 10) || null;

  return null;
}

/**
 * Main entry point. Runs after DOM is ready.
 */
async function bootstrap(): Promise<void> {
  initI18n();

  const pageType = detectPageType();

  // Always add toolbar link on every Wikipedia page
  addToolbarLink();

  if (pageType === "diff") {
    // Diff pages: floating button + toolbar link
    const { mountDiffPanel } = await import("./injection/diff-panel.js");
    mountDiffPanel();
  } else if (pageType === "recentchanges" || pageType === "watchlist") {
    // RC/Watchlist: risk badges on edit rows
    try {
      const { injectBadges } = await import("./injection/badges.js");
      await injectBadges();
    } catch (err) {
      console.warn(`${LOG_PREFIX} Badge injection failed:`, err);
    }
  }
  // On all other pages: toolbar link is already added above
}

// Wait for DOM to be ready, then bootstrap
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void bootstrap());
} else {
  void bootstrap();
}

// Exports for testing
export { ensureVue, detectPageType, bootstrap, hasRLModule, loadScript };
