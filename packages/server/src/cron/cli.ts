/**
 * CLI runner for the purge job.
 *
 * Usage: tsx src/cron/cli.ts
 *
 * Connects to MongoDB, runs the purge once, prints results, and exits.
 */

import { connectDB } from "../db/connection.js";
import { runPurgeOnce } from "./scheduler.js";

async function main(): Promise<void> {
  console.log("[purge-cli] Connecting to MongoDB...");
  await connectDB();
  console.log("[purge-cli] Connected.");

  const report = await runPurgeOnce();

  // Print summary
  console.log("\n--- Purge Summary ---");
  console.log(`Status: ${report.success ? "SUCCESS" : "FAILED"}`);
  console.log(`Started:   ${report.startedAt}`);
  console.log(`Completed: ${report.completedAt}`);
  console.log(`Total deleted: ${report.totalDeleted}`);

  if (report.error) {
    console.error(`Error: ${report.error}`);
  }

  for (const r of report.results) {
    console.log(
      `  ${r.collection}: ${r.deletedCount} deleted, ${r.remainingCount} remaining (${r.durationMs}ms)`,
    );
  }

  process.exit(report.success ? 0 : 1);
}

main().catch((err) => {
  console.error("[purge-cli] Fatal error:", err);
  process.exit(1);
});
