# WikiLoop DoubleCheck Newsletter — How-To Guide

## Overview

This documents how the v5 newsletter (March 2026) was created and delivered to all project subscribers on English Wikipedia.

## Prerequisites

- **Wikipedia bot password** stored in `~/.env` as `WIKIPEDIA_BOT_PASSWORD` in the format `Username@BotName:Password`
  - Create one at https://en.wikipedia.org/wiki/Special:BotPasswords
  - Required permissions: "Edit existing pages" and "Create, edit, and move pages"
- **Node.js** and **pnpm** installed
- **bottleneck** package (`pnpm add -D bottleneck`)

## Step 1: Draft the newsletter

Create a wikitext file in `docs/` (e.g., `docs/newsletter-2026-03-draft.wikitext`) with the newsletter content. Follow the format of previous newsletters at `Wikipedia:WikiLoop_DoubleCheck/newsletter/`.

Key sections:
- Heading summarizing the release
- Numbered feature highlights
- "How to get started" with install links (web app, userscript, Chrome extension)
- "Get involved" with links to GitHub issues, Discord, leaderboard
- Xinbenlv's signature

## Step 2: Publish the newsletter page on Wikipedia

Use the MediaWiki API with bot credentials to create the page:

```bash
# The send-newsletter.mjs script handles auth, but to create the page manually:
source ~/.env
BOT_USER=$(echo "$WIKIPEDIA_BOT_PASSWORD" | cut -d: -f1)
BOT_PASS=$(echo "$WIKIPEDIA_BOT_PASSWORD" | cut -d: -f2-)

# 1. Get login token
# 2. Login with bot password
# 3. Get CSRF token
# 4. POST to action=edit with title=Wikipedia:WikiLoop_DoubleCheck/newsletter/YYYY-MM
```

The page URL pattern: `Wikipedia:WikiLoop_DoubleCheck/newsletter/YYYY-MM`

## Step 3: Deliver to subscribers

The subscriber list comes from the "Contributors Signup" section of `Wikipedia:WikiLoop_DoubleCheck`. The delivery script posts a short notice to each subscriber's talk page with a link to the full newsletter.

```bash
node scripts/send-newsletter.mjs
```

The script (`scripts/send-newsletter.mjs`):
- Logs in via the MediaWiki API using bot credentials from `~/.env`
- Appends a newsletter notice section to each subscriber's `User talk:` page
- Rate-limited to **1 edit per second** using Bottleneck (respects Wikipedia's edit rate guidelines)
- Marks edits with the `bot` flag
- Reports success/failure for each delivery

## Step 4: Verify

Check a few subscriber talk pages to confirm delivery, e.g.:
- https://en.wikipedia.org/wiki/User_talk:Fuzheado
- https://en.wikipedia.org/wiki/User_talk:Bluerasberry

## Updating the subscriber list

When new users sign up at `Wikipedia:WikiLoop_DoubleCheck#Contributors_Signup`, add their username to the `SUBSCRIBERS` array in `scripts/send-newsletter.mjs`.

## History

| Newsletter | Page | Subscribers | Date |
|-----------|------|-------------|------|
| 2019-12 | [newsletter/2019-12](https://en.wikipedia.org/wiki/Wikipedia:WikiLoop_DoubleCheck/newsletter/2019-12) | 13 (manual pings) | 2019-12-09 |
| 2026-03 | [newsletter/2026-03](https://en.wikipedia.org/wiki/Wikipedia:WikiLoop_DoubleCheck/newsletter/2026-03) | 61 (talk page delivery) | 2026-03-27 |
