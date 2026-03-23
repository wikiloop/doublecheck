// OAuth 2.0 flow using chrome.identity for MediaWiki OAuth

import type { AuthStatusResponse } from "./messages.js";

const API_BASE = "https://wikiloop-doublecheck.toolforge.org";
const OAUTH_AUTHORIZE_URL = "https://meta.wikimedia.org/w/rest.php/oauth2/authorize";

interface TokenData {
  accessToken: string;
  userId: string;
  username: string;
}

/**
 * Launch the OAuth 2.0 web auth flow using chrome.identity.
 * The server provides the client_id and handles the token exchange.
 */
export async function launchOAuthFlow(): Promise<TokenData> {
  // Fetch OAuth client configuration from our server
  const configResponse = await fetch(`${API_BASE}/api/auth/login?format=json`);
  if (!configResponse.ok) {
    throw new Error("Failed to fetch OAuth configuration");
  }
  const config = await configResponse.json();
  const clientId = config.clientId;
  const state = config.state;

  // Build the authorization URL
  const redirectUrl = chrome.identity.getRedirectURL("callback");
  const authUrl = new URL(OAUTH_AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUrl);
  authUrl.searchParams.set("state", state);

  // Launch the web auth flow
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });

  if (!responseUrl) {
    throw new Error("OAuth flow was cancelled");
  }

  // Extract the authorization code from the callback URL
  const callbackUrl = new URL(responseUrl);
  const code = callbackUrl.searchParams.get("code");
  const returnedState = callbackUrl.searchParams.get("state");

  if (!code) {
    throw new Error("No authorization code received");
  }

  // Exchange the code for a token via our server
  const tokenResponse = await fetch(
    `${API_BASE}/api/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(returnedState ?? "")}`,
  );
  if (!tokenResponse.ok) {
    throw new Error("Token exchange failed");
  }

  const tokenData = await tokenResponse.json();

  // Store the token in session storage
  await chrome.storage.session.set({
    auth: {
      accessToken: tokenData.accessToken,
      userId: tokenData.userId,
      username: tokenData.username,
    },
  });

  return tokenData;
}

/**
 * Get the current auth status from session storage.
 */
export async function getAuthStatus(): Promise<AuthStatusResponse> {
  const result = await chrome.storage.session.get("auth");
  const auth = result.auth as TokenData | undefined;

  if (auth?.accessToken) {
    return {
      loggedIn: true,
      userId: auth.userId,
      username: auth.username,
    };
  }

  return { loggedIn: false };
}

/**
 * Get the stored access token, or null if not logged in.
 */
export async function getAccessToken(): Promise<string | null> {
  const result = await chrome.storage.session.get("auth");
  const auth = result.auth as TokenData | undefined;
  return auth?.accessToken ?? null;
}

/**
 * Clear stored auth tokens.
 */
export async function logout(): Promise<void> {
  await chrome.storage.session.remove("auth");
}
