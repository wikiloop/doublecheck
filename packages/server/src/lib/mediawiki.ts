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
