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

This is a greenfield rewrite — the old Heroku app will be shut down and replaced, not incrementally migrated. Work is structured so that multiple subagents (developers or AI agents) can build packages **in parallel** after shared foundations are in place.

### Phase -1 — Demolition (clean slate on `v5` branch)

Create a `v5` branch from `master`, then remove all old application code. The v5 branch starts empty except for assets to carry forward and this plan document. Everything else is rebuilt from scratch.

#### Branch Setup

```bash
git checkout master
git checkout -b v5
```

#### Assets to Preserve (copy to `v5-assets/` before demolition)

These files represent community effort, branding, or historical context that cannot be regenerated.

**Branding & Icons** — needed for the new Web SPA, Extension, and UserScript panel header:

| File | Purpose | Used by |
|------|---------|---------|
| `static/wikiloop-doublecheck-logo.svg` | Primary brand logo (vector) | Web SPA, Extension popup, landing page |
| `static/wikiloop-doublecheck-logo.png` | Primary brand logo (raster) | OpenGraph image, Chrome Web Store listing |
| `static/wikiloop-logo.svg` | Parent project logo (vector) | Landing page footer |
| `static/wikiloop-logo.png` | Parent project logo (raster) | Fallback |
| `static/favicon.ico` | Browser favicon | Web SPA |
| `static/icon.png` | App icon | Extension, PWA manifest |

**Translations (26 languages)** — significant community contribution, convert from YAML to JSON during Phase 2:

| Directory | Contents |
|-----------|----------|
| `i18n/locales/*.yml` | `af`, `ar`, `bg`, `ca`, `cs`, `de`, `en`, `es`, `fa`, `fr`, `he`, `id`, `it`, `ja`, `ko`, `lv`, `nl`, `pl`, `pt`, `ru`, `sv`, `th`, `tr`, `uk`, `zh` |

**Test fixtures** — real MediaWiki API responses, useful as reference for the new API client and migration script:

| Directory | Contents |
|-----------|----------|
| `test/testdata/mwapi/small/*.json` | Sample MW API responses (enwiki, zhwiki, wikidatawiki) + datamap |
| `test/testdata/mwapi/large/*.json` | Larger MW API response samples |
| `test/testdata/wikitrust_feed.json` | WikiTrust scoring feed sample |

**Project history & legal:**

| File | Purpose |
|------|---------|
| `LICENSE` | Apache-2.0 — must remain in repo root |
| `CHANGELOG.md` | Version history through v4 — keep for reference |
| `.all-contributorsrc` | Contributor attribution metadata |

**This plan:**

| File | Purpose |
|------|---------|
| `docs/STACK_MODERNIZATION.md` | The v5 blueprint — the only document that drives implementation |

#### What Gets Deleted (everything else)

All old application code, config, and build artifacts. For reference, this includes:

| Category | Paths |
|----------|-------|
| Nuxt 2 app | `pages/`, `layouts/`, `components/`, `store/`, `plugins/`, `middleware/`, `nuxt.config.js`, `custom.scss`, `vue-shim.d.ts` |
| Express server | `server/`, `cronjobs/`, `mailer/`, `tscmd/`, `cross-edits-detection/` |
| Old shared code | `shared/` |
| Old build/config | `package.json`, `yarn.lock`, `.yarnrc`, `.nvmrc`, `.babelrc`, `.eslintrc.yml`, `tsconfig.json`, `jest*.config.js`, `jest.setup.js`, `typedoc.json`, `commitlint.config.js`, `eco.yml`, `renovate.json` |
| Old deployment | `Procfile`, `app.json`, `heroku.env`, `template.env`, `.circleci/` |
| Old CI/GitHub | `.github/config.yml`, `.github/weekly-digest.yml` |
| Generated/cached | `.nuxt/`, `node_modules/`, `package-lock.json`, `tmp/` |
| Old scripts | `scripts/` |
| Old test infra | `test/` (fixtures already copied to `v5-assets/`) |
| Old assets dir | `assets/` (demo GIFs and legacy icons — not needed for v5) |
| Old static dir | `static/` (logos already copied to `v5-assets/`) |
| Old docs | `docs/` (TypeDoc output — will be regenerated), `README.md`, `ARCHITECT.md`, `CONTRIBUTING.md` |
| Claude config | `.agents/`, `.claude/`, `skills-lock.json` |
| VS Code | `.vscode/` |

#### Demolition Script

```bash
# 1. Create v5 branch
git checkout master && git checkout -b v5

# 2. Copy assets to preserve
mkdir -p v5-assets/branding v5-assets/i18n v5-assets/test-fixtures v5-assets/history

cp static/wikiloop-doublecheck-logo.svg v5-assets/branding/
cp static/wikiloop-doublecheck-logo.png v5-assets/branding/
cp static/wikiloop-logo.svg v5-assets/branding/
cp static/wikiloop-logo.png v5-assets/branding/
cp static/favicon.ico v5-assets/branding/
cp static/icon.png v5-assets/branding/

cp -r i18n/locales/ v5-assets/i18n/
cp -r test/testdata/ v5-assets/test-fixtures/

cp CHANGELOG.md v5-assets/history/
cp .all-contributorsrc v5-assets/history/

# 3. Remove everything except what we keep
#    (LICENSE, docs/STACK_MODERNIZATION.md, v5-assets/, .git/, .gitignore)
find . -maxdepth 1 \
  ! -name '.' ! -name '.git' ! -name '.gitignore' \
  ! -name 'LICENSE' ! -name 'v5-assets' ! -name 'docs' \
  -exec rm -rf {} +

# Clean docs/ down to just the plan
find docs/ ! -name 'STACK_MODERNIZATION.md' ! -name '.' -exec rm -rf {} +

# 4. Commit the clean slate
git add -A
git commit -m "chore: demolish v4 codebase, preserve assets for v5 rewrite

Remove all Nuxt 2 / Vue 2 / Express application code, config, and build
artifacts. Preserve branding assets, 26 i18n translation files, test
fixtures, changelog, and the v5 stack modernization plan.

See docs/STACK_MODERNIZATION.md for the full v5 blueprint."
```

#### Post-Demolition: Repo State

```
v5 branch
├── .git/
├── .gitignore
├── LICENSE
├── docs/
│   └── STACK_MODERNIZATION.md    ← the blueprint
└── v5-assets/
    ├── branding/
    │   ├── wikiloop-doublecheck-logo.svg
    │   ├── wikiloop-doublecheck-logo.png
    │   ├── wikiloop-logo.svg
    │   ├── wikiloop-logo.png
    │   ├── favicon.ico
    │   └── icon.png
    ├── i18n/
    │   ├── en.yml
    │   ├── fr.yml
    │   └── ... (26 locale files)
    ├── test-fixtures/
    │   ├── mwapi/small/
    │   ├── mwapi/large/
    │   └── wikitrust_feed.json
    └── history/
        ├── CHANGELOG.md
        └── .all-contributorsrc
```

Phase 1 will move `v5-assets/branding/` → `packages/web/public/`, convert `v5-assets/i18n/*.yml` → `packages/core/i18n/*.json`, and reference `v5-assets/test-fixtures/` from integration tests. The `v5-assets/` directory is deleted once everything is relocated.

---

### Phase 0 — Human Unblock (requires project owner, not dev agents)

These are things **only you** can do — provisioning accounts, registering with external services, and proving that access works. Dev agents are blocked until these are confirmed. Each item includes a **smoke test** so you know it actually works.

#### Toolforge Access

| Step | Action | Smoke test |
|------|--------|------------|
| 1 | Create `doublecheck` tool account on Toolforge (`toolforge-admin`) | `ssh doublecheck.toolforge.org` succeeds |
| 2 | Verify ToolsDB credentials exist at `~/replica.my.cnf` | `sql tools` → `SELECT 1;` returns a row |
| 3 | Verify Wikimedia replica access | `sql enwiki` → `SELECT rev_id FROM revision LIMIT 1;` returns a row |
| 4 | Test a Buildpacks deploy with a hello-world Node app | `curl https://doublecheck.toolforge.org/` returns response |

#### MediaWiki OAuth 2.0

| Step | Action | Smoke test |
|------|--------|------------|
| 1 | Register an OAuth 2.0 consumer at `meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration` | Consumer approved, `client_id` + `client_secret` received |
| 2 | Set callback URLs: `https://doublecheck.toolforge.org/auth/callback`, `https://doublecheck.wikiloop.org/auth/callback` | — |
| 3 | Test the token exchange manually | `curl -X POST https://meta.wikimedia.org/w/rest.php/oauth2/access_token -d 'grant_type=authorization_code&...'` returns an access token |

#### MongoDB Atlas (migration only)

| Step | Action | Smoke test |
|------|--------|------------|
| 1 | Create a read-only user on the existing Atlas cluster | `mongosh $MONGO_URI --eval 'db.interactions.countDocuments()'` returns a count |

#### Chrome Web Store

| Step | Action | Smoke test |
|------|--------|------------|
| 1 | Register a Chrome Web Store developer account ($5 fee) | Dashboard accessible at `chrome.google.com/webstore/devconsole` |

#### GitHub Secrets

After the above are provisioned, add these to the repo's GitHub Actions secrets:

- `TOOLSDB_HOST`, `TOOLSDB_USER`, `TOOLSDB_PASSWORD`
- `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`
- `MONGO_URI` (temporary, for migration only)

#### Phase 0 Validation Script

Run `packages/server/scripts/validate-phase0.ts` (created by the Phase 1 agent) to confirm all external access is working. The script can also be run by a dev agent to programmatically verify before starting Phase 2.

```
$ pnpm run validate:phase0

Phase 0 Validation
==================

Toolforge Access
  [✓] SSH to doublecheck.toolforge.org .............. connected
  [✓] ToolsDB query (SELECT 1) ...................... ok
  [✓] Replica query (enwiki revision) ............... rev_id=1234567890
  [✓] HTTPS endpoint reachable ...................... 200 OK

MediaWiki OAuth 2.0
  [✓] OAuth client_id is set ....................... ok
  [✓] OAuth client_secret is set ................... ok
  [✓] Token exchange endpoint reachable ............ 200 OK
  [✓] Test token exchange .......................... access_token received
  [✓] Token → userinfo call ........................ username=DoubleCheckBot

MongoDB Atlas
  [✓] MONGO_URI is set ............................. ok
  [✓] Connection to Atlas cluster .................. connected
  [✓] Read access (interactions count) ............. 48,231 documents
  [✓] Read access (users count) .................... 1,205 documents

Chrome Web Store
  [✓] Developer account registered ................. (manual confirmation)

GitHub Actions Secrets
  [✓] TOOLSDB_HOST is set .......................... ok
  [✓] TOOLSDB_USER is set .......................... ok
  [✓] TOOLSDB_PASSWORD is set ...................... ok
  [✓] OAUTH_CLIENT_ID is set ....................... ok
  [✓] OAUTH_CLIENT_SECRET is set ................... ok
  [✓] MONGO_URI is set ............................. ok

==================
Result: 18/18 passed, 0 failed
Phase 0 is COMPLETE — ready for Phase 1.
```

The script validates:

| Check | What it proves | Failure means |
|-------|---------------|---------------|
| SSH to Toolforge | Tool account exists, SSH key is configured | Tool not created, or SSH key not added to Toolforge |
| ToolsDB SELECT 1 | Database credentials work, ToolsDB is reachable | `replica.my.cnf` missing or credentials wrong |
| Replica revision query | Can read live Wikipedia data from Toolforge | Replica access not granted, or wrong host |
| HTTPS endpoint | Buildpacks deploy pipeline works, ingress routes traffic | Build failed, or tool not webservice-enabled |
| OAuth client_id/secret set | Credentials are available as env vars | Not provisioned or not added to `.env` / secrets |
| Token exchange | OAuth consumer is approved and callback URLs are correct | Consumer pending approval, or wrong callback URL |
| Token → userinfo | Full OAuth round-trip works; token has correct scopes | Insufficient scopes on the consumer registration |
| MongoDB connection + counts | Atlas credentials work, data is readable | Wrong URI, IP allowlist blocking, or user lacks read access |
| GitHub secrets set | CI pipeline will have access to all credentials | Secret not added to repo settings |

**Phase 0 is done when the validation script reports all checks passed.** The Chrome Web Store check is manual (the script prompts for confirmation) since there's no API to verify account registration.

> **Note:** The validation script itself is created during Phase 1 as part of monorepo scaffolding. Before that, use the individual smoke test commands listed in each section above.

### Phase 1 — Foundation (sequential, single agent)

Must complete before parallel work begins. One agent scaffolds the entire monorepo and defines all shared contracts.

#### Monorepo Scaffolding

- pnpm workspace, TypeScript config, ESLint flat config, Prettier
- `docker-compose.yml` for local dev (MariaDB + MediaWiki containers)
- `.env.example` listing every required variable with descriptions
- CI pipeline (GitHub Actions): lint, type-check, unit tests per package, MariaDB service container, Playwright browsers

#### Interface Contracts

These are the boundaries between packages. Defined as TypeScript types/interfaces so all subagents code against the same contract.

| Contract | Location | Defines | Consumers |
|----------|----------|---------|-----------|
| **API schema** | `packages/core/src/types/api.ts` | REST endpoint paths, request/response shapes for every route (judgement CRUD, revision feed, Lift Wing proxy, auth, SSE event types) | server, core API client, all three clients |
| **Domain types** | `packages/core/src/types/models.ts` | `Revision`, `Judgement`, `User`, `Feed`, `LiftWingScore`, `WikiIdentity` (named / temp / anon) | all packages |
| **Component props & events** | `packages/core/src/types/components.ts` | Props interfaces and emitted event payloads for `RevisionCard`, `DiffBox`, `ActionPanel`, `JudgementPanel` | core, web, userscript, extension |
| **Drizzle schema** | `packages/server/src/db/schema.ts` | Table definitions — the single source of truth for database shape | server, migration script |
| **i18n message keys** | `packages/core/i18n/en.json` | Canonical set of translation keys and English strings | all client packages |

> **Rule:** If a subagent needs to change a shared contract, it must update the type file in `packages/core` (or `server/db/schema.ts`) and all subagents must pull the change before continuing.

#### Exit Criteria

- All subagents can `pnpm install`, import shared types, and run `pnpm test` with no errors
- `docker compose up` starts MariaDB + MediaWiki locally
- `drizzle-kit migrate` runs against local MariaDB successfully

### Phase 2 — Parallel Build (6 subagents)

Once Phase 1 is complete, the following workstreams run **concurrently**. Each subagent owns one package and codes against the shared contracts.

```
Phase 1 (Foundation)
        │
        ▼
  ┌─────┼─────┬─────────┬────────────┬──────────────┐
  ▼     ▼     ▼         ▼            ▼              ▼
 [A]   [B]   [C]       [D]          [E]            [F]
Server Core  Web SPA   UserScript   Extension      Migration
                                                   Script
  │     │     │         │            │              │
  ▼     ▼     ▼         ▼            ▼              ▼
  └─────┴─────┴─────────┴────────────┴──────────────┘
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
- **Tests:** all server unit tests, integration tests against MariaDB Docker
- **Dependencies on Phase 1:** Drizzle schema, API type definitions, `.env.example`
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

#### Subagent F — Migration Script

- `packages/server/scripts/migrate-mongo-to-mariadb.ts`
- MongoDB read → transform → MariaDB batch insert
- Validation queries (row counts, spot checks, referential integrity)
- **Tests:** integration test against MongoDB fixture + MariaDB Docker
- **Dependencies on Phase 1:** Drizzle schema only
- **No dependency on other subagents** — runs independently against database containers
- **Requires:** MongoDB Atlas read-only credentials (temporary)

### Phase 3 — Integration & Launch (sequential)

After all subagents complete:

1. **Integration testing**: wire all packages together; run full E2E suite against a staging Toolforge deployment
2. **Run migration script** against production MongoDB → production MariaDB
3. **Deploy to Toolforge Buildpacks** (run `drizzle-kit migrate` as `prestart` or one-off job first)
4. **Submit Chrome Extension** to Chrome Web Store
5. **Publish UserScript** installation instructions to Meta-Wiki
6. **Shut down old Heroku app**
7. **Decommission MongoDB Atlas** after 30-day holding period

### Deployment: Schema Migrations

Drizzle migrations must run **before** the new application code starts serving traffic. On Toolforge:

- Run `drizzle-kit migrate` as a **one-off Toolforge job** (`toolforge jobs run migrate -- node scripts/migrate.js`) prior to deploying the new build
- Alternatively, include the migration as a `prestart` script in `package.json` — Buildpacks execute this before the main process starts
- Migrations must be idempotent (safe to re-run) to handle deployment retries
- For breaking schema changes, coordinate migration + deploy as a pair: run migration, then immediately deploy the matching code

---

## Testing Strategy

### Unit Tests (Vitest)

All packages use Vitest with Vite-native transforms. Target: critical paths covered; no arbitrary coverage percentage mandate.

#### `packages/core` — Component & Composable Tests

Via `@testing-library/vue` — render components, assert DOM output and emitted events.

- **RevisionCard**: renders revision metadata (author, timestamp, wiki); shows loading skeleton while fetching
- **DiffBox**: renders added/removed lines from diff2html output; handles empty diffs gracefully
- **ActionPanel**: emits correct judgement values (`ShouldRevert`, `NotSure`, `LooksGood`) on button click; disables buttons after submission
- **JudgementPanel**: displays community vote tallies; updates reactively when new votes arrive
- **`useRevision()`**: fetches revision data from API client; returns error state on network failure
- **`useJudgement()`**: submits judgement payload; distinguishes verified vs unverified attribution
- **`useLiftWing()`**: parses Lift Wing response into damaging/good-faith scores; handles model unavailability
- **API client**: constructs correct URLs and headers; retries on 5xx; respects abort signals

#### `packages/server` — Handler & Middleware Tests

Mock database layer, test API route logic.

- **Judgement submission**: validates payload shape; rejects missing `wiki`/`rev_id`; stores with correct user attribution
- **Revision feed**: returns paginated results; filters by wiki; respects `since` timestamp parameter
- **Lift Wing proxy**: forwards requests to Lift Wing API; caches scores per revision; returns cached result on repeated requests
- **OAuth 2.0 flow**: exchanges authorization code for token; creates/updates user record; sets session cookie
- **Server-side identity verification**: calls MW API `action=query&meta=userinfo` with forwarded token; rejects mismatched usernames; marks temp account judgements as unverified
- **CORS middleware**: allows requests from `*.wikipedia.org` origins; allows `chrome-extension://` origin; rejects unlisted origins; caches preflight responses
- **SSE endpoint**: sends `:ping` heartbeat every 15s; streams new judgement events; includes `id` field for `Last-Event-ID` resume
- **Rate limiting**: throttles excessive requests per IP/user; returns 429 with `Retry-After` header
- **Health check**: `GET /healthz` returns 200 when MariaDB is connected; returns 503 when connection is lost

#### `packages/userscript` — UserScript-Specific Tests

- **Runtime detection**: correctly identifies ResourceLoader Vue 3 availability; falls back to self-hosted bundle when `mw.loader` cannot resolve `vue`
- **CSP failure handling**: catches blocked script load; logs `[DoubleCheck]` warning; does not inject DOM elements
- **Identity detection**: correctly classifies `mw.user.isNamed()`, `mw.user.isTemp()`, `mw.user.isAnon()` states; extracts `wgUserName` for named and temp accounts; returns `null` for anonymous
- **i18n fallback**: uses `mw.msg()` when available; falls back to `vue-i18n` when `mw.messages` is not loaded

#### `packages/extension` — Extension-Specific Tests

- **Background service worker**: routes API calls from content script; manages OAuth token lifecycle in `chrome.storage.session`; handles SSE connection and forwards events to content script
- **Content script isolation**: injects into Wikipedia pages without interfering with page scripts; cleans up on navigation

### Integration Tests

Run against real services (Docker in CI).

- **Drizzle queries against MariaDB**: CRUD operations on all tables; migration up/down idempotency; verify foreign key constraints
- **API contract tests**: full request/response cycle through Hono handlers against real MariaDB — submit judgement, fetch feed, verify stored data matches
- **Database migration script**: run `migrate-mongo-to-mariadb.ts` against a MongoDB fixture dump; verify row counts match document counts; spot-check `wikiRevId` decomposition into `wiki` + `rev_id`; verify referential integrity across tables
- **Multi-host database access**: connect to ToolsDB and replica hosts separately; verify read-only enforcement on replica connections

### E2E Tests (Playwright)

#### `packages/web` — Web SPA

Playwright tests against a running dev server.

- **OAuth login flow**: redirect to MW OAuth → callback → session established → username displayed
- **Review flow**: load revision → see diff + Lift Wing scores → submit judgement → see updated community tally
- **Feed navigation**: paginate through revision feed; filter by wiki; see risk badges
- **Leaderboard**: displays ranked users; updates after new judgements
- **Landing page SEO**: verify `<title>`, `og:*` meta tags, JSON-LD structured data are present; verify review pages have `noindex`

#### `packages/userscript` — UserScript on MediaWiki

Playwright with a local MediaWiki Docker instance (`mediawiki-docker`).

- **Diff page injection**: navigate to `Special:Diff/*` → DoubleCheck panel appears below diff → Lift Wing scores displayed → vote buttons functional
- **RecentChanges badges**: navigate to `Special:RecentChanges` → risk badges appear on edit rows with correct color coding
- **Watchlist badges**: same as RecentChanges on `Special:Watchlist`
- **Identity detection**: log in as named user → verify `isNamed()` path; browse anonymously → verify `isAnon()` path and read-only mode
- **Vue 3 fallback**: test against a MediaWiki instance without ResourceLoader Vue 3 → verify self-hosted bundle loads and panel renders

#### `packages/extension` — Chrome Extension

Playwright with `--load-extension` flag.

- **Content script injection**: navigate to Wikipedia diff page → review panel appears → vote buttons work
- **Popup**: click extension icon → popup shows leaderboard and settings
- **OAuth flow**: trigger login from popup → `chrome.identity` flow completes → token stored → authenticated API calls succeed
- **CSP isolation**: verify content script does not trigger CSP violations on Wikipedia pages

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
