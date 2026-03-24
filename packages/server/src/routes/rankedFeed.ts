import { Hono } from "hono";
import type { RankedFeedResponse } from "@doublecheck/core";
import { getBufferedRevisions, getBufferSize } from "../lib/revertRiskStream.js";

const BATCH_SIZE = parseInt(process.env.RANKED_FEED_BATCH_SIZE ?? "50", 10);

const rankedFeed = new Hono();

/** GET /api/feed/ranked?wiki=enwiki&cursor=0 */
rankedFeed.get("/", async (c) => {
  const wiki = c.req.query("wiki") ?? "enwiki";
  const offset = parseInt(c.req.query("cursor") ?? "0", 10) || 0;

  const { items, total } = getBufferedRevisions(wiki, BATCH_SIZE, offset);

  const nextOffset = offset + items.length;
  const response: RankedFeedResponse = {
    items,
    nextCursor: nextOffset < total ? String(nextOffset) : undefined,
    batchSize: BATCH_SIZE,
  };

  return c.json(response);
});

export { rankedFeed };
