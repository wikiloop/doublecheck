import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

const app = new Hono();

// API routes
app.get("/api/health", (c) =>
  c.json({ status: "ok", app: "WikiLoop DoubleCheck", version: "5.0.0-alpha.0" })
);

// Serve userscript for direct installation
app.use("/doublecheck.user.js", serveStatic({ root: "./packages/userscript", path: "wikiloop-doublecheck.user.js" }));

// Serve Vue SPA static files
app.use("/*", serveStatic({ root: "./dist/web" }));
app.use("/*", serveStatic({ root: "./dist/web", path: "index.html" }));

const port = parseInt(process.env.PORT || "8000", 10);
console.log(`Listening on port ${port}`);
serve({ fetch: app.fetch, port });
