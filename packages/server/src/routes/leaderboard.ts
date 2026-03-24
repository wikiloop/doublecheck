import { Hono } from "hono";
import type { LeaderboardResponse } from "@doublecheck/core";
import { InteractionModel } from "../db/models/index.js";

const leaderboard = new Hono();

/** GET /api/leaderboard */
leaderboard.get("/", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 100);
  const period = c.req.query("period") ?? "all";

  // Compute date cutoff for period filtering
  let dateFilter: Date | null = null;
  const now = new Date();
  if (period === "day")
    dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  else if (period === "week")
    dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  else if (period === "month")
    dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Aggregate judgement counts per user.
  // Supports both legacy docs (wikiUserName, timestamp) and v5 docs (userId, createdAt).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipeline: any[] = [];

  // Normalize: pick whichever user/time field exists
  pipeline.push({
    $addFields: {
      _user: { $ifNull: ["$userId", "$wikiUserName"] },
      _time: {
        $ifNull: [
          "$createdAt",
          // Legacy timestamp is Unix seconds — convert to Date
          { $cond: { if: "$timestamp", then: { $toDate: { $multiply: ["$timestamp", 1000] } }, else: null } },
        ],
      },
    },
  });

  // Exclude anonymous / empty users
  pipeline.push({ $match: { _user: { $nin: [null, "", "anonymous"] } } });

  if (dateFilter) {
    pipeline.push({ $match: { _time: { $gte: dateFilter } } });
  }

  pipeline.push(
    {
      $group: {
        _id: "$_user",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 as const } },
    { $limit: limit },
  );

  const results = await InteractionModel.aggregate(pipeline);

  const entries = results.map(
    (r: { _id: string; count: number }, index: number) => ({
      userId: r._id,
      username: r._id,
      count: r.count,
      rank: index + 1,
    }),
  );

  const response: LeaderboardResponse = { entries };
  return c.json(response);
});

export { leaderboard };
