import { handle } from "hono/vercel";
import { createApiApp } from "../packages/server/src/index.js";
import { connectDB } from "../packages/server/src/db/connection.js";

export const config = { runtime: "nodejs" };

const app = createApiApp();

// Connect to MongoDB once on cold start
connectDB().catch((err) => {
  console.error("MongoDB connection failed:", err.message ?? err);
});

export default handle(app);
