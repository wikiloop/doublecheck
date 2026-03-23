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
