import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp } from "../index.js";

// Mock mongoose before any imports that use it
vi.mock("mongoose", () => {
  const connection = { readyState: 1 };
  return {
    default: {
      connection,
      connect: vi.fn().mockResolvedValue(undefined),
      model: vi.fn(),
      models: {},
      Schema: vi.fn().mockImplementation(() => ({
        index: vi.fn(),
      })),
    },
  };
});

// Mock all Mongoose models
vi.mock("../db/models/index.js", () => ({
  RevisionModel: {
    findOne: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn().mockResolvedValue(undefined),
    bulkWrite: vi.fn().mockResolvedValue(undefined),
    find: vi.fn(),
    aggregate: vi.fn(),
  },
  InteractionModel: {
    create: vi.fn(),
    find: vi.fn(),
    aggregate: vi.fn(),
  },
  UserModel: {
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  FeedModel: {
    findOne: vi.fn(),
  },
}));

// Mock external API calls
vi.mock("../lib/mediawiki.js", () => ({
  fetchRevisionFromMW: vi.fn(),
  fetchDiffFromMW: vi.fn().mockResolvedValue(null),
  fetchRecentChanges: vi.fn(),
  verifyMWToken: vi.fn(),
}));

vi.mock("../lib/liftWingCache.js", () => ({
  fetchLiftWingScore: vi.fn(),
  getCachedScore: vi.fn(),
  setCachedScore: vi.fn(),
  _clearCache: vi.fn(),
}));

// Import mocked modules for test setup
import {
  RevisionModel,
  InteractionModel,
  UserModel,
  FeedModel,
} from "../db/models/index.js";
import { fetchRevisionFromMW, fetchRecentChanges } from "../lib/mediawiki.js";
import { fetchLiftWingScore } from "../lib/liftWingCache.js";

const app = createApp();

async function req(path: string, init?: RequestInit): Promise<Response> {
  return app.request(path, init);
}

describe("GET /api/health", () => {
  it("returns health status with mongo connection", async () => {
    const res = await req("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      status: "ok",
      version: "5.0.0-alpha.0",
      mongo: true,
    });
  });
});

describe("GET /api/revision/:wiki/:revId", () => {
  beforeEach(() => {
    vi.mocked(RevisionModel.findOne).mockReset();
    vi.mocked(fetchRevisionFromMW).mockReset();
    vi.mocked(fetchLiftWingScore).mockReset();
  });

  it("returns revision from DB", async () => {
    const mockRev = {
      wiki: "enwiki",
      revId: 12345,
      parentRevId: 12344,
      title: "Test Article",
      timestamp: "2024-01-01T00:00:00Z",
      user: "TestUser",
      comment: "test edit",
      pageId: 100,
    };

    vi.mocked(RevisionModel.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockRev),
    } as unknown as ReturnType<typeof RevisionModel.findOne>);

    vi.mocked(fetchLiftWingScore).mockRejectedValue(
      new Error("not available"),
    );

    const res = await req("/api/revision/enwiki/12345");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.wiki).toBe("enwiki");
    expect(body.revId).toBe(12345);
    expect(body.title).toBe("Test Article");
  });

  it("fetches from MW API when not in DB", async () => {
    vi.mocked(RevisionModel.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as unknown as ReturnType<typeof RevisionModel.findOne>);

    const mockRev = {
      wiki: "enwiki",
      revId: 99999,
      parentRevId: 99998,
      title: "New Article",
      timestamp: "2024-06-01T00:00:00Z",
      user: "Editor",
      comment: "new",
      pageId: 200,
    };

    vi.mocked(fetchRevisionFromMW).mockResolvedValue(mockRev);
    vi.mocked(RevisionModel.create).mockResolvedValue({
      ...mockRev,
      toObject: () => mockRev,
    } as unknown as Awaited<ReturnType<typeof RevisionModel.create>>);
    vi.mocked(fetchLiftWingScore).mockRejectedValue(new Error("skip"));

    const res = await req("/api/revision/enwiki/99999");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revId).toBe(99999);
    expect(fetchRevisionFromMW).toHaveBeenCalledWith("enwiki", 99999);
  });

  it("returns 404 when revision not found anywhere", async () => {
    vi.mocked(RevisionModel.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as unknown as ReturnType<typeof RevisionModel.findOne>);
    vi.mocked(fetchRevisionFromMW).mockResolvedValue(null);

    const res = await req("/api/revision/enwiki/00000");
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid revId", async () => {
    const res = await req("/api/revision/enwiki/notanumber");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/feed/:feedName", () => {
  beforeEach(() => {
    vi.mocked(FeedModel.findOne).mockReset();
    vi.mocked(fetchRecentChanges).mockReset();
  });

  it("returns feed items", async () => {
    vi.mocked(FeedModel.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ name: "recent", wiki: "enwiki" }),
    } as unknown as ReturnType<typeof FeedModel.findOne>);

    vi.mocked(fetchRecentChanges).mockResolvedValue({
      revisions: [
        {
          wiki: "enwiki",
          revId: 1,
          parentRevId: 0,
          title: "A",
          timestamp: "2024-01-01T00:00:00Z",
          user: "U",
          comment: "",
          pageId: 1,
        },
      ],
      continueToken: "next123",
    });

    const res = await req("/api/feed/recent");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).toBe("next123");
  });
});

describe("POST /api/judgement", () => {
  beforeEach(() => {
    vi.mocked(InteractionModel.create).mockReset();
  });

  it("creates a judgement and returns 201", async () => {
    vi.mocked(InteractionModel.create).mockResolvedValue({
      revisionWiki: "enwiki",
      revisionId: 123,
      action: "LooksGood",
      userId: "anonymous",
      identity: { type: "anon", username: null, verified: false },
      createdAt: new Date("2024-01-01T00:00:00Z"),
    } as unknown as Awaited<ReturnType<typeof InteractionModel.create>>);

    const res = await req("/api/judgement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wiki: "enwiki",
        revId: 123,
        action: "LooksGood",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.action).toBe("LooksGood");
    expect(body.revisionWiki).toBe("enwiki");
  });

  it("returns 400 for invalid action", async () => {
    const res = await req("/api/judgement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wiki: "enwiki",
        revId: 123,
        action: "InvalidAction",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing wiki", async () => {
    const res = await req("/api/judgement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        revId: 123,
        action: "LooksGood",
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/judgements/:wiki/:revId", () => {
  beforeEach(() => {
    vi.mocked(InteractionModel.find).mockReset();
  });

  it("returns judgements with tallies", async () => {
    const mockDocs = [
      {
        revisionWiki: "enwiki",
        revisionId: 123,
        action: "LooksGood",
        userId: "user1",
        identity: { type: "named", username: "user1", verified: true },
        createdAt: new Date("2024-01-01T00:00:00Z"),
      },
      {
        revisionWiki: "enwiki",
        revisionId: 123,
        action: "ShouldRevert",
        userId: "user2",
        identity: { type: "named", username: "user2", verified: true },
        createdAt: new Date("2024-01-01T01:00:00Z"),
      },
    ];

    vi.mocked(InteractionModel.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockDocs),
      }),
    } as unknown as ReturnType<typeof InteractionModel.find>);

    const res = await req("/api/judgements/enwiki/123");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.judgements).toHaveLength(2);
    expect(body.tallies.LooksGood).toBe(1);
    expect(body.tallies.ShouldRevert).toBe(1);
    expect(body.tallies.NotSure).toBe(0);
  });
});

describe("GET /api/leaderboard", () => {
  it("returns ranked users", async () => {
    vi.mocked(InteractionModel.aggregate).mockResolvedValue([
      { _id: "user1", count: 50 },
      { _id: "user2", count: 30 },
    ]);
    vi.mocked(UserModel.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { wikiUserName: "user1" },
        { wikiUserName: "user2" },
      ]),
    } as unknown as ReturnType<typeof UserModel.find>);

    const res = await req("/api/leaderboard");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].rank).toBe(1);
    expect(body.entries[0].count).toBe(50);
    expect(body.entries[1].rank).toBe(2);
  });
});

describe("GET /api/user/:userId/history", () => {
  it("returns paginated user history", async () => {
    const mockDocs = [
      {
        _id: "abc123",
        revisionWiki: "enwiki",
        revisionId: 100,
        action: "LooksGood",
        userId: "testuser",
        identity: { type: "named", username: "testuser", verified: true },
        createdAt: new Date("2024-01-01T00:00:00Z"),
      },
    ];

    vi.mocked(InteractionModel.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockDocs),
        }),
      }),
    } as unknown as ReturnType<typeof InteractionModel.find>);

    const res = await req("/api/user/testuser/history");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.judgements).toHaveLength(1);
    expect(body.judgements[0].userId).toBe("testuser");
  });
});

describe("GET /api/liftwing/:wiki/:revId", () => {
  beforeEach(() => {
    vi.mocked(fetchLiftWingScore).mockReset();
  });

  it("returns Lift Wing scores", async () => {
    vi.mocked(fetchLiftWingScore).mockResolvedValue({
      damaging: 0.1,
      goodfaith: 0.9,
      modelVersion: "v1.0",
    });

    const res = await req("/api/liftwing/enwiki/12345");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.damaging).toBe(0.1);
    expect(body.goodfaith).toBe(0.9);
  });

  it("returns 502 on Lift Wing API error", async () => {
    vi.mocked(fetchLiftWingScore).mockRejectedValue(
      new Error("API error"),
    );

    const res = await req("/api/liftwing/enwiki/12345");
    expect(res.status).toBe(502);
  });
});

describe("Auth routes", () => {
  it("GET /api/auth/me returns unauthenticated when no session", async () => {
    const res = await req("/api/auth/me");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.loggedIn).toBe(false);
  });

  it("GET /api/auth/login returns 500 without OAUTH_CLIENT_ID", async () => {
    const original = process.env.OAUTH_CLIENT_ID;
    delete process.env.OAUTH_CLIENT_ID;

    const res = await req("/api/auth/login");
    expect(res.status).toBe(500);

    if (original) process.env.OAUTH_CLIENT_ID = original;
  });

  it("GET /api/auth/logout returns success", async () => {
    const res = await req("/api/auth/logout");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("GET /api/auth/callback returns 400 without code/state", async () => {
    const res = await req("/api/auth/callback");
    expect(res.status).toBe(400);
  });
});

describe("SSE /api/events", () => {
  it("returns event-stream content type", async () => {
    const controller = new AbortController();
    const resPromise = req("/api/events", {
      signal: controller.signal,
    });

    // Give it a moment to start streaming, then abort
    setTimeout(() => controller.abort(), 100);

    try {
      const res = await resPromise;
      expect(res.headers.get("content-type")).toContain("text/event-stream");
    } catch (err: unknown) {
      // AbortError is expected — check it's the right error
      if (err instanceof Error && err.name === "AbortError") {
        // Expected when stream is aborted
      } else {
        throw err;
      }
    }
  });
});
