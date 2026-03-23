import { describe, it, expect, vi, beforeEach } from "vitest";
import { useJudgement } from "../../composables/useJudgement.js";
import { createApiClient } from "../../api/client.js";
import type { JudgementsResponse, JudgementResponse } from "../../types/index.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const mockJudgementsResponse: JudgementsResponse = {
  judgements: [
    {
      revisionWiki: "enwiki",
      revisionId: 123,
      action: "LooksGood",
      userId: "user1",
      identity: { type: "named", username: "User1", verified: true },
      timestamp: "2024-01-01T00:00:00Z",
    },
  ],
  tallies: { ShouldRevert: 1, NotSure: 0, LooksGood: 3 },
};

const mockSubmitResponse: JudgementResponse = {
  revisionWiki: "enwiki",
  revisionId: 123,
  action: "ShouldRevert",
  userId: "me",
  identity: { type: "named", username: "Me", verified: true },
  timestamp: "2024-01-01T01:00:00Z",
};

describe("useJudgement", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    createApiClient({ baseUrl: "http://test" });
  });

  it("fetches judgements and tallies", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(mockJudgementsResponse));

    const { judgements, tallies, loading } = useJudgement("enwiki", 123);

    await vi.waitFor(() => {
      expect(loading.value).toBe(false);
    });

    expect(judgements.value).toHaveLength(1);
    expect(tallies.value.LooksGood).toBe(3);
    expect(tallies.value.ShouldRevert).toBe(1);
  });

  it("submits a judgement and updates tallies", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(mockJudgementsResponse))
      .mockResolvedValueOnce(jsonResponse(mockSubmitResponse));

    const { submit, tallies, userAction, loading } = useJudgement("enwiki", 123);

    // Wait for initial fetch
    await vi.waitFor(() => {
      expect(loading.value).toBe(false);
    });

    await submit("ShouldRevert");

    expect(userAction.value).toBe("ShouldRevert");
    // Tally should be incremented by 1 from original
    expect(tallies.value.ShouldRevert).toBe(2);
  });

  it("handles fetch error", async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, 404));

    const { error, loading } = useJudgement("enwiki", 123);

    await vi.waitFor(() => {
      expect(loading.value).toBe(false);
    });

    expect(error.value).not.toBeNull();
  });
});
