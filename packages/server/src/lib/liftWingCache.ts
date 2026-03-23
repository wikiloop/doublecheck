import type { LiftWingScore } from "@doublecheck/core";

interface CacheEntry {
  score: LiftWingScore;
  expiresAt: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map<string, CacheEntry>();

function cacheKey(wiki: string, revId: number): string {
  return `${wiki}:${revId}`;
}

export function getCachedScore(
  wiki: string,
  revId: number,
): LiftWingScore | null {
  const entry = cache.get(cacheKey(wiki, revId));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey(wiki, revId));
    return null;
  }
  return entry.score;
}

export function setCachedScore(
  wiki: string,
  revId: number,
  score: LiftWingScore,
): void {
  cache.set(cacheKey(wiki, revId), {
    score,
    expiresAt: Date.now() + TTL_MS,
  });
}

/** Fetch Lift Wing scores from the Wikimedia API */
export async function fetchLiftWingScore(
  wiki: string,
  revId: number,
): Promise<LiftWingScore> {
  const cached = getCachedScore(wiki, revId);
  if (cached) return cached;

  const baseUrl =
    "https://api.wikimedia.org/service/lw/inference/v1/models";

  const [damagingRes, goodfaithRes] = await Promise.all([
    fetch(`${baseUrl}/${wiki}-damaging:predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rev_id: revId }),
    }),
    fetch(`${baseUrl}/${wiki}-goodfaith:predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rev_id: revId }),
    }),
  ]);

  if (!damagingRes.ok || !goodfaithRes.ok) {
    throw new Error(
      `Lift Wing API error: damaging=${damagingRes.status}, goodfaith=${goodfaithRes.status}`,
    );
  }

  const damagingData = await damagingRes.json();
  const goodfaithData = await goodfaithRes.json();

  // Extract probability from Lift Wing response structure
  const damagingProb =
    damagingData?.[wiki]?.scores?.[String(revId)]?.damaging?.score
      ?.probability?.true ?? 0;
  const goodfaithProb =
    goodfaithData?.[wiki]?.scores?.[String(revId)]?.goodfaith?.score
      ?.probability?.true ?? 0;

  const score: LiftWingScore = {
    damaging: damagingProb,
    goodfaith: goodfaithProb,
    modelVersion: damagingData?.[wiki]?.models?.damaging?.version,
  };

  setCachedScore(wiki, revId, score);
  return score;
}

/** Clear cache — for testing */
export function _clearCache(): void {
  cache.clear();
}
