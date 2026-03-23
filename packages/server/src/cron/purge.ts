/**
 * Purge logic for transient MongoDB collections.
 *
 * SAFETY: Only collections in PURGEABLE_COLLECTIONS are ever touched.
 * Core data (interactions, users) is NEVER deleted.
 */

import mongoose from "mongoose";
import type { CollectionPurgeResult, PurgeReport } from "./types.js";

/**
 * Hardcoded allowlist of collections that may be purged.
 * NEVER add "interactions", "users", "revisions", or "feeds" here.
 */
const PURGEABLE_COLLECTIONS: readonly string[] = Object.freeze([
  "feedrevisions",
  "feedpages",
  "sockets",
  "sessions",
  "liveclients",
  "decisionlogs",
]);

/**
 * Collections that must NEVER be purged — an explicit deny-list as a second safeguard.
 */
const PROTECTED_COLLECTIONS: readonly string[] = Object.freeze([
  "interactions",
  "users",
  "revisions",
  "feeds",
]);

/**
 * Purge a single collection. For "sessions", only deletes documents older than 7 days.
 * If the collection does not exist in the database, it is silently skipped.
 */
async function purgeCollection(
  db: mongoose.mongo.Db,
  name: string,
): Promise<CollectionPurgeResult> {
  const start = Date.now();

  // Double-check safety: refuse to touch protected collections
  if (PROTECTED_COLLECTIONS.includes(name)) {
    throw new Error(`SAFETY VIOLATION: refusing to purge protected collection "${name}"`);
  }

  // List existing collections to avoid errors on missing ones
  const collections = await db.listCollections({ name }).toArray();
  if (collections.length === 0) {
    return {
      collection: name,
      deletedCount: 0,
      remainingCount: 0,
      durationMs: Date.now() - start,
    };
  }

  const col = db.collection(name);
  let deleteResult: { deletedCount: number };

  if (name === "sessions") {
    // Only purge sessions older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    deleteResult = await col.deleteMany({
      $or: [
        { updatedAt: { $lt: sevenDaysAgo } },
        { createdAt: { $lt: sevenDaysAgo } },
        // If no timestamp fields exist, skip (deleteMany with $or of empty matches nothing extra)
      ],
    });
  } else {
    deleteResult = await col.deleteMany({});
  }

  const afterCount = await col.countDocuments();

  return {
    collection: name,
    deletedCount: deleteResult.deletedCount,
    remainingCount: afterCount,
    durationMs: Date.now() - start,
  };
}

/**
 * Run the full purge across all transient collections.
 * Returns a PurgeReport summarizing what was done.
 */
export async function runPurge(): Promise<PurgeReport> {
  const startedAt = new Date().toISOString();

  try {
    const connection = mongoose.connection;
    if (!connection.db) {
      throw new Error("Mongoose is not connected — call connectDB() first");
    }
    const db = connection.db;

    const results: CollectionPurgeResult[] = [];

    for (const name of PURGEABLE_COLLECTIONS) {
      const result = await purgeCollection(db, name);
      results.push(result);
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);

    return {
      startedAt,
      completedAt: new Date().toISOString(),
      results,
      totalDeleted,
      success: true,
    };
  } catch (err) {
    return {
      startedAt,
      completedAt: new Date().toISOString(),
      results: [],
      totalDeleted: 0,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Re-export for testing
export { PURGEABLE_COLLECTIONS, PROTECTED_COLLECTIONS };
