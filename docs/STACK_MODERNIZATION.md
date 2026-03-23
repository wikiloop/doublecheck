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
  web/            # SPA entry — Vite, preact-router, landing page
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
| Language | TypeScript | 5.7 | |
| Build | Vite | 6.x | All three clients |
| | CRXJS Vite Plugin | 2.x | Chrome Extension build |
| Frontend | vue | 3.x | UserScript reuses Wikipedia's runtime |
| | @wikimedia/codex | 1.x | Wikimedia design system (Vue 3 components) |
| | @wikimedia/codex-design-tokens | 1.x | CSS variables for Web SPA + Extension |
| | vue-router | 4.x | Web SPA only |
| | diff2html | 3.x | Diff rendering (carried over) |
| Backend | hono | 4.x | API framework |
| | @hono/node-server | 1.x | Node adapter |
| Database | drizzle-orm | 0.38.x | Type-safe SQL builder |
| | mysql2 | 3.x | MariaDB driver |
| | drizzle-kit | 0.30.x | Migration tooling |
| Testing | vitest | 3.x | Vite-native test runner |
| | @testing-library/vue | 8.x | Component testing |
| Code quality | eslint | 9.x | Flat config |
| | prettier | 3.x | |
| Migration | mongodb | 6.x | One-time migration script only |

---

## Three-Client Strategy

### Shared (packages/core)

- Vue 3 components: RevisionCard, DiffBox, ActionPanel, JudgementPanel
- Composables: `useRevision()`, `useJudgement()`, `useLiftWing()`
- Typed API client (plain `fetch` wrapper)
- Type definitions: Revision, Judgement, Feed, etc.

### Web SPA (packages/web)

- Vite SPA build
- Landing page: static HTML with SEO meta tags, links to "Start Reviewing"
- Review pages: `<meta name="robots" content="noindex">`
- Imports Codex design tokens + components
- OAuth 2.0 login flow
- Routes: review, feed, leaderboard, history

### UserScript (packages/userscript)

- Vite IIFE build, Vue 3 marked as **external** (reuse Wikipedia's runtime)
- Codex components and CSS tokens already available on the page — zero extra CSS
- Two injection points:
  - **Diff pages** (`Special:Diff/*`): inject review panel below diff (ML score + vote buttons + community votes)
  - **RecentChanges / Watchlist**: inject colored risk badges per edit row
- User identity via `mw.config.get('wgUserName')` — no separate login
- Full functionality: review + revert

**Loader script** (user installs this in `Special:MyPage/common.js`):

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

mw.loader.using(['vue', 'mediawiki.api']).then(function (require) {
  var script = document.createElement('script');
  script.src = 'https://doublecheck.toolforge.org/userscript.iife.js';
  document.head.appendChild(script);
});
```

### Chrome Extension (packages/extension)

- Manifest V3 + CRXJS Vite plugin
- Content script injects on Wikipedia pages (similar to UserScript)
- Popup for quick access to leaderboard / settings
- Auth via `chrome.identity` or OAuth 2.0 flow

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

## Design System: Wikimedia Codex

- **UserScript**: uses Wikipedia's already-loaded Codex CSS variables and Vue 3 runtime — zero extra payload
- **Web SPA + Extension**: import `@wikimedia/codex-design-tokens` for CSS variables, use Codex Vue 3 components
- Custom styling limited to a small `.dc-*` namespace for DoubleCheck-specific layout
- Logo/branding: small `⬡ DoubleCheck` label in panel header, links to Meta-Wiki project page

---

## Database Migration (MongoDB → MariaDB)

- Decompose `wikiRevId` ("enwiki:987654") into `wiki VARCHAR` + `rev_id INT` columns
- Main tables: `interactions`, `feed_revisions`, `decision_logs`, `users`
- One-time migration: `mongoexport` → transform → `LOAD DATA INFILE`
- ORM: Drizzle schema definitions generate SQL migrations via `drizzle-kit`

---

## Auth Strategy

| Client | Method |
|--------|--------|
| Web SPA | OAuth 2.0 flow → session cookie |
| UserScript | `mw.config.get('wgUserName')` — user is already logged into Wikipedia |
| Chrome Extension | OAuth 2.0 via `chrome.identity` |
| Anonymous users | Cookie-based anonymous ID (Web), temporary account identity (UserScript) |

---

## Real-time Strategy

- Replace Socket.IO with **Server-Sent Events (SSE)** or **short polling (30s)**
- Use cases are lightweight: new judgement notifications, metrics updates
- SSE is HTTP-native, no special Toolforge configuration needed
- Falls back gracefully in UserScript context

---

## Key Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vue 3 over Preact | Vue 3 | UserScript can reuse Wikipedia's Vue 3 runtime (0KB overhead); enables native Codex component usage |
| MariaDB over Postgres | MariaDB | Toolforge provides ToolsDB (MariaDB) for free; can JOIN Wikimedia replica databases |
| Drizzle over Prisma | Drizzle | No Rust binary dependency; lightweight; SQL-first fits simple query needs |
| Hono over Express | Hono | Lighter, TypeScript-first; backend is pure API server (no SSR) |
| SSE over Socket.IO | SSE | Simpler on Toolforge; real-time needs are modest (one-way push) |
| Codex over custom CSS | Codex | Native Wikipedia look-and-feel; accessibility and RTL support included |
| Monorepo over polyrepo | Monorepo | Three clients share core components; single CI; atomic changes |
| SPA over SSR | SPA | Only landing page needs SEO (static HTML); review pages should not be indexed |
