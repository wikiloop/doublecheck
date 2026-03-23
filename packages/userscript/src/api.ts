import type {
  JudgementAction,
  JudgementsResponse,
  LiftWingResponse,
  JudgementResponse,
} from "@doublecheck/core";
import { detectIdentity } from "./identity.js";

const API_BASE = "https://wikiloop-doublecheck.toolforge.org/api";

interface FetchOptions {
  method?: string;
  body?: unknown;
}

/**
 * Fetch wrapper that targets the DoubleCheck Toolforge API.
 * Automatically includes identity information for authenticated requests.
 */
async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const identity = detectIdentity();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (identity.username) {
    headers["X-DC-Username"] = identity.username;
    headers["X-DC-Identity-Type"] = identity.type;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: "omit",
  });

  if (!response.ok) {
    throw new Error(`[DoubleCheck] API ${response.status}: ${path}`);
  }

  return response.json() as Promise<T>;
}

/** Fetch LiftWing scores for a single revision. */
export function fetchLiftWingScore(
  wiki: string,
  revId: number,
): Promise<LiftWingResponse> {
  return apiFetch<LiftWingResponse>(`/liftwing/${wiki}/${revId}`);
}

/** Fetch existing judgements + tallies for a revision. */
export function fetchJudgements(
  wiki: string,
  revId: number,
): Promise<JudgementsResponse> {
  return apiFetch<JudgementsResponse>(`/judgements/${wiki}/${revId}`);
}

/** Submit a judgement for a revision. */
export function submitJudgement(
  wiki: string,
  revId: number,
  action: JudgementAction,
): Promise<JudgementResponse> {
  return apiFetch<JudgementResponse>("/judgement", {
    method: "POST",
    body: { wiki, revId, action },
  });
}

/**
 * Batch-fetch LiftWing scores for multiple revisions.
 * Limits concurrency to avoid flooding the API.
 */
export async function fetchLiftWingScoresBatch(
  wiki: string,
  revIds: number[],
  concurrency = 4,
): Promise<Map<number, LiftWingResponse>> {
  const results = new Map<number, LiftWingResponse>();
  const queue = [...revIds];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const revId = queue.shift()!;
      try {
        const score = await fetchLiftWingScore(wiki, revId);
        results.set(revId, score);
      } catch {
        // Skip failed fetches — badge will simply not appear
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}
