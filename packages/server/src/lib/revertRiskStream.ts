import type { ScoredRevision } from "@doublecheck/core";

const STREAM_URL =
  "https://stream.wikimedia.org/v2/stream/mediawiki.page_revert_risk_prediction_change.v1";

const BUFFER_SIZE = parseInt(process.env.REVERT_RISK_BUFFER_SIZE ?? "500", 10);

/** Per-wiki ring buffer of scored revisions (newest first). */
const buffers = new Map<string, ScoredRevision[]>();

let eventSource: EventSource | null = null;
let retryDelay = 1000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Parse a Wikimedia revert-risk prediction event into a ScoredRevision.
 * Returns null if the event cannot be parsed.
 */
function parseEvent(data: unknown): ScoredRevision | null {
  if (!data || typeof data !== "object") return null;

  const d = data as Record<string, unknown>;
  const wikiId = d.wiki_id as string | undefined;
  if (!wikiId) return null;

  const rev = d.revision as Record<string, unknown> | undefined;
  const page = d.page as Record<string, unknown> | undefined;
  const performer = d.performer as Record<string, unknown> | undefined;
  const prediction = d.predicted_classification as Record<string, unknown> | undefined;

  if (!rev || !page || !prediction) return null;

  const probabilities = prediction.probabilities as Record<string, number> | undefined;
  const revertRiskProb = probabilities?.["true"] ?? 0;

  const revId = rev.rev_id as number | undefined;
  if (!revId) return null;

  return {
    wiki: wikiId,
    revId,
    parentRevId: (rev.rev_parent_id as number) ?? 0,
    title: (page.page_title as string)?.replace(/_/g, " ") ?? "",
    timestamp: (rev.rev_dt as string) ?? new Date().toISOString(),
    user: (performer?.user_text as string) ?? "",
    comment: (rev.comment as string) ?? "",
    pageId: (page.page_id as number) ?? 0,
    revertRisk: {
      revertRisk: revertRiskProb,
      modelName: prediction.model_name as string | undefined,
      modelVersion: prediction.model_version as string | undefined,
    },
    rankScore: revertRiskProb,
  };
}

function addToBuffer(scored: ScoredRevision): void {
  let buf = buffers.get(scored.wiki);
  if (!buf) {
    buf = [];
    buffers.set(scored.wiki, buf);
  }
  // Prepend (newest first)
  buf.unshift(scored);
  // Trim to max size
  if (buf.length > BUFFER_SIZE) {
    buf.length = BUFFER_SIZE;
  }
}

/** Start consuming the Wikimedia revert-risk prediction stream. */
export function startRevertRiskStream(): void {
  if (eventSource) return; // already running

  console.log("[RevertRiskStream] Connecting to Wikimedia EventStreams...");

  eventSource = new EventSource(STREAM_URL);

  eventSource.onopen = () => {
    console.log("[RevertRiskStream] Connected");
    retryDelay = 1000;
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const scored = parseEvent(data);
      if (scored) {
        addToBuffer(scored);
      }
    } catch {
      // ignore parse errors
    }
  };

  eventSource.onerror = () => {
    console.warn("[RevertRiskStream] Connection lost, will retry...");
    eventSource?.close();
    eventSource = null;
    retryDelay = Math.min(retryDelay * 2, 60_000);
    retryTimer = setTimeout(startRevertRiskStream, retryDelay);
  };
}

/** Stop the stream (for testing / shutdown). */
export function stopRevertRiskStream(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

/**
 * Get buffered scored revisions for a wiki, sorted by rankScore descending.
 * @param wiki  e.g. "enwiki"
 * @param limit max items to return
 * @param offset skip first N items (for pagination)
 */
export function getBufferedRevisions(
  wiki: string,
  limit: number,
  offset = 0,
): { items: ScoredRevision[]; total: number } {
  const buf = buffers.get(wiki) ?? [];
  // Sort descending by rankScore (buffer is chronological, we need risk-ranked)
  const sorted = [...buf].sort((a, b) => b.rankScore - a.rankScore);
  return {
    items: sorted.slice(offset, offset + limit),
    total: sorted.length,
  };
}

/** Get total buffer size for a wiki (for diagnostics). */
export function getBufferSize(wiki: string): number {
  return buffers.get(wiki)?.length ?? 0;
}

/** Clear all buffers — for testing. */
export function _clearBuffers(): void {
  buffers.clear();
}
