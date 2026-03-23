import { describe, it, expectTypeOf } from "vitest";
import type { JudgementAction, Revision, WikiIdentity, Interaction, LiftWingScore } from "../types/models.js";
import type { HealthResponse, JudgementRequest, FeedResponse } from "../types/api.js";
import type { RevisionCardProps, ActionPanelProps } from "../types/components.js";

describe("Domain types", () => {
  it("JudgementAction is a string union", () => {
    expectTypeOf<JudgementAction>().toBeString();
  });

  it("Revision has required fields", () => {
    expectTypeOf<Revision>().toHaveProperty("wiki");
    expectTypeOf<Revision>().toHaveProperty("revId");
    expectTypeOf<Revision>().toHaveProperty("title");
  });

  it("WikiIdentity has type and username", () => {
    expectTypeOf<WikiIdentity>().toHaveProperty("type");
    expectTypeOf<WikiIdentity>().toHaveProperty("username");
    expectTypeOf<WikiIdentity>().toHaveProperty("verified");
  });

  it("Interaction includes revision and judgement", () => {
    expectTypeOf<Interaction>().toHaveProperty("revision");
    expectTypeOf<Interaction>().toHaveProperty("judgement");
  });

  it("LiftWingScore has damaging and goodfaith", () => {
    expectTypeOf<LiftWingScore>().toHaveProperty("damaging");
    expectTypeOf<LiftWingScore>().toHaveProperty("goodfaith");
  });
});

describe("API types", () => {
  it("HealthResponse has status and mongo", () => {
    expectTypeOf<HealthResponse>().toHaveProperty("status");
    expectTypeOf<HealthResponse>().toHaveProperty("mongo");
  });

  it("JudgementRequest has wiki, revId, action", () => {
    expectTypeOf<JudgementRequest>().toHaveProperty("wiki");
    expectTypeOf<JudgementRequest>().toHaveProperty("revId");
    expectTypeOf<JudgementRequest>().toHaveProperty("action");
  });

  it("FeedResponse has items array", () => {
    expectTypeOf<FeedResponse>().toHaveProperty("items");
  });
});

describe("Component types", () => {
  it("RevisionCardProps has revision", () => {
    expectTypeOf<RevisionCardProps>().toHaveProperty("revision");
  });

  it("ActionPanelProps has revisionWiki and revisionId", () => {
    expectTypeOf<ActionPanelProps>().toHaveProperty("revisionWiki");
    expectTypeOf<ActionPanelProps>().toHaveProperty("revisionId");
  });
});
