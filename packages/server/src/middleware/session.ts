import type { MiddlewareHandler, Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { SessionModel } from "../db/models/index.js";

export interface SessionData {
  userId: string;
  username: string;
  identity: {
    type: "named" | "temp" | "anon";
    username: string | null;
    verified: boolean;
  };
  accessToken?: string;
  refreshToken?: string;
}

const SESSION_COOKIE = "dc_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// In-memory cache to avoid hitting MongoDB on every request.
// Falls through to DB on cache miss (e.g. after server restart).
const sessionCache = new Map<string, SessionData>();

function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getSession(c: Context): Promise<SessionData | null> {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (!sessionId) return null;

  // Check in-memory cache first
  const cached = sessionCache.get(sessionId);
  if (cached) return cached;

  // Fall through to MongoDB
  try {
    const doc = await SessionModel.findOne({ sessionId }).lean<{
      userId: string;
      username: string;
      identity: SessionData["identity"];
      accessToken?: string;
      refreshToken?: string;
    }>();
    if (!doc) return null;

    const data: SessionData = {
      userId: doc.userId,
      username: doc.username,
      identity: doc.identity,
      accessToken: doc.accessToken,
      refreshToken: doc.refreshToken,
    };
    sessionCache.set(sessionId, data);
    return data;
  } catch {
    return null;
  }
}

export async function setSession(c: Context, data: SessionData): Promise<void> {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  // Persist to MongoDB
  try {
    await SessionModel.create({
      sessionId,
      userId: data.userId,
      username: data.username,
      identity: data.identity,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt,
    });
  } catch (err) {
    console.error("Failed to persist session to MongoDB:", err);
  }

  // Also cache in memory
  sessionCache.set(sessionId, data);

  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

/** Update the access (and optionally refresh) token on an existing session */
export async function updateSessionTokens(
  c: Context,
  newAccessToken: string,
  newRefreshToken?: string,
): Promise<void> {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (!sessionId) return;

  const cached = sessionCache.get(sessionId);
  if (cached) {
    cached.accessToken = newAccessToken;
    if (newRefreshToken) cached.refreshToken = newRefreshToken;
  }

  try {
    const update: Record<string, string> = { accessToken: newAccessToken };
    if (newRefreshToken) update.refreshToken = newRefreshToken;
    await SessionModel.updateOne({ sessionId }, { $set: update });
  } catch {
    // best-effort
  }
}

export async function clearSession(c: Context): Promise<void> {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (sessionId) {
    sessionCache.delete(sessionId);
    try {
      await SessionModel.deleteOne({ sessionId });
    } catch {
      // best-effort cleanup
    }
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export function sessionMiddleware(): MiddlewareHandler {
  return async (_c, next) => {
    await next();
  };
}

// Exported for testing
export function _clearAllSessions(): void {
  sessionCache.clear();
}
