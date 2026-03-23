# WikiLoop DoubleCheck — Architecture

A crowdsourced Wikipedia vandalism detection and review platform. Users review recent edits and provide judgements (**LooksGood**, **NotSure**, **ShouldRevert**), powered by ORES machine learning scores and real-time collaboration via Socket.IO.

**Production:** doublecheck.wikiloop.org
**Stack:** Nuxt.js 2 (Vue 2) + Express + MongoDB + Socket.IO

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                            │
│  Nuxt.js 2 SSR → Vue 2 + Vuex + Bootstrap-Vue + Socket.IO Client  │
└──────────────┬──────────────────────────────────┬───────────────────┘
               │ HTTP (REST)                      │ WebSocket
               ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       Express Server (index.ts)                      │
│                                                                      │
│  ┌────────────┐  ┌──────────────┐  ┌───────────┐  ┌──────────────┐ │
│  │ Nuxt SSR   │  │ API Router   │  │ Socket.IO │  │  Passport    │ │
│  │ Renderer   │  │ /api/*       │  │  Server   │  │  OAuth 1.0a  │ │
│  └────────────┘  └──────┬───────┘  └─────┬─────┘  └──────────────┘ │
│                         │                 │                          │
│  ┌──────────────────────┴─────────────────┴───────────────────────┐ │
│  │                    Shared Models & Utilities                    │ │
│  │              shared/models/  shared/interfaces.ts               │ │
│  └────────────────────────────┬───────────────────────────────────┘ │
└───────────────────────────────┼──────────────────────────────────────┘
                                │
               ┌────────────────┼────────────────┐
               ▼                ▼                ▼
        ┌───────────┐   ┌───────────┐   ┌───────────────┐
        │  MongoDB   │   │ MediaWiki │   │ ORES / STiki  │
        │ (primary)  │   │ API+OAuth │   │ WikiTrust     │
        └───────────┘   └───────────┘   └───────────────┘
```

---

## Directory Structure

```
doublecheck/
├── pages/                # Nuxt routes (auto-routed)
│   ├── index.vue         #   / — main review page
│   ├── feed2.vue         #   /feed2 — new feed view
│   ├── feed/_feed.vue    #   /feed/:feed — dynamic feed
│   ├── revision/_wiki/   #   /revision/:wiki/:rev — detail
│   ├── leaderboard.vue   #   /leaderboard
│   ├── history.vue       #   /history
│   ├── active.vue        #   /active
│   └── chart.vue         #   /chart
│
├── layouts/
│   ├── default.vue       # Navbar + content shell
│   └── empty.vue         # Minimal (no nav)
│
├── components/
│   ├── RevisionCard.vue  # Core review card (31KB)
│   ├── DiffBox.vue       # Diff HTML renderer
│   ├── ActionPanel.vue   # Judgement buttons
│   ├── JudgementPanel.vue
│   ├── PureFeed2.vue     # Feed2 display
│   ├── UserAvatar.vue    # DiceBear avatar
│   └── TimeSeriesBarChart.vue
│
├── store/                # Vuex modules
│   ├── index.js          #   flags, version, wiki
│   ├── user.js           #   profile, preferences
│   ├── revisions.js      #   legacy feed (heap queue)
│   └── feed2.js          #   new feed queue + cache
│
├── plugins/
│   ├── axios.js          # HTTP client config
│   ├── socket.io.js      # Real-time client
│   └── timeago.js        # Relative timestamps
│
├── server/
│   ├── index.ts          # Entry point: Express + Nuxt + Socket.IO + crons
│   ├── common.ts         # Logging, middleware, helpers
│   ├── routers/api/      # All REST endpoints
│   │   ├── feed.ts       #   /api/feed/*
│   │   ├── interaction.ts#   /api/interaction/*
│   │   ├── revision.ts   #   /api/revision/*
│   │   ├── diff.ts       #   /api/diff/*
│   │   ├── ores.ts       #   /api/ores
│   │   ├── leaderboard.ts#   /api/leaderboard
│   │   └── ...
│   ├── feed/             # Feed engines (population, watchers)
│   └── ingest/           # ORES stream ingestion
│
├── shared/
│   ├── models/           # Mongoose schemas
│   │   ├── interaction-item.model.ts
│   │   ├── feed-revision.model.ts
│   │   ├── decision-log.model.ts
│   │   └── ...
│   ├── interfaces.ts     # Shared TS types
│   ├── mwapi.ts          # MediaWiki API client
│   └── utility-shared.ts # wikiRevId parsing, URL helpers
│
├── cronjobs/
│   ├── purge-collections.cron.ts   # Daily DB cleanup (quota)
│   └── award-barnstar.cron.ts      # Award top contributors
│
├── i18n/                 # 25 languages
├── mailer/               # Nodemailer service
├── test/                 # Jest tests
├── nuxt.config.js
├── Procfile              # Heroku: node --max-old-space-size=450
└── eco.yml               # PM2 config
```

---

## Main UI Layouts

### 1. Review Page (`/` — RevisionCard)

The primary screen where users review Wikipedia edits one at a time.

```
┌──────────────────────────────────────────────────────────────────┐
│  WikiLoop™ DoubleCheck    History  Leaderboard  Feeds  [Login]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  [[Article Title]]                        ↗ enwiki:987654  │  │
│  │  ┌──────────┐                                              │  │
│  │  │ lastbad  │  feed badge                                  │  │
│  │  └──────────┘                                              │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  👤 Username                          Edited 2 minutes ago │  │
│  │  ORES Damaging: ████████░░ 78%                             │  │
│  │  ORES Good-faith: ███░░░░░░░ 32%                           │  │
│  │  Summary: "rv vandalism"                                   │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                            │  │
│  │                      Diff Box                              │  │
│  │  ─ old text in red                                         │  │
│  │  + new text in green                                       │  │
│  │                                                            │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                            │  │
│  │   ┌───────────────┐ ┌──────────┐ ┌─────────────┐          │  │
│  │   │ ShouldRevert  │ │ Not Sure │ │  LooksGood  │          │  │
│  │   │     (V)       │ │   (P)    │ │    (G)      │          │  │
│  │   └───────────────┘ └──────────┘ └─────────────┘          │  │
│  │                                                            │  │
│  │           ┌──────────────────────┐                         │  │
│  │           │   ↩ Direct Revert   │  (auth required)        │  │
│  │           └──────────────────────┘                         │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
  Keyboard: V=ShouldRevert  G=LooksGood  P=NotSure  →=Next  R=Revert
```

### 2. Feed View (`/feed/:feed` — PureFeed2)

Queue-based review with claim/release model.

```
┌──────────────────────────────────────────────────────────────────┐
│  WikiLoop™ DoubleCheck    History  Leaderboard  Feeds  [Login]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Feed: [ores ▾]    Wiki: [enwiki ▾]                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  [[Article Title]]                          enwiki:123456  │  │
│  │                                                            │  │
│  │  Author: ExampleUser    ORES: 85% damaging                 │  │
│  │  Summary: "added unsourced claim"                          │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │                    Diff HTML                         │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌───────────────┐ ┌──────────┐ ┌─────────────┐           │  │
│  │  │ ShouldRevert  │ │ Not Sure │ │  LooksGood  │           │  │
│  │  └───────────────┘ └──────────┘ └─────────────┘           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Queue: 47 remaining                                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 3. Leaderboard (`/leaderboard`)

```
┌──────────────────────────────────────────────────────────────────┐
│  WikiLoop™ DoubleCheck    History  Leaderboard  Feeds  [Login]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Leaderboard            Time: [Past 7 days ▾]                   │
│                                                                  │
│  Logged-in Reviewers                                             │
│  ┌──────┬──────────────────────┬───────────────────────────┐    │
│  │ Rank │ User                 │ Reviews                   │    │
│  ├──────┼──────────────────────┼───────────────────────────┤    │
│  │  1   │ 👤 TopReviewer       │ ████████████████████  482 │    │
│  │  2   │ 👤 ActiveEditor      │ ██████████████       337  │    │
│  │  3   │ 👤 PatrolBot         │ ████████████         291  │    │
│  │ ...  │                      │                           │    │
│  └──────┴──────────────────────┴───────────────────────────┘    │
│                                                                  │
│  Anonymous Reviewers                                             │
│  ┌──────┬──────────────────────┬───────────────────────────┐    │
│  │  1   │ 🔵 GA:a8f2...        │ ████████████         295  │    │
│  │  2   │ 🔵 GA:c3d1...        │ █████████            218  │    │
│  └──────┴──────────────────────┴───────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4. History (`/history`)

```
┌──────────────────────────────────────────────────────────────────┐
│  WikiLoop™ DoubleCheck    History  Leaderboard  Feeds  [Login]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Recent Judgements                                               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  enwiki:987654  [[Barack Obama]]                           │  │
│  │  👤 Reviewer1 → ShouldRevert          2 minutes ago        │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  dewiki:123456  [[Berlin]]                                 │  │
│  │  👤 Reviewer2 → LooksGood             5 minutes ago        │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  enwiki:654321  [[COVID-19 pandemic]]                      │  │
│  │  🔵 Anonymous  → NotSure              8 minutes ago        │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  ...                                                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│                    [ Load More ]                                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
  Real-time updates via Socket.IO
```

---

## Data Flow

### Review Cycle

```
Wikipedia Recent Changes
        │
        ▼
┌─────────────────┐     ┌─────────────────┐
│ ORES Streaming  │     │ WikiTrust POST  │
│ (EventSource)   │     │ (webhook)       │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌──────────────────────────────────────────┐
│        FeedRevision Collection           │
│   { feed, wikiRevId, feedRankScore }     │
└──────────────────┬───────────────────────┘
                   │
          GET /api/feed/:feed
                   │
                   ▼
┌──────────────────────────────────────────┐
│           Client (Vuex Store)            │
│  reviewQueue → cache → render            │
└──────────────────┬───────────────────────┘
                   │
          User clicks judgement
                   │
                   ▼
┌──────────────────────────────────────────┐
│   POST /api/interaction/:wikiRevId       │
│   { judgement, userGaId, wikiUserName }  │
└──────────────────┬───────────────────────┘
                   │
         ┌─────────┴──────────┐
         ▼                    ▼
┌────────────────┐  ┌──────────────────┐
│  Interaction   │  │ Socket.IO emit   │
│  (MongoDB)     │  │ → all clients    │
└────────────────┘  └──────────────────┘
```

### Authentication

```
User clicks [Login]
       │
       ▼
GET /auth/mediawiki/login
       │
       ▼
┌─────────────────────────┐
│  Wikipedia OAuth 1.0a   │
│  (user grants access)   │
└────────────┬────────────┘
             │
             ▼
GET /auth/mediawiki/callback
       │
       ├── Create express-session (MongoDB store)
       ├── Store OAuth tokens in session
       └── Redirect → /

Authenticated users can:
  • Perform direct reverts (if rollback rights)
  • Earn Barn Star awards
  • Appear on named leaderboard
```

---

## Core Data Models

### Interaction (judgements)

```
{
  wikiRevId:     "enwiki:987654"     # wiki:revid format
  judgement:     "ShouldRevert"      # LooksGood | NotSure | ShouldRevert
  userGaId:      "GA:xxxxxxxx"      # anonymous identifier
  wikiUserName:  "Username"          # null if not logged in
  feed:          "ores"              # originating feed
  wiki:          "enwiki"
  title:         "Article Name"
  timestamp:     1679529600000
}
```

### FeedRevision (queue items)

```
{
  feed:           "lastbad"
  wikiRevId:      "enwiki:987654"
  wiki:           "enwiki"
  title:          "Article Name"
  feedRankScore:  0.85               # ORES-based priority
  createdAt:      Date
  claimerInfo: {                     # claim/release model
    userGaId, wikiUserName,
    claimedAt, checkedOffAt
  }
}
  UNIQUE INDEX: { feed, wikiRevId }
```

---

## API Endpoints (Key)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/feed/:feed` | Fetch feed queue |
| GET | `/api/revision/:wikiRevId` | Revision metadata |
| GET | `/api/diff/:wikiRevId` | Diff HTML |
| GET/POST | `/api/interaction/:wikiRevId` | Get/submit judgement |
| GET | `/api/ores?wiki=&revIds=` | ORES scores |
| GET | `/api/leaderboard?days=7` | Rankings |
| GET | `/api/recentchanges/list` | Recent changes |
| GET | `/api/stats` | Statistics |
| GET | `/api/healthz` | Health check |
| POST | `/api/decisionLog` | Log decisions |
| GET | `/api/auth/revert/:wikiRevId` | Authenticated revert |

---

## Background Jobs

| Cron | Schedule | Purpose |
|------|----------|---------|
| `purge-collections` | Daily 3am | Delete old data to stay within MongoDB quota |
| `award-barnstar` | Configurable | Award Wikipedia Barn Stars to top contributors |
| `feed-revision` | Every 10 min | Populate feed queues (us2020, covid19) |
| `category-traverse` | Configurable | Walk Wikipedia category trees for topical feeds |

---

## Real-time (Socket.IO)

```
Server emits every 5s:  'metrics-update'  → { activeUsers, reviewCount, ... }
On new judgement:        'interaction-item' → { wikiRevId, judgement, user }

Client emits on connect: 'user-id-info'   → { userGaId, wikiUserName }
```

---

## External Integrations

| Service | Purpose |
|---------|---------|
| **MediaWiki API** | Revision data, recent changes, authenticated reverts |
| **ORES** | ML vandalism scores (damaging, goodfaith) |
| **WikiTrust** | Alternative vandalism detection feed |
| **STiki / ClueBot NG** | Historical vandalism scores (MySQL) |
| **Discord Webhooks** | Moderation team notifications |
| **Google Analytics** | Usage tracking |

---

## Deployment

```
Heroku (Procfile)
  └── node --max-old-space-size=450 server/index.ts
        ├── Express + Nuxt SSR on :3000
        ├── MongoDB Atlas (MONGODB_URI)
        ├── Socket.IO (same port)
        └── Cron jobs (in-process)
```

**Heap limit:** 450MB to prevent OOM on Heroku free tier.
