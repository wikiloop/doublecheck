import { ref, onUnmounted } from "vue";
import type { SSEEvent, Judgement } from "@doublecheck/core";

export function useSSE() {
  const events = ref<SSEEvent[]>([]);
  const connected = ref(false);

  let eventSource: EventSource | null = null;
  let retryDelay = 1000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let lastEventId: string | undefined;
  let pollingTimer: ReturnType<typeof setInterval> | null = null;
  let sseFailCount = 0;

  function connect() {
    cleanup();

    const url = lastEventId
      ? `/api/events?lastEventId=${encodeURIComponent(lastEventId)}`
      : "/api/events";

    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      connected.value = true;
      retryDelay = 1000;
      sseFailCount = 0;
      stopPolling();
    };

    eventSource.onmessage = (event) => {
      if (event.lastEventId) {
        lastEventId = event.lastEventId;
      }
      try {
        const parsed: SSEEvent = JSON.parse(event.data);
        events.value = [...events.value.slice(-99), parsed];
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      connected.value = false;
      eventSource?.close();
      eventSource = null;
      sseFailCount++;

      if (sseFailCount >= 3) {
        startPolling();
        return;
      }

      retryDelay = Math.min(retryDelay * 2, 30_000);
      retryTimer = setTimeout(connect, retryDelay);
    };
  }

  function startPolling() {
    if (pollingTimer) return;
    pollingTimer = setInterval(async () => {
      try {
        const res = await fetch("/api/judgements");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.judgements)) {
            for (const j of data.judgements as Judgement[]) {
              const evt: SSEEvent = {
                type: "judgement",
                data: {
                  revisionWiki: j.revisionWiki,
                  revisionId: j.revisionId,
                  action: j.action,
                  userId: j.userId,
                  timestamp: j.timestamp,
                },
              };
              events.value = [...events.value.slice(-99), evt];
            }
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 30_000);
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }

  function cleanup() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    stopPolling();
  }

  onUnmounted(cleanup);

  return {
    events,
    connected,
    connect,
    cleanup,
  };
}
