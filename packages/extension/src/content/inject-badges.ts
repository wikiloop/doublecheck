// Inject risk badges on RecentChanges and Watchlist pages

import { apiGet } from "./api.js";
import { openReviewModal } from "./inject-modal.js";

const BADGE_CLASS = "dc-risk-badge";
const PROCESSED_ATTR = "data-dc-processed";

/**
 * Inject colored risk badges next to edit rows on RC/Watchlist pages.
 */
export async function injectRiskBadges(): Promise<void> {
  // Find all diff links that haven't been processed yet
  const diffLinks = document.querySelectorAll<HTMLAnchorElement>(
    `.mw-changeslist a[href*="diff="]:not([${PROCESSED_ATTR}]),` +
    `.mw-changeslist a[href*="Special:Diff/"]:not([${PROCESSED_ATTR}])`,
  );

  for (const link of diffLinks) {
    link.setAttribute(PROCESSED_ATTR, "true");

    const revId = extractRevIdFromLink(link.href);
    const wiki = extractWikiFromLink(link.href);

    if (!revId || !wiki) continue;

    // Fetch LiftWing score for this revision
    fetchAndInjectBadge(link, wiki, revId);
  }

  // Watch for dynamically loaded content (AJAX navigation in RC)
  observeNewContent();
}

async function fetchAndInjectBadge(
  link: HTMLAnchorElement,
  wiki: string,
  revId: number,
): Promise<void> {
  try {
    const result = await apiGet<{ damaging: number; goodfaith: number }>(
      `/api/liftwing/${wiki}/${revId}`,
    );

    if (result.status === 200 && result.data) {
      const badge = createBadge(result.data.damaging);
      // Click badge to open review modal for this revision
      badge.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (revId && wiki) openReviewModal(wiki, revId);
      });
      link.parentElement?.insertBefore(badge, link.nextSibling);
    }
  } catch {
    // Silently fail — don't disrupt the page
  }
}

function createBadge(damagingScore: number): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = BADGE_CLASS;

  let level: string;
  let color: string;
  let bgColor: string;

  if (damagingScore >= 0.7) {
    level = "high";
    color = "#d33";
    bgColor = "#fee7e6";
  } else if (damagingScore >= 0.4) {
    level = "med";
    color = "#ac6600";
    bgColor = "#fef6e7";
  } else {
    level = "low";
    color = "#14866d";
    bgColor = "#d5fdf4";
  }

  badge.textContent = `${Math.round(damagingScore * 100)}%`;
  badge.title = `Damaging probability: ${level}`;
  badge.style.cssText = `
    display: inline-block;
    margin-left: 4px;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    color: ${color};
    background: ${bgColor};
    cursor: pointer;
  `;

  return badge;
}

function extractRevIdFromLink(href: string): number | null {
  try {
    const url = new URL(href);
    const diff = url.searchParams.get("diff");
    if (diff) {
      const id = parseInt(diff, 10);
      return isNaN(id) ? null : id;
    }
    const match = url.pathname.match(/Special:Diff\/(\d+)/);
    if (match) return parseInt(match[1], 10);
  } catch {
    // Invalid URL
  }
  return null;
}

function extractWikiFromLink(href: string): string | null {
  try {
    const url = new URL(href);
    const match = url.hostname.match(/^(\w+)\.wikipedia\.org$/);
    if (match) return `${match[1]}wiki`;
  } catch {
    // Invalid URL
  }
  return null;
}

let observer: MutationObserver | null = null;

function observeNewContent(): void {
  if (observer) return;

  const target = document.querySelector(".mw-changeslist");
  if (!target) return;

  observer = new MutationObserver(() => {
    injectRiskBadges();
  });

  observer.observe(target, { childList: true, subtree: true });
}

/**
 * Clean up badges and disconnect observer.
 */
export function cleanupRiskBadges(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  document.querySelectorAll(`.${BADGE_CLASS}`).forEach((el) => el.remove());
  document
    .querySelectorAll(`[${PROCESSED_ATTR}]`)
    .forEach((el) => el.removeAttribute(PROCESSED_ATTR));
}
