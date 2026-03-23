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

export function createApp(): Hono {
  const app = new Hono();

  // Global middleware
  app.use("*", corsMiddleware());
  app.use("*", loggerMiddleware());
  app.use("*", sessionMiddleware());

  // Rate limiting: writes (POST) get stricter limits
  app.use("/api/judgement", writeLimiter);
  app.use("/api/*", readLimiter);

  // Health check
  app.get("/api/health", async (c) => {
    const mongoConnected = mongoose.connection.readyState === 1;
    return c.json({
      status: "ok",
      version: "5.0.0-alpha.0",
      mongo: mongoConnected,
    });
  });

  // API routes
  app.route("/api/revision", revision);
  app.route("/api/feed", feed);
  app.route("/api/judgement", judgement);
  app.route("/api/judgements", judgement);
  app.route("/api/leaderboard", leaderboard);
  app.route("/api/user", userHistory);
  app.route("/api/liftwing", liftwing);
  app.route("/api/auth", auth);
  app.route("/api/events", events);

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

// Only start server when running directly (not during tests)
const isDirectRun =
  process.argv[1]?.includes("index") ?? false;

if (isDirectRun) {
  const app = createApp();

  // Connect to MongoDB
  connectDB()
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => {
      console.error("MongoDB connection failed:", err);
      process.exit(1);
    });

  const port = parseInt(process.env.PORT || "8000", 10);
  console.log(`Listening on port ${port}`);
  serve({ fetch: app.fetch, port });
}
