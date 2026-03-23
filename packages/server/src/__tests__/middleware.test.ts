import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { corsMiddleware } from "../middleware/cors.js";
import { rateLimitMiddleware } from "../middleware/rateLimit.js";

describe("CORS middleware", () => {
  const app = new Hono();
  app.use("*", corsMiddleware());
  app.get("/test", (c) => c.json({ ok: true }));

  it("allows wikipedia.org origins", async () => {
    const res = await app.request("/test", {
      headers: { Origin: "https://en.wikipedia.org" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://en.wikipedia.org",
    );
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("allows localhost origins", async () => {
    const res = await app.request("/test", {
      headers: { Origin: "http://localhost:3000" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000",
    );
  });

  it("allows chrome-extension origins", async () => {
    const res = await app.request("/test", {
      headers: { Origin: "chrome-extension://abcdef123456" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "chrome-extension://abcdef123456",
    );
  });

  it("does not set Allow-Origin for disallowed origins", async () => {
    const res = await app.request("/test", {
      headers: { Origin: "https://evil.com" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("handles OPTIONS preflight", async () => {
    const res = await app.request("/test", {
      method: "OPTIONS",
      headers: { Origin: "https://en.wikipedia.org" },
    });
    expect(res.status).toBe(204);
  });
});

describe("Rate limiting middleware", () => {
  it("allows requests within limit", async () => {
    const app = new Hono();
    app.use("*", rateLimitMiddleware({ max: 5, windowMs: 60_000 }));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
  });

  it("returns 429 when limit exceeded", async () => {
    const app = new Hono();
    app.use("*", rateLimitMiddleware({ max: 2, windowMs: 60_000 }));
    app.get("/test", (c) => c.json({ ok: true }));

    // Use a unique IP for this test
    const headers = { "X-Forwarded-For": "test-rate-limit-ip" };

    await app.request("/test", { headers });
    await app.request("/test", { headers });
    const res = await app.request("/test", { headers });

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too Many Requests");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });
});
