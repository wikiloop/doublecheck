/**
 * Types for the purge cron job.
 */

export interface CollectionPurgeResult {
  collection: string;
  deletedCount: number;
  remainingCount: number;
  durationMs: number;
}

export interface PurgeReport {
  startedAt: string;
  completedAt: string;
  results: CollectionPurgeResult[];
  totalDeleted: number;
  success: boolean;
  error?: string;
}
