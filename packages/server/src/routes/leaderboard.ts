import { Hono } from "hono";
import type { LeaderboardResponse } from "@doublecheck/core";
import { InteractionModel, UserModel } from "../db/models/index.js";

const leaderboard = new Hono();

/** GET /api/leaderboard */
leaderboard.get("/", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 100);

  // Aggregate judgement counts per user
  const pipeline = [
    {
      $group: {
        _id: "$userId",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 as const } },
    { $limit: limit },
  ];

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
