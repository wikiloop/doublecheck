// Direct MediaWiki API helpers — same-origin calls using the user's Wikipedia session

export function getWikiUser(): { username: string | null; groups: string[] } | null {
  try {
    return {
      username: mw.config.get("wgUserName") as string | null,
      groups: (mw.config.get("wgUserGroups") as string[]) || [],
    };
  } catch { /* mw not available */ }
  return null;
}

export function getCurrentWiki(): string | null {
  const match = window.location.hostname.match(/^(\w+)\.wikipedia\.org$/);
  return match ? `${match[1]}wiki` : null;
}

export async function getCsrfToken(): Promise<string> {
  const res = await fetch("/w/api.php?action=query&meta=tokens&type=csrf&format=json", {
    credentials: "include",
  });
  const data = await res.json();
  const token = data?.query?.tokens?.csrftoken;
  if (!token || token === "+\\") throw new Error("Not logged in to Wikipedia");
  return token;
}

export async function performRevert(
  wiki: string,
  revId: number,
  baseRevId: number | undefined,
  mode: string,
  reason?: string,
): Promise<{ success: boolean; newRevId?: number; error?: string }> {
  const currentWiki = getCurrentWiki();
  if (currentWiki && currentWiki !== wiki) {
    return { success: false, error: `Cannot revert ${wiki} edits from ${currentWiki}` };
  }

  try {
    const token = await getCsrfToken();

    const revRes = await fetch(
      `/w/api.php?action=query&prop=revisions&revids=${revId}&rvprop=ids|user&format=json&formatversion=2`,
      { credentials: "include" },
    );
    const revData = await revRes.json();
    const page = revData?.query?.pages?.[0];
    if (!page?.title) return { success: false, error: "Could not find page for revision" };

    const revUser = page.revisions?.[0]?.user || "unknown";
    const summary =
      reason?.trim() ||
      (mode === "vandalism"
        ? `Reverted edit(s) by [[Special:Contributions/${revUser}|${revUser}]] ([[User talk:${revUser}|talk]]): vandalism ([[WP:DC|DoubleCheck]])`
        : `Reverted edit(s) by [[Special:Contributions/${revUser}|${revUser}]] ([[User talk:${revUser}|talk]]): good-faith revert ([[WP:DC|DoubleCheck]])`);

    const form = new URLSearchParams();
    form.set("action", "edit");
    form.set("title", page.title);
    form.set("undo", String(revId));
    if (baseRevId) form.set("undoafter", String(baseRevId));
    form.set("summary", summary);
    form.set("token", token);
    form.set("format", "json");
    form.set("formatversion", "2");

    const editRes = await fetch("/w/api.php", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const editData = await editRes.json();

    if (editData?.edit?.result === "Success") {
      return { success: true, newRevId: editData.edit.newrevid };
    }
    return {
      success: false,
      error: editData?.error?.info || editData?.edit?.result || "Revert failed",
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function performThank(
  wiki: string,
  revId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getCsrfToken();
    const form = new URLSearchParams();
    form.set("action", "thank");
    form.set("rev", String(revId));
    form.set("token", token);
    form.set("format", "json");

    const res = await fetch("/w/api.php", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = await res.json();

    if (data?.result?.success) return { success: true };
    return { success: false, error: data?.error?.info || "Thank failed" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function performWarn(
  wiki: string,
  username: string,
  level: number | string,
  articleTitle: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getCsrfToken();
    const talkPage = `User talk:${username}`;

    const templateMap: Record<string, string> = {
      "1": `{{subst:uw-vandalism1|${articleTitle}}} ~~~~`,
      "2": `{{subst:uw-vandalism2|${articleTitle}}} ~~~~`,
      "3": `{{subst:uw-vandalism3|${articleTitle}}} ~~~~`,
      "4": `{{subst:uw-vandalism4|${articleTitle}}} ~~~~`,
      "4im": `{{subst:uw-vandalism4im|${articleTitle}}} ~~~~`,
    };
    const templateText = templateMap[String(level)] || templateMap["1"];

    const form = new URLSearchParams();
    form.set("action", "edit");
    form.set("title", talkPage);
    form.set("section", "new");
    form.set("sectiontitle", `Warning: Editing on [[${articleTitle}]]`);
    form.set("text", templateText);
    form.set("summary", `Level ${level} warning re: [[${articleTitle}]] ([[WP:DC|DoubleCheck]])`);
    form.set("token", token);
    form.set("format", "json");
    form.set("formatversion", "2");

    const res = await fetch("/w/api.php", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = await res.json();

    if (data?.edit?.result === "Success") return { success: true };
    return { success: false, error: data?.error?.info || "Warning failed" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/** Fetch diff HTML from same-origin MediaWiki API */
export async function fetchDiffHtml(
  revId: number,
  parentRevId: number,
): Promise<string> {
  const url = new URL("/w/api.php", window.location.origin);
  url.searchParams.set("action", "compare");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  if (parentRevId > 0) {
    url.searchParams.set("fromrev", String(parentRevId));
  } else {
    url.searchParams.set("fromslots", "main");
    url.searchParams.set("fromcontentmodel", "wikitext");
    url.searchParams.set("fromtext", "");
  }
  url.searchParams.set("torev", String(revId));

  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) return "";
  const data = await res.json();
  const body = data?.compare?.body ?? "";
  return body ? `<table class="diff diff-contentalign-ltr"><tbody>${body}</tbody></table>` : "";
}
