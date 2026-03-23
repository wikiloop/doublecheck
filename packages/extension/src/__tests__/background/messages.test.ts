import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { MessageType } from "../../background/messages.js";
import { chromeMock } from "../chrome-mock.js";

// Mock fetch before importing the background index
const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

// Mock EventSource
class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor(public url: string) {}
}
(globalThis as Record<string, unknown>).EventSource = MockEventSource;

// The background module registers its listener on import (once, cached).
// We capture it here so all tests can use it.
type Listener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean | void;

let listener: Listener;

beforeAll(async () => {
  await import("../../background/index.js");
  // The listener was registered via addListener during module init
  const calls = chromeMock.runtime.onMessage.addListener.mock.calls;
  listener = calls[0][0] as Listener;
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe("Background message routing", () => {
  it("defines all expected message types", () => {
    expect(MessageType.API_REQUEST).toBe("API_REQUEST");
    expect(MessageType.API_RESPONSE).toBe("API_RESPONSE");
    expect(MessageType.SSE_EVENT).toBe("SSE_EVENT");
    expect(MessageType.AUTH_LOGIN).toBe("AUTH_LOGIN");
    expect(MessageType.AUTH_STATUS).toBe("AUTH_STATUS");
    expect(MessageType.AUTH_LOGOUT).toBe("AUTH_LOGOUT");
  });

  it("registers a message listener when background script loads", () => {
    expect(listener).toBeTypeOf("function");
  });

  it("handles API_REQUEST messages by fetching from the API", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: "ok" }),
    });

    const sendResponse = vi.fn();
    const result = listener(
      {
        type: MessageType.API_REQUEST,
        id: "test-1",
        method: "GET",
        path: "/api/health",
      },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    );

    // Should return true to indicate async response
    expect(result).toBe(true);

    // Wait for async work
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/health"),
      expect.objectContaining({ method: "GET" }),
    );
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.API_RESPONSE,
        id: "test-1",
        status: 200,
      }),
    );
  });

  it("handles API_REQUEST errors gracefully", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network failure"));

    const sendResponse = vi.fn();
    listener(
      {
        type: MessageType.API_REQUEST,
        id: "test-err",
        method: "GET",
        path: "/api/health",
      },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.API_RESPONSE,
        id: "test-err",
        status: 0,
        error: "Network failure",
      }),
    );
  });

  it("handles AUTH_STATUS messages", async () => {
    const sendResponse = vi.fn();
    listener(
      { type: MessageType.AUTH_STATUS },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ loggedIn: false }),
    );
  });

  it("handles AUTH_LOGOUT messages", async () => {
    // Pre-set auth data
    await chromeMock.storage.session.set({
      auth: { accessToken: "test", userId: "u1", username: "TestUser" },
    });

    const sendResponse = vi.fn();
    listener(
      { type: MessageType.AUTH_LOGOUT },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ loggedIn: false }),
    );
  });
});
