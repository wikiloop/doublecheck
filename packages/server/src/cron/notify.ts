/**
 * Slack notification for purge reports.
 *
 * Sends a formatted message to the configured Slack webhook.
 * If SLACK_WEBHOOK_URL is not set, logs locally and returns.
 */

import type { PurgeReport } from "./types.js";

/**
 * Format a number with comma separators (e.g. 1234 -> "1,234").
 */
function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Build a human-readable Slack message from a PurgeReport.
 */
export function formatPurgeMessage(report: PurgeReport): string {
  const lines: string[] = [];

  lines.push("🧹 DoubleCheck Purge Report");
  lines.push(`Started: ${report.startedAt}`);
  lines.push("");

  if (!report.success) {
    lines.push(`❌ Purge FAILED: ${report.error ?? "unknown error"}`);
    return lines.join("\n");
  }

  for (const r of report.results) {
    lines.push(
      `${r.collection}: ${formatNumber(r.deletedCount)} deleted (${formatNumber(r.remainingCount)} remaining)`,
    );
  }

  lines.push("");

  const totalDurationMs = report.results.reduce((sum, r) => sum + r.durationMs, 0);
  const totalDurationSec = (totalDurationMs / 1000).toFixed(1);

  lines.push(`Total: ${formatNumber(report.totalDeleted)} documents deleted`);
  lines.push(`Duration: ${totalDurationSec}s`);

  return lines.join("\n");
}

/**
 * Send the purge report to Slack via webhook.
 * If SLACK_WEBHOOK_URL is not configured, logs the report and returns.
 */
export async function notifySlack(report: PurgeReport): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log("[purge] SLACK_WEBHOOK_URL not set — skipping Slack notification");
    console.log("[purge] Report:\n" + formatPurgeMessage(report));
    return;
  }

  const text = formatPurgeMessage(report);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      console.error(
        `[purge] Slack webhook returned ${response.status}: ${await response.text()}`,
      );
    }
  } catch (err) {
    console.error("[purge] Failed to send Slack notification:", err);
    // Do not throw — notification failure should not break the purge flow
  }
}
