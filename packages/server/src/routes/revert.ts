import { Hono } from "hono";
import type { RevertRequest, RevertCheckResponse, RevertResponse } from "@doublecheck/core";
import { getSession, updateSessionTokens } from "../middleware/session.js";
import { InteractionModel } from "../db/models/index.js";
import {
  apiUrl,
  fetchRevisionFromMW,
  fetchPageLatestRevisions,
  fetchCsrfToken,
  performUndo,
  refreshAccessToken,
} from "../lib/mediawiki.js";

const revert = new Hono();

/** Build a Wikipedia page-history URL */
function pageHistoryUrl(wiki: string, title: string): string {
  const base = apiUrl(wiki).replace("/w/api.php", "");
  return `${base}/w/index.php?title=${encodeURIComponent(title)}&action=history`;
}

/** Build the edit summary for a revert */
function editSummary(revIds: number[], username: string, wiki: string, origin?: string): string {
  const domain = origin ?? "https://doublecheck.wikiloop.org";
  const revPart =
    revIds.length === 1
      ? `Reverted revision ${revIds[0]} by [[User:${username}]]`
      : `Reverted ${revIds.length} consecutive edits by [[User:${username}]] (revisions ${revIds.join(", ")})`;
  return (
    `${revPart}: ` +
    `Revert made with [[m:WikiLoop DoubleCheck|WikiLoop DoubleCheck]] (${domain}), ` +
    `reviewer deemed the revision as damaging and possibly vandalism. ` +
    `Report abuse at [[Wikipedia talk:WikiLoop DoubleCheck]].`
  );
}

/**
 * Check eligibility: the revision must be the current (latest) revision.
 * If the user made multiple consecutive edits, return them all so the
 * client can show a combined diff and revert them as a group (rollback-style).
 */
async function checkEligibility(
  wiki: string,
  revId: number,
  title: string,
  revisionUser: string,
): Promise<RevertCheckResponse> {
  const latest = await fetchPageLatestRevisions(wiki, title, 50);
  if (latest.length === 0) {
    return { eligible: false, reason: "not_current" };
  }

  // The revision must still be the latest
  if (latest[0].revid !== revId) {
    return { eligible: false, reason: "not_current" };
  }

  // Walk newest-to-oldest to find all consecutive edits by the same user
  let consecutiveCount = 0;
  for (const rev of latest) {
    if (rev.user === revisionUser) consecutiveCount++;
    else break;
  }

  // Safety cap: if ALL fetched revisions are by the same user, we can't
  // determine the base revision — fall back to "review page history"
  if (consecutiveCount === latest.length && latest.length >= 50) {
    return {
      eligible: false,
      reason: "consecutive_edits",
      consecutiveEditUser: revisionUser,
      pageHistoryUrl: pageHistoryUrl(wiki, title),
    };
  }

  const consecutiveRevIds = latest.slice(0, consecutiveCount).map((r) => r.revid);
  const baseRev = latest[consecutiveCount]; // last rev by a different user

  if (consecutiveCount >= 2 && baseRev) {
    return {
      eligible: true,
      consecutiveEditUser: revisionUser,
      consecutiveRevIds,
      baseRevId: baseRev.revid,
      pageHistoryUrl: pageHistoryUrl(wiki, title),
    };
  }

  // Single edit — simple case
  return { eligible: true };
}

/** GET /api/revert/check/:wiki/:revId — eligibility check */
revert.get("/check/:wiki/:revId", async (c) => {
  const session = await getSession(c);
  if (!session?.accessToken) {
    return c.json<RevertCheckResponse>({ eligible: false, reason: "not_logged_in" });
  }

  const wiki = c.req.param("wiki");
  const revId = parseInt(c.req.param("revId"), 10);
  if (isNaN(revId)) return c.json({ error: "Invalid revId" }, 400);

  // Fetch revision metadata to get title and user
  const rev = await fetchRevisionFromMW(wiki, revId);
  if (!rev) return c.json<RevertCheckResponse>({ eligible: false, reason: "not_current" });

  const result = await checkEligibility(wiki, revId, rev.title, rev.user);
  return c.json(result);
});

/** POST /api/revert — execute the revert */
revert.post("/", async (c) => {
  const session = await getSession(c);
  if (!session?.accessToken) {
    return c.json({ error: "Not logged in" }, 401);
  }

  const body = await c.req.json<RevertRequest>();
  if (!body.wiki || !body.revId) {
    return c.json({ error: "wiki and revId are required" }, 400);
  }

  try {
    // Fetch revision metadata
    const rev = await fetchRevisionFromMW(body.wiki, body.revId);
    if (!rev) {
      return c.json<RevertResponse>({ success: false, error: "Revision not found", errorCode: "not_found" }, 404);
    }

    // Re-verify eligibility server-side (never trust client)
    const eligibility = await checkEligibility(body.wiki, body.revId, rev.title, rev.user);
    if (!eligibility.eligible) {
      return c.json<RevertResponse>(
        { success: false, error: `Not eligible: ${eligibility.reason}`, errorCode: eligibility.reason },
        409,
      );
    }

    // Get CSRF token — if it fails, try refreshing the OAuth token once
    let activeToken = session.accessToken;
    let csrfToken = await fetchCsrfToken(body.wiki, activeToken);

    if (!csrfToken && session.refreshToken) {
      const refreshed = await refreshAccessToken(session.refreshToken);
      if (refreshed) {
        activeToken = refreshed.accessToken;
        csrfToken = await fetchCsrfToken(body.wiki, activeToken);
        // Persist the new tokens so future requests don't need to refresh again
        if (csrfToken) {
          await updateSessionTokens(c, refreshed.accessToken, refreshed.refreshToken);
        }
      }
    }

    if (!csrfToken) {
      return c.json<RevertResponse>(
        { success: false, error: "Failed to obtain edit token — please log out and log in again", errorCode: "token_failed" },
        401,
      );
    }

    // Perform the undo — use the request origin so the summary shows the correct domain
    const origin = c.req.header("origin") ?? "https://doublecheck.wikiloop.org";
    const revIdsForSummary = eligibility.consecutiveRevIds ?? [body.revId];
    const summary = editSummary(revIdsForSummary, rev.user, body.wiki, origin);
    const result = await performUndo(body.wiki, activeToken, {
      title: rev.title,
      revId: body.revId,
      summary,
      csrfToken,
      undoafter: body.baseRevId,
    });

    if (result.success) {
      // Mark all consecutive revisions as reverted (non-blocking)
      const revIdsToMark = eligibility.consecutiveRevIds ?? [body.revId];
      for (const rid of revIdsToMark) {
        InteractionModel.updateOne(
          { revisionWiki: body.wiki, revisionId: rid, userId: session.userId },
          { $set: { revertedByUser: true } },
        ).catch(() => {});
      }
    }

    const status = result.success ? 200 : 422;
    return c.json<RevertResponse>(result, status);
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "MediaWiki API timed out — please try again"
        : "Unexpected error communicating with Wikipedia";
    return c.json<RevertResponse>(
      { success: false, error: message, errorCode: "timeout" },
      504,
    );
  }
});

export { revert };
