# MarketPulse — Change Intelligence Platform

Track what changed in the market since you last checked. Not just prices — meaningful changes.

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Technology Stack](#technology-stack)
4. [Data Flow](#data-flow)
5. [Core Concepts](#core-concepts)
6. [API Design](#api-design)
7. [Database Schema](#database-schema)
8. [Change Detection Engine](#change-detection-engine)
9. [Caching Strategy](#caching-strategy)
10. [Step-by-Step Implementation Guide](#step-by-step-implementation-guide)
11. [Design Decisions & Tradeoffs](#design-decisions--tradeoffs)
12. [Scaling Considerations](#scaling-considerations)
13. [Setup & Run](#setup--run)

---

## System Overview

MarketPulse is a **stock watchlist application** that helps users track meaningful changes in stock prices. The core value proposition:

1. **Create and manage watchlists** — Group stocks you care about
2. **View latest market information** — Real-time prices from Yahoo Finance
3. **Return later and see what changed** — Compare current prices to when you last viewed

### The Problem We Solve

Most stock apps show you current prices. But if you check back days later, you don't know:
- What changed since you were last here?
- Which stocks need your attention?
- What caused the change (price move, volume spike, 52-week milestone)?

MarketPulse answers these questions by:
- Storing a **price snapshot** every time you view your watchlist
- Comparing current prices to that snapshot
- Scoring each stock's "attention level" based on price moves, volume spikes, and 52-week signals

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Dashboard │  │  Watchlists │  │    Search   │            │
│  │  (view)     │  │  (manage)   │  │  (add stock)│            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP requests
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js API Routes                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ GET /api/watchlists                                     │   │
│  │   └─ Returns user's watchlists with stock counts       │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ GET /api/watchlists/[id]/summary                       │   │
│  │   ├─ Fetch current quotes (Yahoo Finance)              │   │
│  │   ├─ Get price snapshots from DB (if available)        │   │
│  │   ├─ Calculate change since last view                  │   │
│  │   ├─ Score attention (price + volume + 52w signals)   │   │
│  │   └─ Return sorted summary with severity              │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ POST /api/watchlists/[id]/mark-seen                   │   │
│  │   ├─ Store price snapshot for each stock              │   │
│  │   ├─ Update lastViewedAt timestamp                    │   │
│  │   └─ Invalidate summary cache                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ POST /api/watchlists/[id]/stocks                      │   │
│  │   └─ Add stock to watchlist + invalidate cache        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────┐          ┌─────────────────────┐
│    PostgreSQL       │          │       Redis         │
│  ┌───────────────┐  │          │  ┌───────────────┐  │
│  │ users         │  │          │  │ stock:quote:  │  │
│  │ watchlists    │  │          │  │ AAPL          │  │
│  │ watchlist_    │  │          │  │ (60s TTL)     │  │
│  │ stocks        │  │          │  └───────────────┘  │
│  │ price_snap-   │  │          │  ┌───────────────┐  │
│  │ shots         │  │          │  │ summary:      │  │
│  └───────────────┘  │          │  │ watchlist:... │  │
│                     │          │  │ (30s TTL)     │  │
└─────────────────────┘          │  └───────────────┘  │
                                └─────────────────────┘
                                      ▲
                                      │
                              ┌─────────────────┐
                              │  Yahoo Finance  │
                              │  (free API)     │
                              └─────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS | UI rendering, client-side interactivity |
| **Backend** | Next.js API Routes | Server-side API handlers |
| **Database** | PostgreSQL | Persistent storage for users, watchlists, price snapshots |
| **ORM** | Prisma | Type-safe database queries |
| **Cache** | Redis (optional) | Speed up repeated queries (stock quotes, summaries) |
| **Auth** | NextAuth.js (Credentials provider) | Email/password authentication |
| **External API** | Yahoo Finance (unofficial) | Real-time stock prices and chart data |
| **Language** | TypeScript | Type safety across the stack |

### Why These Choices?

- **Next.js**: Full-stack framework; API routes + frontend in one project
- **PostgreSQL**: Reliable, ACID-compliant; perfect for user data + price history
- **Prisma**: Type safety; auto-generated client from schema; easy migrations
- **Redis**: Optional caching layer; app works without it (graceful degradation)
- **Yahoo Finance**: Free, no API key needed; sufficient for demo/hackathon
- **NextAuth**: Battle-tested auth; easy to add OAuth providers later

---

## Data Flow

### User Journey: First Time Login

```
1. User registers/logs in
   └─ POST /api/auth/register or NextAuth signin
   └─ Creates user in PostgreSQL

2. User lands on /dashboard
   └─ Frontend calls GET /api/watchlists
   └─ Returns user's watchlists (with stock counts)
   └─ Sets first watchlist as "active"

3. Dashboard fetches summary for active watchlist
   └─ GET /api/watchlists/[id]/summary
   └─ Fetches current prices from Yahoo Finance
   └─ Checks Redis cache (30s TTL)
   └─ If no cache: calculates attention scores
   └─ Returns summary with stocks sorted by attention

4. User views dashboard
   └─ POST /api/watchlists/[id]/mark-seen
   └─ Stores price snapshot for each stock in DB
   └─ Updates lastViewedAt timestamp
   └─ Invalidates summary cache (forces fresh data next time)
```

### User Journey: Return After Days

```
1. User logs in and opens /dashboard
   └─ Same as step 2 above

2. Dashboard fetches summary
   └─ GET /api/watchlists/[id]/summary
   └─ Fetches current prices from Yahoo Finance
   └─ Finds price snapshots from last view (stored in DB)
   └─ Calculates: "change since last view" for each stock
   └─ Scores attention based on that change

3. User sees:
   - "Since Your Last Visit" section
   - Stocks sorted by attention (most changed first)
   - Price changes shown with daily change in parentheses
   - Severity badges: 🔴 Needs Attention, 🟡 Worth a Look, 🟢 Quiet
```

### User Journey: Add Stock to Watchlist

```
1. User clicks "Add Stock" on watchlist card (or goes to /search)
   └─ Modal opens (from dashboard) or search page

2. User searches for stock
   └─ GET /api/stocks/search?q=apple
   └─ Returns matching stocks from local list

3. User clicks "+ Add"
   └─ POST /api/watchlists/[id]/stocks
   └─ Adds stock to watchlist_stocks table
   └─ Invalidates summary cache (so new stock appears immediately)

4. UI updates
   └─ Dashboard re-fetches watchlists (stock count updates)
   └─ Dashboard re-fetches summary (new stock appears with price)
```

---

## Core Concepts

### 1. Watchlist

A collection of stocks a user wants to track.

**Fields:**
- `id`: Unique identifier (CUID)
- `userId`: Owner of the watchlist
- `name`: User-defined name (e.g., "Tech Stocks", "My Watchlist")
- `lastViewedAt`: Timestamp of when user last viewed this watchlist
- `createdAt`, `updatedAt`: Audit timestamps

### 2. WatchlistStock

A stock in a watchlist.

**Fields:**
- `id`: Unique identifier
- `watchlistId`: Parent watchlist
- `symbol`: Stock ticker (e.g., "AAPL")
- `sortOrder`: Display order in the watchlist
- `addedAt`: When added

**Unique constraint:** `(watchlistId, symbol)` — same stock can't be in same watchlist twice

### 3. WatchlistStockPriceSnapshot ⭐ (Key Innovation)

A snapshot of a stock's price when the user last viewed their watchlist.

**Fields:**
- `id`: Unique identifier
- `watchlistStockId`: Which stock in which watchlist
- `price`: Price at time of viewing
- `change`: Daily % change at that time (for context)
- `volume`: Trading volume at that time
- `snapshotAt`: When this snapshot was taken

**Why this matters:**
Without this, we can only show "daily change" (vs previous close). With this, we can show **"change since you last viewed"** — the core value proposition.

### 4. Attention Scoring

How we decide if a stock needs attention:

| Signal | Threshold | Score |
|--------|-----------|-------|
| Price move | ≥5% | 3 pts |
| Price move | ≥2% | 2 pts |
| Price move | ≥1% | 1 pt |
| Volume spike | ≥3× avg | 3 pts |
| Volume spike | ≥2× avg | 2 pts |
| Near 52W high/low | <1% away | 2 pts |
| Multi-signal (3+) | — | +2 bonus |

**Severity:**
- **High (≥6 points):** Needs attention 🔴
- **Medium (≥3 points):** Worth a look 🟡
- **Low (<3 points):** Quiet 🟢

### 5. Caching Strategy

| Layer | What | TTL | Purpose |
|-------|------|-----|---------|
| Redis | Stock quote (`stock:quote:{symbol}`) | 60s | Avoid repeated Yahoo Finance calls |
| Redis | Watchlist summary (`watchlist:summary:{userId}:{id}`) | 30s | Avoid recomputing attention scores |
| — | Price snapshots (PostgreSQL) | Permanent | Enable cross-session change detection |

**Cache invalidation:**
- When stock is added/removed → invalidate summary cache
- When user marks watchlist as seen → invalidate summary cache
- Cache expires naturally after TTL

---

## API Design

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account (name, email, password) |
| POST | `/api/auth/[...nextauth]` | NextAuth handlers (signin, signout, session) |

### Watchlists

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/watchlists` | List user's watchlists (with stock counts) |
| POST | `/api/watchlists` | Create new watchlist |
| DELETE | `/api/watchlists/[id]` | Delete watchlist |
| PATCH | `/api/watchlists/[id]` | Rename watchlist |

### Watchlist Stocks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/watchlists/[id]/stocks` | Add stock to watchlist |
| DELETE | `/api/watchlists/[id]/stocks?symbol=AAPL` | Remove stock from watchlist |
| GET | `/api/watchlists/[id]/summary` | Get attention-scored summary with price changes |

### User Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/watchlists/[id]/mark-seen` | Record that user viewed this watchlist (stores price snapshots) |

### Stock Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stocks/search?q=apple` | Search stocks by symbol/name |
| GET | `/api/stocks/[symbol]` | Get stock detail with attention scoring |
| GET | `/api/stocks/[symbol]/chart?range=1m` | Get chart data for a stock |

---

## Database Schema

```
┌─────────────────────────────────────────────────────────────────┐
│                           users                                  │
│  id        │ email (unique) │ name │ password_hash │ created_at │
│  ─────────────────────────────────────────────────────────────  │
│  cuid()    │ user@example   │ Riya │ bcrypt hash    │ now()      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ 1:N
┌─────────────────────────────────────────────────────────────────┐
│                        watchlists                               │
│  id        │ user_id │ name      │ last_viewed_at │ created_at │
│  ─────────────────────────────────────────────────────────────  │
│  default   │ user id │ My Watch  │ 2026-09-05...  │ now()      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ 1:N
┌─────────────────────────────────────────────────────────────────┐
│                      watchlist_stocks                           │
│  id          │ watchlist_id │ symbol │ sort_order │ added_at   │
│  ─────────────────────────────────────────────────────────────  │
│  abc123      │ default       │ AAPL   │ 0          │ now()      │
│  def456      │ default       │ NVDA   │ 1          │ now()      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ 1:N
┌─────────────────────────────────────────────────────────────────┐
│              watchlist_stock_price_snapshots ⭐                │
│  id                │ watchlist_stock_id │ price │ snapshot_at  │
│  ─────────────────────────────────────────────────────────────  │
│  snap001           │ abc123             │ 319.97│ 2026-09-... │
│  snap002           │ abc123             │ 325.00│ 2026-09-... │
└─────────────────────────────────────────────────────────────────┘
```

**Key indexes:**
- `users.email` — unique, for login lookup
- `watchlists.user_id` — for fetching user's watchlists
- `watchlist_stocks.watchlist_id` — for fetching watchlist's stocks
- `watchlist_stocks.watchlist_id symbol` — unique, prevents duplicates
- `watchlist_stock_price_snapshots.watchlist_stock_id snapshot_at` — for finding last snapshot

---

## Change Detection Engine

### How It Works (Step-by-Step)

**File:** `src/lib/change-engine.ts`

```
1. Fetch current stock quote from Yahoo Finance
   └─ Returns: { symbol, price, change (daily %), volume, avgVolume, high52w, low52w, ... }

2. Look up price snapshot from database
   └─ If watchlist.lastViewedAt exists AND we have a snapshot:
   └─ Use snapshot.price as "price then"
   └─ Else: fall back to daily change as approximation

3. Calculate change since last view
   └─ changeSinceLastView = ((currentPrice - priceThen) / priceThen) * 100

4. Score the stock for attention
   ├─ Price change scoring:
   │   ├─ |change| >= 5% → 3 points (high)
   │   ├─ |change| >= 2% → 2 points (medium)
   │   ├─ |change| >= 1% → 1 point (low)
   │   └─ else → 0 points
   │
   ├─ Volume spike scoring:
   │   ├─ volume/avgVolume >= 3 → 3 points
   │   ├─ volume/avgVolume >= 2 → 2 points
   │   └─ else → 0 points
   │
   ├─ 52-week range signals:
   │   ├─ Within 1% of 52W high → 2 points
   │   ├─ Within 5% of 52W high → 1 point
   │   ├─ Within 1% of 52W low → 2 points
   │   └─ else → 0 points
   │
   └─ Multi-signal bonus:
       ├─ 3+ signals fired → +2 points
       └─ 2 signals fired → +1 point

5. Determine severity
   ├─ score >= 6 → "high" (needs attention)
   ├─ score >= 3 → "medium" (worth a look)
   └─ score < 3 → "low" (quiet)

6. Build description
   └─ Combines signal labels into human-readable string
   └─ Example: "Price moved -5.9%, multiple signals changed together"

7. Return AttentionResult
   └─ { symbol, name, price, changeSinceLastView, attentionScore, severity, signals[], description, ... }
```

### Code Walkthrough

**`calculateChangeSinceLastView()` function:**
```typescript
export function calculateChangeSinceLastView(
  currentPrice: number,
  lastViewedAt: Date,
  dailyChangePercent: number,
  previousClose: number
): ChangeSinceLastView | null {
  const now = new Date();
  const hoursSinceView = (now.getTime() - lastViewedAt.getTime()) / (1000 * 60 * 60);

  // If viewed within last hour, use previous close as proxy for "price then"
  // (We don't have historical snapshots yet in this fallback case)
  if (hoursSinceView < 1) {
    const estimatedPriceThen = previousClose;
    if (estimatedPriceThen <= 0) return null;

    const changeSince = ((currentPrice - estimatedPriceThen) / estimatedPriceThen) * 100;
    return {
      symbol: "",
      priceThen: estimatedPriceThen,
      priceNow: currentPrice,
      changeSinceLastView: Math.round(changeSince * 100) / 100,
      changeAbsSinceLastView: Math.round((currentPrice - estimatedPriceThen) * 100) / 100,
      direction: changeSince > 0.5 ? "up" : changeSince < -0.5 ? "down" : "flat",
      significant: Math.abs(changeSince) >= 1,
    };
  }

  // For longer periods, fall back to daily change
  const changeSince = dailyChangePercent;
  return { ... };
}
```

**`calculateAttention()` function:**
```typescript
export function calculateAttention(
  quote: StockQuote,
  changeSinceLastView: ChangeSinceLastView | null = null
): AttentionResult {
  const signals: Signal[] = [];
  let score = 0;

  // Use change since last view if available, otherwise daily change
  const effectiveChange = changeSinceLastView?.changeSinceLastView ?? quote.change;

  // 1. Price change scoring
  const priceResult = scorePriceChange(effectiveChange);
  score += priceResult.score;
  signals.push(...priceResult.signals);

  // 2. Volume scoring
  const volumeResult = scoreVolume(quote.volume, quote.avgVolume);
  score += volumeResult.score;
  signals.push(...volumeResult.signals);

  // 3. 52-week range signals
  const weekSignals = score52WeekHigh(quote.price, quote.high52w, quote.low52w);
  for (const sig of weekSignals) {
    if (sig.severity === "high") score += 2;
    else if (sig.severity === "medium") score += 1;
  }
  signals.push(...weekSignals);

  // 4. Multi-signal bonus
  if (signals.length >= 3) {
    score += 2;
    signals.push({ type: "MULTI_SIGNAL", severity: "high", label: "Multiple signals changed together" });
  } else if (signals.length === 2) {
    score += 1;
  }

  // Determine severity
  let severity: Severity;
  if (score >= 6) severity = "high";
  else if (score >= 3) severity = "medium";
  else severity = "low";

  return {
    symbol: quote.symbol,
    name: quote.name,
    price: quote.price,
    change: quote.change,              // Daily change (for context)
    changeSinceLastView: changeSinceLastView?.changeSinceLastView ?? 0,
    attentionScore: score,
    severity,
    signals,
    description: buildDescription(signals, effectiveChange),
    volumeRatio: volumeResult.ratio,
    near52wHigh: quote.high52w > 0 && ((quote.high52w - quote.price) / quote.high52w) * 100 < 5,
    near52wLow: quote.low52w > 0 && ((quote.price - quote.low52w) / quote.low52w) * 100 < 5,
    status: quote.status,
    fetchedAt: quote.fetchedAt,
  };
}
```

---

## Caching Strategy

### Why Cache?

1. **Yahoo Finance rate limits** — We don't want to fetch the same stock repeatedly
2. **Summary computation is expensive** — Fetching 10 stocks, scoring each, sorting = work
3. **Multiple users may view same watchlist** — Cache avoids redundant work

### Cache Layers

**Layer 1: Stock Quote Cache (Redis)**
```
Key: stock:quote:{symbol}
Value: { symbol, name, price, change, volume, ... }
TTL: 60 seconds
```

**When we fetch:** Check Redis first. If cached and <60s old, return it. Else fetch from Yahoo Finance and cache.

**Layer 2: Summary Cache (Redis)**
```
Key: watchlist:summary:{userId}:{watchlistId}
Value: { stocks: [...], attentionCount, mediumCount, unchangedCount, ... }
TTL: 30 seconds
```

**When we fetch:** Check Redis first. If cached and <30s old, return it. Else compute and cache.

**Layer 3: Price Snapshots (PostgreSQL)**
```
Not cached — permanent storage.
```

**Why no TTL?** We need these forever (or until user removes the stock). They're the source of truth for "change since last view."

### Cache Invalidation

```typescript
// When stock is added to watchlist
await cacheDelPattern(`watchlist:summary:${session.user.id}:${id}*`);

// When user marks watchlist as seen
await cacheDelPattern(`watchlist:summary:${session.user.id}:${id}*`);

// Pattern deletion ensures we clear all summary cache variants
```

---

## Step-by-Step Implementation Guide

### Phase 1: Infrastructure Setup

**Step 1: Install PostgreSQL**
```bash
# macOS (Homebrew)
brew install postgresql@14
brew services start postgresql@14

# Create database
createdb marketpulse
```

**Step 2: Install Redis (optional but recommended)**
```bash
brew install redis
brew services start redis
```

**Step 3: Configure environment**
```bash
# Create .env.local
DATABASE_URL="postgresql://username@localhost:5432/marketpulse"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
```

**Step 4: Run database migrations**
```bash
npx prisma migrate dev
```

**Step 5: Seed demo data (optional)**
```bash
npx tsx prisma/seed.ts
# Creates: demo@marketpulse.com / demo123
# With watchlist containing: AAPL, NVDA, MSFT, GOOGL, TSLA, AMZN, META, NFLX
```

### Phase 2: Core Backend

**Step 6: Implement Prisma schema**
- `User` model for auth
- `Watchlist` model for user's collections
- `WatchlistStock` model for stocks in watchlists
- `WatchlistStockPriceSnapshot` model for price history

**Step 7: Implement market data layer** (`src/lib/market-data.ts`)
- `fetchQuote(symbol)` — Fetch from Yahoo Finance with Redis caching
- `fetchChartData(symbol, range)` — Fetch chart data
- `fetchMultipleQuotes(symbols)` — Batch fetch with Promise.allSettled
- `searchStocks(query)` — Local search over popular stocks list

**Step 8: Implement change detection engine** (`src/lib/change-engine.ts`)
- `calculateChangeSinceLastView()` — Compare current price to snapshot
- `calculateAttention()` — Score stock for attention
- `buildWatchlistSummary()` — Aggregate scores into summary

**Step 9: Implement API routes**
- `GET /api/watchlists` — List user's watchlists
- `GET /api/watchlists/[id]/summary` — Get attention-scored summary
- `POST /api/watchlists/[id]/mark-seen` — Store price snapshots
- `POST /api/watchlists/[id]/stocks` — Add stock
- `DELETE /api/watchlists/[id]/stocks?symbol=AAPL` — Remove stock

### Phase 3: Frontend

**Step 10: Implement authentication pages**
- `src/app/(auth)/login/page.tsx` — Login form
- `src/app/(auth)/register/page.tsx` — Registration form

**Step 11: Implement dashboard** (`src/app/(dashboard)/dashboard/page.tsx`)
- Fetch watchlists on load
- Fetch summary for active watchlist
- Call `mark-seen` when dashboard loads
- Handle "View" button from watchlists page (via sessionStorage)

**Step 12: Implement watchlist card** (`src/components/dashboard/watchlist-card.tsx`)
- Show stock count
- Show stock list if active/visible
- "Add Stock" button opens modal
- "View" state (expanded vs collapsed)

**Step 13: Implement add stock modal** (`src/components/dashboard/add-stock-modal.tsx`)
- Search input with debounced API call
- Results list with "+ Add" buttons
- Success/error feedback

**Step 14: Implement stock rows** (`src/components/dashboard/stock-row.tsx`)
- Show symbol, name
- Show price
- Show change (prioritize "change since last view" over daily change)
- Show severity indicator
- Link to stock detail page

**Step 15: Implement attention summary** (`src/components/dashboard/attention-summary.tsx`)
- Show stats: attention count, medium count, unchanged count
- Show "Needs Attention" list (high severity)
- Show "Worth a Look" list (medium severity)
- Show "All quiet" message if no changes

### Phase 4: Polish & Testing

**Step 16: Handle edge cases**
- Empty watchlists → Show "No stocks yet" message
- Failed stock fetch → Show "—" for price, status indicator
- Stale data → Show warning indicator
- Multiple watchlists → Only active one shows stock list

**Step 17: Test the complete flow**
1. Register/login
2. View dashboard → prices load
3. Add stock via modal → appears immediately
4. Refresh page → "change since last view" shows
5. Add multiple stocks → all appear with prices
6. Create second watchlist → switch between them

---

## Design Decisions & Tradeoffs

### Decision 1: What counts as a "meaningful change"?

**Choice:** Scoring system based on price change %, volume spike, and 52-week signals.

**Why:** Simple, interpretable, tunable. Users understand "price moved 5%" or "unusual volume."

**Tradeoff:** Doesn't capture news events, earnings, or sector movement. Would need news API integration for that.

### Decision 2: How to track change since last view?

**Choice:** Store price snapshot in PostgreSQL when user views watchlist (`mark-seen` API).

**Why:** Accurate, works across sessions and devices (database-backed), simple to implement.

**Tradeoff:** Adds write load (one DB insert per stock per view). For 20-stock watchlist viewed 10 times/day = 200 writes/day. Negligible for hackathon scale.

**Alternative considered:** Store only `lastViewedAt` timestamp and approximate using daily change. Less accurate, doesn't work if user views outside market hours.

### Decision 3: How to handle data staleness?

**Choice:** Redis caching with TTL + status field (fresh/stale/error) in UI.

**Why:** Yahoo Finance can be slow or return errors. Caching makes app feel fast. Status field gives users transparency.

**Tradeoff:** 60s cache means price might be up to 60s old. Acceptable for a watchlist app (not day trading).

### Decision 4: How to scale for more users?

**Choice:** Keep it simple for now — PostgreSQL + Redis, no sharding, no microservices.

**Why:** Hackathon scope. PostgreSQL handles thousands of users fine with proper indexing. Redis cache reduces load.

**Tradeoff:** Won't scale to millions of users without changes. Would need:
- Read replicas for PostgreSQL
- More aggressive caching
- Rate limiting on API
- Proper API key for Yahoo Finance (or switch to paid API)

### Decision 5: Real-time updates?

**Choice:** No WebSockets. Polling via cache refresh (30s summary cache).

**Why:** Simpler architecture. Stock prices don't need sub-second accuracy for this use case.

**Tradeoff:** Users won't see price changes instantly. 30s delay is acceptable for "check what changed since I was here" use case.

### Decision 6: Search functionality?

**Choice:** Static list of 50 popular stocks. No external search API.

**Why:** No API key needed, fast, covers most common stocks users will search for.

**Tradeoff:** Can't search for obscure stocks. Would need to integrate a search API (e.g., Yahoo Finance search, Alpha Vantage) for full coverage.

### Decision 7: Authentication?

**Choice:** NextAuth with credentials provider (email/password).

**Why:** Simple, self-contained, no external dependencies.

**Tradeoff:** No OAuth (Google, GitHub login). Would be easy to add later via NextAuth providers.

---

## Scaling Considerations

### Current Limits

| Component | Limit | How to Overcome |
|-----------|-------|-----------------|
| Yahoo Finance API | No documented limits; may block aggressive fetching | Add rate limiting, proxy layer, or switch to paid API |
| Redis cache | Memory limited | Use LRU eviction (Redis default), increase memory |
| PostgreSQL | Handles thousands of users with indexes | Add read replicas, connection pooling for more |
| Watchlist size | No limit, but fetching 50+ stocks simultaneously may hit rate limits | Pagination, batch fetching with delays |
| Price snapshots | Grows with each view | Archive old snapshots, keep only last N per stock |

### Future Enhancements (Not in Scope)

1. **News integration** — Show news articles alongside price changes
2. **Multiple data sources** — Alpha Vantage, Polygon, etc. for redundancy
3. **WebSocket updates** — Real-time price streaming (overkill for this use case)
4. **Push notifications** — Alert user when watched stock hits threshold
5. **Portfolio tracking** — Track shares owned, P&L
6. **Social features** — Share watchlists, follow other users
7. **Advanced screening** — Filter stocks by criteria (PE ratio, dividend yield, etc.)

---

## Setup & Run

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+ (optional)

### Quick Start

```bash
# 1. Navigate to project
cd marketwatch

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL, REDIS_URL, etc.

# 4. Run migrations
npx prisma migrate deploy

# 5. Seed demo data (optional)
npx tsx prisma/seed.ts

# 6. Start development server
npm run dev

# 7. Open browser
http://localhost:3000
```

### Demo Credentials

After seeding:
- **Email:** `demo@marketpulse.com`
- **Password:** `demo123`

### Project Structure

```
marketwatch/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed.ts                # Demo data seeder
│   └── migrations/            # Database migrations
├── src/
│   ├── app/                   # Next.js app directory
│   │   ├── (auth)/            # Auth pages (login, register)
│   │   ├── (dashboard)/       # Dashboard pages
│   │   │   ├── dashboard/     # Main dashboard
│   │   │   ├── watchlists/    # Watchlist management
│   │   │   └── search/        # Stock search & add
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Auth handlers
│   │   │   ├── stocks/        # Stock data endpoints
│   │   │   └── watchlists/    # Watchlist endpoints
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Home page (redirects to dashboard)
│   ├── components/            # React components
│   │   ├── dashboard/         # Dashboard-specific components
│   │   ├── layout/            # Sidebar, header
│   │   └── stock/             # Stock chart component
│   ├── lib/                   # Utility libraries
│   │   ├── auth.ts            # NextAuth config
│   │   ├── change-engine.ts   # Attention scoring logic
│   │   ├── market-data.ts     # Yahoo Finance fetcher
│   │   ├── prisma.ts          # Prisma client
│   │   ├── redis.ts           # Redis cache helpers
│   │   └── utils.ts           # Format helpers, cn() utility
│   └── types/                 # TypeScript type definitions
├── .env.local                 # Environment variables (create this)
├── package.json
└── README.md                  # This file
```

---

## Deployment Guide

### Option 1: Deploy to Vercel (Recommended, Free)

Vercel is the easiest way to deploy Next.js apps. It handles SSR, API routes, and is optimized for this stack.

#### Prerequisites

- GitHub account (free)
- Vercel account (free, sign in with GitHub)
- PostgreSQL database (can use Vercel Postgres, Neon, Supabase, or any PostgreSQL provider)

#### Step 1: Prepare Your Repository

1. Push your code to GitHub
```bash
cd marketwatch
git init
git add .
git commit -m "Initial commit"
# Create a repo on GitHub and push
git remote add origin https://github.com/yourusername/marketpulse.git
git push -u origin main
```

2. Ensure `.env.local` is in `.gitignore` (it should be by default)

#### Step 2: Create a PostgreSQL Database

**Option A: Vercel Postgres (Easiest)**
```bash
# In your Vercel project, add the Postgres addon
# Or use the CLI:
vmc addons create postgres
```

**Option B: Neon (Free tier, serverless)**
1. Go to https://neon.tech
2. Create a new project
3. Copy the connection string

**Option C: Supabase (Free tier)**
1. Go to https://supabase.com
2. Create a new project
3. Copy the connection string from Settings → Database

**Option D: Render PostgreSQL (Free tier)**
1. Go to https://render.com
2. Create a new PostgreSQL database
3. Copy the internal connection string

#### Step 3: Deploy to Vercel

**Via Dashboard:**
1. Go to https://vercel.com
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Next.js

**Via CLI:**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd marketwatch
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (your account)
# - Link to existing project? No
# - Project name? marketpulse
# - Directory? . (or marketwatch if in subdirectory)
```

#### Step 4: Configure Environment Variables

In Vercel dashboard → Project Settings → Environment Variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | Your PostgreSQL connection string | Database connection |
| `REDIS_URL` | Your Redis connection string (optional) | Caching layer |
| `NEXTAUTH_SECRET` | Generate with: `openssl rand -base64 32` | NextAuth encryption |
| `NEXTAUTH_URL` | Your Vercel URL (e.g., `https://marketpulse.vercel.app`) | Auth callbacks |

**Important:** Set these for **Production** environment (not just Preview).

#### Step 5: Run Database Migrations

After first deployment:

**Via Vercel Dashboard:**
1. Go to your project
2. Open the deployed URL
3. Vercel will run `prisma migrate deploy` automatically if configured

**Or via CLI:**
```bash
# Set DATABASE_URL in your environment temporarily
vercel env add DATABASE_URL

# Run migration
vercel run --prod "npx prisma migrate deploy"
```

**Or via a deploy script (recommended):**
Create `api/health/route.ts` or use `POST /api/deploy/migrate` to trigger migrations on deploy.

#### Step 6: Seed the Database (Optional)

```bash
# Via Vercel CLI
vercel run --prod "npx tsx prisma/seed.ts"

# Or create a one-time API route that seeds
# Then visit that URL once after deployment
```

#### Step 7: Verify Deployment

1. Open your Vercel URL (e.g., `https://marketpulse.vercel.app`)
2. You should see the login page
3. Login with demo credentials (if seeded) or create a new account
4. Add stocks and verify everything works

---

### Option 2: Deploy to Render (Free Tier)

Render provides web services + PostgreSQL + Redis in one place.

#### Step 1: Create PostgreSQL Database
1. Go to https://render.com
2. Click "New" → "PostgreSQL"
3. Choose free tier
4. Copy the connection string

#### Step 2: Create Web Service
1. Click "New" → "Web Service"
2. Connect your GitHub repo
3. Configure:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment Variables:** Add DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
4. Deploy

#### Step 3: Run Migrations
```bash
# Use Render's shell access or deploy hook
psql -h your-db-host -U postgres -d marketpulse -c "\dt"
# Then run migrations
npx prisma migrate deploy
```

---

### Option 3: Deploy to Railway (Simple)

#### Step 1: Create Database
1. Go to https://railway.app
2. Create a new PostgreSQL service
3. Copy the connection URL

#### Step 2: Deploy App
1. Create a new service from GitHub repo
2. Add environment variables
3. Deploy

---

### Deployment Checklist

Before deploying, ensure:

- [ ] `.env.local` is **NOT** committed to git (check `.gitignore`)
- [ ] All environment variables are set in production
- [ ] `NEXTAUTH_URL` matches your production domain
- [ ] `DATABASE_URL` points to your production database
- [ ] Database migrations are run (`prisma migrate deploy`)
- [ ] Database is seeded (optional, for demo)
- [ ] Build passes locally (`npm run build`)
- [ ] Test the deployed app end-to-end

---

### Troubleshooting Deployment

**Issue: Build fails with Prisma errors**
```bash
# Ensure Prisma is generating correctly
npm install
npx prisma generate
npm run build
```

**Issue: Database connection fails**
- Check that `DATABASE_URL` is correct
- For Vercel/Neon/Supabase: ensure the connection string includes SSL
- Example: `postgresql://user:pass@host:port/db?sslmode=require`

**Issue: NextAuth errors**
- Ensure `NEXTAUTH_SECRET` is set and is at least 32 characters
- Ensure `NEXTAUTH_URL` matches your deployment URL exactly

**Issue: API routes return 500 errors**
- Check Vercel logs (Dashboard → Functions → Logs)
- Verify database is accessible from the deployment environment
- Check Redis connection (if using)

---

### Post-Deployment: Production Best Practices

1. **Set up proper error monitoring** (Sentry, LogRocket, or Vercel Analytics)
2. **Configure custom domain** (in Vercel/Render dashboard)
3. **Set up automated backups** for your database
4. **Monitor rate limits** on Yahoo Finance API
5. **Consider a paid stock API** for production (Yahoo Finance is unofficial)
6. **Add rate limiting** to API routes to prevent abuse

---

## Summary

MarketPulse is a **change intelligence platform** for stock watchlists. The key innovations:

1. **Price snapshots** — Store price when user views, enable accurate "change since last view"
2. **Attention scoring** — Combine price moves, volume spikes, and 52-week signals into severity levels
3. **Persistent across sessions** — PostgreSQL-backed snapshots work across devices and sessions
4. **Simple but functional** — Free APIs, optional Redis, no complex infrastructure

The system is designed to be **hackathon-ready**: functional, demonstrable, with clear extension points for future enhancements.
