// Content script entry point — detects page type and injects appropriate UI

import { detectPageType, extractRevisionId, extractWikiId } from "./detection.js";
import { injectReviewPanel, cleanupReviewPanel } from "./inject-panel.js";
import { injectRiskBadges, cleanupRiskBadges } from "./inject-badges.js";

function main(): void {
  const pageType = detectPageType();

  switch (pageType) {
    case "diff":
      injectDiffPageUI();
      break;
    case "recentchanges":
    case "watchlist":
      injectListPageUI();
      break;
    default:
      // Unknown page type — do nothing
      break;
  }

  // Clean up on navigation
  window.addEventListener("beforeunload", cleanup);
}

function injectDiffPageUI(): void {
  const revId = extractRevisionId();
  const wiki = extractWikiId();

  if (!revId) return;

  injectReviewPanel(wiki, revId);
}

function injectListPageUI(): void {
  injectRiskBadges();
}

function cleanup(): void {
  cleanupReviewPanel();
  cleanupRiskBadges();
}

// Listen for SSE events from the background worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SSE_EVENT" && message.eventType === "judgement") {
    // A new judgement was recorded — refresh if relevant
    const data = message.data as {
      revisionWiki: string;
      revisionId: number;
    };
    const currentRevId = extractRevisionId();
    const currentWiki = extractWikiId();

    if (data.revisionWiki === currentWiki && data.revisionId === currentRevId) {
      // Re-inject to refresh data
      injectReviewPanel(currentWiki, currentRevId);
    }
  }
});

// Run on load
main();
