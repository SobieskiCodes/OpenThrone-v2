# Bot Analytics System — Implementation Plan

> **Goal:** Build a comprehensive bot monitoring and analytics system that uses bots as 24/7 QA agents to balance the game, find bottlenecks, and validate long-term economy scaling.

## 📊 Current Progress

| Phase | Status | Commit |
|-------|--------|--------|
| **Phase 0: Foundation** | ✅ Complete | 8a740ed, 8086fb5 |
| **Phase 1: Time-Series Charts** | ✅ Complete | 8a740ed |
| **Phase 2: Equipment & Efficiency** | ⏳ Not Started | - |
| **Phase 3: Strategy Comparison** | ✅ Complete | 8a740ed |
| **Phase 4: Simulation** | ✅ Complete | 8a740ed |
| **Phase 5: Advanced Analytics** | ⏳ Not Started | - |
| **Phase 6: Global Dashboard** | 🟡 Partial | 8a740ed |
| **Phase 7: AI-Powered Optimization** | ⏳ Not Started | - |

**Overall: 4/7 phases complete, 1 partial**

### What's Working Now

✅ **You can:**
- Generate 100 bots with `POST /admin/bots/generate`
- Run 6-month simulation: `POST /admin/bots/simulation/start` with `{days: 180, sessionsPerDay: 5}`
- View global analytics at `/admin/bots/dashboard` with time range filters
- See individual bot progression charts at `/admin/bots/:id` (Analytics tab)
- Compare strategies side-by-side on dashboard
- Track top performers by gold and level
- Stop running simulations with UI button
- Use all search features on both SQLite (dev) and PostgreSQL (prod)

### Recent Fixes (8626420)
- ✅ Database-agnostic search queries (SQLite + PostgreSQL compatible)
- ✅ Fixed hydration errors on battle page
- ✅ Proper level calculation using `getLevelForXP()` throughout system

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

**Status: ✅ COMPLETE**
- Implemented in commits 8a740ed, 8086fb5
- Snapshot service includes optional date parameter for simulation support
- Uses `getLevelForXP()` for accurate level calculation (not rank field)

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

**Status: ✅ COMPLETE**
- Implemented in commit 8a740ed
- Endpoint: `GET /admin/bots/:id/analytics?period=7d|30d|3m|6m|1y|all`
- Charts include gold, level/XP, population, combat, and action success
- Summary metrics: gold/XP growth rates, avg actions/session, win rate, success rate

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
- [ ] Equipment inventory tab
- [ ] Efficiency score card
- [ ] API endpoints for equipment & efficiency
- [ ] Actionable recommendations

**Status: ⏳ NOT STARTED**

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

**Status: ✅ COMPLETE**
- Implemented in commit 8a740ed
- Endpoint: `GET /admin/bots/analytics/global?period=7d|30d|3m|6m|1y|all`
- Page: `apps/web/src/app/(game)/admin/bots/dashboard/page.tsx`
- Shows top 10 bots by gold, strategy comparison with aggregated metrics
- Auto-refreshes every 5 seconds during simulation
- Includes summary (total bots, gold, population) and top performers by gold/level

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

**Status: ✅ COMPLETE**
- Implemented in commit 8a740ed
- Service: `BotSimulationService` in `apps/api/src/bot/bot-simulation.service.ts`
- Endpoints:
  - `POST /admin/bots/simulation/start` - Start simulation with configurable days & sessions/day
  - `GET /admin/bots/simulation/status` - Check simulation progress
  - `POST /admin/bots/simulation/cancel` - Stop running simulation
- Frontend: Simulation modal with progress tracking, persistent banner during run
- Supports proper date progression for time-series analytics (simulated dates span historical range)

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
- [ ] Bottleneck detection service
- [ ] Strategy recommendation engine
- [ ] Timeline view component
- [ ] CSV export functionality

**Status: ⏳ NOT STARTED**

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
- [ ] Economy health monitoring
- [ ] Alert system for imbalances
- [ ] Multi-bot overlay charts

**Status: 🟡 PARTIALLY COMPLETE**
- Basic global dashboard implemented (shows top 10, strategy comparison, summary stats)
- Still needed: Economy health alerts, inflation tracking, multi-bot overlay charts

---

## Implementation Order (Recommended)

| Phase | Effort | Priority | Dependencies | Status |
|-------|--------|----------|--------------|--------|
| **Phase 0** | Medium | **Critical** | None — foundation for all analytics | ✅ Complete |
| **Phase 1** | Medium | High | Phase 0 | ✅ Complete |
| **Phase 2** | Low | Medium | Phase 1 | ⏳ Not Started |
| **Phase 3** | Medium | High | Phase 0, 1 | ✅ Complete |
| **Phase 4** | High | Medium | Phase 0 | ✅ Complete |
| **Phase 5** | High | Low | Phase 0, 1 | ⏳ Not Started |
| **Phase 6** | Medium | Low | Phase 0, 1, 3 | 🟡 Partial |
| **Phase 7** | **Very High** | **High** | Phase 0, 1, 3, 4 | ⏳ Not Started |

**Actual sprint progress:**
1. ✅ **Sprint 1:** Phase 0 (foundation) — Snapshot system with date progression support
2. ✅ **Sprint 2:** Phase 1 (bot detail charts) — Time-series analytics with Recharts
3. ✅ **Sprint 3:** Phase 3 + 4 (comparison & simulation) — Global dashboard + fast-forward sim
4. ⏳ **Sprint 4:** Phase 2 (equipment & efficiency)
5. ⏳ **Sprint 5:** Phase 5 + 6 completion (advanced analytics + economy monitoring)
6. ⏳ **Sprint 6:** Phase 7A (agent framework) — CrewAI integration, 5 agents, weekly analysis
7. ⏳ **Sprint 7:** Phase 7B + 7C (AI insights dashboard + experiments) — Admin UI for AI recommendations
8. ⏳ **Sprint 8:** Phase 7D (LLM decision engine) — Internal AI-powered bots

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

## Phase 7: AI-Powered Optimization & Agent Analysis

**Goal:** Use AI agents (CrewAI, LangGraph) to analyze bot performance and suggest strategy improvements.

### 7.1 AI Analysis Dashboard

**Location:** `apps/web/src/app/(game)/admin/bots/ai-insights/page.tsx`

An AI-powered dashboard that:
- Ingests bot logs, snapshots, and action data
- Analyzes performance across strategies
- Suggests weight adjustments for rule-based strategies
- Identifies inefficiencies and bottlenecks
- Recommends new strategy variants

**Dashboard sections:**
1. **Performance Analysis** - AI summary of what's working/not working
2. **Strategy Tuning Suggestions** - Recommended weight changes with A/B test proposals
3. **Bottleneck Detection** - AI-identified progression blockers
4. **Anomaly Detection** - Unusual bot behaviors that might indicate bugs
5. **Optimization Queue** - Pending experiments to run

### 7.2 Agent Architecture (CrewAI / LangGraph)

**Location:** `apps/api/src/bot/ai-analyst/`

Multi-agent system with specialized roles:

```typescript
// Agent 1: Data Analyst
// - Queries bot snapshots and action logs
// - Aggregates metrics across strategies
// - Identifies trends and outliers

// Agent 2: Strategy Optimizer
// - Analyzes strategy weights and outcomes
// - Suggests weight adjustments
// - Proposes new strategy variants

// Agent 3: Economist
// - Monitors gold circulation, inflation
// - Detects economic imbalances
// - Recommends gold sink/source adjustments

// Agent 4: Combat Analyst
// - Analyzes win rates, target selection
// - Identifies combat balance issues
// - Suggests attack/defense tuning

// Agent 5: Report Writer
// - Synthesizes insights from other agents
// - Generates human-readable reports
// - Creates actionable recommendations
```

### 7.3 CrewAI Integration

**Setup:**
```typescript
// apps/api/src/bot/ai-analyst/crew.ts
import { Crew } from '@crewai/crewai';

const dataAnalyst = new Agent({
  role: 'Bot Performance Analyst',
  goal: 'Analyze bot snapshot data and identify performance trends',
  backstory: 'Expert data scientist specializing in game economy analytics',
  tools: [querySnapshots, aggregateMetrics, detectOutliers],
});

const strategyOptimizer = new Agent({
  role: 'Strategy Weight Optimizer',
  goal: 'Optimize bot strategy weights for better performance',
  backstory: 'Game balance expert who fine-tunes AI behavior',
  tools: [compareStrategies, simulateWeightChange, proposeExperiment],
});

const economist = new Agent({
  role: 'Game Economy Monitor',
  goal: 'Ensure economic balance and prevent inflation/deflation',
  backstory: 'Economist who tracks in-game currency flow',
  tools: [trackGoldCirculation, detectInflation, recommendAdjustments],
});

const crew = new Crew({
  agents: [dataAnalyst, strategyOptimizer, economist],
  tasks: [
    'Analyze last 30 days of bot performance',
    'Identify underperforming strategies',
    'Suggest weight adjustments',
    'Detect economic imbalances',
  ],
  process: 'sequential', // or 'hierarchical'
});

const results = await crew.kickoff();
```

### 7.4 Analysis Tools (Agent Tools)

**Location:** `apps/api/src/bot/ai-analyst/tools/`

Tools that agents can use:

```typescript
// query-snapshots.tool.ts
export const querySnapshots = new Tool({
  name: 'query_snapshots',
  description: 'Query bot snapshot database with filters',
  func: async (params: { strategy?: string; days?: number }) => {
    // Query BotSnapshot table
    // Return aggregated data
  },
});

// compare-strategies.tool.ts
export const compareStrategies = new Tool({
  name: 'compare_strategies',
  description: 'Compare performance across strategies',
  func: async (params: { strategies: string[]; metric: string }) => {
    // Compare gold/XP/win rates by strategy
  },
});

// simulate-weight-change.tool.ts
export const simulateWeightChange = new Tool({
  name: 'simulate_weight_change',
  description: 'Run simulation with modified strategy weights',
  func: async (params: { strategy: string; weightChanges: Record<string, number> }) => {
    // Clone bot with new weights
    // Run 30-day simulation
    // Return before/after metrics
  },
});

// propose-experiment.tool.ts
export const proposeExperiment = new Tool({
  name: 'propose_experiment',
  description: 'Create A/B test proposal for weight changes',
  func: async (params: { strategy: string; changes: any; hypothesis: string }) => {
    // Store experiment proposal
    // Return experiment ID
  },
});
```

### 7.5 AI Analysis Workflow

**Scheduled Analysis (Weekly):**
```typescript
@Cron('0 0 2 * * 0') // Every Sunday at 2 AM
async runWeeklyAnalysis() {
  const crew = this.buildAnalysisCrew();

  const insights = await crew.kickoff({
    inputs: {
      timePeriod: '30d',
      strategies: ['WARRIOR', 'ECONOMIST', 'TURTLE', 'SPYMASTER', 'BALANCED'],
    },
  });

  // Store insights in database
  await this.storeInsights(insights);

  // Send notification to admin
  await this.notifyAdmin(insights);
}
```

**Manual Trigger (Admin Dashboard):**
```typescript
@Post('ai-analyst/run')
async runAnalysis(@Body() dto: { focus: string; timePeriod: string }) {
  // Run focused analysis (e.g., "economy" or "combat")
  const crew = this.buildFocusedCrew(dto.focus);
  return crew.kickoff({ inputs: { timePeriod: dto.timePeriod } });
}
```

### 7.6 AI Insights UI

**Location:** `apps/web/src/app/(game)/admin/bots/ai-insights/page.tsx`

**Page sections:**

1. **Latest Insights** (auto-refreshes)
   ```
   🤖 AI Analysis Report — Generated 2 hours ago

   📊 Performance Summary
   • ECONOMIST bots outperforming by 35% gold/day
   • WARRIOR win rate dropped 8% this week
   • TURTLE bots stalling at level 20 (bottleneck detected)

   🎯 Recommended Actions
   1. WARRIOR: Increase trainDefense weight from 3 → 5 (early-game survival)
   2. TURTLE: Decrease bankDeposit weight from 8 → 6 (more aggressive spending)
   3. SPYMASTER: Add spyMission frequency cap (currently spamming missions)

   📈 Proposed Experiments
   • A/B Test: WARRIOR vs WARRIOR_v2 (with defense boost)
   • Duration: 14 days
   • Sample size: 10 bots per variant
   ```

2. **Strategy Tuning Suggestions**
   - Table of proposed weight changes
   - "Run Simulation" button for each
   - "Apply Changes" button (updates bot configs)

3. **Economic Health Monitor**
   - AI-detected inflation/deflation trends
   - Gold distribution analysis
   - Recommended balance changes

4. **Experiment Queue**
   - List of A/B tests to run
   - Status: Pending / Running / Complete
   - Results summary

### 7.7 Experiment System

**Database:**
```prisma
model BotExperiment {
  id              Int      @id @default(autoincrement())
  name            String
  hypothesis      String   // "Increasing defense weight will improve WARRIOR survival"
  strategy        String   // WARRIOR
  control_config  Json     // Original weights
  variant_config  Json     // Modified weights
  status          String   // PENDING | RUNNING | COMPLETE
  start_date      DateTime?
  end_date        DateTime?
  duration_days   Int      // 14
  bots_per_group  Int      // 10

  // Results (populated after completion)
  control_metrics Json?    // { avgGold: 50000, avgLevel: 25, winRate: 0.65 }
  variant_metrics Json?
  winner          String?  // "control" | "variant" | "inconclusive"
  confidence      Float?   // 0.95 (statistical significance)

  @@map("bot_experiments")
}
```

**Workflow:**
1. AI agent proposes experiment
2. Admin reviews and approves
3. System spawns 20 bots (10 control, 10 variant)
4. Runs for N days
5. Compares metrics with statistical analysis
6. AI agent generates results report
7. If variant wins, suggests deploying to all bots

### 7.8 Deliverables

**Phase 7A: Agent Framework (2-3 weeks)**
- [ ] CrewAI integration setup
- [ ] 5 specialized agents (data, strategy, economy, combat, report)
- [ ] Agent tools for querying snapshots and running simulations
- [ ] Weekly scheduled analysis cron job

**Phase 7B: AI Insights Dashboard (1-2 weeks)**
- [ ] AI insights page in admin
- [ ] Latest insights display with recommendations
- [ ] Strategy tuning suggestion cards
- [ ] "Run Simulation" and "Apply Changes" buttons

**Phase 7C: Experiment System (2 weeks)**
- [ ] BotExperiment database table
- [ ] A/B test creation workflow
- [ ] Automated bot spawning for experiments
- [ ] Statistical analysis of results
- [ ] Winner selection and deployment workflow

**Phase 7D: LLM Decision Engine (3-4 weeks)**
- [ ] BotLLMBrainService (replaces rule-based brain for flagged bots)
- [ ] LLM prompt engineering for action decisions
- [ ] Structured output parsing (JSON schema)
- [ ] Cost tracking and budget limits
- [ ] Hybrid mode: LLM for strategic decisions, rules for execution

**Status: ⏳ NOT STARTED**

---

## Future Enhancements

**Post-Phase 7 ideas:**
- **A/B Testing:** Run two identical bots with different strategies and compare ✅ (Covered in Phase 7C)
- **Machine Learning:** Train a model to predict optimal actions
- **Bot vs Bot Tournaments:** Pit strategies against each other
- **Player vs Bot Benchmarking:** Compare real players to bot progression
- **Scenario Testing:** "What if gold costs increase 20%?" — run simulation
- **Live Dashboard:** Real-time WebSocket updates during bot sessions
- **Community Insights:** Public-facing bot stats for player research
- **Agent Collaboration:** Multiple agents debate best strategy changes before proposing
- **Reinforcement Learning:** Train bots to optimize via trial-and-error (beyond LLM)

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

### Implementation Learnings

**Database Compatibility:**
- All search queries use conditional `mode: 'insensitive'` only for PostgreSQL
- SQLite doesn't support this flag, so we detect `DATABASE_URL` type at runtime
- Applied to: player search, admin search, battle player search

**Level vs Rank Confusion:**
- `rank` field = leaderboard position (#1, #61, etc.)
- `level` = calculated from experience using `getLevelForXP()`
- ALWAYS use `getLevelForXP(stats.experience)` for bot analytics, never `stats.rank`

**Simulation Date Progression:**
- Snapshot service accepts optional `snapshotDate` parameter
- Simulation calculates simulated dates spanning historical range (e.g., 180 days ago → today)
- This ensures proper time-series charts instead of all data collapsing to current date

**Frontend Performance:**
- Dashboard auto-refreshes every 5s during simulation
- Shows top 10 bots instead of all 100 for readability
- Battle page filters load from localStorage in `useEffect` to avoid hydration errors

---

## Next Steps

### Immediate Actions
1. **Run 100-bot simulation** — Test the completed system with real data
   - Generate 100 bots across all 5 strategies
   - Run 6-month simulation (180 days, 5 sessions/day)
   - Review global analytics dashboard for balance insights
   - Identify which strategies dominate at different level ranges

2. **Address BACKLOG balance issues**
   - Casualties at 10x turns feel too high
   - Sabotage destroying 3–5 items is negligible (should be percentage-based)
   - Proficiency limits needed (cap at 25 or 50)

### Recommended Phase Order
1. **Phase 2: Equipment & Efficiency** (Low effort, high value)
   - Shows resource inefficiencies (unequipped units, untrained citizens)
   - Helps identify why bots stall at certain levels

2. **Phase 6 Completion: Economy Monitoring** (Medium effort)
   - Inflation tracking alerts
   - Gold distribution analysis
   - Multi-bot overlay charts

3. **Phase 5: Advanced Analytics** (High effort, nice-to-have)
   - Bottleneck detection
   - Strategy recommendations
   - Timeline view
   - CSV export

## Conclusion

This bot analytics system transforms bots from simple NPCs into a sophisticated game balance testing framework. By tracking long-term progression and comparing strategies, we can:
- Identify and fix economic imbalances before real players hit them
- Validate that all strategies remain viable at every progression stage
- Ensure the game remains engaging for months/years (not just days/weeks)
- Catch bugs and exploits through unusual bot behavior patterns

**The bots become our 24/7 QA team, constantly stress-testing the game's economy and balance.**

---

**Current status:** Core analytics system is functional and ready for large-scale testing. Run a 100-bot simulation to validate game balance before moving to Phase 2.
