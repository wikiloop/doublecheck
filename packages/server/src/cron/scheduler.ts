/**
 * Purge scheduler — runs the purge job on a daily schedule.
 *
 * Uses node-cron to schedule at 3:00 AM UTC by default.
 */

import cron from "node-cron";
import { runPurge } from "./purge.js";
import { notifySlack } from "./notify.js";
import type { PurgeReport } from "./types.js";

/**
 * Run the purge once and send a Slack notification.
 * Suitable for manual/CLI invocation or for the scheduler callback.
 */
export async function runPurgeOnce(): Promise<PurgeReport> {
  console.log("[purge] Starting purge run...");
  const report = await runPurge();

  if (report.success) {
    console.log(`[purge] Completed — ${report.totalDeleted} documents deleted`);
  } else {
    console.error(`[purge] Failed — ${report.error}`);
  }

  await notifySlack(report);
  return report;
}

let scheduledTask: cron.ScheduledTask | null = null;

/**
 * Start the purge scheduler. Default: daily at 03:00 UTC.
 *
 * @param schedule - cron expression (default: "0 3 * * *")
 */
export function startPurgeScheduler(schedule = "0 3 * * *"): void {
  if (scheduledTask) {
    console.warn("[purge] Scheduler already running — ignoring duplicate start");
    return;
  }

  console.log(`[purge] Scheduler started — schedule: "${schedule}"`);

  scheduledTask = cron.schedule(
    schedule,
    () => {
      runPurgeOnce().catch((err) => {
        console.error("[purge] Unhandled error in scheduled purge:", err);
      });
    },
    {
      timezone: "UTC",
    },
  );
}

/**
 * Stop the purge scheduler.
 */
export function stopPurgeScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[purge] Scheduler stopped");
  }
}
