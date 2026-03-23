import { Hono } from "hono";
import type { Revision, RevisionResponse } from "@doublecheck/core";
import { RevisionModel } from "../db/models/index.js";
import { fetchRevisionFromMW } from "../lib/mediawiki.js";
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
  let rev = (await RevisionModel.findOne({ wiki, revId }).lean()) as Revision | null;

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
      // If duplicate key error (race condition), re-fetch from DB
      rev = (await RevisionModel.findOne({ wiki, revId }).lean()) as Revision | null;
      if (!rev) return c.json({ error: "Revision not found" }, 404);
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
    diffHtml: rev.diffHtml,
    liftWing,
  };

  return c.json(response);
});

export { revision };
