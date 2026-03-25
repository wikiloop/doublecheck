/**
 * Deduplication Migration Script
 *
 * Removes duplicate interactions, keeping only the most recent judgement
 * per (userId, revisionWiki, revisionId) combination.
 *
 * Run via: pnpm --filter @doublecheck/server tsx scripts/dedup-interactions.ts
 *
 * Requires MONGODB_URI environment variable.
 */

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI!);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db!;
  const collection = db.collection("Interaction");

  // Find groups with duplicates: same user + same revision
  const duplicates = await collection
    .aggregate([
      {
        $addFields: {
          _user: { $ifNull: ["$userId", "$wikiUserName"] },
          _wiki: { $ifNull: ["$revisionWiki", "$wiki"] },
          _rev: { $ifNull: ["$revisionId", null] },
          _time: {
            $ifNull: [
              "$createdAt",
              {
                $cond: {
                  if: "$timestamp",
                  then: { $toDate: { $multiply: ["$timestamp", 1000] } },
                  else: new Date(0),
                },
              },
            ],
          },
        },
      },
      {
        $match: {
          _user: { $nin: [null, "", "anonymous"] },
          _rev: { $ne: null },
        },
      },
      { $sort: { _time: -1 } },
      {
        $group: {
          _id: { user: "$_user", wiki: "$_wiki", rev: "$_rev" },
          keepId: { $first: "$_id" }, // newest one to keep
          allIds: { $push: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  console.log(`Found ${duplicates.length} groups with duplicate judgements`);

  let totalRemoved = 0;

  for (const group of duplicates) {
    const idsToRemove = group.allIds.filter(
      (id: mongoose.Types.ObjectId) => !id.equals(group.keepId),
    );
    const result = await collection.deleteMany({
      _id: { $in: idsToRemove },
    });
    totalRemoved += result.deletedCount;
  }

  console.log(`Removed ${totalRemoved} duplicate interactions`);
  console.log("Done!");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
