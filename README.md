# WikiLoop DoubleCheck

<p align="center">
  <a href="https://doublecheck.wikiloop.org">
    <img src="docs/wikiloop-doublecheck-logo.svg" alt="WikiLoop DoubleCheck" height="100">
  </a>
</p>

<p align="center">
  <strong>Community tool for reviewing Wikipedia edits using AI-assisted scoring and human judgement.</strong>
</p>

<p align="center">
  <a href="https://doublecheck.wikiloop.org/review">Start Reviewing</a> &middot;
  <a href="https://en.wikipedia.org/wiki/Wikipedia:WikiLoop_DoubleCheck">Install UserScript</a> &middot;
  <a href="https://chromewebstore.google.com/detail/wikiloop-doublecheck/efpakmfbfkbeoejabnbamnmpbmncippn">Chrome Extension</a> &middot;
  <a href="https://discord.gg/daZXxPB">Discord</a>
</p>

---

> **v5 is live!** WikiLoop DoubleCheck has been rebuilt from the ground up with a modern TypeScript/Vue 3 stack, native Wikipedia integration via UserScript, and real-time Wikimedia EventStreams feed. Active deployment resumed March 2026.

## History

WikiLoop DoubleCheck (originally **WikiLoop Battlefield**) was created in 2019 at Google as [`google/wikiloop-doublecheck`](https://github.com/google/wikiloop-doublecheck), an open-source, crowd-sourced counter-vandalism tool for Wikipedia. It was presented at Wikimania 2019 and gained support from dozens of Wikipedia editors and researchers.

Since the author left Google, the project has moved to **[github.com/wikiloop](https://github.com/wikiloop)** and is now maintained **100% through community contributions**. The v5 rewrite modernizes the entire stack while preserving the original mission: making it easy for anyone to help protect Wikipedia.

**Help wanted and welcome** — whether you're a developer, Wikipedia editor, or researcher, we'd love your involvement. See [Contributing](#contributing) below.

**[Start Reviewing](https://doublecheck.wikiloop.org/review)** | **[Install UserScript](https://en.wikipedia.org/wiki/Wikipedia:WikiLoop_DoubleCheck)** | **[Chrome Extension](https://chromewebstore.google.com/detail/wikiloop-doublecheck/efpakmfbfkbeoejabnbamnmpbmncippn)** | **[Wikipedia Project Page](https://en.wikipedia.org/wiki/Wikipedia:WikiLoop_DoubleCheck)** | **[Discord](https://discord.gg/daZXxPB)**

![Review flow demo](docs/review-demo.gif)

## What's New in v5

- **Native Wikipedia UserScript** — runs directly on every Wikipedia page with a "DoubleCheck" tab (like Twinkle). Uses MediaWiki's built-in Vue 3 + Codex from ResourceLoader (zero extra download).
- **Real-time review feed** — live stream from Wikimedia EventStreams with AI-ranked priority scoring. Reviews edits most likely to be damaging first.
- **Direct revert/warn/thank** — actions use your own Wikipedia session via the MediaWiki API. Reverts appear under your account.
- **Article history mode** — on article history pages, review the last 5 revisions of that article before switching to the global feed.
- **Cross-wiki support** — install once from Meta-Wiki, works on all Wikimedia wikis (English, French, Japanese, etc.).
- **Shared component architecture** — web app, userscript, and extension all share UI components from `@doublecheck/core`.

## Install

### UserScript (recommended)

Visit **[Wikipedia:WikiLoop DoubleCheck](https://en.wikipedia.org/wiki/Wikipedia:WikiLoop_DoubleCheck)** and click **"Install DoubleCheck"**. One click — done.

The userscript adds a "DoubleCheck" tab to every Wikipedia page. Click it to open the review modal with the full review interface, diff viewer, ML risk scores, and action buttons — without leaving the page.

### Chrome Extension

Install from the **[Chrome Web Store](https://chromewebstore.google.com/detail/wikiloop-doublecheck/efpakmfbfkbeoejabnbamnmpbmncippn)**.

### Web Application

Visit **[doublecheck.wikiloop.org/review](https://doublecheck.wikiloop.org/review)** — no installation needed.

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

## How It Works

1. A "**DoubleCheck**" tab appears on every Wikipedia page
2. Click it to open the review modal — edits stream in from Wikimedia EventStreams, ranked by AI risk score
3. Review the diff, see ML scores, and judge: **Should Revert**, **Not Sure**, or **Looks Good**
4. If vandalism: **directly revert** with one click (uses your Wikipedia account)
5. After reverting: **warn the editor** with standard warning templates
6. If good edit: **thank the author** via MW Thanks

## Architecture

```
@doublecheck/core        Shared Vue 3 components, composables, API client, types
@doublecheck/web         Web SPA (Vite + Vue 3 + Codex) → Vercel + Toolforge
@doublecheck/server      Express API + MongoDB → Toolforge
@doublecheck/userscript  Wikipedia UserScript (Vue via ResourceLoader) → Toolforge
@doublecheck/extension   Chrome Extension (Manifest V3) → Chrome Web Store
```

- **Frontend:** TypeScript, Vue 3, Wikimedia Codex UI
- **Backend:** Node.js, Hono, MongoDB
- **ML Scoring:** Wikimedia LiftWing (ORES) + revert-risk prediction via EventStreams
- **Hosted on:** [Toolforge](https://wikiloop-doublecheck.toolforge.org) and [Vercel](https://doublecheck.wikiloop.org)

## Development

```bash
pnpm install
pnpm build
pnpm test           # 180+ tests across all packages
pnpm dev            # start dev servers
```

## Deploy

```bash
bash scripts/deploy.sh all          # deploy to all targets
bash scripts/deploy.sh vercel       # web app → Vercel
bash scripts/deploy.sh toolforge    # server + userscript → Toolforge
bash scripts/deploy.sh extension    # Chrome extension → CWS
```

## Contributors

Thanks to all the wonderful people who have contributed to WikiLoop DoubleCheck since its inception at Google in 2019:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="http://keybase.io/xinbenlv"><img src="https://avatars2.githubusercontent.com/u/640325?v=4" width="80px;" alt=""/><br /><sub><b>xinbenlv</b></sub></a><br />💻📖🤔📆</td>
    <td align="center"><a href="https://epicfaace.github.io/"><img src="https://avatars2.githubusercontent.com/u/1689183?v=4" width="80px;" alt=""/><br /><sub><b>Ashwin Ramaswami</b></sub></a><br />🚇💻</td>
    <td align="center"><a href="https://github.com/hrasyid"><img src="https://avatars0.githubusercontent.com/u/4159519?v=4" width="80px;" alt=""/><br /><sub><b>Hamdanil Rasyid</b></sub></a><br />🌍💻🐛</td>
    <td align="center"><a href="https://aligoren.com"><img src="https://avatars0.githubusercontent.com/u/4205423?v=4" width="80px;" alt=""/><br /><sub><b>Ali GOREN</b></sub></a><br />🌍🐛💻</td>
    <td align="center"><a href="https://github.com/ElanHR"><img src="https://avatars3.githubusercontent.com/u/573697?v=4" width="80px;" alt=""/><br /><sub><b>Elan</b></sub></a><br />🐛</td>
    <td align="center"><a href="https://github.com/ChaoyueFred"><img src="https://avatars1.githubusercontent.com/u/14314482?v=4" width="80px;" alt=""/><br /><sub><b>ChaoyueFred</b></sub></a><br />📹</td>
  </tr>
  <tr>
    <td align="center"><a href="http://simia.net"><img src="https://avatars0.githubusercontent.com/u/663648?v=4" width="80px;" alt=""/><br /><sub><b>Denny Vrandecic</b></sub></a><br />🐛</td>
    <td align="center"><a href="https://wisn.github.io/"><img src="https://avatars1.githubusercontent.com/u/8147926?v=4" width="80px;" alt=""/><br /><sub><b>Wisnu Adi Nurcahyo</b></sub></a><br />🐛</td>
    <td align="center"><a href="https://curimit.com/blog"><img src="https://avatars0.githubusercontent.com/u/1249753?v=4" width="80px;" alt=""/><br /><sub><b>curimit</b></sub></a><br />🐛</td>
    <td align="center"><a href="http://www.andrew-g-west.com"><img src="https://avatars0.githubusercontent.com/u/1369929?v=4" width="80px;" alt=""/><br /><sub><b>Andrew G. West</b></sub></a><br />💬🔧</td>
    <td align="center"><a href="https://florian-koerner.com"><img src="https://avatars0.githubusercontent.com/u/647303?v=4" width="80px;" alt=""/><br /><sub><b>Florian Korner</b></sub></a><br />💻</td>
    <td align="center"><a href="https://github.com/dz-s"><img src="https://avatars2.githubusercontent.com/u/27350480?v=4" width="80px;" alt=""/><br /><sub><b>dz_s</b></sub></a><br />💻</td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/ExtremoBlando"><img src="https://avatars3.githubusercontent.com/u/18313773?v=4" width="80px;" alt=""/><br /><sub><b>ExtremoBlando</b></sub></a><br />🐛</td>
    <td align="center"><a href="http://aiz.miga.lv"><img src="https://avatars1.githubusercontent.com/u/1764614?v=4" width="80px;" alt=""/><br /><sub><b>Martins Brunenieks</b></sub></a><br />🌍</td>
    <td align="center"><a href="https://bhavyakaria.github.io/"><img src="https://avatars3.githubusercontent.com/u/16178833?v=4" width="80px;" alt=""/><br /><sub><b>Bhavya Karia</b></sub></a><br />🌍</td>
    <td align="center"><a href="https://github.com/fmobus"><img src="https://avatars0.githubusercontent.com/u/396521?v=4" width="80px;" alt=""/><br /><sub><b>Felipe Mobus</b></sub></a><br />🌍</td>
  </tr>
</table>
<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

**Translation volunteers:** @tzuhsiao (ZH), @MT-Wizard & @adehtiarov (UK), @alex-martelli (IT), @apatronl & @fmobus (ES), @fmobus & @he7d3r & Ted Hardie (PT), @luisfors-g & @renamoo (JA), Andrei Goriachev (RU)

## Contributing

We welcome contributions of all kinds! See the **[Wikipedia:WikiLoop DoubleCheck](https://en.wikipedia.org/wiki/Wikipedia:WikiLoop_DoubleCheck)** project page for editor signup, or jump straight into the code:

- [Open issues](https://github.com/wikiloop/doublecheck/issues) — bug reports and feature requests
- [Good first issues](https://github.com/wikiloop/doublecheck/labels/good%20first%20issue) — great for new contributors
- Translations — help us reach more languages

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification.

## License

[Apache-2.0](LICENSE)
