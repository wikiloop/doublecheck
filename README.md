# WikiLoop DoubleCheck

Community tool for reviewing Wikipedia edits using AI-assisted scoring and human judgement.

**[Start Reviewing](https://doublecheck.wikiloop.org/review)** | **[Wikipedia Project Page](https://en.wikipedia.org/wiki/Wikipedia:WikiLoop_DoubleCheck)** | **[Discord](https://discord.gg/daZXxPB)**

## Install

### UserScript (recommended for Wikipedia editors)

Add this line to your [common.js](https://en.wikipedia.org/wiki/Special:MyPage/common.js):

```js
mw.loader.load('https://wikiloop-doublecheck.toolforge.org/doublecheck.user.js');
```

This integrates DoubleCheck directly into Wikipedia. On diff pages, a floating button opens the full review interface in a modal overlay. On RecentChanges and Watchlist, risk badges appear on each edit. Revert, thank, and warn actions use **your own Wikipedia session**.

Alternatively, install via [Tampermonkey](https://www.tampermonkey.net/) or [Greasemonkey](https://www.greasespot.net/): [doublecheck.user.js](https://wikiloop-doublecheck.toolforge.org/doublecheck.user.js)

### Chrome Extension

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/wikiloop-doublecheck/efpakmfbfkbeoejabnbamnmpbmncippn). Works the same as the userscript.

### Web Application

Visit [doublecheck.wikiloop.org/review](https://doublecheck.wikiloop.org/review) — no installation needed.

## Features

- **Review interface** — Full diff viewer with ML risk scores (LiftWing/ORES damaging and good-faith probabilities)
- **Judgement actions** — Mark revisions as "Should Revert", "Not Sure", or "Looks Good"
- **Direct revert** — Undo edits using your Wikipedia session (vandalism or good-faith revert modes)
- **Warn user** — Post warning templates (levels 1-4 and 4im) to the editor's talk page
- **Thank author** — Send MW thanks notifications for good edits
- **Risk badges** — Colored risk indicators on Special:RecentChanges and Special:Watchlist
- **Real-time feed** — Live stream from Wikimedia EventStreams, ranked by human-review priority
- **Keyboard shortcuts** — R (revert), G (looks good), N (not sure + skip), Arrow keys (prev/next)
- **Leaderboard** — [doublecheck.wikiloop.org/leaderboard](https://doublecheck.wikiloop.org/leaderboard)

## How it works

When using the userscript or Chrome extension on Wikipedia:

1. Visit a diff page (e.g., `Special:Diff/12345`) or Special:RecentChanges
2. Click the floating "Review with DoubleCheck" button
3. A modal overlay (80% of page) opens with the full review interface
4. Review the diff, see ML risk scores, and cast your judgement
5. If you judge "Should Revert", directly revert using your own Wikipedia account

## Tech Stack

- **Frontend:** TypeScript, Vue 3, Wikimedia Codex UI
- **Backend:** Node.js, Express, MongoDB
- **ML Scoring:** Wikimedia LiftWing (ORES) + revert-risk prediction via EventStreams
- **Hosted on:** [Toolforge](https://wikiloop-doublecheck.toolforge.org) and [Vercel](https://doublecheck.wikiloop.org)
- **Monorepo:** pnpm workspaces — `packages/web`, `packages/server`, `packages/extension`, `packages/userscript`, `packages/core`

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm dev        # start dev servers
```

## Deploy

```bash
bash scripts/deploy.sh all          # deploy to all targets
bash scripts/deploy.sh vercel       # deploy web app only
bash scripts/deploy.sh toolforge    # deploy to Toolforge only
bash scripts/deploy.sh extension    # build Chrome extension zip
```

## License

[Apache-2.0](LICENSE)
