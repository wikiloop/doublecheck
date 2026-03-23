import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick } from "vue";
import { useRevision } from "../../composables/useRevision.js";
import { createApiClient } from "../../api/client.js";
import type { RevisionResponse } from "../../types/index.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const mockRevisionResponse: RevisionResponse = {
  wiki: "enwiki",
  revId: 123,
  parentRevId: 122,
  title: "Test",
  timestamp: "2024-01-01T00:00:00Z",
  user: "User1",
  comment: "Test edit",
  pageId: 1,
  liftWing: { damaging: 0.5, goodfaith: 0.9 },
};

describe("useRevision", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    createApiClient({ baseUrl: "http://test" });
  });

  it("fetches revision data and populates refs", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(mockRevisionResponse));

    const { revision, liftWingScore, loading } = useRevision("enwiki", 123);

    // Initially loading
    expect(loading.value).toBe(true);

    // Wait for the fetch to complete
    await vi.waitFor(() => {
      expect(loading.value).toBe(false);
    });

    expect(revision.value).not.toBeNull();
    expect(revision.value!.wiki).toBe("enwiki");
    expect(revision.value!.title).toBe("Test");
    expect(liftWingScore.value).toEqual({ damaging: 0.5, goodfaith: 0.9 });
  });

  it("sets error on fetch failure", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: "not found" }, 404));

    const { error, loading } = useRevision("enwiki", 999);

    await vi.waitFor(() => {
      expect(loading.value).toBe(false);
    });

    expect(error.value).not.toBeNull();
  });

  it("constructs correct URL", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(mockRevisionResponse));

    useRevision("enwiki", 123);

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(mockFetch.mock.calls[0][0]).toBe("http://test/api/revision/enwiki/123");
  });
});
