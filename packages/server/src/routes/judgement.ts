import { Hono } from "hono";
import type {
  JudgementAction,
  JudgementRequest,
  JudgementResponse,
  JudgementsResponse,
} from "@doublecheck/core";
import { InteractionModel } from "../db/models/index.js";
import { getSession } from "../middleware/session.js";
import { eventBus } from "../lib/eventBus.js";

const judgement = new Hono();

const VALID_ACTIONS: JudgementAction[] = [
  "ShouldRevert",
  "NotSure",
  "LooksGood",
];

/** POST /api/judgement */
judgement.post("/", async (c) => {
  const body = await c.req.json<JudgementRequest>();

  // Validate payload
  if (!body.wiki || typeof body.wiki !== "string") {
    return c.json({ error: "wiki is required" }, 400);
  }
  if (!body.revId || typeof body.revId !== "number") {
    return c.json({ error: "revId must be a number" }, 400);
  }
  if (!VALID_ACTIONS.includes(body.action)) {
    return c.json(
      { error: `action must be one of: ${VALID_ACTIONS.join(", ")}` },
      400,
    );
  }

  // Get user from session or use anonymous
  const session = getSession(c);
  const userId = session?.userId ?? "anonymous";
  const identity = session?.identity ?? {
    type: "anon" as const,
    username: null,
    verified: false,
  };

  const now = new Date().toISOString();

  const interaction = await InteractionModel.create({
    revisionWiki: body.wiki,
    revisionId: body.revId,
    action: body.action,
    userId,
    identity,
  });

  const response: JudgementResponse = {
    revisionWiki: body.wiki,
    revisionId: body.revId,
    action: body.action,
    userId,
    identity,
    timestamp: interaction.createdAt?.toISOString?.() ?? now,
  };

  // Emit SSE event
  eventBus.emitJudgement({
    revisionWiki: body.wiki,
    revisionId: body.revId,
    action: body.action,
    userId,
    timestamp: response.timestamp,
  });

  return c.json(response, 201);
});

/** GET /api/judgements/:wiki/:revId */
judgement.get("/:wiki/:revId", async (c) => {
  const wiki = c.req.param("wiki");
  const revId = parseInt(c.req.param("revId"), 10);

  if (isNaN(revId)) {
    return c.json({ error: "Invalid revId" }, 400);
  }

  // Query both v5 fields and legacy wikiRevId format ("wiki:revId")
  const legacyWikiRevId = `${wiki}:${revId}`;
  const interactions = await InteractionModel.find({
    $or: [
      { revisionWiki: wiki, revisionId: revId },
      { wikiRevId: legacyWikiRevId },
    ],
  })
    .sort({ createdAt: -1 })
    .lean();

  const judgements = interactions.map((doc: Record<string, unknown>) => ({
    revisionWiki: (doc.revisionWiki as string) ?? wiki,
    revisionId: (doc.revisionId as number) ?? revId,
    action: ((doc.action ?? doc.judgement) as JudgementAction),
    userId: ((doc.userId ?? doc.wikiUserName ?? doc.userGaId) as string) ?? "anonymous",
    identity: (doc.identity as JudgementResponse["identity"]) ?? {
      type: "anon" as const,
      username: (doc.wikiUserName as string) ?? null,
      verified: false,
    },
    timestamp:
      (doc.createdAt as Date)?.toISOString?.() ??
      (doc.createdAt as string) ??
      (doc.timestamp ? new Date((doc.timestamp as number) * 1000).toISOString() : ""),
  }));

  // Calculate tallies
  const tallies: Record<JudgementAction, number> = {
    ShouldRevert: 0,
    NotSure: 0,
    LooksGood: 0,
  };
  for (const j of judgements) {
    if (tallies[j.action] !== undefined) {
      tallies[j.action]++;
    }
  }

  const response: JudgementsResponse = { judgements, tallies };
  return c.json(response);
});

export { judgement };
