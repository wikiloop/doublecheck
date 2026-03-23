import type { MiddlewareHandler, Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

export interface SessionData {
  userId: string;
  username: string;
  identity: {
    type: "named" | "temp" | "anon";
    username: string | null;
    verified: boolean;
  };
  accessToken?: string;
}

const SESSION_COOKIE = "dc_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// In-memory session store
const sessions = new Map<string, SessionData>();

function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getSession(c: Context): SessionData | null {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (!sessionId) return null;
  return sessions.get(sessionId) ?? null;
}

export function setSession(c: Context, data: SessionData): void {
  const sessionId = generateSessionId();
  sessions.set(sessionId, data);
  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export function clearSession(c: Context): void {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (sessionId) {
    sessions.delete(sessionId);
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
  sessions.clear();
}
