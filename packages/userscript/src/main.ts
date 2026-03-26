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
 * Load Vue + Codex via ResourceLoader.
 * Assigns to window globals so the Vite IIFE build can find them.
 */
async function ensureModules(): Promise<void> {
  const modules = ["vue"];
  // Codex is optional — use it if available for richer UI
  if (hasRLModule("@wikimedia/codex")) {
    modules.push("@wikimedia/codex");
  }

  console.log(`${LOG_PREFIX} Loading ResourceLoader modules: ${modules.join(", ")}`);
  await mw.loader.using(modules);

  // Assign to window globals for Vite's IIFE externals.
  // In userscript context, require() is not available — use mw.loader.require() instead.
  const w = window as Record<string, unknown>;
  const req = (mw.loader as unknown as { require: (m: string) => unknown }).require;
  w.Vue = req("vue");
  if (modules.includes("@wikimedia/codex")) {
    w.codex = req("@wikimedia/codex");
  }

  console.log(`${LOG_PREFIX} Modules loaded — Vue: ${!!w.Vue}, Codex: ${!!w.codex}`);
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

// Keep ensureVue for backward compat (tests)
async function ensureVue(): Promise<typeof import("vue")> {
  await ensureModules();
  return (window as Record<string, unknown>).Vue as typeof import("vue");
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
 * Add a "DoubleCheck" tab to the Wikipedia page tabs.
 * Tries multiple portlet locations for compatibility across skins.
 */
function addToolbarLink(): void {
  try {
    mw.loader.using(["mediawiki.util"], () => {
      const pageType = detectPageType();
      const wiki = getWikiId();
      const revId = pageType === "diff" ? getRevisionId() : null;
      const tooltip = revId
        ? "Review this edit with WikiLoop DoubleCheck"
        : "Open WikiLoop DoubleCheck review feed";

      // Try portlet locations in order of preference
      const portlets = ["p-views", "p-cactions", "p-tb", "p-navigation"];
      let li: HTMLElement | null = null;
      let usedPortlet = "";

      for (const portlet of portlets) {
        li = mw.util.addPortletLink(portlet, "#", "DoubleCheck", "ca-doublecheck", tooltip);
        if (li) {
          usedPortlet = portlet;
          console.log(`${LOG_PREFIX} Toolbar link added to portlet: ${portlet}`);
          break;
        }
      }

      if (!li) {
        console.warn(`${LOG_PREFIX} Could not add toolbar link to any portlet`);
        return;
      }

      // Attach click handler to the <a> inside the <li>
      const anchor = li.querySelector("a");
      if (anchor) {
        anchor.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log(`${LOG_PREFIX} DoubleCheck clicked (portlet: ${usedPortlet})`);

          const { openReviewModal, isModalOpen, closeReviewModal } = await import("./injection/native-modal.js");
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

/**
 * Main entry point. Runs after DOM is ready.
 */
async function bootstrap(): Promise<void> {
  initI18n();

  // Load Vue + Codex early so IIFE globals are available for bundled components
  try {
    await ensureModules();
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to load Vue/Codex:`, err);
  }

  const pageType = detectPageType();
  const skin = (typeof mw !== "undefined" && mw.config?.get("skin")) || "unknown";
  console.log(`${LOG_PREFIX} Bootstrap — pageType: ${pageType}, skin: ${skin}`);

  // Always add toolbar link on every Wikipedia page
  addToolbarLink();

  if (pageType === "diff") {
    // Diff pages: also add floating button
    try {
      await ensureModules();
      const { mountDiffPanel } = await import("./injection/diff-panel.js");
      mountDiffPanel();
    } catch (err) {
      console.warn(`${LOG_PREFIX} Could not mount diff panel:`, err);
    }
  } else if (pageType === "recentchanges" || pageType === "watchlist") {
    // RC/Watchlist: risk badges on edit rows
    try {
      const { injectBadges } = await import("./injection/badges.js");
      await injectBadges();
    } catch (err) {
      console.warn(`${LOG_PREFIX} Badge injection failed:`, err);
    }
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
