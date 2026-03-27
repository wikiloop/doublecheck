#!/usr/bin/env node
/**
 * Send WikiLoop DoubleCheck newsletter to all subscribers' talk pages.
 * Rate-limited to 1 edit per second using Bottleneck.
 *
 * Usage: node scripts/send-newsletter.mjs
 *
 * Requires WIKIPEDIA_BOT_PASSWORD in ~/.env (format: Username@BotName:Password)
 */

import Bottleneck from "bottleneck";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// --- Config ---
const NEWSLETTER_PAGE =
  "Wikipedia:WikiLoop_DoubleCheck/newsletter/2026-03";
const API_URL = "https://en.wikipedia.org/w/api.php";

// All unique subscribers (excluding Xinbenlv, the sender)
const SUBSCRIBERS = [
  "Fuzheado",
  "Jorm",
  "ElanHR",
  "Chaoyuel",
  "Eldarado",
  "Josve05a",
  "Llightex",
  "mewestin",
  "Sadads",
  "CAPTAIN MEDUSA",
  "LakesideMiners",
  "Carlojoseph14",
  "FULBERT",
  "aaPle",
  "Sj",
  "J ansari",
  "Joris Darlington Quarshie",
  "NEHAOUA",
  "A-NEUN",
  "Edi7*",
  "The4lines",
  "CAPTAIN RAJU",
  "Spy-cicle",
  "CatcherStorm",
  "Orphan Wiki",
  "JaneciaTaylor",
  "Alexcalamaro",
  "The Lord of Math",
  "pythoncoder",
  "Markworthen",
  "Bluerasberry",
  "Daask",
  "Macruzbar",
  "Jamesrichards12345",
  "Path slopu",
  "Tbiw",
  "Sohom data",
  "Md Maruf Parvez",
  "Henry20090",
  "Opalzukor",
  "TigerScientist",
  "Aseleste",
  "Parrotapocalypse",
  "Ezlev",
  "-Zai-",
  "FeralOink",
  "Ariconte",
  "MrAgentSochi",
  "Akim Ernest",
  "RFZYNSPY",
  "Actualcpscm",
  "SHenrichs",
  "Darkdeath-2",
  "Wakelamp",
  "EPEAviator",
  "Mr Reading Turtle",
  "Smuckola",
  "BenBrownBoy",
  "Msaskiw",
  "Bukky658",
  "EllenCT",
];

// Message to append to each talk page
const TALK_MESSAGE = `

== WikiLoop DoubleCheck v5 — Major update ==

Hi! You are receiving this message because you signed up as a contributor at [[Wikipedia:WikiLoop DoubleCheck]].

We are excited to announce '''WikiLoop DoubleCheck v5''' — a complete ground-up rewrite with direct revert, Twinkle-style patrol features, real-time ML scoring, and three ways to review (web app, userscript, Chrome extension).

Read the full announcement: '''[[${NEWSLETTER_PAGE}|WikiLoop DoubleCheck v5 newsletter]]'''

Thank you for supporting the project! — ~~~~
`;

// --- Load bot credentials from ~/.env ---
function loadBotCredentials() {
  const envPath = resolve(process.env.HOME, ".env");
  const envContent = readFileSync(envPath, "utf-8");
  const match = envContent.match(/^WIKIPEDIA_BOT_PASSWORD=(.+)$/m);
  if (!match) throw new Error("WIKIPEDIA_BOT_PASSWORD not found in ~/.env");
  const [botUser, ...passParts] = match[1].split(":");
  return { botUser, botPass: passParts.join(":") };
}

// --- MediaWiki API helpers ---
let cookies = {};

function parseCookies(setCookieHeaders) {
  if (!setCookieHeaders) return;
  const headers = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : [setCookieHeaders];
  for (const h of headers) {
    const [pair] = h.split(";");
    const [name, ...valParts] = pair.split("=");
    cookies[name.trim()] = valParts.join("=").trim();
  }
}

function cookieString() {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function apiGet(params) {
  const url = new URL(API_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("format", "json");
  const res = await fetch(url, { headers: { Cookie: cookieString() }, redirect: "manual" });
  parseCookies(res.headers.getSetCookie?.() || []);
  return res.json();
}

async function apiPost(params) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.set(k, v);
  body.set("format", "json");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieString(),
    },
    body: body.toString(),
    redirect: "manual",
  });
  parseCookies(res.headers.getSetCookie?.() || []);
  return res.json();
}

// --- Main ---
async function main() {
  const { botUser, botPass } = loadBotCredentials();
  console.log(`Logging in as ${botUser}...`);

  // Step 1: Get login token
  const tokenData = await apiGet({ action: "query", meta: "tokens", type: "login" });
  const loginToken = tokenData.query.tokens.logintoken;

  // Step 2: Login
  const loginResult = await apiPost({
    action: "login",
    lgname: botUser,
    lgpassword: botPass,
    lgtoken: loginToken,
  });

  if (loginResult.login.result !== "Success") {
    console.error("Login failed:", loginResult.login);
    process.exit(1);
  }
  console.log(`Logged in as ${loginResult.login.lgusername}`);

  // Step 3: Get CSRF token
  const csrfData = await apiGet({ action: "query", meta: "tokens" });
  const csrfToken = csrfData.query.tokens.csrftoken;

  // Step 4: Set up rate limiter — 1 edit per second
  const limiter = new Bottleneck({
    minTime: 1000, // 1 second between each job
    maxConcurrent: 1,
  });

  // Step 5: Send to each subscriber
  const results = { success: 0, failed: 0, errors: [] };

  const jobs = SUBSCRIBERS.map((user) =>
    limiter.schedule(async () => {
      const talkPage = `User talk:${user}`;
      try {
        const editResult = await apiPost({
          action: "edit",
          title: talkPage,
          appendtext: TALK_MESSAGE,
          summary: `[[${NEWSLETTER_PAGE}|WikiLoop DoubleCheck v5 newsletter]] delivery`,
          token: csrfToken,
          bot: "1",
        });

        if (editResult.edit?.result === "Success") {
          results.success++;
          console.log(
            `[${results.success + results.failed}/${SUBSCRIBERS.length}] ✓ ${talkPage}`
          );
        } else {
          results.failed++;
          const err = editResult.error?.info || JSON.stringify(editResult);
          results.errors.push({ user, error: err });
          console.log(
            `[${results.success + results.failed}/${SUBSCRIBERS.length}] ✗ ${talkPage}: ${err}`
          );
        }
      } catch (e) {
        results.failed++;
        results.errors.push({ user, error: e.message });
        console.log(
          `[${results.success + results.failed}/${SUBSCRIBERS.length}] ✗ ${talkPage}: ${e.message}`
        );
      }
    })
  );

  await Promise.all(jobs);

  console.log(`\nDone! ${results.success} delivered, ${results.failed} failed.`);
  if (results.errors.length > 0) {
    console.log("\nFailed deliveries:");
    for (const { user, error } of results.errors) {
      console.log(`  - ${user}: ${error}`);
    }
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
