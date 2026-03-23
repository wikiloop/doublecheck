/**
 * Purge cron job — public API.
 *
 * Import from here for server integration:
 *
 *   import { startPurgeScheduler } from "./cron/index.js";
 *   startPurgeScheduler();
 */

export type { CollectionPurgeResult, PurgeReport } from "./types.js";
export { runPurge, PURGEABLE_COLLECTIONS, PROTECTED_COLLECTIONS } from "./purge.js";
export { formatPurgeMessage, notifySlack } from "./notify.js";
export { runPurgeOnce, startPurgeScheduler, stopPurgeScheduler } from "./scheduler.js";
