// Domain types — pure type contracts, no runtime code

/** The three judgement actions a reviewer can take on a revision. */
export type JudgementAction = "ShouldRevert" | "NotSure" | "LooksGood";

/** Identity classification for Wikipedia users. */
export type WikiIdentityType = "named" | "temp" | "anon";

/** A Wikipedia user's identity as detected on the client and optionally verified server-side. */
export interface WikiIdentity {
  type: WikiIdentityType;
  username: string | null;
  verified: boolean;
}

/** A single Wikipedia revision (edit). */
export interface Revision {
  wiki: string;
  revId: number;
  parentRevId: number;
  title: string;
  timestamp: string;
  user: string;
  comment: string;
  pageId: number;
  diffHtml?: string;
}

/** Lift Wing (ORES successor) machine-learning score for a revision. */
export interface LiftWingScore {
  damaging: number;
  goodfaith: number;
  modelVersion?: string;
}

/** A single judgement submitted by a reviewer for a revision. */
export interface Judgement {
  revisionWiki: string;
  revisionId: number;
  action: JudgementAction;
  userId: string;
  identity: WikiIdentity;
  timestamp: string;
}

/** A user profile in the system. */
export interface User {
  wikiUserName: string;
  identity: WikiIdentity;
  contributionCount: number;
  lastActive: string;
}

/** A named review feed (e.g., recent changes for a particular wiki). */
export interface Feed {
  name: string;
  wiki: string;
  filter?: Record<string, unknown>;
}

/** Full interaction record combining a revision with its judgement and ML scores. */
export interface Interaction {
  revisionWiki: string;
  revisionId: number;
  revision: Revision;
  judgement: Judgement;
  liftWingScore?: LiftWingScore;
  revertedByUser?: boolean;
  createdAt: string;
}
