import { Hono } from "hono";
import type { Revision, RevisionResponse } from "@doublecheck/core";
import { RevisionModel } from "../db/models/index.js";
import { fetchRevisionFromMW, fetchDiffFromMW } from "../lib/mediawiki.js";
import { fetchLiftWingScore } from "../lib/liftWingCache.js";

const revision = new Hono();

/** GET /api/revision/:wiki/:revId */
revision.get("/:wiki/:revId", async (c) => {
  const wiki = c.req.param("wiki");
  const revId = parseInt(c.req.param("revId"), 10);

  if (isNaN(revId)) {
    return c.json({ error: "Invalid revId" }, 400);
  }

  // Try DB first
  let rev: Revision | null = null;
  try {
    rev = (await RevisionModel.findOne({ wiki, revId }).lean()) as Revision | null;
  } catch {
    // DB may not be connected — fall through to MW API
  }

  // If not in DB, fetch from MediaWiki API
  if (!rev) {
    const fetched = await fetchRevisionFromMW(wiki, revId);
    if (!fetched) {
      return c.json({ error: "Revision not found" }, 404);
    }

    // Store in DB for future lookups
    try {
      const created = await RevisionModel.create(fetched);
      rev = created.toObject() as unknown as Revision;
    } catch {
      // DB not available or duplicate key — use fetched data directly
      rev = fetched;
    }
  }

  // Fetch diff HTML if not already cached
  let diffHtml = rev.diffHtml;
  if (!diffHtml) {
    diffHtml =
      (await fetchDiffFromMW(wiki, revId, rev.parentRevId)) ?? undefined;
    // Cache in DB (non-blocking)
    if (diffHtml) {
      RevisionModel.updateOne({ wiki, revId }, { $set: { diffHtml } }).catch(
        () => {},
      );
    }
  }

  // Try to get Lift Wing score (non-blocking failure)
  let liftWing: RevisionResponse["liftWing"] | undefined;
  try {
    liftWing = await fetchLiftWingScore(wiki, revId);
  } catch {
    // Lift Wing may not support all wikis — ignore errors
  }

  const response: RevisionResponse = {
    wiki: rev.wiki,
    revId: rev.revId,
    parentRevId: rev.parentRevId,
    title: rev.title,
    timestamp: rev.timestamp,
    user: rev.user,
    comment: rev.comment,
    pageId: rev.pageId,
    diffHtml,
    liftWing,
  };

  return c.json(response);
});

export { revision };
