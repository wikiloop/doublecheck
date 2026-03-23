/**
 * Phase 0 Validation Script
 *
 * Validates all Phase 0 prerequisites for the WikiLoop DoubleCheck v5 stack.
 * Run via: pnpm run validate:phase0
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// Colors (ANSI escape codes)
// ---------------------------------------------------------------------------
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const PASS = `${GREEN}[✓]${RESET}`;
const FAIL = `${RED}[✗]${RESET}`;
const SKIP = `${YELLOW}[–]${RESET}`;
const MANUAL = `${YELLOW}[?]${RESET}`;

// ---------------------------------------------------------------------------
// Load .env file manually (no dotenv dependency)
// ---------------------------------------------------------------------------
function loadEnvFile(): void {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envPaths = [
    resolve(__dirname, "../../../.env"),
    resolve(__dirname, "../.env"),
  ];

  for (const envPath of envPaths) {
    try {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        // Don't overwrite existing env vars
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
      // .env file not found at this path — that's fine
    }
  }
}

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------
type CheckResult = { label: string; status: "pass" | "fail" | "skip" | "manual"; detail: string };
const results: CheckResult[] = [];

function record(label: string, status: CheckResult["status"], detail: string): void {
  results.push({ label, status, detail });
  const icon =
    status === "pass" ? PASS :
    status === "fail" ? FAIL :
    status === "skip" ? SKIP :
    MANUAL;
  // Pad label with dots to column 55
  const padded = label + " " + ".".repeat(Math.max(2, 55 - label.length)) + " ";
  console.log(`  ${icon} ${padded}${detail}`);
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

let sshOk = false;

async function checkSSH(): Promise<void> {
  try {
    execSync(
      "ssh -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no wikiloop-doublecheck.toolforge.org echo ok",
      { stdio: "pipe", timeout: 10_000 },
    );
    sshOk = true;
    record("SSH to wikiloop-doublecheck.toolforge.org", "pass", "connected");
  } catch {
    record("SSH to wikiloop-doublecheck.toolforge.org", "fail", "connection failed");
  }
}

async function checkToolsDB(): Promise<void> {
  if (!sshOk) {
    record("ToolsDB query (SELECT 1)", "skip", "SSH not available");
    return;
  }
  try {
    execSync(
      'ssh -o ConnectTimeout=5 -o BatchMode=yes wikiloop-doublecheck.toolforge.org "sql tools -e \\"SELECT 1;\\""',
      { stdio: "pipe", timeout: 15_000 },
    );
    record("ToolsDB query (SELECT 1)", "pass", "ok");
  } catch {
    record("ToolsDB query (SELECT 1)", "fail", "query failed");
  }
}

async function checkReplica(): Promise<void> {
  if (!sshOk) {
    record("Replica query (enwiki revision)", "skip", "SSH not available");
    return;
  }
  try {
    const output = execSync(
      'ssh -o ConnectTimeout=5 -o BatchMode=yes wikiloop-doublecheck.toolforge.org "sql enwiki -e \\"SELECT rev_id FROM revision LIMIT 1;\\""',
      { stdio: "pipe", timeout: 15_000 },
    ).toString().trim();
    const match = output.match(/(\d+)/);
    const revId = match ? match[1] : "ok";
    record("Replica query (enwiki revision)", "pass", `rev_id=${revId}`);
  } catch {
    record("Replica query (enwiki revision)", "fail", "query failed");
  }
}

async function checkHTTPS(): Promise<void> {
  try {
    const resp = await fetch("https://wikiloop-doublecheck.toolforge.org/", {
      signal: AbortSignal.timeout(10_000),
    });
    record("HTTPS endpoint reachable", "pass", `${resp.status} ${resp.statusText || "OK"}`);
  } catch {
    record("HTTPS endpoint reachable", "fail", "unreachable");
  }
}

async function checkOAuthClientId(): Promise<void> {
  if (process.env.OAUTH_CLIENT_ID) {
    record("OAuth client_id is set", "pass", "ok");
  } else {
    record("OAuth client_id is set", "fail", "OAUTH_CLIENT_ID not set");
  }
}

async function checkOAuthClientSecret(): Promise<void> {
  if (process.env.OAUTH_CLIENT_SECRET) {
    record("OAuth client_secret is set", "pass", "ok");
  } else {
    record("OAuth client_secret is set", "fail", "OAUTH_CLIENT_SECRET not set");
  }
}

async function checkTokenEndpoint(): Promise<void> {
  try {
    const resp = await fetch(
      "https://meta.wikimedia.org/w/rest.php/oauth2/access_token",
      { method: "HEAD", signal: AbortSignal.timeout(10_000) },
    );
    // Any response (even 4xx) means the endpoint is reachable
    record("Token exchange endpoint reachable", "pass", `${resp.status} ${resp.statusText || "OK"}`);
  } catch {
    record("Token exchange endpoint reachable", "fail", "unreachable");
  }
}

async function checkMongoURI(): Promise<void> {
  if (process.env.MONGO_URI) {
    record("MONGO_URI is set", "pass", "ok");
  } else {
    record("MONGO_URI is set", "fail", "MONGO_URI not set");
  }
}

async function checkMongoConnection(): Promise<boolean> {
  if (!process.env.MONGO_URI) {
    record("Connection to Atlas cluster", "skip", "MONGO_URI not set");
    return false;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 5_000,
    });
    record("Connection to Atlas cluster", "pass", "connected");
    return true;
  } catch (err: any) {
    const msg = err?.message ? err.message.slice(0, 60) : "connection failed";
    record("Connection to Atlas cluster", "fail", msg);
    return false;
  }
}

async function checkMongoRead(connected: boolean): Promise<void> {
  if (!connected) {
    record("Read access (interactions count)", "skip", "not connected");
    return;
  }
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error("no db handle");
    const count = await db.collection("interactions").countDocuments();
    record("Read access (interactions count)", "pass", `${count.toLocaleString()} documents`);
  } catch (err: any) {
    const msg = err?.message ? err.message.slice(0, 60) : "query failed";
    record("Read access (interactions count)", "fail", msg);
  }
}

function checkCWSManual(): void {
  record("Developer account registered", "manual", "manual check");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  loadEnvFile();

  console.log();
  console.log(`${BOLD}Phase 0 Validation${RESET}`);
  console.log("==================");

  // --- Toolforge Access ---
  console.log();
  console.log(`${BOLD}Toolforge Access${RESET}`);
  await checkSSH();
  await checkToolsDB();
  await checkReplica();
  await checkHTTPS();

  // --- MediaWiki OAuth 2.0 ---
  console.log();
  console.log(`${BOLD}MediaWiki OAuth 2.0${RESET}`);
  await checkOAuthClientId();
  await checkOAuthClientSecret();
  await checkTokenEndpoint();

  // --- MongoDB Atlas ---
  console.log();
  console.log(`${BOLD}MongoDB Atlas${RESET}`);
  await checkMongoURI();
  const mongoConnected = await checkMongoConnection();
  await checkMongoRead(mongoConnected);

  // Disconnect mongoose if connected
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }

  // --- Chrome Web Store ---
  console.log();
  console.log(`${BOLD}Chrome Web Store${RESET}`);
  checkCWSManual();

  // --- Summary ---
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const manual = results.filter((r) => r.status === "manual").length;
  const total = results.length;

  console.log();
  console.log("==================");

  const allCriticalPassed = failed === 0;
  if (allCriticalPassed) {
    console.log(
      `${GREEN}Result: ${passed}/${total} passed, ${skipped} skipped, ${manual} manual${RESET}`,
    );
    console.log(`${GREEN}Phase 0 is COMPLETE — ready for Phase 1.${RESET}`);
  } else {
    console.log(
      `${RED}Result: ${passed}/${total} passed, ${failed} failed, ${skipped} skipped, ${manual} manual${RESET}`,
    );
    console.log(`${RED}Phase 0 has failures — resolve them before proceeding.${RESET}`);
  }

  console.log();
  process.exit(allCriticalPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(`${RED}Unexpected error:${RESET}`, err);
  process.exit(1);
});
