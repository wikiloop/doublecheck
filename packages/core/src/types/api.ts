// REST API contract — pure type contracts, no runtime code

import type {
  JudgementAction,
  Judgement,
  LiftWingScore,
  Revision,
} from "./models.js";

// ---------------------------------------------------------------------------
// Endpoint path constants
// ---------------------------------------------------------------------------

export const API_PATHS = {
  health: "/api/health",
  revision: "/api/revision/:wiki/:revId",
  feed: "/api/feed/:feedName",
  rankedFeed: "/api/feed/ranked",
  judgement: "/api/judgement",
  judgements: "/api/judgements/:wiki/:revId",
  leaderboard: "/api/leaderboard",
  userHistory: "/api/user/:userId/history",
  liftWing: "/api/liftwing/:wiki/:revId",
  revertCheck: "/api/revert/check/:wiki/:revId",
  revert: "/api/revert",
  thank: "/api/thank",
  warnLevel: "/api/warn/level",
  warn: "/api/warn",
  tag: "/api/tag",
  authLogin: "/api/auth/login",
  authCallback: "/api/auth/callback",
  authMe: "/api/auth/me",
  authLogout: "/api/auth/logout",
} as const;

// ---------------------------------------------------------------------------
// Request / response types per endpoint
// ---------------------------------------------------------------------------

/** GET /api/health */
export interface HealthResponse {
  status: string;
  /** e.g. "5.0.3-alpha.0+a1b2c3" */
  version: string;
  mongo: boolean;
}

/** GET /api/revision/:wiki/:revId */
export type RevisionResponse = Revision & {
  liftWing?: LiftWingScore;
};

/** GET /api/feed/:feedName */
export interface FeedResponse {
  items: Revision[];
  nextCursor?: string;
}

/** GET /api/feed/ranked */
export interface RankedFeedResponse {
  items: import("./models.js").ScoredRevision[];
  /** Opaque cursor to continue fetching from MediaWiki */
  nextCursor?: string;
  /** How many revisions were fetched before scoring/filtering */
  batchSize: number;
}

/** POST /api/judgement — request body */
export interface JudgementRequest {
  wiki: string;
  revId: number;
  action: JudgementAction;
  /** Additional revision IDs to apply the same judgement to (consecutive edits by same user). */
  additionalRevIds?: number[];
}

/** POST /api/judgement — response */
export type JudgementResponse = Judgement;

/** GET /api/judgements/:wiki/:revId */
export interface JudgementsResponse {
  judgements: Judgement[];
  tallies: Record<JudgementAction, number>;
}

/** GET /api/leaderboard */
export interface LeaderboardEntry {
  userId: string;
  username: string;
  count: number;
  articleCount: number;
  lastReview: string | null;
  rank: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
}

/** GET /api/user/:userId/history */
export interface UserHistoryResponse {
  judgements: Judgement[];
  nextCursor?: string;
}

/** GET /api/liftwing/:wiki/:revId */
export type LiftWingResponse = LiftWingScore;

// ---------------------------------------------------------------------------
// Auth endpoint types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Revert endpoint types
// ---------------------------------------------------------------------------

/** GET /api/revert/check/:wiki/:revId */
export interface RevertCheckResponse {
  eligible: boolean;
  reason?: "not_logged_in" | "not_current" | "consecutive_edits";
  pageHistoryUrl?: string;
  consecutiveEditUser?: string;
  /** Rev IDs of all consecutive edits by the same user (newest first). Length 1 for single edits. */
  consecutiveRevIds?: number[];
  /** The revision ID just before the consecutive run (the "undoafter" target for multi-revision revert). */
  baseRevId?: number;
}

/** Revert mode determines the edit summary tone */
export type RevertMode = "vandalism" | "goodfaith";

/** POST /api/revert */
export interface RevertRequest {
  wiki: string;
  revId: number;
  /** For multi-revision revert: the base revision to undo after (last rev by a different user). */
  baseRevId?: number;
  /** Revert mode — "vandalism" (default) or "goodfaith" (AGF revert) */
  mode?: RevertMode;
  /** Optional custom reason appended to the edit summary */
  reason?: string;
}

export interface RevertResponse {
  success: boolean;
  newRevId?: number;
  error?: string;
  errorCode?: string;
}

// ---------------------------------------------------------------------------
// Warn endpoint types
// ---------------------------------------------------------------------------

/** Warning level: 1-4 for escalating severity, "4im" for immediate final */
export type WarningLevel = 1 | 2 | 3 | 4 | "4im";

/** GET /api/warn/level?wiki=enwiki&user=Example */
export interface WarnLevelResponse {
  /** The highest existing warning level found on the user's talk page this month (0 = none) */
  level: number;
  /** The recommended next warning level to post */
  autoLevel: WarningLevel;
}

/** POST /api/warn */
export interface WarnRequest {
  wiki: string;
  username: string;
  articleTitle: string;
  /** If omitted, auto-detects from talk page and increments */
  level?: WarningLevel;
}

export interface WarnResponse {
  success: boolean;
  level?: WarningLevel;
  error?: string;
}

// ---------------------------------------------------------------------------
// Tag endpoint types
// ---------------------------------------------------------------------------

/** POST /api/tag */
export interface TagRequest {
  wiki: string;
  title: string;
  tags: string[];
}

export interface TagResponse {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Thank endpoint types
// ---------------------------------------------------------------------------

/** POST /api/thank */
export interface ThankRequest {
  wiki: string;
  revId: number;
}

export interface ThankResponse {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Auth endpoint types
// ---------------------------------------------------------------------------

/** GET /api/auth/login — redirects, but define the query params */
export interface AuthLoginQuery {
  returnTo?: string;
}

/** GET /api/auth/callback — OAuth callback query params */
export interface AuthCallbackQuery {
  code: string;
  state: string;
}

/** GET /api/auth/me */
export interface AuthMeResponse {
  userId: string;
  username: string;
  identity: import("./models.js").WikiIdentity;
  loggedIn: true;
}

export interface AuthMeUnauthenticatedResponse {
  loggedIn: false;
}

/** GET /api/auth/logout */
export interface AuthLogoutResponse {
  success: boolean;
}

// ---------------------------------------------------------------------------
// SSE event types
// ---------------------------------------------------------------------------

/** SSE event dispatched when a new judgement is recorded. */
export interface JudgementEvent {
  type: "judgement";
  data: {
    revisionWiki: string;
    revisionId: number;
    action: JudgementAction;
    userId: string;
    timestamp: string;
  };
}

/** SSE heartbeat ping event. */
export interface PingEvent {
  type: "ping";
  data: {
    timestamp: string;
  };
}

/** Union of all SSE event types. */
export type SSEEvent = JudgementEvent | PingEvent;
