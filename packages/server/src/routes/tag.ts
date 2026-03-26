import { Hono, type Context } from "hono";
import type { TagRequest, TagResponse } from "@doublecheck/core";
import { getSession, updateSessionTokens } from "../middleware/session.js";
import {
  fetchCsrfToken,
  refreshAccessToken,
  prependToArticle,
} from "../lib/mediawiki.js";

const tag = new Hono();

/** Map of supported tag names to their Wikipedia template names. */
const ALLOWED_TAGS: Record<string, string> = {
  unreferenced: "Unreferenced",
  refimprove: "Refimprove",
  POV: "POV",
  cleanup: "Cleanup",
  "original research": "Original research",
  notability: "Notability",
};

/** Build the current month+year string for template date params (e.g. "March 2026"). */
function currentMonthYear(): string {
  const now = new Date();
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
}

/** Obtain a valid CSRF token, refreshing the OAuth token if needed. */
async function obtainCsrfToken(
  c: Context,
  wiki: string,
  session: { accessToken: string; refreshToken?: string },
): Promise<{ activeToken: string; csrfToken: string } | null> {
  let activeToken = session.accessToken;
  let csrfToken = await fetchCsrfToken(wiki, activeToken);

  if (!csrfToken && session.refreshToken) {
    const refreshed = await refreshAccessToken(session.refreshToken);
    if (refreshed) {
      activeToken = refreshed.accessToken;
      csrfToken = await fetchCsrfToken(wiki, activeToken);
      if (csrfToken) {
        await updateSessionTokens(c, refreshed.accessToken, refreshed.refreshToken);
      }
    }
  }

  if (!csrfToken) return null;
  return { activeToken, csrfToken };
}

/** POST /api/tag — prepend maintenance templates to an article */
tag.post("/", async (c) => {
  const session = await getSession(c);
  if (!session?.accessToken) {
    return c.json<TagResponse>({ success: false, error: "Not logged in" }, 401);
  }

  const body = await c.req.json<TagRequest>();
  if (!body.wiki || !body.title || !Array.isArray(body.tags) || body.tags.length === 0) {
    return c.json<TagResponse>(
      { success: false, error: "wiki, title, and at least one tag are required" },
      400,
    );
  }

  // Validate all tags
  const validTags: string[] = [];
  for (const t of body.tags) {
    if (!ALLOWED_TAGS[t]) {
      return c.json<TagResponse>(
        { success: false, error: `Unknown tag: ${t}` },
        400,
      );
    }
    validTags.push(t);
  }

  try {
    const tokens = await obtainCsrfToken(c, body.wiki, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    if (!tokens) {
      return c.json<TagResponse>(
        { success: false, error: "Failed to obtain edit token — please log out and log in again" },
        401,
      );
    }

    // Build the wikitext to prepend
    const date = currentMonthYear();
    const templateLines = validTags.map(
      (t) => `{{${ALLOWED_TAGS[t]}|date=${date}}}`,
    );
    const prependText = templateLines.join("\n") + "\n";

    // Build edit summary
    const templateNames = validTags.map((t) => `{{${ALLOWED_TAGS[t]}}}`);
    const summary =
      `Added maintenance tag(s): ${templateNames.join(", ")}. ` +
      `Tagged with [[m:WikiLoop DoubleCheck|WikiLoop DoubleCheck]].`;

    const result = await prependToArticle(body.wiki, tokens.activeToken, {
      title: body.title,
      prependText,
      summary,
      csrfToken: tokens.csrfToken,
    });

    if (!result.success && result.error?.includes("permission")) {
      return c.json<TagResponse>(
        {
          success: false,
          error:
            "Your Wikipedia account does not have permission to edit this page. " +
            "This usually means the page is protected or the account is too new.",
        },
        403,
      );
    }

    return c.json<TagResponse>(
      { success: result.success, error: result.error },
      result.success ? 200 : 422,
    );
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "MediaWiki API timed out — please try again"
        : "Unexpected error communicating with Wikipedia";
    return c.json<TagResponse>({ success: false, error: message }, 504);
  }
});

export { tag };
