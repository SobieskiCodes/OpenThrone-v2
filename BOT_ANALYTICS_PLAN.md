# Bot Analytics System — Implementation Plan

> **Goal:** Build a comprehensive bot monitoring and analytics system that uses bots as 24/7 QA agents to balance the game, find bottlenecks, and validate long-term economy scaling.

## Overview

Bots will serve as automated playtesters that reveal:
- Economic balance issues (inflation, stagnation, resource ceilings)
- Strategy effectiveness over time (early vs late game balance)
- Progression bottlenecks (level gates, gold sinks, unit caps)
- Combat win rates and target selection patterns
- Equipment upgrade paths and efficiency
- Long-term "endgame" behavior (months to years)

This system will provide time-series analytics (7 days to 1+ year) with visual dashboards to track bot behavior and compare strategies.

---

## Phase 0: Foundation — Historical Data Tracking

**Goal:** Establish the data layer for long-term bot tracking.

### 0.1 Database Schema

Create `BotSnapshot` table to store daily bot state:

```prisma
model BotSnapshot {
  id                Int      @id @default(autoincrement())
  bot_config_id     Int
  snapshot_date     DateTime @default(now())

  // Economy
  gold              BigInt
  gold_in_bank      BigInt
  attack_turns      Int

  // Stats
  level             Int
  experience        BigInt
  offense           Int
  defense           Int
  spy               Int
  sentry            Int

  // Population
  citizens          Int
  workers           Int
  offense_units     Int
  defense_units     Int
  spy_units         Int
  sentry_units      Int
  total_population  Int

  // Fort
  fort_level        Int
  fort_hp           Int
  fort_max_hp       Int

  // Combat metrics
  attacks_won       Int      // Wins since last snapshot
  attacks_lost      Int      // Losses since last snapshot
  gold_stolen       BigInt   // Gold gained from attacks
  gold_lost         BigInt   // Gold lost from being attacked

  // Equipment counts (by tier)
  weapons_t1        Int
  weapons_t2        Int
  weapons_t3        Int
  armor_t1          Int
  armor_t2          Int
  armor_t3          Int

  // Session metrics
  sessions_run      Int      // Sessions since last snapshot
  actions_performed Int      // Total actions
  actions_failed    Int      // Failed actions

  bot_config        BotConfig @relation(fields: [bot_config_id], references: [id])

  @@map("bot_snapshots")
  @@index([bot_config_id, snapshot_date])
}
```

### 0.2 Snapshot Service

**Location:** `apps/api/src/bot/bot-snapshot.service.ts`

```typescript
@Injectable()
export class BotSnapshotService {
  async captureSnapshot(botConfigId: number): Promise<void>
  async getCaptureHistory(botConfigId: number, days: number): Promise<BotSnapshot[]>
  async getLatestSnapshot(botConfigId: number): Promise<BotSnapshot | null>
}
```

### 0.3 Daily Snapshot Job

**Location:** `apps/api/src/bot/bot-scheduler.service.ts`

Add cron job to capture snapshots:
```typescript
@Cron('0 0 1 * * *') // Daily at 1:00 AM (after daily tick)
async captureDailySnapshots() {
  // For each active bot, capture current state
}
```

### 0.4 Snapshot on Session End

Modify `BotSchedulerService.runSingleBot()` to update snapshot metrics after each session (actions performed, gold changes, combat results).

**Deliverables:**
- ✅ `BotSnapshot` table in Prisma schema
- ✅ `BotSnapshotService` with capture/query methods
- ✅ Daily snapshot cron job
- ✅ Session-end snapshot updates
- ✅ Database migration

---

## Phase 1: Bot Detail Page — Time-Series Charts

**Goal:** Add historical progression charts to the existing bot detail page.

### 1.1 Analytics API Endpoints

**Location:** `apps/api/src/bot/bot.controller.ts`

```typescript
@Get(':id/analytics')
async getBotAnalytics(
  @Param('id') id: string,
  @Query('period') period: '7d' | '30d' | '3m' | '6m' | '1y' | 'all',
) {
  // Returns time-series data for charts
}
```

**Response structure:**
```typescript
{
  snapshots: BotSnapshot[],
  summary: {
    goldGrowthRate: number,      // Gold/day average
    xpGrowthRate: number,         // XP/day average
    avgActionsPerSession: number,
    combatWinRate: number,        // wins / (wins + losses)
    actionSuccessRate: number,    // success / total
  }
}
```

### 1.2 Frontend: Time-Series Charts

**Location:** `apps/web/src/app/(game)/admin/bots/[id]/page.tsx`

Add new tab: **"Analytics"**

**Charts to add:**
1. **Gold Over Time** (line chart)
   - Gold on hand
   - Gold in bank
   - Total wealth

2. **Level & XP Progression** (line chart)
   - Level
   - Experience

3. **Population Growth** (stacked area chart)
   - Citizens
   - Workers
   - Offense units
   - Defense units
   - Spy units
   - Sentry units

4. **Combat Performance** (bar chart)
   - Wins vs losses over time
   - Gold stolen vs gold lost

5. **Action Success Rate** (line chart)
   - % of actions succeeded per session

**Time range selector:**
```tsx
<SegmentedControl
  data={[
    { label: '7D', value: '7d' },
    { label: '30D', value: '30d' },
    { label: '3M', value: '3m' },
    { label: '6M', value: '6m' },
    { label: '1Y', value: '1y' },
    { label: 'All', value: 'all' },
  ]}
/>
```

**Deliverables:**
- ✅ Analytics API endpoint
- ✅ Analytics tab on bot detail page
- ✅ 5 Recharts visualizations
- ✅ Time range selector
- ✅ Summary metrics cards

---

## Phase 2: Equipment Inventory & Efficiency Metrics

**Goal:** Show what equipment bots own and identify resource inefficiencies.

### 2.1 Equipment Inventory Tab

**Location:** `apps/web/src/app/(game)/admin/bots/[id]/page.tsx`

Add **"Equipment"** tab showing:
- Weapons by tier (T1, T2, T3) and usage (OFFENSE, DEFENSE, SPY, SENTRY)
- Armor by tier and usage
- Comparison: units equipped vs units needing equipment
- Suggested upgrades (e.g., "50 offense units with T1 weapons — upgrade to T2?")

### 2.2 Efficiency Score Card

**Location:** Bot detail "Config" tab

Add **"Efficiency Metrics"** card:
```
📊 Efficiency Score: 72/100

✓ Banking gold regularly (85% banked)
⚠ 200 citizens untrained (train more units)
✗ 30 offense units unequipped (buy weapons)
✓ Fort HP maintained above 80%
⚠ Attack win rate: 45% (target weaker players)
```

**Efficiency factors:**
- Banking behavior (gold in bank / total gold ratio)
- Citizen utilization (% of citizens trained)
- Equipment coverage (% of units equipped)
- Fort maintenance (HP % over time)
- Combat target selection (win rate)

### 2.3 API Endpoints

```typescript
@Get(':id/equipment')
async getBotEquipment(@Param('id') id: string)

@Get(':id/efficiency')
async getBotEfficiency(@Param('id') id: string)
```

**Deliverables:**
- ✅ Equipment inventory tab
- ✅ Efficiency score card
- ✅ API endpoints for equipment & efficiency
- ✅ Actionable recommendations

---

## Phase 3: Strategy Comparison Dashboard

**Goal:** Compare all 5 strategies side-by-side to identify balance issues.

### 3.1 Comparison API Endpoint

**Location:** `apps/api/src/bot/bot.controller.ts`

```typescript
@Get('compare')
async compareStrategies(
  @Query('period') period: string,
  @Query('strategies') strategies: string, // comma-separated
) {
  // Returns aggregated metrics for each strategy
}
```

**Response:**
```typescript
{
  WARRIOR: {
    avgGoldPerDay: 15000,
    avgXpPerDay: 500,
    avgLevel: 25,
    combatWinRate: 0.72,
    avgActionsPerSession: 8,
  },
  ECONOMIST: { ... },
  // etc.
}
```

### 3.2 Strategy Comparison Page

**Location:** `apps/web/src/app/(game)/admin/bots/compare/page.tsx`

**Features:**
- Select strategies to compare (default: all 5)
- Time range selector
- Side-by-side stat cards
- Multi-line charts:
  - Gold growth by strategy
  - Level progression by strategy
  - Win rate over time
- Table: "Strategy at a Glance"

| Strategy   | Avg Gold/Day | Avg Level | Win Rate | Actions/Session |
|------------|--------------|-----------|----------|-----------------|
| WARRIOR    | 15,000       | 25        | 72%      | 8               |
| ECONOMIST  | 22,000       | 18        | 35%      | 6               |
| TURTLE     | 12,000       | 20        | 55%      | 7               |
| SPYMASTER  | 14,000       | 22        | 50%      | 9               |
| BALANCED   | 16,000       | 23        | 60%      | 8               |

**Deliverables:**
- ✅ Strategy comparison API endpoint
- ✅ New comparison page in admin
- ✅ Multi-strategy charts
- ✅ At-a-glance stats table
- ✅ Add link to admin nav

---

## Phase 4: Simulation & Fast-Forward

**Goal:** Run bots through simulated sessions to test balance changes quickly.

### 4.1 Fast-Forward Simulator

**Location:** `apps/api/src/bot/bot-simulator.service.ts`

```typescript
@Injectable()
export class BotSimulatorService {
  /**
   * Run N sessions for a bot in fast-forward (no delays, no logs).
   * Returns snapshots after each session for progression visualization.
   */
  async simulate(
    botConfigId: number,
    sessions: number,
  ): Promise<{ snapshots: BotSnapshot[]; summary: any }>
}
```

### 4.2 Simulator API Endpoint

```typescript
@Post(':id/simulate')
async simulateBot(
  @Param('id') id: string,
  @Body() dto: { sessions: number },
) {
  // Runs bot through N sessions
  // Returns progression data
}
```

### 4.3 Frontend: Simulate Modal

**Location:** Bot detail page

Add **"Simulate 10/50/100 Sessions"** button:
- Opens modal with session count input
- Shows loading spinner during simulation
- Displays before/after comparison:
  - Gold: 50,000 → 125,000 (+75k)
  - Level: 10 → 15 (+5)
  - Units trained: 500
  - Actions performed: 47

**Use cases:**
- Test strategy changes before committing
- Preview bot progression
- Validate balance tweaks (e.g., "did my gold nerf break ECONOMIST?")

**Deliverables:**
- ✅ Simulator service (fast-forward mode)
- ✅ Simulate API endpoint
- ✅ Frontend simulate button & modal
- ✅ Before/after comparison view

---

## Phase 5: Advanced Analytics & Insights

**Goal:** AI-powered insights and advanced metrics.

### 5.1 Bottleneck Detection

Analyze snapshots to detect:
- **Gold ceiling:** Bot hits X gold and stops growing (needs better banking/spending)
- **Level plateau:** XP growth stalls (needs more combat/training)
- **Population stagnation:** Not recruiting/training citizens
- **Equipment gap:** Units outpace equipment purchases

**Location:** `apps/api/src/bot/bot-analytics.service.ts`

```typescript
async detectBottlenecks(botConfigId: number): Promise<Bottleneck[]>
```

### 5.2 Strategy Recommendations

Based on bot state, suggest strategy changes:
- "Your WARRIOR bot has low win rate — try switching to TURTLE"
- "ECONOMIST bots are outperforming WARRIOR at your level range"
- "Consider increasing sessions/day — this bot is resource-capped"

### 5.3 Timeline View

**Location:** Bot detail page (new tab)

Visual timeline showing:
- Level-up milestones
- Major purchases (T2 weapon, fort upgrade)
- Combat events (big wins/losses)
- Strategy changes
- Sessions run

Use a horizontal timeline component with event markers.

### 5.4 Export & Reporting

Add "Export to CSV" button to download:
- Raw snapshot data
- Action logs
- Strategy comparison data

**Deliverables:**
- ✅ Bottleneck detection service
- ✅ Strategy recommendation engine
- ✅ Timeline view component
- ✅ CSV export functionality

---

## Phase 6: Global Bot Dashboard

**Goal:** High-level overview of all bots and game economy.

### 6.1 Bot Health Dashboard

**Location:** `apps/web/src/app/(game)/admin/bots/dashboard/page.tsx`

**Metrics:**
- Total bots active
- Total sessions run today/week/month
- Aggregate economy stats:
  - Total gold across all bots
  - Total population
  - Average level
- Strategy distribution (pie chart)
- Top performers (by gold, level, win rate)

### 6.2 Economy Monitor

Track game-wide economic health:
- **Total gold in circulation** (on hand + banked)
- **Gold inflation rate** (gold growth % per day)
- **Gold distribution** (top 10% vs bottom 50%)
- **Turn usage** (are bots running out of attack turns?)

**Alert system:**
- 🚨 "Gold inflation detected — 15% growth/day"
- ⚠️ "ECONOMIST bots control 70% of total gold"
- ✅ "Economy stable — balanced growth"

### 6.3 Global Comparison Charts

Multi-bot charts:
- Gold over time (all bots overlaid)
- Level distribution histogram
- Combat activity heatmap (attacks per hour)
- Strategy adoption trends

**Deliverables:**
- ✅ Global dashboard page
- ✅ Economy health monitoring
- ✅ Alert system for imbalances
- ✅ Multi-bot overlay charts

---

## Implementation Order (Recommended)

| Phase | Effort | Priority | Dependencies |
|-------|--------|----------|--------------|
| **Phase 0** | Medium | **Critical** | None — foundation for all analytics |
| **Phase 1** | Medium | High | Phase 0 |
| **Phase 2** | Low | Medium | Phase 1 |
| **Phase 3** | Medium | High | Phase 0, 1 |
| **Phase 4** | High | Medium | Phase 0 |
| **Phase 5** | High | Low | Phase 0, 1 |
| **Phase 6** | Medium | Low | Phase 0, 1, 3 |

**Suggested sprint plan:**
1. **Sprint 1:** Phase 0 (foundation)
2. **Sprint 2:** Phase 1 (bot detail charts)
3. **Sprint 3:** Phase 2 + Phase 3 (equipment & comparison)
4. **Sprint 4:** Phase 4 (simulation)
5. **Sprint 5:** Phase 5 + 6 (advanced analytics)

---

## Success Metrics

After implementation, we'll be able to answer:
- ✅ Which strategy is most effective at each level range?
- ✅ Does the economy inflate, deflate, or stabilize over time?
- ✅ Where do players hit bottlenecks? (level 20? level 50?)
- ✅ Are bots playing efficiently or wasting resources?
- ✅ What does "endgame" look like after 6+ months?
- ✅ Do combat win rates stay balanced across strategies?
- ✅ Is equipment progression smooth or do bots get stuck?

---

## Future Enhancements

**Post-Phase 6 ideas:**
- **A/B Testing:** Run two identical bots with different strategies and compare
- **Machine Learning:** Train a model to predict optimal actions
- **Bot vs Bot Tournaments:** Pit strategies against each other
- **Player vs Bot Benchmarking:** Compare real players to bot progression
- **Scenario Testing:** "What if gold costs increase 20%?" — run simulation
- **Live Dashboard:** Real-time WebSocket updates during bot sessions
- **Community Insights:** Public-facing bot stats for player research

---

## Technical Notes

### Performance Considerations
- Snapshots are write-heavy (daily for all bots) — index `bot_config_id` + `snapshot_date`
- Analytics queries span weeks/months — consider materialized views or caching
- Fast-forward simulation can be CPU-intensive — run async with job queue

### Data Retention
- Keep snapshots forever (cheap storage, valuable historical data)
- Archive bot action logs after 90 days (high volume, less useful long-term)
- Export snapshots to CSV monthly for external analysis

### Testing Strategy
- Unit tests for snapshot capture logic
- Integration tests for analytics queries
- Seed test data with 30 days of fake snapshots
- Load test: 100 bots × 365 snapshots = 36,500 rows (should be fast)

---

## Conclusion

This bot analytics system transforms bots from simple NPCs into a sophisticated game balance testing framework. By tracking long-term progression and comparing strategies, we can:
- Identify and fix economic imbalances before real players hit them
- Validate that all strategies remain viable at every progression stage
- Ensure the game remains engaging for months/years (not just days/weeks)
- Catch bugs and exploits through unusual bot behavior patterns

**The bots become our 24/7 QA team, constantly stress-testing the game's economy and balance.**
