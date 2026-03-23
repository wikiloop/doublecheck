# WikiLoop DoubleCheck — Testing Strategy

Detailed test cases for Phase 2 implementation. Summary in `STACK_MODERNIZATION.md`.

---

## Unit Tests (Vitest)

All packages use Vitest with Vite-native transforms. Target: critical paths covered; no arbitrary coverage percentage mandate.

### `packages/core` — Component & Composable Tests

Via `@testing-library/vue` — render components, assert DOM output and emitted events.

- **RevisionCard**: renders revision metadata (author, timestamp, wiki); shows loading skeleton while fetching
- **DiffBox**: renders added/removed lines from diff2html output; handles empty diffs gracefully
- **ActionPanel**: emits correct judgement values (`ShouldRevert`, `NotSure`, `LooksGood`) on button click; disables buttons after submission
- **JudgementPanel**: displays community vote tallies; updates reactively when new votes arrive
- **`useRevision()`**: fetches revision data from API client; returns error state on network failure
- **`useJudgement()`**: submits judgement payload; distinguishes verified vs unverified attribution
- **`useLiftWing()`**: parses Lift Wing response into damaging/good-faith scores; handles model unavailability
- **API client**: constructs correct URLs and headers; retries on 5xx; respects abort signals

### `packages/server` — Handler & Middleware Tests

Mock database layer, test API route logic.

- **Judgement submission**: validates payload shape; rejects missing `wiki`/`rev_id`; stores with correct user attribution
- **Revision feed**: returns paginated results; filters by wiki; respects `since` timestamp parameter
- **Lift Wing proxy**: forwards requests to Lift Wing API; caches scores per revision; returns cached result on repeated requests
- **OAuth 2.0 flow**: exchanges authorization code for token; creates/updates user record; sets session cookie
- **Server-side identity verification**: calls MW API `action=query&meta=userinfo` with forwarded token; rejects mismatched usernames; marks temp account judgements as unverified
- **CORS middleware**: allows requests from `*.wikipedia.org` origins; allows `chrome-extension://` origin; rejects unlisted origins; caches preflight responses
- **SSE endpoint**: sends `:ping` heartbeat every 15s; streams new judgement events; includes `id` field for `Last-Event-ID` resume
- **Rate limiting**: throttles excessive requests per IP/user; returns 429 with `Retry-After` header
- **Health check**: `GET /healthz` returns 200 when MongoDB is connected; returns 503 when connection is lost

### `packages/userscript` — UserScript-Specific Tests

- **Runtime detection**: correctly identifies ResourceLoader Vue 3 availability; falls back to self-hosted bundle when `mw.loader` cannot resolve `vue`
- **CSP failure handling**: catches blocked script load; logs `[DoubleCheck]` warning; does not inject DOM elements
- **Identity detection**: correctly classifies `mw.user.isNamed()`, `mw.user.isTemp()`, `mw.user.isAnon()` states; extracts `wgUserName` for named and temp accounts; returns `null` for anonymous
- **i18n fallback**: uses `mw.msg()` when available; falls back to `vue-i18n` when `mw.messages` is not loaded

### `packages/extension` — Extension-Specific Tests

- **Background service worker**: routes API calls from content script; manages OAuth token lifecycle in `chrome.storage.session`; handles SSE connection and forwards events to content script
- **Content script isolation**: injects into Wikipedia pages without interfering with page scripts; cleans up on navigation

---

## Integration Tests

Run against real services (Docker in CI).

- **Mongoose queries against MongoDB**: CRUD operations on all collections; verify indexes are created
- **API contract tests**: full request/response cycle through Hono handlers against real MongoDB — submit judgement, fetch feed, verify stored data matches
- **Purge cron job**: verify transient collections are purged correctly while preserving interactions and user data

---

## E2E Tests (Playwright)

### `packages/web` — Web SPA

Playwright tests against a running dev server.

- **OAuth login flow**: redirect to MW OAuth → callback → session established → username displayed
- **Review flow**: load revision → see diff + Lift Wing scores → submit judgement → see updated community tally
- **Feed navigation**: paginate through revision feed; filter by wiki; see risk badges
- **Leaderboard**: displays ranked users; updates after new judgements
- **Landing page SEO**: verify `<title>`, `og:*` meta tags, JSON-LD structured data are present; verify review pages have `noindex`

### `packages/userscript` — UserScript on MediaWiki

Playwright with a local MediaWiki Docker instance (`mediawiki-docker`).

- **Diff page injection**: navigate to `Special:Diff/*` → DoubleCheck panel appears below diff → Lift Wing scores displayed → vote buttons functional
- **RecentChanges badges**: navigate to `Special:RecentChanges` → risk badges appear on edit rows with correct color coding
- **Watchlist badges**: same as RecentChanges on `Special:Watchlist`
- **Identity detection**: log in as named user → verify `isNamed()` path; browse anonymously → verify `isAnon()` path and read-only mode
- **Vue 3 fallback**: test against a MediaWiki instance without ResourceLoader Vue 3 → verify self-hosted bundle loads and panel renders

### `packages/extension` — Chrome Extension

Playwright with `--load-extension` flag.

- **Content script injection**: navigate to Wikipedia diff page → review panel appears → vote buttons work
- **Popup**: click extension icon → popup shows leaderboard and settings
- **OAuth flow**: trigger login from popup → `chrome.identity` flow completes → token stored → authenticated API calls succeed
- **CSP isolation**: verify content script does not trigger CSP violations on Wikipedia pages

---

## CI Pipeline (GitHub Actions)

- Lint + type-check (all packages, fast)
- Unit tests (all packages, parallel)
- Integration tests (server, requires MongoDB service container)
- E2E tests (web + userscript + extension, requires browser install step)
- Run on: push to main, all PRs
