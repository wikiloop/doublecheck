import { Hono } from "hono";
import type { RankedFeedResponse, ScoredRevision } from "@doublecheck/core";
import { RevisionModel } from "../db/models/index.js";
import { fetchRecentChanges } from "../lib/mediawiki.js";
import { fetchLiftWingScore } from "../lib/liftWingCache.js";
import type { Revision } from "@doublecheck/core";

const BATCH_SIZE = parseInt(process.env.RANKED_FEED_BATCH_SIZE ?? "250", 10);
const CONCURRENCY = 10; // max parallel LiftWing requests

const rankedFeed = new Hono();

/** Score revisions via LiftWing with concurrency limit, skip failures */
async function scoreRevisions(revisions: Revision[]): Promise<ScoredRevision[]> {
  const scored: ScoredRevision[] = [];
  const queue = [...revisions];

  async function worker() {
    while (queue.length > 0) {
      const rev = queue.shift()!;
      try {
        const lw = await fetchLiftWingScore(rev.wiki, rev.revId);
        scored.push({
          ...rev,
          liftWing: lw,
          rankScore: lw.damaging + (1 - lw.goodfaith),
        });
      } catch {
        // LiftWing failed for this revision — skip it
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, revisions.length) }, () => worker());
  await Promise.all(workers);

  return scored;
}

/** GET /api/feed/ranked?wiki=enwiki&cursor=X */
rankedFeed.get("/", async (c) => {
  const wiki = c.req.query("wiki") ?? "enwiki";
  const cursor = c.req.query("cursor") ?? undefined;

  // Fetch a large batch of recent changes
  const { revisions, continueToken } = await fetchRecentChanges(wiki, BATCH_SIZE, cursor);

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

  // Score all revisions via LiftWing (with concurrency limit)
  const scored = await scoreRevisions(revisions);

  // Rank: highest rankScore first (most suspicious)
  scored.sort((a, b) => b.rankScore - a.rankScore);

  const response: RankedFeedResponse = {
    items: scored,
    nextCursor: continueToken,
    batchSize: BATCH_SIZE,
  };

  return c.json(response);
});

export { rankedFeed };
