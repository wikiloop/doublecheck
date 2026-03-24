import { Hono } from "hono";
import type { RankedFeedResponse, ScoredRevision } from "@doublecheck/core";
import { getBufferedRevisions } from "../lib/revertRiskStream.js";
import { fetchRecentChanges } from "../lib/mediawiki.js";
import { fetchLiftWingScore } from "../lib/liftWingCache.js";
import { RevisionModel } from "../db/models/index.js";
import type { Revision } from "@doublecheck/core";

const BATCH_SIZE = parseInt(process.env.RANKED_FEED_BATCH_SIZE ?? "50", 10);
const FALLBACK_BATCH_SIZE = parseInt(process.env.RANKED_FEED_BATCH_SIZE ?? "250", 10);
const CONCURRENCY = 10;

const rankedFeed = new Hono();

/** Fallback: fetch from MediaWiki + score via LiftWing (old approach). */
async function fallbackScoreRevisions(
  wiki: string,
  cursor?: string,
): Promise<{ items: ScoredRevision[]; nextCursor?: string }> {
  const { revisions, continueToken } = await fetchRecentChanges(
    wiki,
    FALLBACK_BATCH_SIZE,
    cursor,
  );

  // Store revisions in DB (fire-and-forget)
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

  // Score with concurrency limit
  const scored: ScoredRevision[] = [];
  const queue = [...revisions];

  async function worker() {
    while (queue.length > 0) {
      const rev = queue.shift()!;
      try {
        const lw = await fetchLiftWingScore(rev.wiki, rev.revId);
        const combined = lw.damaging + (1 - lw.goodfaith);
        scored.push({
          ...rev,
          revertRisk: {
            revertRisk: combined / 2, // normalize 0-2 → 0-1
            modelName: "damaging+goodfaith-combined",
          },
          liftWing: lw,
          rankScore: combined,
        });
      } catch {
        // skip
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, revisions.length) }, () =>
      worker(),
    ),
  );

  scored.sort((a, b) => b.rankScore - a.rankScore);
  return { items: scored, nextCursor: continueToken };
}

/** GET /api/feed/ranked?wiki=enwiki&cursor=0 */
rankedFeed.get("/", async (c) => {
  const wiki = c.req.query("wiki") ?? "enwiki";
  const cursor = c.req.query("cursor") ?? undefined;

  // Try stream buffer first (instant)
  const { items, total } = getBufferedRevisions(wiki, BATCH_SIZE, 0);

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

  // Fallback: fetch from MediaWiki + LiftWing (slow but works on serverless)
  const fallback = await fallbackScoreRevisions(wiki, cursor);
  return c.json<RankedFeedResponse>({
    items: fallback.items,
    nextCursor: fallback.nextCursor,
    batchSize: FALLBACK_BATCH_SIZE,
  });
});

export { rankedFeed };
