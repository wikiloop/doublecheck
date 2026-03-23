import { Hono } from "hono";
import type {
  AuthMeResponse,
  AuthMeUnauthenticatedResponse,
  AuthLogoutResponse,
} from "@doublecheck/core";
import { UserModel } from "../db/models/index.js";
import {
  getSession,
  setSession,
  clearSession,
} from "../middleware/session.js";

const auth = new Hono();

// OAuth state store (in-memory, maps state -> returnTo)
const oauthStates = new Map<string, string>();

function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** GET /api/auth/login */
auth.get("/login", (c) => {
  const returnTo = c.req.query("returnTo") ?? "/";
  const clientId = process.env.OAUTH_CLIENT_ID;

  if (!clientId) {
    return c.json({ error: "OAuth not configured" }, 500);
  }

  const state = generateState();
  oauthStates.set(state, returnTo);

  // Clean up old states after 10 minutes
  setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: `${c.req.url.split("/api/auth")[0]}/api/auth/callback`,
    state,
  });

  const authorizeUrl = `https://meta.wikimedia.org/w/rest.php/oauth2/authorize?${params.toString()}`;
  return c.redirect(authorizeUrl);
});

/** GET /api/auth/callback */
auth.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code || !state) {
    return c.json({ error: "Missing code or state" }, 400);
  }

  const returnTo = oauthStates.get(state);
  if (returnTo === undefined) {
    return c.json({ error: "Invalid or expired state" }, 400);
  }
  oauthStates.delete(state);

  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return c.json({ error: "OAuth not configured" }, 500);
  }

  // Exchange code for access token
  const tokenRes = await fetch(
    "https://meta.wikimedia.org/w/rest.php/oauth2/access_token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${c.req.url.split("/api/auth")[0]}/api/auth/callback`,
      }).toString(),
    },
  );

  if (!tokenRes.ok) {
    return c.json({ error: "Token exchange failed" }, 502);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return c.json({ error: "No access token received" }, 502);
  }

  // Get user info from MediaWiki
  const userInfoRes = await fetch(
    "https://meta.wikimedia.org/w/api.php?action=query&meta=userinfo&format=json&formatversion=2",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!userInfoRes.ok) {
    return c.json({ error: "Failed to fetch user info" }, 502);
  }

  const userInfoData = (await userInfoRes.json()) as {
    query?: { userinfo?: { name?: string; id?: number } };
  };
  const username = userInfoData?.query?.userinfo?.name;

  if (!username) {
    return c.json({ error: "Failed to get username" }, 502);
  }

  // Create or update user in DB
  const now = new Date().toISOString();
  await UserModel.findOneAndUpdate(
    { wikiUserName: username },
    {
      $set: {
        wikiUserName: username,
        identity: { type: "named", username, verified: true },
        lastActive: now,
      },
      $inc: { contributionCount: 0 },
    },
    { upsert: true, new: true },
  );

  // Set session
  setSession(c, {
    userId: username,
    username,
    identity: { type: "named", username, verified: true },
    accessToken,
  });

  return c.redirect(returnTo);
});

/** GET /api/auth/me */
auth.get("/me", (c) => {
  const session = getSession(c);

  if (!session) {
    const response: AuthMeUnauthenticatedResponse = { loggedIn: false };
    return c.json(response);
  }

  const response: AuthMeResponse = {
    userId: session.userId,
    username: session.username,
    identity: session.identity,
    loggedIn: true,
  };
  return c.json(response);
});

/** GET /api/auth/logout */
auth.get("/logout", (c) => {
  clearSession(c);
  const response: AuthLogoutResponse = { success: true };
  return c.json(response);
});

export { auth };
