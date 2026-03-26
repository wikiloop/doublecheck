import { Hono } from "hono";
import { getSession, updateSessionTokens } from "../middleware/session.js";
import {
  fetchRevisionFromMW,
  fetchCsrfToken,
  appendTalkPageSection,
  refreshAccessToken,
} from "../lib/mediawiki.js";

const thank = new Hono();

/** POST /api/thank — post a thank-you message on the author's talk page */
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
    const rev = await fetchRevisionFromMW(body.wiki, body.revId);
    if (!rev) {
      return c.json({ success: false, error: "Revision not found" }, 404);
    }

    // Get CSRF token — try refresh if expired
    let activeToken = session.accessToken;
    let csrfToken = await fetchCsrfToken(body.wiki, activeToken);

    if (!csrfToken && session.refreshToken) {
      const refreshed = await refreshAccessToken(session.refreshToken);
      if (refreshed) {
        activeToken = refreshed.accessToken;
        csrfToken = await fetchCsrfToken(body.wiki, activeToken);
        if (csrfToken) {
          await updateSessionTokens(c, refreshed.accessToken, refreshed.refreshToken);
        }
      }
    }

    if (!csrfToken) {
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

    const result = await appendTalkPageSection(body.wiki, activeToken, {
      userTalkPage: talkPage,
      sectionTitle: "Thank you for your contribution",
      body: thankBody,
      csrfToken,
    });

    return c.json(result, result.success ? 200 : 422);
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "MediaWiki API timed out — please try again"
        : "Unexpected error communicating with Wikipedia";
    return c.json({ success: false, error: message }, 504);
  }
});

export { thank };
