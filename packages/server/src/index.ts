import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import mongoose from "mongoose";

import { connectDB } from "./db/connection.js";
import { corsMiddleware } from "./middleware/cors.js";
import { loggerMiddleware } from "./middleware/logger.js";
import { readLimiter, writeLimiter } from "./middleware/rateLimit.js";
import { sessionMiddleware } from "./middleware/session.js";

import { revision } from "./routes/revision.js";
import { feed } from "./routes/feed.js";
import { judgement } from "./routes/judgement.js";
import { leaderboard } from "./routes/leaderboard.js";
import { userHistory } from "./routes/userHistory.js";
import { liftwing } from "./routes/liftwing.js";
import { auth } from "./routes/auth.js";
import { events } from "./routes/events.js";
import { revert } from "./routes/revert.js";
import { rankedFeed } from "./routes/rankedFeed.js";
import { startRevertRiskStream } from "./lib/revertRiskStream.js";
import { readFileSync } from "node:fs";

let BUILD_VERSION = "unknown";
try {
  const info = JSON.parse(readFileSync(new URL("../build-info.json", import.meta.url), "utf8"));
  BUILD_VERSION = info.version ?? "unknown";
} catch { /* no build-info.json */ }

/** Create a Hono app with API routes only (no static file serving). */
export function createApiApp(): Hono {
  const app = new Hono();

  // Global middleware
  app.use("*", corsMiddleware());
  app.use("*", loggerMiddleware());
  app.use("*", sessionMiddleware());

  // Rate limiting: writes (POST) get stricter limits
  app.use("/api/judgement", writeLimiter);
  app.use("/api/revert", writeLimiter);
  app.use("/api/*", readLimiter);

  // Health check
  app.get("/api/health", async (c) => {
    const mongoConnected = mongoose.connection.readyState === 1;
    return c.json({
      status: "ok",
      version: BUILD_VERSION,
      mongo: mongoConnected,
    });
  });

  // API routes
  app.route("/api/revision", revision);
  app.route("/api/feed/ranked", rankedFeed);
  app.route("/api/feed", feed);
  app.route("/api/judgement", judgement);
  app.route("/api/judgements", judgement);
  app.route("/api/leaderboard", leaderboard);
  app.route("/api/user", userHistory);
  app.route("/api/liftwing", liftwing);
  app.route("/api/auth", auth);
  app.route("/auth", auth); // OAuth callback registered at /auth/callback
  app.route("/api/events", events);
  app.route("/api/revert", revert);

  return app;
}

/** Create a full Hono app with API routes + static file serving (for standalone server). */
export function createApp(): Hono {
  const app = createApiApp();

  // Serve userscript for direct installation
  app.use(
    "/doublecheck.user.js",
    serveStatic({
      root: "./packages/userscript",
      path: "wikiloop-doublecheck.user.js",
    }),
  );

  // Serve Vue SPA static files
  app.use("/*", serveStatic({ root: "./dist/web" }));
  app.use("/*", serveStatic({ root: "./dist/web", path: "index.html" }));

  return app;
}

// Start server when running directly (not during tests)
// Detect: either `node dist/index.js` or `tsx src/index.ts`
const scriptPath = process.argv[1] ?? "";
const isDirectRun =
  scriptPath.endsWith("/index.js") ||
  scriptPath.endsWith("/index.ts") ||
  scriptPath.includes("dist/index");

if (isDirectRun) {
  const app = createApp();

  // Connect to MongoDB (non-blocking — server starts even if DB is unavailable)
  connectDB()
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => {
      console.error("MongoDB connection failed (server continues without DB):", err.message ?? err);
    });

  // Start consuming the Wikimedia revert-risk prediction stream
  startRevertRiskStream();

  const port = parseInt(process.env.PORT || "8000", 10);
  console.log(`Listening on port ${port}`);
  serve({ fetch: app.fetch, port });
}
