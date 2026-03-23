import { Hono } from "hono";
import type { LiftWingResponse } from "@doublecheck/core";
import { fetchLiftWingScore } from "../lib/liftWingCache.js";

const liftwing = new Hono();

/** GET /api/liftwing/:wiki/:revId */
liftwing.get("/:wiki/:revId", async (c) => {
  const wiki = c.req.param("wiki");
  const revId = parseInt(c.req.param("revId"), 10);

  if (isNaN(revId)) {
    return c.json({ error: "Invalid revId" }, 400);
  }

  try {
    const score: LiftWingResponse = await fetchLiftWingScore(wiki, revId);
    return c.json(score);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Lift Wing API error";
    return c.json({ error: message }, 502);
  }
});

export { liftwing };
