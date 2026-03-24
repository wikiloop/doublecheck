import { Hono } from "hono";
import type { RevertRequest, RevertCheckResponse, RevertResponse } from "@doublecheck/core";
import { getSession } from "../middleware/session.js";
import { InteractionModel } from "../db/models/index.js";
import {
  apiUrl,
  fetchRevisionFromMW,
  fetchPageLatestRevisions,
  fetchCsrfToken,
  performUndo,
} from "../lib/mediawiki.js";

const revert = new Hono();

/** Build a Wikipedia page-history URL */
function pageHistoryUrl(wiki: string, title: string): string {
  const base = apiUrl(wiki).replace("/w/api.php", "");
  return `${base}/w/index.php?title=${encodeURIComponent(title)}&action=history`;
}

/** Build the edit summary for a revert */
function editSummary(revId: number, username: string, wiki: string, origin?: string): string {
  const domain = origin ?? "https://doublecheck.wikiloop.org";
  return (
    `Reverted revision ${revId} by [[User:${username}]]: ` +
    `Revert made with [[m:WikiLoop DoubleCheck|WikiLoop DoubleCheck]] (${domain}), ` +
    `reviewer deemed the revision as damaging and possibly vandalism. ` +
    `Report abuse at [[Wikipedia talk:WikiLoop DoubleCheck]].`
  );
}

/**
 * Check eligibility: the revision must be the current (latest) revision,
 * and the author must have made only ONE consecutive edit (the last one).
 * If the second-from-last edit is also by the same user, direct revert is
 * disabled — the user is directed to the page history instead.
 */
async function checkEligibility(
  wiki: string,
  revId: number,
  title: string,
  revisionUser: string,
): Promise<RevertCheckResponse> {
  const latest = await fetchPageLatestRevisions(wiki, title, 2);
  if (latest.length === 0) {
    return { eligible: false, reason: "not_current" };
  }

  // The revision must still be the latest
  if (latest[0].revid !== revId) {
    return { eligible: false, reason: "not_current" };
  }

  // If the second-from-last edit is also by the same user, consecutive edits
  if (latest.length >= 2 && latest[1].user === revisionUser) {
    return {
      eligible: false,
      reason: "consecutive_edits",
      consecutiveEditUser: revisionUser,
      pageHistoryUrl: pageHistoryUrl(wiki, title),
    };
  }

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

  // Get CSRF token
  const csrfToken = await fetchCsrfToken(body.wiki, session.accessToken);
  if (!csrfToken) {
    return c.json<RevertResponse>(
      { success: false, error: "Failed to obtain edit token — session may have expired", errorCode: "token_failed" },
      401,
    );
  }

  // Perform the undo — use the request origin so the summary shows the correct domain
  const origin = c.req.header("origin") ?? "https://doublecheck.wikiloop.org";
  const summary = editSummary(body.revId, rev.user, body.wiki, origin);
  const result = await performUndo(body.wiki, session.accessToken, {
    title: rev.title,
    revId: body.revId,
    summary,
    csrfToken,
  });

  if (result.success) {
    // Mark the interaction as reverted (non-blocking)
    InteractionModel.updateOne(
      { revisionWiki: body.wiki, revisionId: body.revId, userId: session.userId },
      { $set: { revertedByUser: true } },
    ).catch(() => {});
  }

  const status = result.success ? 200 : 422;
  return c.json<RevertResponse>(result, status);
});

export { revert };
