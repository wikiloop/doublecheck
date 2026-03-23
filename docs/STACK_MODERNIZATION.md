# WikiLoop DoubleCheck — Stack Modernization Plan

## Motivation

1. **Architecture is outdated** — Original stack (2018) built on Nuxt 2, Vue 2, Node 12, all EOL or unmaintained
2. **Platform migration** — Move to Wikimedia Toolforge (Buildpacks) for native Wikimedia IP range, better community support, and free infrastructure (MariaDB, OAuth)
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
| Database | MongoDB (Atlas) | **MariaDB** (Toolforge ToolsDB) |
| ORM | Mongoose | **Drizzle ORM** |
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
                    │ Landing Page │  (static HTML, SEO)
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
                 │  (Node + Hono)    │
                 │  OAuth 2.0       │
                 └────────┬─────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌──────────┐ ┌─────────┐ ┌──────────┐
        │ ToolsDB  │ │MediaWiki│ │ Lift Wing│
        │ MariaDB  │ │  API    │ │  ML API  │
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
  server/         # Hono API server + Drizzle + cron jobs
```

All three clients import from `@doublecheck/core`. Vite builds each with a different entry point and output format.

---

## Key Dependencies

| Layer | Dependency | Version | Notes |
|-------|-----------|---------|-------|
| Runtime | Node.js | 22 LTS | Toolforge Buildpacks |
| Monorepo | pnpm | 9.x | Workspace management |
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
| Database | drizzle-orm | 0.x | Type-safe SQL builder |
| | mysql2 | 3.x | MariaDB driver |
| | drizzle-kit | 0.x | Migration tooling |
| Testing | vitest | 3.x | Vite-native test runner |
| | @testing-library/vue | 8.x | Component testing |
| | @playwright/test | 1.x | E2E testing |
| Code quality | eslint | 9.x | Flat config |
| | prettier | 3.x | |
| Migration | mongodb | 6.x | One-time migration script only |

> **Note:** Version numbers are major-version guidance for initial development. We will update dependencies over time as new versions are released.

---

## Three-Client Strategy

### Shared (packages/core)

- Vue 3 components: RevisionCard, DiffBox, ActionPanel, JudgementPanel
- Composables: `useRevision()`, `useJudgement()`, `useLiftWing()`
- Typed API client (plain `fetch` wrapper)
- Type definitions: Revision, Judgement, Feed, etc.
- i18n: shared translation JSON files (`i18n/{locale}.json`) consumed via `vue-i18n`

### Web SPA (packages/web)

- Vite SPA build — **bundles its own Vue 3, Codex components, and Codex design tokens** (fully self-contained, no dependency on Wikipedia's runtime)
- Served from `https://doublecheck.wikiloop.org`
- Landing page: static HTML with SEO meta tags, links to "Start Reviewing"
- Review pages: `<meta name="robots" content="noindex">`
- OAuth 2.0 login flow
- Routes: review, feed, leaderboard, history

### UserScript (packages/userscript)

- Vite IIFE build — the **only** client surface that attempts to reuse Wikipedia's Vue 3 and Codex runtime via `mw.loader.using(['vue', '@wikimedia/codex'])`
- This avoids shipping duplicate Vue 3 / Codex bytes on Wikimedia wikis where ResourceLoader already provides them (cached, zero extra download)
- **Fallback for wikis without ResourceLoader Vue 3** (e.g., some non-EN Wikipedias or third-party MediaWiki installs): the IIFE entry point is kept minimal (~2 KB) and runs a feature-detection step before loading the main bundle:
  1. Check if `mw.loader` can resolve `vue` and `@wikimedia/codex` — if yes, use ResourceLoader (zero extra bytes)
  2. If not, dynamically load a self-hosted Vue 3 + Codex bundle from `doublecheck.toolforge.org/vendor/`
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
    return mw.loader.getScript('https://doublecheck.toolforge.org/userscript.iife.js');
  });
}
```

**Option B — Tampermonkey / Greasemonkey** (install as a userscript manager script):

```js
// ==UserScript==
// @name         WikiLoop DoubleCheck
// @version      4.3.0
// @description  Crowdsourced vandalism review for Wikipedia
// @namespace    https://doublecheck.wikiloop.org
// @match        *://*.wikipedia.org/w/index.php?*diff=*
// @match        *://*.wikipedia.org/wiki/Special:Diff/*
// @match        *://*.wikipedia.org/wiki/Special:RecentChanges*
// @match        *://*.wikipedia.org/wiki/Special:Watchlist*
// @grant        none
// @license      MIT
// ==/UserScript==

mw.loader.using(['vue', '@wikimedia/codex', 'mediawiki.api']).then(function () {
  mw.loader.getScript('https://doublecheck.toolforge.org/userscript.iife.js');
});
```

In both cases, `mw.loader.using` ensures Vue 3 and Codex are loaded before the IIFE executes. The IIFE accesses them via `require('vue')` and `require('@wikimedia/codex')` from the ResourceLoader registry.

### Chrome Extension (packages/extension)

- **Build**: Manifest V3 + CRXJS Vite plugin — **bundles its own Vue 3 and Codex** (extensions run in an isolated world and cannot access Wikipedia's ResourceLoader runtime)
- **Content script**: injects on Wikipedia diff pages, RecentChanges, and Watchlist (same injection points as UserScript)
  - Uses `@doublecheck/core` components for review panel and risk badges
  - Communicates with background service worker for API calls (avoids page CSP restrictions)
- **Popup**: quick access to leaderboard, recent activity, and settings
- **Auth**: OAuth 2.0 flow via `chrome.identity.launchWebAuthFlow()` — token stored in `chrome.storage.session`
- **Permissions**: `activeTab`, `storage`, host permission for `*.wikipedia.org` and `doublecheck.toolforge.org`
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

## Database Migration (MongoDB → MariaDB)

This is a clean-break migration — the old MongoDB database will not be kept running alongside the new MariaDB instance.

### Schema Design

- Decompose `wikiRevId` ("enwiki:987654") into `wiki VARCHAR` + `rev_id INT` columns
- Main tables: `interactions`, `feed_revisions`, `decision_logs`, `users`
- ORM: Drizzle schema definitions generate SQL migrations via `drizzle-kit`

### Multi-Host Database Access (Toolforge)

Toolforge's ToolsDB and the Wikimedia replica databases (e.g., `enwiki_p`) reside on **different hosts/sockets**. The Drizzle configuration must account for this:

- **ToolsDB connection** (`tools.db.svc.wikimedia.cloud`): used for all application data (interactions, users, etc.)
- **Replica connections** (`enwiki.analytics.db.svc.wikimedia.cloud`, etc.): read-only access to live Wikipedia data for enrichment queries (e.g., fetching article metadata, edit counts)
- Maintain separate Drizzle client instances per host — do not attempt cross-database JOINs across different hosts in a single query
- Replica access is read-only; never write to replica databases

### Migration Script

A one-time Node.js migration script (`packages/server/scripts/migrate-mongo-to-mariadb.ts`) will:

1. Connect to old MongoDB (Atlas) in read-only mode
2. Export each collection, transform documents to relational rows (decompose `wikiRevId`, flatten nested objects, map ObjectIds to auto-increment IDs)
3. Batch-insert into MariaDB via Drizzle (or `LOAD DATA INFILE` for large tables)
4. Run validation queries: compare row counts, spot-check random records, verify referential integrity

### Migration Sequence

1. Freeze writes to old app (put in read-only / maintenance mode)
2. Run migration script
3. Verify data integrity
4. Deploy new stack pointing to MariaDB
5. Decommission old MongoDB instance after a holding period (30 days recommended)

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
  - UserScript context: Wikipedia's CSP may block SSE connections to `doublecheck.toolforge.org`; the userscript detects this and falls back to polling the REST API
  - Extension context: background service worker handles SSE; content script receives updates via `chrome.runtime.onMessage`
  - Web SPA: SSE should work directly; polling only as a network-error fallback

---

## Migration & Rollout Plan

This is a greenfield rewrite — the old Heroku app will be shut down and replaced, not incrementally migrated.

### Phase 1 — Foundation

- Set up pnpm monorepo, TypeScript config, ESLint flat config, Prettier
- `packages/server`: Hono API server with Drizzle ORM, MariaDB schema, basic CRUD endpoints
- Drizzle migrations for all tables
- CI pipeline (GitHub Actions): lint, type-check, unit tests per package

### Phase 2 — Core & Web SPA

- `packages/core`: shared Vue 3 components (RevisionCard, DiffBox, ActionPanel, JudgementPanel), composables, API client
- `packages/web`: Vite SPA with Codex, vue-router, OAuth 2.0 login, review flow
- Landing page with SEO

### Phase 3 — UserScript

- `packages/userscript`: Vite IIFE build, ResourceLoader integration, Vue 3 fallback
- Diff page injection + RecentChanges/Watchlist badges
- Identity detection (`mw.user.isNamed()` / `isTemp()` / `isAnon()`)

### Phase 4 — Chrome Extension

- `packages/extension`: CRXJS Vite build, Manifest V3, content script, popup, OAuth via `chrome.identity`
- Chrome Web Store submission

### Phase 5 — Data Migration & Launch

- Run MongoDB → MariaDB migration script
- Deploy to Toolforge Buildpacks
- Shut down old Heroku app
- Decommission MongoDB Atlas after 30-day holding period

### Deployment: Schema Migrations

Drizzle migrations must run **before** the new application code starts serving traffic. On Toolforge:

- Run `drizzle-kit migrate` as a **one-off Toolforge job** (`toolforge jobs run migrate -- node scripts/migrate.js`) prior to deploying the new build
- Alternatively, include the migration as a `prestart` script in `package.json` — Buildpacks execute this before the main process starts
- Migrations must be idempotent (safe to re-run) to handle deployment retries
- For breaking schema changes, coordinate migration + deploy as a pair: run migration, then immediately deploy the matching code

---

## Testing Strategy

### Unit Tests (Vitest)

- All packages use Vitest with Vite-native transforms
- `packages/core`: component tests via `@testing-library/vue` — render components, assert DOM output and emitted events
- `packages/server`: handler tests — mock database layer, test API route logic
- Target: critical paths covered; no arbitrary coverage percentage mandate

### Integration Tests

- `packages/server`: test against a real MariaDB instance (Docker in CI) — verify Drizzle queries, migration correctness, and API contract
- Database migration script: run against a MongoDB fixture dump and verify output in MariaDB

### E2E Tests (Playwright)

- `packages/web`: Playwright tests against a running dev server — login flow, review flow, feed navigation
- `packages/userscript`: Playwright with a local MediaWiki Docker instance (from `mediawiki-docker`) — verify injection on diff pages and RecentChanges, identity detection, vote submission
- `packages/extension`: Playwright with `--load-extension` flag to test content script injection and popup

### CI Pipeline (GitHub Actions)

- Lint + type-check (all packages, fast)
- Unit tests (all packages, parallel)
- Integration tests (server, requires MariaDB service container)
- E2E tests (web + userscript + extension, requires browser install step)
- Run on: push to main, all PRs

---

## CORS & Cross-Origin Policy

The API server at `doublecheck.toolforge.org` must handle cross-origin requests from three client contexts:

| Client | Origin | Notes |
|--------|--------|-------|
| Web SPA | `doublecheck.toolforge.org` | Same-origin; no CORS needed |
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

- `GET /healthz` endpoint: returns 200 if MariaDB connection is alive
- Used by Toolforge Buildpacks for liveness/readiness probes

---

## Landing Page SEO

The landing page (`/`) is a static HTML page served by the Hono API server (or a separate static build), designed for discoverability.

### Meta Tags

- `<title>`: "DoubleCheck — Crowdsourced Vandalism Review for Wikipedia"
- `<meta name="description">`: concise project summary
- Canonical URL: `https://doublecheck.toolforge.org/`

### OpenGraph & Twitter Cards

- `og:title`, `og:description`, `og:image` (project logo or screenshot of review panel)
- `og:type`: `website`
- `og:url`: canonical URL
- `twitter:card`: `summary_large_image`

### Structured Data

- JSON-LD `WebApplication` schema: name, description, URL, applicationCategory ("Productivity"), operatingSystem ("Web")
- Optional: `SoftwareSourceCode` pointing to the GitHub repository

### Review Pages

- All review routes (`/review/*`, `/feed/*`, `/leaderboard/*`) include `<meta name="robots" content="noindex">` to prevent indexing of dynamic content

---

## Key Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vue 3 over Preact | Vue 3 | Web SPA and Extension bundle their own Vue 3; UserScript reuses Wikipedia's Vue 3 via ResourceLoader (cached, zero extra bytes) with fallback to self-hosted bundle; all three surfaces share Codex components |
| MariaDB over Postgres | MariaDB | Toolforge provides ToolsDB (MariaDB) for free; can JOIN Wikimedia replica databases |
| Drizzle over Prisma | Drizzle | No Rust binary dependency; lightweight; SQL-first fits simple query needs |
| Hono over Express | Hono | Lighter, TypeScript-first; backend is pure API server (no SSR) |
| SSE over Socket.IO | SSE | Simpler on Toolforge; real-time needs are modest (one-way push) |
| Codex over custom CSS | Codex | Native Wikipedia look-and-feel; accessibility and RTL support included |
| Monorepo over polyrepo | Monorepo | Three clients share core components; single CI; atomic changes |
| SPA over SSR | SPA | Only landing page needs SEO (static HTML); review pages should not be indexed |
