#!/usr/bin/env node
/**
 * cws-publish.mjs — Publish Chrome extension to Chrome Web Store via service account
 *
 * Usage:
 *   node scripts/cws-publish.mjs [--upload-only] [--zip path/to/zip]
 *
 * Requires:
 *   - Service account key at .credentials/cws-publisher.json or .creds/cws-key.json
 *   - Extension ID (set below or via CWS_EXTENSION_ID env var)
 */

import { GoogleAuth } from 'google-auth-library';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Configuration ──────────────────────────────────────────────────────────
const EXTENSION_ID = process.env.CWS_EXTENSION_ID || 'efpakmfbfkbeoejabnbamnmpbmncippn';
const CWS_API = 'https://www.googleapis.com/upload/chromewebstore/v1.1/items';
const CWS_PUBLISH_API = 'https://www.googleapis.com/chromewebstore/v1.1/items';

// ─── Parse args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const uploadOnly = args.includes('--upload-only');
let zipPath = null;

const zipIdx = args.indexOf('--zip');
if (zipIdx !== -1 && args[zipIdx + 1]) {
  zipPath = resolve(args[zipIdx + 1]);
}

// ─── Find zip ───────────────────────────────────────────────────────────────
if (!zipPath) {
  // Find latest extension zip
  const version = JSON.parse(readFileSync(resolve(ROOT, 'packages/extension/package.json'), 'utf8')).version;
  zipPath = resolve(ROOT, `dist/doublecheck-extension-${version}.zip`);
}

if (!existsSync(zipPath)) {
  console.error(`❌ Zip not found: ${zipPath}`);
  console.error('   Run "pnpm --filter @doublecheck/extension build" first.');
  process.exit(1);
}

console.log(`📦 Zip: ${zipPath}`);
console.log(`🆔 Extension ID: ${EXTENSION_ID}`);

// ─── Read version from manifest inside the zip ─────────────────────────────
let localVersion;
try {
  const manifestJson = execSync(`unzip -p "${zipPath}" manifest.json`, { encoding: 'utf8' });
  const manifest = JSON.parse(manifestJson);
  localVersion = manifest.version;
  console.log(`📋 Version in zip: ${localVersion}`);
} catch {
  console.error('❌ Could not read manifest.json from zip');
  process.exit(1);
}

// ─── Authenticate via service account ───────────────────────────────────────
const keyPaths = [
  resolve(ROOT, '.credentials/cws-publisher.json'),
  resolve(ROOT, '.creds/cws-key.json'),
];
const keyFile = keyPaths.find(p => existsSync(p));

if (!keyFile) {
  console.error('❌ No service account key found at:');
  keyPaths.forEach(p => console.error(`   ${p}`));
  process.exit(1);
}

console.log(`🔑 Using key: ${keyFile.replace(ROOT + '/', '')}`);

const auth = new GoogleAuth({
  keyFile,
  scopes: ['https://www.googleapis.com/auth/chromewebstore'],
});

const client = await auth.getClient();
const { token } = await client.getAccessToken();

if (!token) {
  console.error('❌ Failed to get access token');
  process.exit(1);
}
console.log('✅ Access token obtained');

// ─── Check published version ────────────────────────────────────────────────
const infoRes = await fetch(`${CWS_PUBLISH_API}/${EXTENSION_ID}?projection=DRAFT`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'x-goog-api-version': '2',
  },
});

if (infoRes.ok) {
  const info = await infoRes.json();
  const publishedVersion = info.crxVersion;
  const draftStatus = info.status;
  console.log(`🌐 Published version on CWS: ${publishedVersion || '(none)'}`);

  if (publishedVersion && publishedVersion === localVersion) {
    console.error(`❌ Version ${localVersion} is already published. Bump the version first.`);
    process.exit(1);
  }
  if (publishedVersion) {
    console.log(`📈 Upgrading: ${publishedVersion} → ${localVersion}`);
  }

  // If a prior submission is pending review, uploading a new zip will supersede it.
  // The CWS API automatically cancels the pending review when a new upload is received.
  if (draftStatus === 'PENDING_REVIEW' || draftStatus === 'IN_REVIEW') {
    console.log(`⏳ Prior submission is ${draftStatus} — the new upload will supersede it.`);
  }
}

// ─── Upload ─────────────────────────────────────────────────────────────────
console.log('\n📤 Uploading to Chrome Web Store...');

const zipData = readFileSync(zipPath);

const uploadRes = await fetch(`${CWS_API}/${EXTENSION_ID}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'x-goog-api-version': '2',
  },
  body: zipData,
});

const uploadResult = await uploadRes.json();

if (uploadResult.uploadState === 'FAILURE') {
  console.error('❌ Upload failed:');
  console.error(JSON.stringify(uploadResult, null, 2));
  process.exit(1);
}

console.log(`✅ Upload status: ${uploadResult.uploadState}`);
if (uploadResult.itemError?.length) {
  uploadResult.itemError.forEach(e => console.warn(`   ⚠️  ${e.error_detail}`));
}

if (uploadOnly) {
  console.log('\n📋 Upload only mode — skipping publish.');
  process.exit(0);
}

// ─── Publish ────────────────────────────────────────────────────────────────
console.log('\n🚀 Publishing...');

const publishRes = await fetch(`${CWS_PUBLISH_API}/${EXTENSION_ID}/publish`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'x-goog-api-version': '2',
    'Content-Length': '0',
  },
});

const publishResult = await publishRes.json();

if (publishResult.status?.includes('OK') || publishResult.status?.includes('PUBLISHED_WITH_FRICTION_WARNING')) {
  console.log(`✅ Published! Status: ${publishResult.status.join(', ')}`);
  console.log(`🔗 https://chromewebstore.google.com/detail/${EXTENSION_ID}`);
} else {
  console.error('❌ Publish failed:');
  console.error(JSON.stringify(publishResult, null, 2));
  process.exit(1);
}
