import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock node-cron before importing scheduler
vi.mock("node-cron", () => {
  const mockTask = {
    stop: vi.fn(),
  };
  return {
    default: {
      schedule: vi.fn(() => mockTask),
    },
  };
});

// Mock the purge and notify modules
vi.mock("../../cron/purge.js", () => ({
  runPurge: vi.fn(async () => ({
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    results: [],
    totalDeleted: 0,
    success: true,
  })),
}));

vi.mock("../../cron/notify.js", () => ({
  notifySlack: vi.fn(async () => {}),
}));

describe("scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Stop scheduler between tests to reset state
    const { stopPurgeScheduler } = await import("../../cron/scheduler.js");
    stopPurgeScheduler();
  });

  it("startPurgeScheduler creates a cron job", async () => {
    const cron = await import("node-cron");
    const { startPurgeScheduler } = await import("../../cron/scheduler.js");

    startPurgeScheduler();

    expect(cron.default.schedule).toHaveBeenCalledWith(
      "0 3 * * *",
      expect.any(Function),
      expect.objectContaining({ timezone: "UTC" }),
    );
  });

  it("startPurgeScheduler accepts custom schedule", async () => {
    const cron = await import("node-cron");
    const { startPurgeScheduler } = await import("../../cron/scheduler.js");

    startPurgeScheduler("0 */6 * * *");

    expect(cron.default.schedule).toHaveBeenCalledWith(
      "0 */6 * * *",
      expect.any(Function),
      expect.any(Object),
    );
  });

  it("stopPurgeScheduler stops the cron task", async () => {
    const cron = await import("node-cron");
    const { startPurgeScheduler, stopPurgeScheduler } = await import(
      "../../cron/scheduler.js"
    );

    startPurgeScheduler();
    const mockTask = (cron.default.schedule as ReturnType<typeof vi.fn>).mock.results[0]
      ?.value;

    stopPurgeScheduler();

    expect(mockTask.stop).toHaveBeenCalled();
  });

  it("runPurgeOnce executes purge and notifies", async () => {
    const { runPurge } = await import("../../cron/purge.js");
    const { notifySlack } = await import("../../cron/notify.js");
    const { runPurgeOnce } = await import("../../cron/scheduler.js");

    const report = await runPurgeOnce();

    expect(runPurge).toHaveBeenCalled();
    expect(notifySlack).toHaveBeenCalledWith(report);
    expect(report.success).toBe(true);
  });
});
