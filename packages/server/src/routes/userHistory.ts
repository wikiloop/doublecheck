import { Hono } from "hono";
import type { JudgementAction, UserHistoryResponse } from "@doublecheck/core";
import { InteractionModel } from "../db/models/index.js";

const userHistory = new Hono();

/** GET /api/user/:userId/history */
userHistory.get("/:userId/history", async (c) => {
  const userId = c.req.param("userId");
  const cursor = c.req.query("cursor");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 50);

  const query: Record<string, unknown> = { userId };

  // Cursor-based pagination using _id
  if (cursor) {
    query._id = { $lt: cursor };
  }

  const interactions = await InteractionModel.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = interactions.length > limit;
  const items = hasMore ? interactions.slice(0, limit) : interactions;

  const judgements = items.map((doc: Record<string, unknown>) => ({
    revisionWiki: doc.revisionWiki as string,
    revisionId: doc.revisionId as number,
    action: doc.action as JudgementAction,
    userId: doc.userId as string,
    identity: doc.identity as { type: "named" | "temp" | "anon"; username: string | null; verified: boolean },
    timestamp:
      (doc.createdAt as Date)?.toISOString?.() ??
      (doc.createdAt as string) ??
      "",
  }));

  const nextCursor = hasMore
    ? String((items[items.length - 1] as Record<string, unknown>)?._id)
    : undefined;

  const response: UserHistoryResponse = { judgements, nextCursor };
  return c.json(response);
});

/** GET /api/user/:userId/reviewed-ids — lightweight list of recently reviewed wiki:revId pairs */
userHistory.get("/:userId/reviewed-ids", async (c) => {
  const userId = c.req.param("userId");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "200", 10), 500);

  const docs = await InteractionModel.find({ userId })
    .sort({ _id: -1 })
    .limit(limit)
    .select("revisionWiki revisionId")
    .lean();

  const ids = docs.map(
    (d: Record<string, unknown>) => `${d.revisionWiki}:${d.revisionId}`,
  );

  return c.json({ ids });
});

export { userHistory };
