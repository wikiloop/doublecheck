import { Hono } from "hono";
import type { LeaderboardResponse } from "@doublecheck/core";
import { InteractionModel, UserModel } from "../db/models/index.js";

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

  // Aggregate judgement counts per user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipeline: any[] = [];
  if (dateFilter) {
    pipeline.push({ $match: { createdAt: { $gte: dateFilter } } });
  }
  pipeline.push(
    {
      $group: {
        _id: "$userId",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 as const } },
    { $limit: limit },
  );

  const results = await InteractionModel.aggregate(pipeline);

  // Look up usernames
  const userIds = results.map((r: { _id: string }) => r._id);
  const users = await UserModel.find({
    wikiUserName: { $in: userIds },
  }).lean();
  const userMap = new Map(
    users.map((u: Record<string, unknown>) => [
      u.wikiUserName as string,
      u.wikiUserName as string,
    ]),
  );

  const entries = results.map(
    (r: { _id: string; count: number }, index: number) => ({
      userId: r._id,
      username: userMap.get(r._id) ?? r._id,
      count: r.count,
      rank: index + 1,
    }),
  );

  const response: LeaderboardResponse = { entries };
  return c.json(response);
});

export { leaderboard };
