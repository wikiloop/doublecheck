import { describe, it, expect, vi, beforeEach } from "vitest";
import { chromeMock, resetChromeMock } from "../chrome-mock.js";
import { launchOAuthFlow, getAuthStatus, getAccessToken, logout } from "../../background/auth.js";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

describe("OAuth authentication", () => {
  beforeEach(() => {
    resetChromeMock();
    fetchMock.mockReset();
  });

  describe("launchOAuthFlow", () => {
    it("fetches config, launches web auth flow, and exchanges code", async () => {
      // Mock: server returns OAuth config
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ clientId: "test-client", state: "test-state" }),
        })
        // Mock: token exchange
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              accessToken: "access-123",
              userId: "user-1",
              username: "TestUser",
            }),
        });

      // Mock: chrome.identity returns a callback URL with code
      chromeMock.identity.launchWebAuthFlow.mockResolvedValueOnce(
        "https://test-id.chromiumapp.org/callback?code=auth-code-123&state=test-state",
      );

      const result = await launchOAuthFlow();

      expect(result).toEqual({
        accessToken: "access-123",
        userId: "user-1",
        username: "TestUser",
      });

      // Verify the auth flow was launched with correct URL
      expect(chromeMock.identity.launchWebAuthFlow).toHaveBeenCalledWith(
        expect.objectContaining({ interactive: true }),
      );

      // Verify token was stored in session storage
      const stored = await chromeMock.storage.session.get("auth");
      expect(stored.auth).toEqual({
        accessToken: "access-123",
        userId: "user-1",
        username: "TestUser",
      });
    });

    it("throws when OAuth config fetch fails", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false });

      await expect(launchOAuthFlow()).rejects.toThrow(
        "Failed to fetch OAuth configuration",
      );
    });

    it("throws when auth flow is cancelled", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: "c", state: "s" }),
      });
      chromeMock.identity.launchWebAuthFlow.mockResolvedValueOnce("");

      await expect(launchOAuthFlow()).rejects.toThrow();
    });

    it("throws when token exchange fails", async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ clientId: "c", state: "s" }),
        })
        .mockResolvedValueOnce({ ok: false });

      chromeMock.identity.launchWebAuthFlow.mockResolvedValueOnce(
        "https://test-id.chromiumapp.org/callback?code=c&state=s",
      );

      await expect(launchOAuthFlow()).rejects.toThrow("Token exchange failed");
    });
  });

  describe("getAuthStatus", () => {
    it("returns loggedIn false when no auth stored", async () => {
      const status = await getAuthStatus();
      expect(status).toEqual({ loggedIn: false });
    });

    it("returns loggedIn true with user info when auth is stored", async () => {
      await chromeMock.storage.session.set({
        auth: {
          accessToken: "token-123",
          userId: "user-1",
          username: "TestUser",
        },
      });

      const status = await getAuthStatus();
      expect(status).toEqual({
        loggedIn: true,
        userId: "user-1",
        username: "TestUser",
      });
    });
  });

  describe("getAccessToken", () => {
    it("returns null when not logged in", async () => {
      const token = await getAccessToken();
      expect(token).toBeNull();
    });

    it("returns the token when logged in", async () => {
      await chromeMock.storage.session.set({
        auth: { accessToken: "my-token", userId: "u", username: "u" },
      });

      const token = await getAccessToken();
      expect(token).toBe("my-token");
    });
  });

  describe("logout", () => {
    it("clears the auth from session storage", async () => {
      await chromeMock.storage.session.set({
        auth: { accessToken: "x", userId: "u", username: "u" },
      });

      await logout();

      const stored = await chromeMock.storage.session.get("auth");
      expect(stored.auth).toBeUndefined();
    });
  });
});
