import { Hono } from "hono";
import type { RankedFeedResponse, ScoredRevision } from "@doublecheck/core";
import { getBufferedRevisions } from "../lib/revertRiskStream.js";
import { fetchRecentChanges } from "../lib/mediawiki.js";
import { RevisionModel } from "../db/models/index.js";

const BATCH_SIZE = parseInt(process.env.RANKED_FEED_BATCH_SIZE ?? "50", 10);

const rankedFeed = new Hono();

/**
 * GET /api/feed/ranked?wiki=enwiki&cursor=X
 *
 * Returns scored revisions from the server-side stream buffer if available,
 * otherwise falls back to unscored recent changes from MediaWiki.
 * Primary ranking now happens client-side via browser EventSource.
 */
rankedFeed.get("/", async (c) => {
  const wiki = c.req.query("wiki") ?? "enwiki";
  const cursor = c.req.query("cursor") ?? undefined;

  // Try server-side stream buffer first (instant, pre-scored)
  const { items } = getBufferedRevisions(wiki, BATCH_SIZE, 0);
  if (items.length > 0) {
    const offset = parseInt(cursor ?? "0", 10) || 0;
    const page = getBufferedRevisions(wiki, BATCH_SIZE, offset);
    const nextOffset = offset + page.items.length;
    return c.json<RankedFeedResponse>({
      items: page.items,
      nextCursor: nextOffset < page.total ? String(nextOffset) : undefined,
      batchSize: BATCH_SIZE,
    });
  }

  // Fallback: return recent changes unscored (client will get scores from stream)
  const { revisions, continueToken } = await fetchRecentChanges(wiki, BATCH_SIZE, cursor);

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

  const unscoredItems: ScoredRevision[] = revisions.map((rev) => ({
    ...rev,
    revertRisk: { revertRisk: 0 },
    rankScore: 0,
  }));

  return c.json<RankedFeedResponse>({
    items: unscoredItems,
    nextCursor: continueToken,
    batchSize: BATCH_SIZE,
  });
});

export { rankedFeed };
