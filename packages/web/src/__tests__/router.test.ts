import { describe, it, expect } from "vitest";
import { router } from "../router/index";

describe("router", () => {
  it("has a landing route at /", () => {
    const route = router.resolve("/");
    expect(route.name).toBe("landing");
  });

  it("has a review route at /review", () => {
    const route = router.resolve("/review");
    expect(route.name).toBe("review");
  });

  it("resolves review route with wiki and revId params", () => {
    const route = router.resolve("/review/enwiki/12345");
    expect(route.name).toBe("review");
    expect(route.params.wiki).toBe("enwiki");
    expect(route.params.revId).toBe("12345");
  });

  it("has a feed route at /feed", () => {
    const route = router.resolve("/feed");
    expect(route.name).toBe("feed");
  });

  it("resolves feed route with feedName param", () => {
    const route = router.resolve("/feed/recent");
    expect(route.name).toBe("feed");
    expect(route.params.feedName).toBe("recent");
  });

  it("has a leaderboard route at /leaderboard", () => {
    const route = router.resolve("/leaderboard");
    expect(route.name).toBe("leaderboard");
  });

  it("has a history route at /history with auth meta", () => {
    const route = router.resolve("/history");
    expect(route.name).toBe("history");
    expect(route.meta.requiresAuth).toBe(true);
  });

  it("has an auth callback route at /auth/callback", () => {
    const route = router.resolve("/auth/callback");
    expect(route.name).toBe("auth-callback");
  });
});
