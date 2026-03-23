// Detect the type of Wikipedia page we're on

export type WikiPageType = "diff" | "recentchanges" | "watchlist" | "unknown";

/**
 * Detect what type of Wikipedia page the content script is running on.
 */
export function detectPageType(): WikiPageType {
  const url = window.location.href;

  // Diff page: /w/index.php?diff=... or /wiki/Special:Diff/...
  if (
    url.includes("/w/index.php") && url.includes("diff=") ||
    url.includes("/wiki/Special:Diff/")
  ) {
    return "diff";
  }

  // Recent changes
  if (url.includes("/wiki/Special:RecentChanges")) {
    return "recentchanges";
  }

  // Watchlist
  if (url.includes("/wiki/Special:Watchlist")) {
    return "watchlist";
  }

  return "unknown";
}

/**
 * Extract the revision ID from a diff page URL.
 */
export function extractRevisionId(): number | null {
  const url = new URL(window.location.href);

  // /w/index.php?diff=12345
  const diffParam = url.searchParams.get("diff");
  if (diffParam) {
    const id = parseInt(diffParam, 10);
    return isNaN(id) ? null : id;
  }

  // /wiki/Special:Diff/12345
  const match = url.pathname.match(/\/wiki\/Special:Diff\/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }

  return null;
}

/**
 * Extract the wiki identifier from the hostname (e.g., "en.wikipedia.org" -> "enwiki").
 */
export function extractWikiId(): string {
  const hostname = window.location.hostname;
  const match = hostname.match(/^(\w+)\.wikipedia\.org$/);
  if (match) {
    return `${match[1]}wiki`;
  }
  return "enwiki";
}
