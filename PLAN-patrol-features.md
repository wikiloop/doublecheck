# Patrol Tool Feature Gap Analysis

Comparison of WikiLoop DoubleCheck against Twinkle, Huggle, and STiki. Evaluated 2026-03-25.

## Feature Checklist

### Completed

- [x] **AGF revert** — "Revert (Good Faith)" button with distinct edit summary using `[[Wikipedia:Assume good faith|good faith]]` wikilink
- [x] **Custom edit summary** — optional reason field appended to revert summaries
- [x] **MW Thanks API** — primary thank via `action=thank` notification + secondary "Thank on Talk Page"
- [x] **Talk page existence check** — "Thank on Talk Page" disabled when user has no talk page
- [x] **Wikilinks in edit summaries** — "good faith", "vandalism", and "WikiLoop DoubleCheck" all wikilinked
- [x] **Warn user after revert** — escalating warning templates (uw-vandalism1 through uw-vandalism4im) posted on vandal's talk page after revert, with level selector UI
- [x] **Escalating warning level detection** — auto-reads user talk page, detects current month's highest warning level, suggests next level
- [x] **Article tagging** — maintenance templates (Unreferenced, Refimprove, POV, Cleanup, Original research, Notability) with checkbox UI and `prependtext` API
- [x] **Score/topic queue filtering** — min ORES damage score threshold + IP editors only toggle on the ranked feed
- [x] **Auto-patrol on judgement** — `action=patrol` fires automatically (fire-and-forget) when a logged-in user submits any judgement

### Not yet implemented

- [ ] **Report user to admins (WP:AIV)** — after Level 4 warning, offer to file report at `Wikipedia:Administrator intervention against vandalism`. Requires composing a structured report with diffs + warning history. Medium effort.
- [ ] **User reputation/whitelist** — track revert/approve ratios per editor in MongoDB, auto-deprioritize trusted editors. High effort, needs schema design + background aggregation.
