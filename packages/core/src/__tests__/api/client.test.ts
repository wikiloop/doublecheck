import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiClient, ApiError } from "../../api/client.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ApiClient", () => {
  let client: ApiClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new ApiClient({ baseUrl: "http://localhost:3000" });
  });

  it("constructs correct URL for getHealth", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ status: "ok" }));

    await client.getHealth();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/health",
      expect.anything(),
    );
  });

  it("constructs correct URL for getRevision", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ wiki: "enwiki", revId: 42 }),
    );

    await client.getRevision("enwiki", 42);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/revision/enwiki/42",
      expect.anything(),
    );
  });

  it("constructs correct URL for getFeed with cursor", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ items: [] }));

    await client.getFeed("recent", "abc123");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/feed/recent?cursor=abc123",
      expect.anything(),
    );
  });

  it("sends POST for submitJudgement", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ action: "LooksGood" }));

    await client.submitJudgement({
      wiki: "enwiki",
      revId: 42,
      action: "LooksGood",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/judgement",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          wiki: "enwiki",
          revId: 42,
          action: "LooksGood",
        }),
      }),
    );
  });

  it("retries on 5xx status", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }));

    // Speed up the retry delay
    vi.useFakeTimers();
    const promise = client.getHealth();
    await vi.advanceTimersByTimeAsync(1100);
    const result = await promise;
    vi.useRealTimers();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ status: "ok" });
  });

  it("throws ApiError on non-ok response", async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, 404));

    await expect(client.getHealth()).rejects.toThrow(ApiError);
    await expect(client.getHealth()).rejects.toThrow("404");
  });

  it("respects AbortSignal", async () => {
    const controller = new AbortController();
    controller.abort();

    mockFetch.mockRejectedValue(
      new DOMException("The operation was aborted.", "AbortError"),
    );

    await expect(
      client.getHealth(controller.signal),
    ).rejects.toThrow("aborted");
  });

  it("constructs correct URL for getJudgements", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ judgements: [], tallies: {} }),
    );

    await client.getJudgements("enwiki", 42);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/judgements/enwiki/42",
      expect.anything(),
    );
  });

  it("constructs correct URL for getLiftWing", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ damaging: 0.5, goodfaith: 0.8 }),
    );

    await client.getLiftWing("enwiki", 42);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/liftwing/enwiki/42",
      expect.anything(),
    );
  });

  it("strips trailing slash from baseUrl", async () => {
    const c = new ApiClient({ baseUrl: "http://localhost:3000/" });
    mockFetch.mockResolvedValueOnce(jsonResponse({ status: "ok" }));

    await c.getHealth();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/health",
      expect.anything(),
    );
  });
});
