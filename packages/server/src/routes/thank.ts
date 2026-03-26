import { Hono, type Context } from "hono";
import { getSession, updateSessionTokens } from "../middleware/session.js";
import {
  fetchRevisionFromMW,
  fetchCsrfToken,
  appendTalkPageSection,
  refreshAccessToken,
  sendRevisionThank,
  checkPageExists,
} from "../lib/mediawiki.js";

const thank = new Hono();

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

/** POST /api/thank/notify — send a thanks notification via the MW Thanks extension */
thank.post("/notify", async (c) => {
  const session = await getSession(c);
  if (!session?.accessToken) {
    return c.json({ success: false, error: "Not logged in" }, 401);
  }

  const body = await c.req.json<{ wiki: string; revId: number }>();
  if (!body.wiki || !body.revId) {
    return c.json({ success: false, error: "wiki and revId are required" }, 400);
  }

  try {
    const tokens = await obtainCsrfToken(c, body.wiki, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    if (!tokens) {
      return c.json(
        { success: false, error: "Failed to obtain edit token — please log out and log in again" },
        401,
      );
    }

    const result = await sendRevisionThank(body.wiki, tokens.activeToken, {
      revId: body.revId,
      csrfToken: tokens.csrfToken,
    });

    if (!result.success && result.errorCode === "invalidrecipient") {
      return c.json(
        { success: false, error: "Cannot thank this user — they may have disabled thanks notifications." },
        422,
      );
    }

    return c.json(result, result.success ? 200 : 422);
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "MediaWiki API timed out — please try again"
        : "Unexpected error communicating with Wikipedia";
    return c.json({ success: false, error: message }, 504);
  }
});

/** POST /api/thank/talkpage — post a thank-you message on the author's talk page */
thank.post("/talkpage", async (c) => {
  const session = await getSession(c);
  if (!session?.accessToken) {
    return c.json({ success: false, error: "Not logged in" }, 401);
  }

  const body = await c.req.json<{ wiki: string; revId: number }>();
  if (!body.wiki || !body.revId) {
    return c.json({ success: false, error: "wiki and revId are required" }, 400);
  }

  try {
    const rev = await fetchRevisionFromMW(body.wiki, body.revId);
    if (!rev) {
      return c.json({ success: false, error: "Revision not found" }, 404);
    }

    const tokens = await obtainCsrfToken(c, body.wiki, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    if (!tokens) {
      return c.json(
        { success: false, error: "Failed to obtain edit token — please log out and log in again" },
        401,
      );
    }

    const articleLink = `[[${rev.title}]]`;
    const talkPage = `User talk:${rev.user}`;
    const thankBody =
      `Thank you for your edit to ${articleLink}! ` +
      `It was reviewed using [[m:WikiLoop DoubleCheck|WikiLoop DoubleCheck]] and was found to be a good contribution. ` +
      `Keep up the great work! ~~~~`;

    const result = await appendTalkPageSection(body.wiki, tokens.activeToken, {
      userTalkPage: talkPage,
      sectionTitle: "Thank you for your contribution",
      body: thankBody,
      csrfToken: tokens.csrfToken,
    });

    if (!result.success && result.error?.includes("permission")) {
      return c.json(
        {
          success: false,
          error:
            "Your Wikipedia account does not have permission to post on this talk page. " +
            "This usually means the account is too new or the talk page is protected.",
        },
        403,
      );
    }

    return c.json(result, result.success ? 200 : 422);
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "MediaWiki API timed out — please try again"
        : "Unexpected error communicating with Wikipedia";
    return c.json({ success: false, error: message }, 504);
  }
});

/** GET /api/thank/talkpage-exists?wiki=enwiki&user=Example — check if user talk page exists */
thank.get("/talkpage-exists", async (c) => {
  const wiki = c.req.query("wiki");
  const user = c.req.query("user");
  if (!wiki || !user) {
    return c.json({ exists: false }, 400);
  }

  const exists = await checkPageExists(wiki, `User talk:${user}`);
  return c.json({ exists });
});

/** POST /api/thank — legacy endpoint, now redirects to /notify */
thank.post("/", async (c) => {
  const session = await getSession(c);
  if (!session?.accessToken) {
    return c.json({ success: false, error: "Not logged in" }, 401);
  }

  const body = await c.req.json<{ wiki: string; revId: number }>();
  if (!body.wiki || !body.revId) {
    return c.json({ success: false, error: "wiki and revId are required" }, 400);
  }

  try {
    const tokens = await obtainCsrfToken(c, body.wiki, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    if (!tokens) {
      return c.json(
        { success: false, error: "Failed to obtain edit token — please log out and log in again" },
        401,
      );
    }

    return c.json(
      await sendRevisionThank(body.wiki, tokens.activeToken, {
        revId: body.revId,
        csrfToken: tokens.csrfToken,
      }),
    );
  } catch {
    return c.json({ success: false, error: "Unexpected error" }, 504);
  }
});

export { thank };
