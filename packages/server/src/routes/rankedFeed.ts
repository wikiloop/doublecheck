import { Hono } from "hono";
import type { RankedFeedResponse, ScoredRevision } from "@doublecheck/core";
import { getBufferedRevisions } from "../lib/revertRiskStream.js";
import { fetchRecentChanges } from "../lib/mediawiki.js";
import { RevisionModel } from "../db/models/index.js";

const BATCH_SIZE = parseInt(process.env.RANKED_FEED_BATCH_SIZE ?? "50", 10);

/** Check whether a username looks like an IP address (anonymous editor). */
function isIPUser(user: string): boolean {
  // IPv4: digits and dots
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(user)) return true;
  // IPv6: hex groups separated by colons (may contain ::)
  if (/^[0-9a-fA-F:]+$/.test(user) && user.includes(":")) return true;
  return false;
}

/** Apply feed filters (minScore, userType) to a list of scored revisions. */
function applyFilters(
  items: ScoredRevision[],
  minScore: number,
  userType: string,
): ScoredRevision[] {
  return items.filter((item) => {
    // Filter by minimum revert-risk score
    if (item.revertRisk.revertRisk < minScore) return false;

    // Filter by user type
    if (userType === "ip" && !isIPUser(item.user)) return false;

    return true;
  });
}

const rankedFeed = new Hono();

/**
 * GET /api/feed/ranked?wiki=enwiki&cursor=X&minScore=0.3&userType=all&namespace=0
 *
 * Returns scored revisions from the server-side stream buffer if available,
 * otherwise falls back to unscored recent changes from MediaWiki.
 * Primary ranking now happens client-side via browser EventSource.
 *
 * Optional filter parameters:
 *   minScore  — minimum ORES/revert-risk probability (0.0-1.0), default 0
 *   userType  — "all" (default), "ip" (anonymous/IP editors only)
 *   namespace — namespace number filter, default 0 (main namespace)
 */
rankedFeed.get("/", async (c) => {
  const wiki = c.req.query("wiki") ?? "enwiki";
  const cursor = c.req.query("cursor") ?? undefined;

  // Parse filter parameters
  const minScore = Math.max(0, Math.min(1, parseFloat(c.req.query("minScore") ?? "0") || 0));
  const userType = c.req.query("userType") ?? "all";
  const namespace = parseInt(c.req.query("namespace") ?? "0", 10) || 0;

  // Try server-side stream buffer first (instant, pre-scored)
  // Fetch more than BATCH_SIZE to compensate for items that may be filtered out
  const fetchSize = BATCH_SIZE * 3;
  const { items } = getBufferedRevisions(wiki, fetchSize, 0);
  if (items.length > 0) {
    const offset = parseInt(cursor ?? "0", 10) || 0;
    const page = getBufferedRevisions(wiki, fetchSize, offset);
    const filtered = applyFilters(page.items, minScore, userType);
    const batch = filtered.slice(0, BATCH_SIZE);
    const nextOffset = offset + page.items.length;
    return c.json<RankedFeedResponse>({
      items: batch,
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

  let unscoredItems: ScoredRevision[] = revisions.map((rev) => ({
    ...rev,
    revertRisk: { revertRisk: 0 },
    rankScore: 0,
  }));

  // Apply user-type filter to unscored items (minScore filter is skipped since scores are 0)
  if (userType === "ip") {
    unscoredItems = unscoredItems.filter((item) => isIPUser(item.user));
  }

  return c.json<RankedFeedResponse>({
    items: unscoredItems,
    nextCursor: continueToken,
    batchSize: BATCH_SIZE,
  });
});

export { rankedFeed };
