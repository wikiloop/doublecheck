import { fetchLiftWingScoresBatch } from "../api.js";
import { msg } from "../i18n.js";
import { openReviewModal } from "./modal.js";

const BADGE_CLASS = "dc-risk-badge";
const BADGE_ATTR = "data-dc-badge";

/** Determine badge color based on damaging score. */
export function getBadgeLevel(damaging: number): "high" | "medium" | "low" {
  if (damaging > 0.7) return "high";
  if (damaging > 0.4) return "medium";
  return "low";
}

/** Get badge CSS class for a damaging score. */
function getBadgeClass(damaging: number): string {
  const level = getBadgeLevel(damaging);
  return `${BADGE_CLASS} dc-badge-${level}`;
}

/** Get badge label for a damaging score. */
function getBadgeLabel(damaging: number): string {
  const level = getBadgeLevel(damaging);
  switch (level) {
    case "high":
      return msg("dc-badge-high-risk");
    case "medium":
      return msg("dc-badge-medium-risk");
    case "low":
      return msg("dc-badge-low-risk");
  }
}

/** Extract wiki ID from the current page hostname. */
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

/**
 * Extract revision IDs from edit rows on RecentChanges/Watchlist pages.
 * Returns a Map from revId to the DOM element for that row.
 */
function extractEditRows(): Map<number, Element> {
  const rows = new Map<number, Element>();

  // RecentChanges and Watchlist use various link patterns
  const links = document.querySelectorAll(
    ".mw-changeslist a[href*='diff='], .mw-changeslist a[href*='Special:Diff/']",
  );

  for (const link of links) {
    // Skip if we already badged this row
    const row = link.closest("tr, li, .mw-changeslist-line");
    if (!row || row.hasAttribute(BADGE_ATTR)) continue;

    const href = link.getAttribute("href") ?? "";
    let revId: number | null = null;

    // Try diff= parameter
    const diffMatch = href.match(/[?&]diff=(\d+)/);
    if (diffMatch) {
      revId = parseInt(diffMatch[1], 10);
    }

    // Try Special:Diff/NNN
    if (!revId) {
      const pathMatch = href.match(/Special:Diff\/(\d+)/);
      if (pathMatch) {
        revId = parseInt(pathMatch[1], 10);
      }
    }

    if (revId && !rows.has(revId)) {
      rows.set(revId, row);
    }
  }

  return rows;
}

/** Inject risk badges into RecentChanges or Watchlist page. */
export async function injectBadges(): Promise<void> {
  const editRows = extractEditRows();
  if (editRows.size === 0) return;

  const wiki = getWikiId();
  const revIds = Array.from(editRows.keys());

  // Batch fetch scores with limited concurrency
  const scores = await fetchLiftWingScoresBatch(wiki, revIds);

  for (const [revId, row] of editRows) {
    const score = scores.get(revId);
    if (!score) continue;

    const badge = document.createElement("span");
    badge.className = getBadgeClass(score.damaging);
    badge.textContent = getBadgeLabel(score.damaging);
    badge.title = `Damaging: ${Math.round(score.damaging * 100)}%`;

    row.setAttribute(BADGE_ATTR, "true");

    // Click badge to open review modal for this revision
    badge.style.cursor = "pointer";
    badge.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openReviewModal(wiki, revId);
    });

    // Insert badge near the beginning of the row for visibility
    const firstLink = row.querySelector("a");
    if (firstLink) {
      firstLink.parentNode?.insertBefore(badge, firstLink);
    } else {
      row.prepend(badge);
    }
  }
}
