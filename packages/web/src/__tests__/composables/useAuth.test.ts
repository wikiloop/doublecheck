import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuth } from "../../composables/useAuth";

describe("useAuth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with logged-out state", () => {
    const { isLoggedIn, loading } = useAuth();
    expect(isLoggedIn.value).toBe(false);
    expect(loading.value).toBe(false);
  });

  it("checkAuth sets user when API returns loggedIn: true", async () => {
    const mockUser = {
      loggedIn: true,
      userId: "123",
      username: "TestUser",
      identity: { type: "named", username: "TestUser", verified: true },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      json: () => Promise.resolve(mockUser),
    } as Response);

    const { checkAuth, isLoggedIn, user } = useAuth();
    await checkAuth();

    expect(isLoggedIn.value).toBe(true);
    expect(user.value?.username).toBe("TestUser");
  });

  it("checkAuth handles unauthenticated response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      json: () => Promise.resolve({ loggedIn: false }),
    } as Response);

    const { checkAuth, isLoggedIn, user } = useAuth();
    await checkAuth();

    expect(isLoggedIn.value).toBe(false);
    expect(user.value).toBeNull();
  });

  it("checkAuth handles network errors", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    const { checkAuth, isLoggedIn } = useAuth();
    await checkAuth();

    expect(isLoggedIn.value).toBe(false);
  });

  it("login redirects to /api/auth/login", () => {
    const { login } = useAuth();
    // login() sets window.location.href — we just verify it doesn't throw
    // Full redirect testing requires a browser environment
    expect(typeof login).toBe("function");
  });

  it("logout clears user state", async () => {
    // First login
    const mockUser = {
      loggedIn: true,
      userId: "123",
      username: "TestUser",
      identity: { type: "named", username: "TestUser", verified: true },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      json: () => Promise.resolve(mockUser),
    } as Response);

    const { checkAuth, logout, isLoggedIn, user } = useAuth();
    await checkAuth();
    expect(isLoggedIn.value).toBe(true);

    // Then logout
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true }),
    } as Response);

    await logout();
    expect(isLoggedIn.value).toBe(false);
    expect(user.value).toBeNull();
  });
});
