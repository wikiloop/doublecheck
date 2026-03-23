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
  judgement: "/api/judgement",
  judgements: "/api/judgements/:wiki/:revId",
  leaderboard: "/api/leaderboard",
  userHistory: "/api/user/:userId/history",
  liftWing: "/api/liftwing/:wiki/:revId",
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

/** POST /api/judgement — request body */
export interface JudgementRequest {
  wiki: string;
  revId: number;
  action: JudgementAction;
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
