import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { eventBus } from "../lib/eventBus.js";

const events = new Hono();

/** GET /api/events — SSE endpoint */
events.get("/", (c) => {
  return streamSSE(c, async (stream) => {
    // TODO: use Last-Event-ID for replay support
    void c.req.header("Last-Event-ID");

    // Heartbeat interval
    const heartbeat = setInterval(async () => {
      try {
        await stream.writeSSE({
          event: "ping",
          data: JSON.stringify({ timestamp: new Date().toISOString() }),
        });
      } catch {
        clearInterval(heartbeat);
      }
    }, 15_000);

    // Listen for judgement events
    const onEvent = async (event: { type: string; data: unknown; id: number }) => {
      try {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event.data),
          id: String(event.id),
        });
      } catch {
        // Stream closed
      }
    };

    eventBus.on("sse", onEvent);

    // Clean up on stream close
    stream.onAbort(() => {
      clearInterval(heartbeat);
      eventBus.off("sse", onEvent);
    });

    // Keep the stream alive — wait for abort
    await new Promise<void>((resolve) => {
      stream.onAbort(() => resolve());
    });
  });
});

export { events };
