import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";

// We test purge logic by mocking mongoose.connection.db
describe("purge", () => {
  // Track which collections were operated on
  let deletedCollections: Map<string, { filter: object }>;
  let collectionDocs: Map<string, number>;

  function mockCollection(name: string) {
    return {
      countDocuments: vi.fn(async () => {
        const count = collectionDocs.get(name) ?? 0;
        // After deleteMany, return 0 (or remaining for sessions)
        return count;
      }),
      deleteMany: vi.fn(async (filter: object) => {
        deletedCollections.set(name, { filter });
        const before = collectionDocs.get(name) ?? 0;
        // Simulate deletion: sessions keep some, others delete all
        if (name === "sessions") {
          collectionDocs.set(name, 2); // simulate 2 remaining
          return { deletedCount: before - 2 };
        }
        collectionDocs.set(name, 0);
        return { deletedCount: before };
      }),
    };
  }

  beforeEach(() => {
    deletedCollections = new Map();
    collectionDocs = new Map([
      ["feedrevisions", 100],
      ["feedpages", 50],
      ["sockets", 10],
      ["sessions", 30],
      ["liveclients", 5],
      ["decisionlogs", 200],
    ]);

    // Mock mongoose.connection.db
    const mockDb = {
      listCollections: vi.fn((filter: { name: string }) => ({
        toArray: async () => {
          if (collectionDocs.has(filter.name)) {
            return [{ name: filter.name }];
          }
          return [];
        },
      })),
      collection: vi.fn((name: string) => mockCollection(name)),
    };

    vi.spyOn(mongoose, "connection", "get").mockReturnValue({
      db: mockDb,
    } as unknown as mongoose.Connection);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("purges all transient collections", async () => {
    const { runPurge } = await import("../../cron/purge.js");
    const report = await runPurge();

    expect(report.success).toBe(true);
    expect(report.results).toHaveLength(6);
    expect(report.totalDeleted).toBeGreaterThan(0);

    const purgedNames = report.results.map((r) => r.collection);
    expect(purgedNames).toContain("feedrevisions");
    expect(purgedNames).toContain("feedpages");
    expect(purgedNames).toContain("sockets");
    expect(purgedNames).toContain("sessions");
    expect(purgedNames).toContain("liveclients");
    expect(purgedNames).toContain("decisionlogs");
  });

  it("NEVER touches interactions collection", async () => {
    const { runPurge } = await import("../../cron/purge.js");
    const report = await runPurge();

    const purgedNames = report.results.map((r) => r.collection);
    expect(purgedNames).not.toContain("interactions");
    expect(deletedCollections.has("interactions")).toBe(false);
  });

  it("NEVER touches users collection", async () => {
    const { runPurge } = await import("../../cron/purge.js");
    const report = await runPurge();

    const purgedNames = report.results.map((r) => r.collection);
    expect(purgedNames).not.toContain("users");
    expect(deletedCollections.has("users")).toBe(false);
  });

  it("reports correct counts in results", async () => {
    const { runPurge } = await import("../../cron/purge.js");
    const report = await runPurge();

    const feedrevisions = report.results.find((r) => r.collection === "feedrevisions");
    expect(feedrevisions).toBeDefined();
    expect(feedrevisions!.deletedCount).toBe(100);
    expect(feedrevisions!.remainingCount).toBe(0);
    expect(feedrevisions!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("handles missing collections gracefully", async () => {
    // Remove some collections from mock
    collectionDocs.delete("sockets");
    collectionDocs.delete("liveclients");

    const { runPurge } = await import("../../cron/purge.js");
    const report = await runPurge();

    expect(report.success).toBe(true);
    const sockets = report.results.find((r) => r.collection === "sockets");
    expect(sockets).toBeDefined();
    expect(sockets!.deletedCount).toBe(0);
  });

  it("uses time-based filter for sessions", async () => {
    const { runPurge } = await import("../../cron/purge.js");
    await runPurge();

    const sessionsOp = deletedCollections.get("sessions");
    expect(sessionsOp).toBeDefined();
    // Should have a $or filter with date comparisons
    expect(sessionsOp!.filter).toHaveProperty("$or");
  });

  it("returns error report when mongoose is not connected", async () => {
    vi.spyOn(mongoose, "connection", "get").mockReturnValue({
      db: null,
    } as unknown as mongoose.Connection);

    const { runPurge } = await import("../../cron/purge.js");
    const report = await runPurge();

    expect(report.success).toBe(false);
    expect(report.error).toContain("not connected");
  });

  it("PURGEABLE_COLLECTIONS does not include protected collections", async () => {
    const { PURGEABLE_COLLECTIONS, PROTECTED_COLLECTIONS } = await import(
      "../../cron/purge.js"
    );

    for (const protected_ of PROTECTED_COLLECTIONS) {
      expect(PURGEABLE_COLLECTIONS).not.toContain(protected_);
    }
  });
});
