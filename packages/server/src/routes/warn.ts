import { Hono, type Context } from "hono";
import type { WarnRequest, WarnResponse, WarnLevelResponse, WarningLevel } from "@doublecheck/core";
import { getSession, updateSessionTokens } from "../middleware/session.js";
import {
  fetchPageWikitext,
  detectWarningLevel,
  fetchCsrfToken,
  appendTalkPageSection,
  refreshAccessToken,
} from "../lib/mediawiki.js";

const warn = new Hono();

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

/** Compute the next warning level given the current highest level. */
function nextWarningLevel(currentLevel: number): WarningLevel {
  if (currentLevel >= 4) return 4; // already at max — re-post level 4
  return (currentLevel + 1) as WarningLevel;
}

/** Build the warning template wikitext. */
function warningBody(articleTitle: string, level: WarningLevel): string {
  const levelStr = String(level); // "1", "2", "3", "4", or "4im"
  return `{{subst:uw-vandalism${levelStr}|${articleTitle}}} ~~~~`;
}

/**
 * GET /api/warn/level?wiki=enwiki&user=Example
 * Detect the current warning level on a user's talk page.
 */
warn.get("/level", async (c) => {
  const session = await getSession(c);
  if (!session?.accessToken) {
    return c.json({ error: "Not logged in" }, 401);
  }

  const wiki = c.req.query("wiki");
  const user = c.req.query("user");
  if (!wiki || !user) {
    return c.json({ error: "wiki and user are required" }, 400);
  }

  try {
    const talkPageTitle = `User talk:${user}`;
    const wikitext = await fetchPageWikitext(wiki, talkPageTitle);
    const level = wikitext ? detectWarningLevel(wikitext) : 0;
    const autoLevel = nextWarningLevel(level);

    return c.json<WarnLevelResponse>({ level, autoLevel });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "MediaWiki API timed out — please try again"
        : "Unexpected error fetching talk page";
    return c.json({ error: message }, 504);
  }
});

/**
 * POST /api/warn
 * Post a warning template on a vandal's talk page.
 */
warn.post("/", async (c) => {
  const session = await getSession(c);
  if (!session?.accessToken) {
    return c.json<WarnResponse>({ success: false, error: "Not logged in" }, 401);
  }

  const body = await c.req.json<WarnRequest>();
  if (!body.wiki || !body.username || !body.articleTitle) {
    return c.json<WarnResponse>(
      { success: false, error: "wiki, username, and articleTitle are required" },
      400,
    );
  }

  try {
    // Determine warning level
    let level: WarningLevel;
    if (body.level) {
      level = body.level;
    } else {
      // Auto-detect from talk page
      const talkPageTitle = `User talk:${body.username}`;
      const wikitext = await fetchPageWikitext(body.wiki, talkPageTitle);
      const currentLevel = wikitext ? detectWarningLevel(wikitext) : 0;
      level = nextWarningLevel(currentLevel);
    }

    // Obtain CSRF token
    const tokens = await obtainCsrfToken(c, body.wiki, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    if (!tokens) {
      return c.json<WarnResponse>(
        { success: false, error: "Failed to obtain edit token — please log out and log in again" },
        401,
      );
    }

    // Build the warning section
    const now = new Date();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const sectionTitle = `${monthNames[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
    const warnText = warningBody(body.articleTitle, level);

    // Post the warning
    const result = await appendTalkPageSection(body.wiki, tokens.activeToken, {
      userTalkPage: `User talk:${body.username}`,
      sectionTitle,
      body: warnText,
      csrfToken: tokens.csrfToken,
    });

    if (!result.success) {
      if (result.error?.includes("permission")) {
        return c.json<WarnResponse>(
          {
            success: false,
            error:
              "Your Wikipedia account does not have permission to edit this talk page. " +
              "This usually means the account is too new or the talk page is protected.",
          },
          403,
        );
      }
      return c.json<WarnResponse>(
        { success: false, error: result.error ?? "Failed to post warning" },
        422,
      );
    }

    return c.json<WarnResponse>({ success: true, level });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "MediaWiki API timed out — please try again"
        : "Unexpected error communicating with Wikipedia";
    return c.json<WarnResponse>({ success: false, error: message }, 504);
  }
});

export { warn };
