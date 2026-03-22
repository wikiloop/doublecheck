// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { CronJob } from 'cron';
import { cronLogger } from '@/server/common';
import axios from 'axios';

const mongoose = require('mongoose');

interface PurgeRule {
  collection: string;
  maxAgeDays: number;
  maxDocs: number;
  dateField: string; // field used for age-based purge; '_id' uses ObjectId timestamp
  sortField?: string; // field to sort by when enforcing maxDocs (defaults to dateField)
}

// Collections ordered from most important (core) to least important (ephemeral).
// Core collections are not purged but included in the report for visibility.
const CORE_COLLECTIONS = ['Interaction', 'RevisionInfo', 'WikiActions', 'DecisionLog', 'FeedPage', 'FeatureList', 'UserPreferences', 'NoticeMessage'];

const PURGE_RULES: PurgeRule[] = [
  {
    collection: 'FeedRevision',
    maxAgeDays: 30,
    maxDocs: 100000,
    dateField: 'createdAt',
  },
  {
    collection: 'WatchCollection_WIKITRUST',
    maxAgeDays: 30,
    maxDocs: 100000,
    dateField: '_id',
  },
  {
    collection: 'WatchCollection_ORES',
    maxAgeDays: 30,
    maxDocs: 100000,
    dateField: '_id',
  },
  {
    collection: 'WatchCollection_LASTBAD',
    maxAgeDays: 30,
    maxDocs: 50000,
    dateField: '_id',
  },
  {
    collection: 'Sessions',
    maxAgeDays: 7,
    maxDocs: 10000,
    dateField: '_id',
  },
  {
    collection: 'Sockets',
    maxAgeDays: 1,
    maxDocs: 10000,
    dateField: '_id',
  },
];

const DB_QUOTA_MB = 5120;

interface CollectionStats {
  name: string;
  docs: number;
  sizeMB: number;
}

async function getCollectionStats(db, collectionName: string): Promise<CollectionStats> {
  try {
    const stats = await db.collection(collectionName).stats();
    return {
      name: collectionName,
      docs: stats.count || 0,
      sizeMB: parseFloat(((stats.storageSize + stats.totalIndexSize) / 1024 / 1024).toFixed(2)),
    };
  } catch (err) {
    return { name: collectionName, docs: 0, sizeMB: 0 };
  }
}

async function getAllStats(db): Promise<{ collections: CollectionStats[]; totalMB: number }> {
  const names = (await db.listCollections().toArray()).map((c) => c.name);
  const collections: CollectionStats[] = [];
  let totalMB = 0;
  for (const name of names) {
    const s = await getCollectionStats(db, name);
    collections.push(s);
    totalMB += s.sizeMB;
  }
  // Sort: core first (by CORE_COLLECTIONS order), then purged, then others
  const coreOrder = (n: string) => {
    const ci = CORE_COLLECTIONS.indexOf(n);
    if (ci >= 0) { return ci; }
    const pi = PURGE_RULES.findIndex((r) => r.collection === n);
    if (pi >= 0) { return CORE_COLLECTIONS.length + pi; }
    return CORE_COLLECTIONS.length + PURGE_RULES.length;
  };
  collections.sort((a, b) => coreOrder(a.name) - coreOrder(b.name));
  return { collections, totalMB: parseFloat(totalMB.toFixed(2)) };
}

function buildAgeCutoffQuery(rule: PurgeRule): object {
  const cutoffDate = new Date(Date.now() - rule.maxAgeDays * 24 * 60 * 60 * 1000);
  if (rule.dateField === '_id') {
    const objectIdHex = Math.floor(cutoffDate.getTime() / 1000).toString(16) + '0000000000000000';
    return { _id: { $lt: new mongoose.Types.ObjectId(objectIdHex) } };
  }
  return { [rule.dateField]: { $lt: cutoffDate } };
}

async function enforceMaxDocs(db, rule: PurgeRule): Promise<number> {
  const col = db.collection(rule.collection);
  const count = await col.countDocuments();
  if (count <= rule.maxDocs) {
    return 0;
  }

  const sortField = rule.sortField || rule.dateField;
  const nthNewest = await col
    .find({}, { projection: { [sortField]: 1 } })
    .sort({ [sortField]: -1 })
    .skip(rule.maxDocs)
    .limit(1)
    .toArray();

  if (nthNewest.length === 0) {
    return 0;
  }

  const cutoffValue = nthNewest[0][sortField];
  const result = await col.deleteMany({ [sortField]: { $lte: cutoffValue } });
  return result.deletedCount;
}

// On Atlas shared tier, `compact` is not available. The only way to reclaim
// disk space after large deletes is to drop the collection and re-insert the
// remaining docs. We do this when >1000 docs were deleted from a collection.
async function reclaimSpace(db, collectionName: string): Promise<boolean> {
  try {
    const col = db.collection(collectionName);
    const docs = await col.find().toArray();
    if (docs.length === 0) {
      await col.drop();
      return true;
    }
    const tempName = collectionName + '_purge_temp';
    await db.collection(tempName).insertMany(docs);
    await col.drop();
    await db.collection(tempName).rename(collectionName);
    return true;
  } catch (err) {
    cronLogger.error(`Purge: ${collectionName} reclaim space failed:`, err.message || err);
    return false;
  }
}

function formatSlackReport(
  before: { collections: CollectionStats[]; totalMB: number },
  after: { collections: CollectionStats[]; totalMB: number },
  purgeResults: { collection: string; deletedAge: number; deletedCap: number; reclaimed: boolean }[],
): string {
  const date = new Date().toISOString().split('T')[0];
  const usagePct = ((after.totalMB / DB_QUOTA_MB) * 100).toFixed(1);

  let text = `:broom: *DB Purge Report — ${date}*\n`;
  text += `*Quota:* ${DB_QUOTA_MB} MB | *Before:* ${before.totalMB} MB | *After:* ${after.totalMB} MB | *Freed:* ${(before.totalMB - after.totalMB).toFixed(2)} MB | *Usage:* ${usagePct}%\n\n`;

  // Purge actions
  const actions = purgeResults.filter((r) => r.deletedAge > 0 || r.deletedCap > 0);
  if (actions.length > 0) {
    text += '*Purge actions:*\n';
    for (const r of actions) {
      const parts = [];
      if (r.deletedAge > 0) { parts.push(`${r.deletedAge} stale`); }
      if (r.deletedCap > 0) { parts.push(`${r.deletedCap} over cap`); }
      if (r.reclaimed) { parts.push('space reclaimed'); }
      text += `• \`${r.collection}\`: deleted ${parts.join(', ')}\n`;
    }
    text += '\n';
  } else {
    text += '_No purge needed today._\n\n';
  }

  // Collection table — after state
  text += '*Collections (most → least important):*\n```\n';
  text += 'Collection                        Docs      Size MB\n';
  text += '──────────────────────────────────────────────────────\n';
  for (const s of after.collections) {
    const label = CORE_COLLECTIONS.includes(s.name) ? `${s.name} ★` : s.name;
    text += `${label.padEnd(34)}${String(s.docs).padStart(8)}   ${String(s.sizeMB).padStart(8)}\n`;
  }
  text += '```';

  return text;
}

async function sendSlackReport(text: string) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    cronLogger.warn('Purge: SLACK_WEBHOOK_URL not set, skipping Slack report');
    return;
  }
  try {
    await axios.post(webhookUrl, { text });
    cronLogger.info('Purge: Slack report sent');
  } catch (err) {
    cronLogger.error('Purge: Slack report failed:', err.message || err);
  }
}

export async function purgeCollections() {
  const db = mongoose.connection.db;
  const existingCollections = (await db.listCollections().toArray()).map((c) => c.name);

  // Snapshot before
  const before = await getAllStats(db);

  const purgeResults = [];

  for (const rule of PURGE_RULES) {
    if (!existingCollections.includes(rule.collection)) {
      cronLogger.info(`Purge: skipping ${rule.collection} (does not exist)`);
      purgeResults.push({ collection: rule.collection, deletedAge: 0, deletedCap: 0, reclaimed: false });
      continue;
    }

    try {
      // Step 1: age-based purge
      const ageQuery = buildAgeCutoffQuery(rule);
      const ageResult = await db.collection(rule.collection).deleteMany(ageQuery);
      if (ageResult.deletedCount > 0) {
        cronLogger.info(`Purge: ${rule.collection} deleted ${ageResult.deletedCount} docs older than ${rule.maxAgeDays} days`);
      }

      // Step 2: enforce max doc count (safety cap)
      const capDeleted = await enforceMaxDocs(db, rule);
      if (capDeleted > 0) {
        cronLogger.info(`Purge: ${rule.collection} deleted ${capDeleted} docs to enforce cap of ${rule.maxDocs}`);
      }

      // Step 3: reclaim disk space if we deleted a significant number of docs
      const totalDeleted = ageResult.deletedCount + capDeleted;
      let reclaimed = false;
      if (totalDeleted > 1000) {
        cronLogger.info(`Purge: ${rule.collection} reclaiming space after ${totalDeleted} deletes...`);
        reclaimed = await reclaimSpace(db, rule.collection);
      }

      if (totalDeleted === 0) {
        cronLogger.info(`Purge: ${rule.collection} — nothing to purge`);
      }

      purgeResults.push({ collection: rule.collection, deletedAge: ageResult.deletedCount, deletedCap: capDeleted, reclaimed });
    } catch (err) {
      cronLogger.error(`Purge: ${rule.collection} failed:`, err.message || err);
      purgeResults.push({ collection: rule.collection, deletedAge: 0, deletedCap: 0, reclaimed: false });
    }
  }

  // Snapshot after
  const after = await getAllStats(db);

  // Send Slack report
  const report = formatSlackReport(before, after, purgeResults);
  cronLogger.info(`Purge report:\n${report}`);
  await sendSlackReport(report);
}

export class PurgeCollectionsCronJob {
  public cronJob: CronJob;

  constructor(cronTime: string) {
    cronLogger.info(`Setting up PurgeCollectionsCronJob for cronTime=${cronTime}`);
    this.cronJob = new CronJob(
      cronTime,
      async () => {
        cronLogger.info(`Running purgeCollections at ${new Date()}`);
        await purgeCollections();
        cronLogger.info('Done running purgeCollections');
      },
      null,
      false,
      process.env.CRON_TIMEZONE || 'America/Los_Angeles',
    );
  }

  public startCronJob() {
    cronLogger.info('Starting purge collections cronjob');
    this.cronJob.start();
  }
}
