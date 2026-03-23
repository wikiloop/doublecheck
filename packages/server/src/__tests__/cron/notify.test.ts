import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PurgeReport } from "../../cron/types.js";

describe("notify", () => {
  const sampleReport: PurgeReport = {
    startedAt: "2026-03-23T03:00:00.000Z",
    completedAt: "2026-03-23T03:00:02.300Z",
    results: [
      { collection: "feedrevisions", deletedCount: 1234, remainingCount: 0, durationMs: 800 },
      { collection: "feedpages", deletedCount: 56, remainingCount: 0, durationMs: 200 },
      { collection: "sockets", deletedCount: 10, remainingCount: 0, durationMs: 100 },
      { collection: "sessions", deletedCount: 89, remainingCount: 12, durationMs: 500 },
      { collection: "liveclients", deletedCount: 3, remainingCount: 0, durationMs: 50 },
      { collection: "decisionlogs", deletedCount: 64, remainingCount: 0, durationMs: 350 },
    ],
    totalDeleted: 1456,
    success: true,
  };

  const failedReport: PurgeReport = {
    startedAt: "2026-03-23T03:00:00.000Z",
    completedAt: "2026-03-23T03:00:00.100Z",
    results: [],
    totalDeleted: 0,
    success: false,
    error: "Mongoose is not connected",
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.SLACK_WEBHOOK_URL;
  });

  it("formats a successful purge message", async () => {
    const { formatPurgeMessage } = await import("../../cron/notify.js");
    const msg = formatPurgeMessage(sampleReport);

    expect(msg).toContain("Purge Report");
    expect(msg).toContain("feedrevisions");
    expect(msg).toContain("1,234 deleted");
    expect(msg).toContain("sessions");
    expect(msg).toContain("12 remaining");
    expect(msg).toContain("1,456 documents deleted");
  });

  it("formats a failed purge message", async () => {
    const { formatPurgeMessage } = await import("../../cron/notify.js");
    const msg = formatPurgeMessage(failedReport);

    expect(msg).toContain("FAILED");
    expect(msg).toContain("not connected");
  });

  it("skips Slack notification when webhook URL is not set", async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { notifySlack } = await import("../../cron/notify.js");
    await notifySlack(sampleReport);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("SLACK_WEBHOOK_URL not set"),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends Slack notification when webhook URL is set", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => "ok",
    });

    const { notifySlack } = await import("../../cron/notify.js");
    await notifySlack(sampleReport);

    expect(fetch).toHaveBeenCalledWith(
      "https://hooks.slack.com/test",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("handles webhook failure gracefully", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { notifySlack } = await import("../../cron/notify.js");

    // Should not throw
    await expect(notifySlack(sampleReport)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to send Slack"),
      expect.any(Error),
    );
  });

  it("handles non-OK webhook response gracefully", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { notifySlack } = await import("../../cron/notify.js");
    await notifySlack(sampleReport);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Slack webhook returned 500"),
    );
  });
});
