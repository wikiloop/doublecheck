import type { Revision } from "@doublecheck/core";

function apiUrl(wiki: string): string {
  // Map wiki identifier to MediaWiki API URL
  if (wiki === "enwiki" || wiki === "en.wikipedia.org") {
    return "https://en.wikipedia.org/w/api.php";
  }
  // Generic pattern: extract language code from wiki name
  const match = wiki.match(/^(\w+)wiki$/);
  if (match) {
    return `https://${match[1]}.wikipedia.org/w/api.php`;
  }
  return `https://${wiki}/w/api.php`;
}

/** Fetch a single revision from the MediaWiki API */
export async function fetchRevisionFromMW(
  wiki: string,
  revId: number,
): Promise<Revision | null> {
  const url = new URL(apiUrl(wiki));
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "revisions");
  url.searchParams.set("revids", String(revId));
  url.searchParams.set("rvprop", "ids|timestamp|user|comment|size");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("origin", "*");

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = await res.json();
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;

  const rev = page.revisions?.[0];
  if (!rev) return null;

  return {
    wiki,
    revId: rev.revid,
    parentRevId: rev.parentid ?? 0,
    title: page.title,
    timestamp: rev.timestamp,
    user: rev.user,
    comment: rev.comment ?? "",
    pageId: page.pageid,
  };
}

/** Fetch recent changes from MediaWiki as a revision feed */
export async function fetchRecentChanges(
  wiki: string,
  limit: number = 20,
  rcstart?: string,
): Promise<{ revisions: Revision[]; continueToken?: string }> {
  const url = new URL(apiUrl(wiki));
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "recentchanges");
  url.searchParams.set("rcprop", "ids|title|timestamp|user|comment|sizes");
  url.searchParams.set("rctype", "edit");
  url.searchParams.set("rcnamespace", "0"); // Main namespace only
  url.searchParams.set("rclimit", String(limit));
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("origin", "*");
  if (rcstart) {
    url.searchParams.set("rcstart", rcstart);
  }

  const res = await fetch(url.toString());
  if (!res.ok) return { revisions: [] };

  const data = await res.json();
  const changes = data?.query?.recentchanges ?? [];

  const revisions: Revision[] = changes.map(
    (rc: Record<string, unknown>) => ({
      wiki,
      revId: rc.revid as number,
      parentRevId: (rc.old_revid as number) ?? 0,
      title: rc.title as string,
      timestamp: rc.timestamp as string,
      user: rc.user as string,
      comment: (rc.comment as string) ?? "",
      pageId: rc.pageid as number,
    }),
  );

  const continueToken = data?.continue?.rcstart as string | undefined;
  return { revisions, continueToken };
}

/** Fetch diff HTML between two revisions from the MediaWiki API */
export async function fetchDiffFromMW(
  wiki: string,
  revId: number,
  parentRevId: number,
): Promise<string | null> {
  const url = new URL(apiUrl(wiki));
  url.searchParams.set("action", "compare");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("origin", "*");

  if (parentRevId > 0) {
    url.searchParams.set("fromrev", String(parentRevId));
  } else {
    // New page creation: compare against empty content
    url.searchParams.set("fromslots", "main");
    url.searchParams.set("fromcontentmodel", "wikitext");
    url.searchParams.set("fromtext", "");
  }
  url.searchParams.set("torev", String(revId));

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    return data?.compare?.body ?? null;
  } catch {
    return null;
  }
}

// Make apiUrl available to other modules
export { apiUrl };

const USER_AGENT = "WikiLoop-DoubleCheck/5.0 (https://doublecheck.wikiloop.org)";

/** Fetch with a timeout (default 15s) */
function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = 15_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

/** Fetch the latest N revisions of a page by title */
export async function fetchPageLatestRevisions(
  wiki: string,
  title: string,
  limit: number = 2,
): Promise<{ revid: number; user: string }[]> {
  const url = new URL(apiUrl(wiki));
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "revisions");
  url.searchParams.set("titles", title);
  url.searchParams.set("rvlimit", String(limit));
  url.searchParams.set("rvprop", "ids|user");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("origin", "*");

  const res = await fetchWithTimeout(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return [];

  const data = await res.json();
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return [];
  return (page.revisions ?? []).map((r: { revid: number; user: string }) => ({
    revid: r.revid,
    user: r.user,
  }));
}

/** Fetch a CSRF token using the user's OAuth Bearer token */
export async function fetchCsrfToken(
  wiki: string,
  accessToken: string,
): Promise<string | null> {
  const url = new URL(apiUrl(wiki));
  url.searchParams.set("action", "query");
  url.searchParams.set("meta", "tokens");
  url.searchParams.set("type", "csrf");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");

  const res = await fetchWithTimeout(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": USER_AGENT,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const token = data?.query?.tokens?.csrftoken;
  // "+\\" is the anonymous CSRF token — means the Bearer token was invalid/expired
  if (!token || token === "+\\") return null;
  return token;
}

/** Undo a specific revision (or range of revisions) via action=edit */
export async function performUndo(
  wiki: string,
  accessToken: string,
  params: { title: string; revId: number; summary: string; csrfToken: string; undoafter?: number },
): Promise<{ success: boolean; newRevId?: number; error?: string; errorCode?: string }> {
  const url = new URL(apiUrl(wiki));

  const body = new URLSearchParams();
  body.set("action", "edit");
  body.set("title", params.title);
  body.set("undo", String(params.revId));
  if (params.undoafter) {
    body.set("undoafter", String(params.undoafter));
  }
  body.set("summary", params.summary);
  body.set("token", params.csrfToken);
  body.set("format", "json");
  body.set("formatversion", "2");

  const res = await fetchWithTimeout(
    url.toString(),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
    20_000, // longer timeout for the actual edit action
  );

  const data = await res.json();

  if (data?.edit?.result === "Success") {
    return { success: true, newRevId: data.edit.newrevid };
  }

  return {
    success: false,
    error: data?.error?.info ?? data?.edit?.result ?? "Unknown error",
    errorCode: data?.error?.code ?? "unknown",
  };
}

/** Refresh an expired OAuth2 access token using a refresh token */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken?: string } | null> {
  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetchWithTimeout(
    "https://meta.wikimedia.org/w/rest.php/oauth2/access_token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    },
  );

  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  if (!data.access_token) return null;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

/** Append a new section to a user's talk page via action=edit&section=new */
export async function appendTalkPageSection(
  wiki: string,
  accessToken: string,
  params: { userTalkPage: string; sectionTitle: string; body: string; csrfToken: string },
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  const url = new URL(apiUrl(wiki));

  const formBody = new URLSearchParams();
  formBody.set("action", "edit");
  formBody.set("title", params.userTalkPage);
  formBody.set("section", "new");
  formBody.set("sectiontitle", params.sectionTitle);
  formBody.set("appendtext", params.body);
  formBody.set("token", params.csrfToken);
  formBody.set("format", "json");
  formBody.set("formatversion", "2");

  const res = await fetchWithTimeout(
    url.toString(),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
    },
    20_000,
  );

  const data = await res.json();

  if (data?.edit?.result === "Success") {
    return { success: true };
  }

  return {
    success: false,
    error: data?.error?.info ?? data?.edit?.result ?? "Unknown error",
    errorCode: data?.error?.code,
  };
}

/** Prepend text to the beginning of an article via action=edit with prependtext */
export async function prependToArticle(
  wiki: string,
  accessToken: string,
  params: { title: string; prependText: string; summary: string; csrfToken: string },
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  const url = new URL(apiUrl(wiki));

  const formBody = new URLSearchParams();
  formBody.set("action", "edit");
  formBody.set("title", params.title);
  formBody.set("prependtext", params.prependText);
  formBody.set("summary", params.summary);
  formBody.set("token", params.csrfToken);
  formBody.set("format", "json");
  formBody.set("formatversion", "2");

  const res = await fetchWithTimeout(
    url.toString(),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
    },
    20_000,
  );

  const data = await res.json();

  if (data?.edit?.result === "Success") {
    return { success: true };
  }

  return {
    success: false,
    error: data?.error?.info ?? data?.edit?.result ?? "Unknown error",
    errorCode: data?.error?.code,
  };
}

/** Send a thank notification for a specific revision via the Thanks extension API */
export async function sendRevisionThank(
  wiki: string,
  accessToken: string,
  params: { revId: number; csrfToken: string },
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  const url = new URL(apiUrl(wiki));

  const formBody = new URLSearchParams();
  formBody.set("action", "thank");
  formBody.set("rev", String(params.revId));
  formBody.set("token", params.csrfToken);
  formBody.set("source", "wikiloop-doublecheck");
  formBody.set("format", "json");
  formBody.set("formatversion", "2");

  const res = await fetchWithTimeout(
    url.toString(),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
    },
    15_000,
  );

  const data = await res.json();

  if (data?.result?.success === 1) {
    return { success: true };
  }

  return {
    success: false,
    error: data?.error?.info ?? "Unknown error",
    errorCode: data?.error?.code,
  };
}

/** Mark a revision as patrolled via action=patrol */
export async function markAsPatrolled(
  wiki: string,
  accessToken: string,
  params: { revId: number; csrfToken: string },
): Promise<{ success: boolean; error?: string }> {
  const url = new URL(apiUrl(wiki));

  const body = new URLSearchParams();
  body.set("action", "patrol");
  body.set("revid", String(params.revId));
  body.set("token", params.csrfToken);
  body.set("format", "json");
  body.set("formatversion", "2");

  const res = await fetchWithTimeout(
    url.toString(),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
    15_000,
  );

  const data = await res.json();

  if (data?.patrol) {
    return { success: true };
  }

  return {
    success: false,
    error: data?.error?.info ?? "Unknown error",
  };
}

/** Check whether a page exists on a wiki */
export async function checkPageExists(
  wiki: string,
  title: string,
): Promise<boolean> {
  const url = new URL(apiUrl(wiki));
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", title);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("origin", "*");

  try {
    const res = await fetchWithTimeout(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return false;
    const data = await res.json();
    const page = data?.query?.pages?.[0];
    return !!page && !page.missing;
  } catch {
    return false;
  }
}

/** Fetch the raw wikitext content of a page */
export async function fetchPageWikitext(
  wiki: string,
  title: string,
): Promise<string | null> {
  const url = new URL(apiUrl(wiki));
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "revisions");
  url.searchParams.set("titles", title);
  url.searchParams.set("rvprop", "content");
  url.searchParams.set("rvslots", "main");
  url.searchParams.set("rvlimit", "1");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("origin", "*");

  try {
    const res = await fetchWithTimeout(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const page = data?.query?.pages?.[0];
    if (!page || page.missing) return null;
    return page.revisions?.[0]?.slots?.main?.content ?? null;
  } catch {
    return null;
  }
}

/**
 * Detect the highest vandalism warning level on a user's talk page for the
 * current month.  Returns 0 if no warnings found, 1–4 for the highest level.
 *
 * Searches for patterns like {{subst:uw-vandalism1}}, {{uw-vandalism2}},
 * {{uw-vandalism3}}, {{uw-vandalism4}}, {{uw-vandalism4im}}.
 *
 * Only counts warnings that appear in sections whose heading contains the
 * current month and year (e.g., "March 2026") to avoid penalising users for
 * old warnings.
 */
export function detectWarningLevel(talkPageWikitext: string): number {
  if (!talkPageWikitext) return 0;

  // Build the current month+year string to match section headings
  const now = new Date();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const currentMonthYear = `${monthNames[now.getUTCMonth()]} ${now.getUTCFullYear()}`;

  // Split by section headings (== ... ==)
  // We look for the current month's sections, or if no month sections exist,
  // we scan the whole page (some talk pages don't use monthly sections).
  const lines = talkPageWikitext.split("\n");
  let inCurrentMonth = false;
  let hasMonthSections = false;
  let maxLevel = 0;

  const warningPattern = /uw-vandalism(\d)(?:im)?/g;

  for (const line of lines) {
    // Check for section headings
    const headingMatch = line.match(/^==+\s*(.*?)\s*==+$/);
    if (headingMatch) {
      const heading = headingMatch[1];
      if (heading.includes(currentMonthYear)) {
        inCurrentMonth = true;
        hasMonthSections = true;
      } else if (/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/.test(heading)) {
        // A different month's section
        inCurrentMonth = false;
        hasMonthSections = true;
      }
    }

    // Only scan lines in the current month's sections (or all lines if no month sections)
    if (hasMonthSections && !inCurrentMonth) continue;

    let match: RegExpExecArray | null;
    while ((match = warningPattern.exec(line)) !== null) {
      const level = parseInt(match[1], 10);
      if (level > maxLevel) maxLevel = level;
    }
  }

  return Math.min(maxLevel, 4);
}

/** Verify a MediaWiki access token by calling userinfo */
export async function verifyMWToken(
  accessToken: string,
): Promise<{ username: string } | null> {
  const res = await fetch(
    "https://meta.wikimedia.org/w/api.php?action=query&meta=userinfo&format=json&formatversion=2",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok) return null;
  const data = await res.json();
  const username = data?.query?.userinfo?.name;
  if (!username || data?.query?.userinfo?.anon !== undefined) return null;
  return { username };
}
