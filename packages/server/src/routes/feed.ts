import { Hono } from "hono";
import type { FeedResponse } from "@doublecheck/core";
import { FeedModel, RevisionModel } from "../db/models/index.js";
import { fetchRecentChanges } from "../lib/mediawiki.js";

const feed = new Hono();

/** GET /api/feed/:feedName */
feed.get("/:feedName", async (c) => {
  const feedName = c.req.param("feedName");
  const cursor = c.req.query("cursor");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 50);
  const wiki = c.req.query("wiki");

  // Look up feed definition
  const feedDoc = (await FeedModel.findOne({ name: feedName }).lean()) as { name: string; wiki: string } | null;

  // Determine which wiki to use
  const targetWiki = wiki ?? feedDoc?.wiki ?? "enwiki";

  // Fetch recent changes from MediaWiki
  const { revisions, continueToken } = await fetchRecentChanges(
    targetWiki,
    limit,
    cursor ?? undefined,
  );

  // Store revisions in DB (fire-and-forget, ignore errors)
  if (revisions.length > 0) {
    RevisionModel.bulkWrite(
      revisions.map((rev) => ({
        updateOne: {
          filter: { wiki: rev.wiki, revId: rev.revId },
          update: { $setOnInsert: rev },
          upsert: true,
        },
      })),
    ).catch(() => {});
  }

  const response: FeedResponse = {
    items: revisions,
    nextCursor: continueToken,
  };

  return c.json(response);
});

export { feed };
