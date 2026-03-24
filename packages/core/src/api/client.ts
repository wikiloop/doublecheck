import type {
  HealthResponse,
  RevisionResponse,
  FeedResponse,
  RankedFeedResponse,
  JudgementRequest,
  JudgementResponse,
  JudgementsResponse,
  LeaderboardResponse,
  UserHistoryResponse,
  LiftWingResponse,
  AuthMeResponse,
  AuthMeUnauthenticatedResponse,
  AuthLogoutResponse,
} from "../types/index.js";

export interface ApiClientOptions {
  baseUrl?: string;
}

export class ApiClient {
  private baseUrl: string;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "").replace(/\/$/, "");
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const signal = init?.signal;

    // Network error — no retry (let it propagate naturally)
    let response: Response = await fetch(url, init);

    // Retry once on 5xx
    if (response.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000));
      if (signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      response = await fetch(url, init);
    }

    if (!response.ok) {
      throw new ApiError(response.status, response.statusText, url);
    }

    return response.json() as Promise<T>;
  }

  getHealth(signal?: AbortSignal): Promise<HealthResponse> {
    return this.request("/api/health", { signal });
  }

  getRevision(wiki: string, revId: number, signal?: AbortSignal): Promise<RevisionResponse> {
    return this.request(`/api/revision/${encodeURIComponent(wiki)}/${revId}`, { signal });
  }

  getFeed(feedName: string, cursor?: string, signal?: AbortSignal): Promise<FeedResponse> {
    const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return this.request(`/api/feed/${encodeURIComponent(feedName)}${params}`, { signal });
  }

  getRankedFeed(wiki?: string, cursor?: string, signal?: AbortSignal): Promise<RankedFeedResponse> {
    const params = new URLSearchParams();
    if (wiki) params.set("wiki", wiki);
    if (cursor) params.set("cursor", cursor);
    const qs = params.toString();
    return this.request(`/api/feed/ranked${qs ? `?${qs}` : ""}`, { signal });
  }

  submitJudgement(req: JudgementRequest, signal?: AbortSignal): Promise<JudgementResponse> {
    return this.request("/api/judgement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal,
    });
  }

  getJudgements(wiki: string, revId: number, signal?: AbortSignal): Promise<JudgementsResponse> {
    return this.request(`/api/judgements/${encodeURIComponent(wiki)}/${revId}`, { signal });
  }

  getLeaderboard(period?: string, signal?: AbortSignal): Promise<LeaderboardResponse> {
    const params = period ? `?period=${encodeURIComponent(period)}` : "";
    return this.request(`/api/leaderboard${params}`, { signal });
  }

  getUserHistory(userId: string, cursor?: string, signal?: AbortSignal): Promise<UserHistoryResponse> {
    const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return this.request(`/api/user/${encodeURIComponent(userId)}/history${params}`, { signal });
  }

  getLiftWing(wiki: string, revId: number, signal?: AbortSignal): Promise<LiftWingResponse> {
    return this.request(`/api/liftwing/${encodeURIComponent(wiki)}/${revId}`, { signal });
  }

  getAuthMe(signal?: AbortSignal): Promise<AuthMeResponse | AuthMeUnauthenticatedResponse> {
    return this.request("/api/auth/me", { signal });
  }

  logout(signal?: AbortSignal): Promise<AuthLogoutResponse> {
    return this.request("/api/auth/logout", { signal });
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly url: string,
  ) {
    super(`API ${status} ${statusText}: ${url}`);
    this.name = "ApiError";
  }
}

/** Default singleton instance — consumers can replace via createApiClient(). */
let defaultClient = new ApiClient();

export function createApiClient(options: ApiClientOptions): ApiClient {
  defaultClient = new ApiClient(options);
  return defaultClient;
}

export function getApiClient(): ApiClient {
  return defaultClient;
}
