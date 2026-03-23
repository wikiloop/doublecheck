# WikiLoop DoubleCheck — Stack Modernization Plan

## Motivation

1. **Architecture is outdated** — Original stack (2018) built on Nuxt 2, Vue 2, Node 12, all EOL or unmaintained
2. **Platform migration** — Move to Wikimedia Toolforge (Buildpacks) for native Wikimedia IP range, better community support, and free infrastructure (OAuth, replicas)
3. **Multi-surface delivery** — Serve three client forms from a single codebase:
   - Web SPA
   - Wikipedia UserScript (injected into Wikipedia pages)
   - Chrome Extension

---

## Current Stack → New Stack

| Layer | Current | New |
|-------|---------|-----|
| Frontend framework | Nuxt 2 / Vue 2 | **Vue 3** |
| UI library | Bootstrap-Vue | **Wikimedia Codex** (Vue 3 components + design tokens) |
| State management | Vuex | **Pinia** or Vue 3 composables |
| Build tool | Webpack (via Nuxt) | **Vite** |
| Backend framework | Express | **Hono** |
| Database | MongoDB (Atlas) | **MongoDB** (Atlas — keep existing) |
| ODM | Mongoose | **Mongoose** (or native driver) |
| Auth | OAuth 1.0a + Passport | **OAuth 2.0** (MediaWiki native) |
| Real-time | Socket.IO | **SSE** or short polling |
| ML scoring | ORES | **Lift Wing** (ORES replacement) |
| Testing | Jest | **Vitest** |
| Deployment | Heroku | **Toolforge Buildpacks** |
| Monorepo | — | **pnpm workspace** |

---

## Architecture Overview

```
                    ┌──────────────┐
                    │ Landing Page │  (Vercel — doublecheck.wikiloop.org)
                    └──────┬───────┘
                           │ "Start Reviewing"
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   ┌───────────┐    ┌────────────┐    ┌────────────┐
   │  Web SPA  │    │ UserScript │    │  Chrome    │
   │  (Vite)   │    │  (IIFE)   │    │ Extension  │
   └─────┬─────┘    └─────┬──────┘    └─────┬──────┘
         │                │                  │
         │     shared: @doublecheck/core     │
         │  (Vue 3 components + API client)  │
         └─────────────────┼─────────────────┘
                           │ REST API
                           ▼
                 ┌───────────────────┐
                 │  Toolforge API    │
                 │  (Node + Hono)    │  wikiloop-doublecheck.toolforge.org
                 │  OAuth 2.0       │
                 └────────┬─────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌──────────┐ ┌─────────┐ ┌──────────┐
        │ MongoDB  │ │MediaWiki│ │ Lift Wing│
        │ Atlas    │ │  API    │ │  ML API  │
        └──────────┘ └─────────┘ └──────────┘
```

---

## Monorepo Structure

```
packages/
  core/           # Shared Vue 3 components, composables, API client, types
  web/            # SPA entry — Vite, vue-router, landing page
  userscript/     # IIFE bundle entry — injects into Wikipedia DOM
  extension/      # Chrome Extension (Manifest V3) — CRXJS Vite plugin
  server/         # Hono API server + Mongoose + cron jobs
```

All three clients import from `@doublecheck/core`. Vite builds each with a different entry point and output format.

---

## Key Dependencies

| Layer | Dependency | Version | Notes |
|-------|-----------|---------|-------|
| Runtime | Node.js | 20 LTS | Toolforge Buildpacks |
| Monorepo | pnpm | 10.x | Workspace management |
| Language | TypeScript | 5.x | |
| Build | Vite | 6.x | All three clients |
| | CRXJS Vite Plugin | 2.x | Chrome Extension build |
| Frontend | vue | 3.x | Bundled in Web SPA + Extension; UserScript reuses Wikipedia's runtime when available |
| | @wikimedia/codex | 1.x | Wikimedia design system (Vue 3 components) |
| | @wikimedia/codex-design-tokens | 1.x | CSS variables for Web SPA + Extension |
| | vue-router | 4.x | Web SPA only |
| | vue-i18n | 9.x | Internationalization (all surfaces) |
| | diff2html | 3.x | Diff rendering (carried over) |
| Backend | hono | 4.x | API framework |
| | @hono/node-server | 1.x | Node adapter |
| Database | mongoose | 8.x | MongoDB ODM (keep existing) |
| | mongodb | 6.x | Native driver (used by Mongoose) |
| Testing | vitest | 3.x | Vite-native test runner |
| | @testing-library/vue | 8.x | Component testing |
| | @playwright/test | 1.x | E2E testing |
| Code quality | eslint | 9.x | Flat config |
| | prettier | 3.x | |

> **Note:** Version numbers are major-version guidance for initial development. We will update dependencies over time as new versions are released.

---

## Three-Client Strategy

### Shared (packages/core)

- Vue 3 components: RevisionCard, DiffBox, ActionPanel, JudgementPanel
- Composables: `useRevision()`, `useJudgement()`, `useLiftWing()`, `useWatchlist()`
- Typed API client (plain `fetch` wrapper)
- Type definitions: Revision, Judgement, Feed, etc.
- i18n: shared translation JSON files (`i18n/{locale}.json`) consumed via `vue-i18n`
- Watchlist prioritization: logged-in users see edits to their watched pages first in the review feed

### Web SPA (packages/web)

- Vite SPA build — **bundles its own Vue 3, Codex components, and Codex design tokens** (fully self-contained, no dependency on Wikipedia's runtime)
- **Dual-domain deployment:**
  - `https://wikiloop-doublecheck.toolforge.org` — Toolforge Buildpacks (Wikimedia-hosted, API + SPA)
  - `https://doublecheck.wikiloop.org` — Vercel (custom domain, landing page + SPA)
- Toolforge cannot serve custom domains, so `wikiloop.org` is hosted on Vercel pointing to the same Toolforge API
- **Landing page** (SEO, static HTML):
  - Feature overview and example component previews
  - Two call-to-action buttons: "Use it on toolforge.org (WMF hosted)" and "Use it on wikiloop.org"
  - Links to install UserScript and Chrome Extension
- Review pages: `<meta name="robots" content="noindex">`
- OAuth 2.0 login flow
- Routes: review, feed, leaderboard, history

### UserScript (packages/userscript)

- Vite IIFE build — the **only** client surface that attempts to reuse Wikipedia's Vue 3 and Codex runtime via `mw.loader.using(['vue', '@wikimedia/codex'])`
- This avoids shipping duplicate Vue 3 / Codex bytes on Wikimedia wikis where ResourceLoader already provides them (cached, zero extra download)
- **Fallback for wikis without ResourceLoader Vue 3** (e.g., some non-EN Wikipedias or third-party MediaWiki installs): the IIFE entry point is kept minimal (~2 KB) and runs a feature-detection step before loading the main bundle:
  1. Check if `mw.loader` can resolve `vue` and `@wikimedia/codex` — if yes, use ResourceLoader (zero extra bytes)
  2. If not, dynamically load a self-hosted Vue 3 + Codex bundle from `wikiloop-doublecheck.toolforge.org/vendor/`
  3. If the wiki's CSP blocks external scripts entirely, fail gracefully with a console warning and no DOM injection
- Two injection points:
  - **Diff pages** (`Special:Diff/*`): inject review panel below diff (ML score + vote buttons + community votes)
  - **RecentChanges / Watchlist**: inject colored risk badges per edit row
- User identity detection uses MediaWiki's standard JavaScript APIs:
  - `mw.user.isNamed()` — permanent registered account
  - `mw.user.isTemp()` — temporary account (auto-created for logged-out editors since 2024–2025, username pattern `~2026-12345-6`)
  - `mw.user.isAnon()` — truly anonymous (browsing only, no edits in session)
  - `mw.config.get('wgUserName')` provides the display name for both named and temp accounts (`null` for anonymous)
- **Server-side verification**: the API must not trust the client-supplied username alone. The server verifies identity by calling the MediaWiki API (`action=query&meta=userinfo`) using a session token or signed request forwarded from the userscript. Without OAuth, userscript judgements are attributed but treated as **unverified** unless the user completes the OAuth 2.0 linking flow via the Web SPA or Extension.
- Full functionality: review + revert (revert requires verified identity via OAuth)

**Option A — MediaWiki common.js** (add to `Special:MyPage/common.js`):

```js
// WikiLoop DoubleCheck — crowdsourced vandalism review
// Only runs on diff pages, RecentChanges, and Watchlist
if (/Special:(Diff|RecentChanges|Watchlist)|[?&]diff=/.test(location.href)) {
  mw.loader.using(['vue', '@wikimedia/codex', 'mediawiki.api']).then(function () {
    return mw.loader.getScript('https://wikiloop-doublecheck.toolforge.org/userscript.iife.js');
  });
}
```

**Option B — Tampermonkey/Greasemonkey**: install directly from `https://wikiloop-doublecheck.toolforge.org/doublecheck.user.js`

In both cases, `mw.loader.using` ensures Vue 3 and Codex are loaded before the IIFE executes. The IIFE accesses them via `require('vue')` and `require('@wikimedia/codex')` from the ResourceLoader registry.

### Chrome Extension (packages/extension)

- **Build**: Manifest V3 + CRXJS Vite plugin — **bundles its own Vue 3 and Codex** (extensions run in an isolated world and cannot access Wikipedia's ResourceLoader runtime)
- **Content script**: injects on Wikipedia diff pages, RecentChanges, and Watchlist (same injection points as UserScript)
  - Uses `@doublecheck/core` components for review panel and risk badges
  - Communicates with background service worker for API calls (avoids page CSP restrictions)
- **Popup**: quick access to leaderboard, recent activity, and settings
- **Auth**: OAuth 2.0 flow via `chrome.identity.launchWebAuthFlow()` — token stored in `chrome.storage.session`
- **Permissions**: `activeTab`, `storage`, host permission for `*.wikipedia.org` and `wikiloop-doublecheck.toolforge.org`
- **Distribution**: Chrome Web Store; update cycle independent of server deploys
- **CSP handling**: content script runs in an isolated world; external API calls routed through the background service worker to avoid Wikipedia's Content-Security-Policy restrictions

---

## UserScript UI Mockups

### On Diff Pages

```
┌─── Wikipedia native diff page ────────────────────────────────┐
│                                                                │
│  Revision as of 12:34, 23 March 2026 by ExampleUser            │
│  ← Previous revision | Latest revision | Next revision →       │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ - The population of Berlin is 3.5 million               │  │
│  │ + The population of Berlin is 69 billion lol            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─── ⬡ DoubleCheck ───────────────────────────────────────┐  │
│  │                                                          │  │
│  │  Lift Wing:  Damaging ████████░░ 78%                     │  │
│  │              Good-faith ██░░░░░░░░ 15%                   │  │
│  │                                                          │  │
│  │  ┌───────────────┐ ┌──────────┐ ┌───────────┐           │  │
│  │  │ ShouldRevert  │ │ Not Sure │ │ LooksGood │           │  │
│  │  └───────────────┘ └──────────┘ └───────────┘           │  │
│  │                                                          │  │
│  │  Community: 3× ShouldRevert  1× LooksGood               │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### On RecentChanges / Watchlist

```
┌─── Special:RecentChanges ─────────────────────────────────────┐
│                                                                │
│  (diff | hist) Article_A  ExampleUser  (+342)  🔴 92%          │
│  (diff | hist) Article_B  GoodEditor   (+15)   🟢 3%           │
│  (diff | hist) Article_C  NewUser123   (-891)  🟡 61%          │
│                                                                │
│  🔴🟡🟢 = Lift Wing damaging score                              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Internationalization (i18n)

The current project has an existing `i18n/` directory with translation strings. The new stack must preserve multi-language support across all three client surfaces.

### Strategy per Surface

| Surface | i18n Method |
|---------|-------------|
| `packages/core` | `vue-i18n` composable (`useI18n()`) — shared translation JSON files loaded at build time |
| Web SPA | `vue-i18n` with lazy-loaded locale bundles (only load the active language) |
| UserScript | Prefer MediaWiki's native `mw.msg()` / `mw.messages.set()` system when available — maps DoubleCheck message keys into the ResourceLoader message registry. Falls back to `vue-i18n` on wikis where `mw.msg` is unavailable. |
| Chrome Extension | `vue-i18n` (same as Web SPA); locale detected from `chrome.i18n.getUILanguage()` |

### Translation Files

- Store canonical translations in `packages/core/i18n/{locale}.json` (e.g., `en.json`, `fr.json`, `zh-hans.json`)
- Migrate existing `i18n/` strings during Phase 2
- Use ICU MessageFormat for plurals and interpolation
- Community translations can be managed via Translatewiki.net (standard for Wikimedia tools)

---

## Design System: Wikimedia Codex

- **Web SPA** (`doublecheck.wikiloop.org`): bundles Vue 3, Codex components, and Codex design tokens — fully self-contained
- **Chrome Extension**: bundles Vue 3, Codex components, and design tokens — runs in an isolated world, cannot access Wikipedia's ResourceLoader
- **UserScript**: the only surface that reuses Wikipedia's Vue 3 and Codex runtime via `mw.loader.using(['vue', '@wikimedia/codex'])` — avoids duplicate downloads on Wikimedia wikis. Falls back to self-hosted bundle on wikis where ResourceLoader Vue 3 is unavailable.
- Custom styling limited to a small `.dc-*` namespace for DoubleCheck-specific layout
- Logo/branding: small `⬡ DoubleCheck` label in panel header, links to Meta-Wiki project page

---

## Database Strategy (MongoDB Atlas — keep existing)

Stay on MongoDB Atlas. The document model fits the app's data patterns (interactions, judgements, revisions) and avoids a costly migration of 321K+ interactions. Indexes on `userId` and `revisionId` cover the primary query patterns.

### Wikimedia Replica Access

Toolforge provides read-only access to live Wikipedia replica databases (e.g., `enwiki_p`) for enrichment queries (article metadata, edit counts). These are MariaDB on separate hosts — accessed via direct MySQL queries, not through the app's MongoDB connection.

### Space Management

MongoDB Atlas free tier is 512MB. To stay within limits, run a periodic purge cron job (carried over from v4):

- **Keep:** `Interaction` (core data — judgements), `UserPreferences`
- **Purge periodically:** `FeedRevision`, `FeedPage`, `Sockets`, `Sessions`, `LiveClients`, `DecisionLog` (transient/cache data)
- Schedule: daily at 3am UTC via Toolforge cron or in-app `node-cron`
- Report purge results to Slack webhook (optional, same as v4)

### Future Migration

If the app outgrows Atlas free tier, migrate to either:
- MongoDB self-hosted on Cloud VPS
- MariaDB on ToolsDB (would require schema redesign)

---

## Auth Strategy

| Client | Method |
|--------|--------|
| Web SPA | OAuth 2.0 flow → session cookie |
| UserScript | `mw.user.isNamed()` / `mw.user.isTemp()` / `mw.user.isAnon()` for client-side detection; `wgUserName` for display. Server verifies via MW API `userinfo` call. Unverified until user completes OAuth linking. |
| Chrome Extension | OAuth 2.0 via `chrome.identity.launchWebAuthFlow()` → token in `chrome.storage.session` |
| Named users | Full functionality after OAuth linking |
| Temporary account users | Wikipedia auto-creates temp accounts (pattern `~YYYY-NNNNN-N`) for logged-out editors. Judgements attributed to temp username but treated as unverified. Temp accounts expire after 90 days. |
| Anonymous browsers | Cookie-based anonymous ID (Web SPA). On Wikipedia (UserScript/Extension), `mw.user.isAnon()` returns `true` — read-only mode, no judgement submission. |

---

## Real-time Strategy

- Replace Socket.IO with **Server-Sent Events (SSE)** as the primary transport
- Use cases are lightweight: new judgement notifications, metrics updates
- SSE is HTTP-native, no special Toolforge configuration needed
- **Heartbeat**: the server sends a `:ping` comment every 15s to keep the connection alive — Toolforge's ingress/proxy can prematurely time out idle long-lived connections without this
- **Reconnection**: the client-side `EventSource` (or wrapper) implements automatic reconnection with exponential backoff (1s → 2s → 4s → max 30s) and resumes from the last `Last-Event-ID`
- **Fallback**: short polling (30s interval) when SSE is unavailable — specifically:
  - UserScript context: Wikipedia's CSP may block SSE connections to `wikiloop-doublecheck.toolforge.org`; the userscript detects this and falls back to polling the REST API
  - Extension context: background service worker handles SSE; content script receives updates via `chrome.runtime.onMessage`
  - Web SPA: SSE should work directly; polling only as a network-error fallback

---

## Migration & Rollout Plan

This is a greenfield rewrite — the old Heroku app will be shut down and replaced, not incrementally migrated. Work is structured so that multiple subagents (developers or AI agents) can build packages **in parallel** after shared foundations are in place.

### Phase -1 — Demolition ✅

Executed. Created `v5` branch from `master`, preserved branding, i18n (26 locales), test fixtures, changelog, and this plan. Deleted all Nuxt 2 / Vue 2 / Express code. See commit `ea4f9d0`.

---

### Phase 0 — Human Unblock ✅

All provisioning complete:

- [x] Toolforge: tool `wikiloop-doublecheck`, SSH, ToolsDB, replicas verified
- [x] OAuth 2.0: 3 consumers approved (local dev, Toolforge, wikiloop.org) — grants: Basic, Edit, Rollback, Patrol, Watchlist
- [x] MongoDB Atlas: prod URI in `.env`, 321K interactions, 191 users
- [x] Chrome Web Store: developer account `xinbenlv`, GCP service account `cws-publisher@wikiloop.iam.gserviceaccount.com`
- [x] Toolforge deploy: live at `https://wikiloop-doublecheck.toolforge.org`
- [x] Vercel deploy: live at `https://doublecheck.wikiloop.org` (CNAME to Vercel)
- [x] UserScript: served at `/doublecheck.user.js`
- [x] Chrome Extension: scaffolded in `packages/extension/`, sideloadable

Secrets strategy: all runtime secrets on Toolforge (`.env`) and Vercel (env vars). GitHub Actions secrets added only when CI needs them.

### Phase 1 — Foundation (sequential, single agent)

Must complete before parallel work begins. One agent scaffolds the entire monorepo and defines all shared contracts.

#### Monorepo Scaffolding

- pnpm workspace, TypeScript config, ESLint flat config, Prettier
- `docker-compose.yml` for local dev (MongoDB + MediaWiki containers)
- `.env.example` listing every required variable with descriptions
- CI pipeline (GitHub Actions): lint, type-check, unit tests per package, MongoDB service container, Playwright browsers

#### Interface Contracts

These are the boundaries between packages. Defined as TypeScript types/interfaces so all subagents code against the same contract.

| Contract | Location | Defines | Consumers |
|----------|----------|---------|-----------|
| **API schema** | `packages/core/src/types/api.ts` | REST endpoint paths, request/response shapes for every route (judgement CRUD, revision feed, Lift Wing proxy, auth, SSE event types) | server, core API client, all three clients |
| **Domain types** | `packages/core/src/types/models.ts` | `Revision`, `Judgement`, `User`, `Feed`, `LiftWingScore`, `WikiIdentity` (named / temp / anon) | all packages |
| **Component props & events** | `packages/core/src/types/components.ts` | Props interfaces and emitted event payloads for `RevisionCard`, `DiffBox`, `ActionPanel`, `JudgementPanel` | core, web, userscript, extension |
| **Mongoose models** | `packages/server/src/db/models/` | Collection schemas — the single source of truth for database shape | server |
| **i18n message keys** | `packages/core/i18n/en.json` | Canonical set of translation keys and English strings | all client packages |

> **Rule:** If a subagent needs to change a shared contract, it must update the type file in `packages/core` (or `server/db/models/`) and all subagents must pull the change before continuing.

#### Exit Criteria

- All subagents can `pnpm install`, import shared types, and run `pnpm test` with no errors
- `docker compose up` starts MongoDB + MediaWiki locally
- Mongoose models connect to local MongoDB successfully

### Phase 2 — Parallel Build (5 subagents)

Once Phase 1 is complete, the following workstreams run **concurrently**. Each subagent owns one package and codes against the shared contracts.

```
Phase 1 (Foundation)
        │
        ▼
  ┌─────┼─────┬─────────┬────────────┐
  ▼     ▼     ▼         ▼            ▼
 [A]   [B]   [C]       [D]          [E]
Server Core  Web SPA   UserScript   Extension
  │     │     │         │            │
  ▼     ▼     ▼         ▼            ▼
  └─────┴─────┴─────────┴────────────┘
        │
        ▼
  Phase 3 (Integration & Launch)
```

#### Subagent A — `packages/server`

- Hono API server: all REST endpoints matching the API schema contract
- OAuth 2.0 flow (MW consumer), session management
- Server-side identity verification (MW API `userinfo` call)
- Lift Wing proxy with caching
- SSE endpoint with heartbeat + event IDs
- CORS middleware (Wikipedia origins + extension origin)
- Rate limiting, `/healthz` health check, structured logging (pino)
- Purge cron job: daily purge of transient collections (FeedRevision, FeedPage, Sockets, Sessions, LiveClients, DecisionLog), optional Slack reporting
- **Tests:** all server unit tests, integration tests against MongoDB Docker
- **Dependencies on Phase 1:** Mongoose models, API type definitions, `.env.example`
- **No dependency on other subagents** — can validate with `curl` / Vitest against the API schema

#### Subagent B — `packages/core`

- Vue 3 components: RevisionCard, DiffBox, ActionPanel, JudgementPanel
- Composables: `useRevision()`, `useJudgement()`, `useLiftWing()`
- Typed API client (`fetch` wrapper implementing the API schema contract)
- i18n setup: `vue-i18n` plugin, locale loading, message key access
- **Tests:** all core component and composable unit tests
- **Dependencies on Phase 1:** type definitions, `en.json` keys
- **No dependency on other subagents** — tests mock the API client responses using the shared type definitions

#### Subagent C — `packages/web`

- Vite SPA: vue-router, landing page, review/feed/leaderboard/history routes
- Bundles own Vue 3 + Codex
- OAuth login flow (redirect-based)
- SSE client with reconnection + polling fallback
- SEO: meta tags, OpenGraph, JSON-LD, `noindex` on review pages
- i18n: lazy-loaded locale bundles via `vue-i18n`
- **Tests:** Web SPA E2E tests (Playwright)
- **Depends on Subagent B** (`@doublecheck/core` components + API client)
- **Can start immediately** on routing/layout/landing page while B builds components; integrates core components as they become available

#### Subagent D — `packages/userscript`

- Vite IIFE build with Vue 3 as external
- ResourceLoader feature detection → self-hosted fallback → CSP failure handling
- Diff page injection, RecentChanges/Watchlist badges
- Identity detection (`mw.user.isNamed/isTemp/isAnon`)
- i18n: `mw.msg()` integration with `vue-i18n` fallback
- **Tests:** UserScript unit tests + E2E on MediaWiki Docker
- **Depends on Subagent B** (`@doublecheck/core` components)
- **Can start immediately** on IIFE build scaffolding, ResourceLoader detection, and MW identity logic while B builds components

#### Subagent E — `packages/extension`

- CRXJS Vite build, Manifest V3
- Content script injection (same points as UserScript), popup UI
- Background service worker: API routing, SSE relay, OAuth token management
- `chrome.identity.launchWebAuthFlow()` OAuth flow
- i18n: `vue-i18n` with `chrome.i18n.getUILanguage()` locale detection
- **Tests:** Extension unit tests + E2E with Playwright `--load-extension`
- **Depends on Subagent B** (`@doublecheck/core` components)
- **Can start immediately** on Manifest V3 scaffolding, service worker, and `chrome.identity` flow while B builds components

### Phase 3 — Integration & Launch (sequential)

After all subagents complete:

1. **Integration testing**: wire all packages together; run full E2E suite against a staging Toolforge deployment
2. **Deploy to Toolforge Buildpacks**
3. **Submit Chrome Extension** to Chrome Web Store
4. **Publish UserScript** installation instructions to Meta-Wiki
5. **Shut down old Heroku app**
6. **Set up purge cron job** on Toolforge to keep MongoDB Atlas within free tier limits

---

## Testing Strategy

### Testing Overview

- **Unit tests** (Vitest): component rendering, composable logic, API handler validation, middleware behavior — per package
- **Integration tests**: Mongoose CRUD against MongoDB Docker, full API request/response cycles, purge cron verification
- **E2E tests** (Playwright): OAuth login flow, review + judgement flow, feed navigation, UserScript injection on MediaWiki Docker, Extension content script + popup
- **CI** (GitHub Actions): lint → type-check → unit tests (parallel) → integration (MongoDB container) → E2E (browser install). Runs on push to main and all PRs.

---

## CORS & Cross-Origin Policy

The API server at `wikiloop-doublecheck.toolforge.org` must handle cross-origin requests from three client contexts:

| Client | Origin | Notes |
|--------|--------|-------|
| Web SPA | `wikiloop-doublecheck.toolforge.org` | Same-origin; no CORS needed |
| UserScript | `*.wikipedia.org` | Cross-origin; requires CORS headers |
| Chrome Extension | `chrome-extension://<id>` | Cross-origin; requires CORS headers |

### Hono CORS Middleware Configuration

- `Access-Control-Allow-Origin`: allowlist of `*.wikipedia.org` origins + the extension's `chrome-extension://` origin
- `Access-Control-Allow-Methods`: `GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers`: `Content-Type, Authorization`
- `Access-Control-Allow-Credentials`: `true` (for cookie-based auth on Web SPA)
- Preflight (`OPTIONS`) responses cached via `Access-Control-Max-Age: 86400`

### Toolforge Ingress

- Toolforge's nginx ingress passes through CORS headers set by the application
- No additional proxy-level CORS configuration needed
- Rate limiting at the ingress level; application-level rate limiting via Hono middleware for API abuse protection

---

## Observability & Logging

### Structured Logging

- Use `pino` (or Hono's built-in logger) for structured JSON logging to stdout
- Toolforge captures stdout/stderr and makes it available via `toolforge logs`
- Log levels: `error` for failures, `warn` for degraded paths, `info` for request lifecycle

### Metrics

- Track key counters: judgements submitted, revisions fetched, OAuth logins, Lift Wing API calls
- Expose a `/metrics` endpoint (Prometheus-compatible) for optional scraping
- Toolforge provides basic pod health monitoring; custom dashboards can be built if Prometheus/Grafana access is available

### Error Tracking

- Unhandled exceptions logged with stack trace and request context
- Consider lightweight error reporting (e.g., Sentry free tier) for the Web SPA and Extension if Toolforge-only logging proves insufficient
- UserScript errors: catch and log to `console.error` with `[DoubleCheck]` prefix; optionally report to API endpoint for aggregation

### Health Check

- `GET /healthz` endpoint: returns 200 if MongoDB connection is alive
- Used by Toolforge Buildpacks for liveness/readiness probes

---

## Landing Page SEO

- `<title>`, `<meta description>`, OpenGraph (`og:title`, `og:image`, `og:url`), Twitter Card (`summary_large_image`), JSON-LD `WebApplication` schema
- Canonical URL: `https://doublecheck.wikiloop.org/`
- Review pages (`/review/*`, `/feed/*`, `/leaderboard/*`): `<meta name="robots" content="noindex">`

---

## Key Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vue 3 over Preact | Vue 3 | Web SPA and Extension bundle their own Vue 3; UserScript reuses Wikipedia's Vue 3 via ResourceLoader (cached, zero extra bytes) with fallback to self-hosted bundle; all three surfaces share Codex components |
| Keep MongoDB over MariaDB migration | MongoDB | Avoids costly migration of 321K+ interactions; document model fits app's data patterns; Atlas free tier sufficient with purge cron |
| Hono over Express | Hono | Lighter, TypeScript-first; backend is pure API server (no SSR) |
| SSE over Socket.IO | SSE | Simpler on Toolforge; real-time needs are modest (one-way push) |
| Codex over custom CSS | Codex | Native Wikipedia look-and-feel; accessibility and RTL support included |
| Monorepo over polyrepo | Monorepo | Three clients share core components; single CI; atomic changes |
| SPA over SSR | SPA | Only landing page needs SEO (static HTML); review pages should not be indexed |
