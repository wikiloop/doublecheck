import { handle } from "@hono/node-server/vercel";
import { createApiApp } from "../packages/server/src/index.js";
import { connectDB } from "../packages/server/src/db/connection.js";

const app = createApiApp();

// Connect to MongoDB once on cold start
connectDB().catch((err) => {
  console.error("MongoDB connection failed:", err.message ?? err);
});

export default handle(app);
