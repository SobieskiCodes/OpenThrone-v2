# Bot Dashboard — Focused Implementation Plan

> **Goal:** Build a comprehensive bot monitoring dashboard that reveals strategy effectiveness, identifies bugs through outliers, and tracks progression over time.

## Why This Dashboard Exists

Bots are our **24/7 QA agents**. The dashboard helps us:
1. **Spot bugs** — Outliers with 0% win rate or abnormal behavior indicate bugs
2. **Balance strategies** — See if WARRIOR actually attacks more, ECONOMIST accumulates more gold, etc.
3. **Track progression** — Verify bots aren't stuck or plateauing
4. **Validate fixes** — After changing strategy weights, confirm behavior changed

---

## Dashboard Structure

### Tab 1: Overview (EXISTS - needs minor updates)

**Purpose:** High-level health check of the bot ecosystem

**Current state:**
- ✅ Summary cards (total bots, total gold, total population)
- ✅ Strategy comparison - gold over time
- ✅ Top 10 bots overlay - gold progression
- ✅ Top performers tables (by gold, by level)
- ✅ Time period selector (7D, 30D, 3M, 6M, 1Y, All)
- ✅ Auto-refresh every 5s during simulation

**Enhancements needed:**
- [ ] Add "Total Actions Today" summary card
- [ ] Add "Avg Level" summary card
- [ ] Show strategy distribution (pie chart or stat bars)

**Questions this answers:**
- How many bots are active?
- Which bots are performing best?
- Which strategy is accumulating the most wealth?

---

### Tab 2: Battle Analytics (NEW - HIGH PRIORITY)

**Purpose:** Deep dive into combat performance, identify outliers, spot targeting bugs

#### 2.1 Strategy Battle Performance (Comparison Table)

Shows aggregate battle stats per strategy:

| Strategy  | Attacks/Day | Win Rate | Avg Gold/Attack | Avg Casualties | Gold Efficiency | Defenses Won |
|-----------|-------------|----------|-----------------|----------------|-----------------|--------------|
| WARRIOR   | 12.5        | 68%      | 1,200           | 45             | +850            | 55%          |
| TURTLE    | 6.2         | 72%      | 1,100           | 28             | +950            | 78%          |
| ECONOMIST | 5.8         | 65%      | 1,350           | 52             | +800            | 45%          |
| SPYMASTER | 8.1         | 70%      | 1,150           | 38             | +920            | 60%          |
| BALANCED  | 9.3         | 67%      | 1,180           | 42             | +880            | 58%          |

**Columns explained:**
- **Attacks/Day:** Average attacks per bot per day (shows aggression)
- **Win Rate:** % of attacks won (shows effectiveness)
- **Avg Gold/Attack:** Average gold stolen per successful attack (shows targeting quality)
- **Avg Casualties:** Average units lost per attack (shows efficiency)
- **Gold Efficiency:** (Gold stolen) - (value of casualties lost) — shows net profit
- **Defenses Won:** % of times bot won when attacked (shows defensive strength)

**What this reveals:**
- WARRIOR should have highest Attacks/Day
- TURTLE should have highest Defenses Won %
- ECONOMIST should have highest Avg Gold/Attack (targets rich players)
- SPYMASTER should have balanced stats

**Color coding:**
- Green = best in category
- Yellow = middle
- Red = worst in category

#### 2.2 Outlier Detection Table

Shows individual bots with abnormal battle stats (potential bugs):

| Bot Name      | Strategy  | Level | Attacks | Win Rate | Issue                          | Action          |
|---------------|-----------|-------|---------|----------|--------------------------------|-----------------|
| PhantomBlade  | SPYMASTER | 3     | 181     | 0%       | 🔴 No successful attacks       | [Debug →]       |
| IronFist      | WARRIOR   | 8     | 45      | 95%      | 🟢 Excellent performance       | —               |
| GoldWeaver    | ECONOMIST | 6     | 2       | 50%      | ⚠️ Very low attack frequency   | [Investigate →] |
| StoneShield   | TURTLE    | 7     | 89      | 15%      | 🔴 Terrible win rate           | [Debug →]       |

**Outlier detection rules:**
- 🔴 **0% win rate** after 50+ attacks = targeting bug (like PhantomBlade level calculation bug)
- 🔴 **<20% win rate** = either targeting too strong or wrong unit comp
- ⚠️ **<3 attacks/day** for WARRIOR/BALANCED = bot stuck or idle
- ⚠️ **>95% win rate** = might be targeting too weak (not optimal gold)
- 🔴 **Very high casualties** (>80% of units sent) = wasteful attacks

**Action buttons:**
- **[Debug →]** — Opens drill-down view for that bot
- **[Investigate →]** — Shows recent action logs

**Sorting/Filtering:**
- Sort by: Win Rate (asc), Attacks (desc), Issue Type
- Filter by: Strategy, Issue Type (All / Critical / Warning / Good)
- Search by bot name

#### 2.3 Battle Stats Over Time (Line Charts)

**Chart 1: Win Rate Over Time (by strategy)**
- X-axis: Date
- Y-axis: Win rate %
- One line per strategy (color-coded)
- Shows if bots improve as they level up

**Chart 2: Gold Stolen Per Attack Over Time**
- X-axis: Date
- Y-axis: Avg gold stolen
- One line per strategy
- Should increase over time (better targeting, higher-level targets)

**Chart 3: Casualty Rate Over Time**
- X-axis: Date
- Y-axis: Avg units lost per attack (%)
- One line per strategy
- Should decrease over time (smarter targeting, better equipped)

**Questions this answers:**
- Are bots improving at combat as they level up?
- Are strategies differentiated in combat behavior?
- Which strategy is most profitable in combat?
- Are there any bots stuck/broken that need debugging?

---

### Tab 3: Strategy Comparison (EXISTS - needs unit comp + actions)

**Purpose:** Detailed side-by-side strategy behavior analysis

**Current state:**
- ✅ Gold over time chart (by strategy)
- ✅ Population over time chart (by strategy)

**Enhancements needed:**

#### 3.1 Unit Composition Over Time (Stacked Area Chart)

Shows average unit composition % for each strategy:

**Example for WARRIOR strategy:**
- X-axis: Date
- Y-axis: % of total population
- Stacked layers:
  - Citizens (should decrease over time)
  - Workers (should increase early, stabilize)
  - Offense (should increase steadily)
  - Defense (should increase slowly)
  - Spy (minimal)
  - Sentry (minimal)

**5 separate charts, one per strategy** (or tabs to switch between):
- WARRIOR: High offense %, moderate workers
- TURTLE: High defense %, moderate workers
- ECONOMIST: Very high workers %, low combat units
- SPYMASTER: High spy %, moderate workers
- BALANCED: Even distribution

**What this reveals:**
- Did our worker training fix work? (should see citizens % drop)
- Are strategies actually differentiated in unit comp?
- Are bots stuck with untrained citizens?

#### 3.2 Action Frequency Comparison (Bar Chart)

Shows average actions per day by strategy:

| Action Type          | WARRIOR | TURTLE | ECONOMIST | SPYMASTER | BALANCED |
|----------------------|---------|--------|-----------|-----------|----------|
| Attacks              | 12.5    | 6.2    | 5.8       | 8.1       | 9.3      |
| Spy Missions         | 2.1     | 1.8    | 1.5       | 9.5       | 3.2      |
| Bank Deposits        | 3.2     | 5.8    | 8.1       | 3.5       | 4.5      |
| Train Workers        | 8.5     | 9.2    | 12.3      | 7.8       | 9.1      |
| Train Offense        | 6.2     | 2.1    | 1.8       | 2.5       | 4.2      |
| Train Defense        | 2.5     | 7.8    | 1.5       | 2.1       | 3.8      |
| Building Upgrades    | 1.2     | 1.5    | 1.8       | 1.3       | 1.4      |
| Proficiency Upgrades | 0.8     | 0.7    | 0.6       | 0.9       | 0.7      |

**Visualization:** Grouped bar chart (one group per action type, one bar per strategy)

**What this reveals:**
- WARRIOR should have highest attacks, offense training
- TURTLE should have highest defense training, defenses won
- ECONOMIST should have highest bank deposits, worker training
- SPYMASTER should have highest spy missions
- Shows if strategy weights are actually working

#### 3.3 Resource Efficiency Table

Shows how efficiently each strategy uses resources:

| Strategy  | Gold Income/Day | XP/Day | Actions/Day | Gold per Action | Active Time % |
|-----------|-----------------|--------|-------------|-----------------|---------------|
| WARRIOR   | 8,500           | 450    | 32          | 265             | 78%           |
| TURTLE    | 7,200           | 380    | 28          | 257             | 72%           |
| ECONOMIST | 11,200          | 320    | 35          | 320             | 85%           |
| SPYMASTER | 8,800           | 420    | 34          | 258             | 80%           |
| BALANCED  | 9,100           | 410    | 33          | 275             | 79%           |

**What this reveals:**
- Which strategy generates gold fastest?
- Which strategy levels up fastest?
- Which strategy is most active?
- Gold per action = efficiency metric

**Questions this answers:**
- How do strategies differ in behavior?
- Are all strategies viable (or is one dominating)?
- Are bots training the right units for their strategy?
- Are bots taking actions or sitting idle?

---

### Tab 4: Individual Bot Drill-Down (NEW - MEDIUM PRIORITY)

**Purpose:** Deep dive into a single bot's full timeline

**UI Layout:**

#### Top Section: Bot Selector + Summary
```
[Select Bot: ___________v] [Compare with: ___________v (optional)]

GoldWeaver (ECONOMIST, Level 6)
Created: 2026-01-15 | Active: 38 days | Total Sessions: 190

Summary (Last 30 days):
  Gold: 45,000 → 128,000 (+83k) | Level: 4 → 6 (+2) | Actions: 1,245 | Win Rate: 67%
```

#### Charts Section:

**Chart 1: Gold & Level Over Time**
- Dual Y-axis: Gold (left), Level (right)
- X-axis: Date
- Shows progression over selected time period

**Chart 2: Unit Composition Over Time (Stacked Area)**
- Shows this bot's specific unit composition
- Reveals if stuck with untrained citizens or balanced growth

**Chart 3: Action Timeline (Bar Chart)**
- X-axis: Date (grouped by day)
- Y-axis: Count
- Grouped bars: Attacks, Spies, Deposits, Training, Upgrades
- Shows activity patterns (idle days vs active days)

**Chart 4: Battle Performance Over Time**
- Win rate per day (line)
- Gold stolen per day (bar)
- Shows if combat effectiveness improves

**Chart 5: Building Levels Over Time (Stacked Bar)**
- X-axis: Date
- Y-axis: Building level
- One bar segment per building type
- Shows progression through building system

#### Action Log Table (Bottom)

Recent actions (last 100):

| Timestamp         | Action Type      | Details                          | Success | Gold Change |
|-------------------|------------------|----------------------------------|---------|-------------|
| 2026-02-22 14:32  | Attack           | vs TestKnight (Level 10)         | ❌ Lost | -500        |
| 2026-02-22 14:30  | Train Workers    | Trained 50 workers               | ✅ Yes  | -1,000      |
| 2026-02-22 14:28  | Bank Deposit     | Deposited 5,000 gold             | ✅ Yes  | -5,000      |
| 2026-02-22 14:25  | Spy Mission      | Intel on IronGuard               | ✅ Yes  | -250        |
| ...               | ...              | ...                              | ...     | ...         |

**Filtering:**
- Filter by: Action Type, Success/Failure
- Date range selector

#### Compare Mode (Optional Enhancement)

If "Compare with" is selected:
- All charts show two lines/bars (selected bot vs comparison bot)
- Reveals if one bot is significantly outperforming

**Questions this answers:**
- Why is this specific bot underperforming?
- What is this bot spending time on?
- Is this bot stuck at a progression gate?
- How does this bot compare to others with same strategy?

---

## Backend API Requirements

### New Endpoints Needed

#### 1. Battle Analytics

```typescript
GET /admin/bots/analytics/battles?period=30d
Response:
{
  byStrategy: {
    WARRIOR: {
      attacksPerDay: 12.5,
      winRate: 0.68,
      avgGoldPerAttack: 1200,
      avgCasualties: 45,
      goldEfficiency: 850,
      defensesWon: 0.55,
    },
    // ... other strategies
  },
  outliers: [
    {
      botId: "...",
      botName: "PhantomBlade",
      strategy: "SPYMASTER",
      level: 3,
      totalAttacks: 181,
      winRate: 0,
      issue: "NO_SUCCESSFUL_ATTACKS",
      severity: "CRITICAL",
    },
    // ... other outliers
  ],
  overTime: {
    dates: ["2026-01-01", "2026-01-02", ...],
    winRateByStrategy: {
      WARRIOR: [0.65, 0.66, 0.68, ...],
      // ... other strategies
    },
    goldPerAttackByStrategy: { ... },
    casualtyRateByStrategy: { ... },
  },
}
```

**Data source:** `AttackLog` table + `BotActionLog` table

**Calculation logic:**
- Group attack logs by bot → strategy → aggregate
- Outlier detection: Apply rules (win rate < 20%, attacks = 0, etc.)
- Time series: Group by date, calculate daily averages per strategy

#### 2. Unit Composition Over Time

```typescript
GET /admin/bots/analytics/unit-composition?period=30d&strategy=WARRIOR
Response:
{
  dates: ["2026-01-01", "2026-01-02", ...],
  composition: {
    citizens: [85.2, 82.1, 78.5, ...],      // % of total
    workers: [8.3, 10.2, 12.8, ...],
    offense: [3.5, 4.2, 5.1, ...],
    defense: [1.8, 2.1, 2.3, ...],
    spy: [0.8, 0.9, 1.0, ...],
    sentry: [0.4, 0.5, 0.3, ...],
  },
}
```

**Data source:** `BotSnapshot` table

**Calculation logic:**
- For given strategy, get all bots with that strategy
- For each date, calculate average % composition across all bots
- Return time series of %s

#### 3. Action Frequency

```typescript
GET /admin/bots/analytics/actions?period=30d
Response:
{
  byStrategy: {
    WARRIOR: {
      attacks: 12.5,           // per day
      spyMissions: 2.1,
      bankDeposits: 3.2,
      trainWorkers: 8.5,
      trainOffense: 6.2,
      trainDefense: 2.5,
      buildingUpgrades: 1.2,
      proficiencyUpgrades: 0.8,
    },
    // ... other strategies
  },
}
```

**Data source:** `BotActionLog` table

**Calculation logic:**
- Group by strategy + action_type
- Count actions, divide by (bots × days) = average per day

#### 4. Individual Bot Detail

```typescript
GET /admin/bots/:id/timeline?period=30d
Response:
{
  bot: { id, name, strategy, level, createdAt },
  summary: {
    goldStart: "45000",
    goldEnd: "128000",
    goldChange: "+83000",
    levelStart: 4,
    levelEnd: 6,
    levelChange: 2,
    totalActions: 1245,
    winRate: 0.67,
  },
  charts: {
    goldAndLevel: {
      dates: [...],
      gold: [...],
      level: [...],
    },
    unitComposition: {
      dates: [...],
      citizens: [...],
      workers: [...],
      // ... other unit types
    },
    actionFrequency: {
      dates: [...],
      attacks: [...],
      spies: [...],
      // ... other action types
    },
    battlePerformance: {
      dates: [...],
      winRate: [...],
      goldStolen: [...],
    },
    buildings: {
      dates: [...],
      fortification: [...],
      armory: [...],
      // ... other buildings
    },
  },
  recentActions: [
    { timestamp, actionType, details, success, goldChange },
    // ... last 100 actions
  ],
}
```

**Data source:** `BotSnapshot` + `BotActionLog` + `AttackLog` + `PlayerBuilding`

---

## Frontend Implementation Details

### Tab Navigation

Use Mantine `Tabs` component:

```tsx
<Tabs defaultValue="overview">
  <Tabs.List>
    <Tabs.Tab value="overview">Overview</Tabs.Tab>
    <Tabs.Tab value="battles">Battle Analytics</Tabs.Tab>
    <Tabs.Tab value="strategies">Strategy Comparison</Tabs.Tab>
    <Tabs.Tab value="individual">Individual Bot</Tabs.Tab>
  </Tabs.List>

  <Tabs.Panel value="overview">
    {/* Existing overview content */}
  </Tabs.Panel>

  <Tabs.Panel value="battles">
    {/* Battle analytics content */}
  </Tabs.Panel>

  {/* ... other panels */}
</Tabs>
```

### Time Period Selector (Shared)

Use existing `SegmentedControl` component, lift state to parent:

```tsx
const [period, setPeriod] = useState('30d');

// Pass period to all child tabs
<BattleAnalyticsTab period={period} />
```

### Chart Library

Continue using **Recharts** (already in use):
- `LineChart` for time series
- `BarChart` for action frequency comparison
- `AreaChart` for unit composition (stacked)
- `ComposedChart` for dual Y-axis (gold + level)

### Color Palette (Strategy Colors)

Use existing strategy colors from current dashboard:

```typescript
const STRATEGY_COLORS = {
  WARRIOR: '#ff4444',
  TURTLE: '#4c9eff',
  ECONOMIST: '#82ca9d',
  SPYMASTER: '#9b59b6',
  BALANCED: '#f39c12',
};
```

### Loading States

Show `<Skeleton>` components while data loads (already implemented in overview).

### Error Handling

If API fails:
```tsx
<Text c="dimmed" ta="center" py="xl">
  Failed to load analytics data. Try refreshing.
</Text>
```

---

## Implementation Order

### Phase 1: Battle Analytics (HIGH PRIORITY)
**Effort:** 1 week
**Why first:** Most valuable for debugging, reveals bugs through outliers

- [ ] Backend: Battle analytics endpoint
- [ ] Frontend: Battle Analytics tab
  - [ ] Strategy comparison table
  - [ ] Outlier detection table
  - [ ] Win rate over time chart
  - [ ] Gold stolen over time chart

### Phase 2: Unit Composition (HIGH PRIORITY)
**Effort:** 3 days
**Why second:** Validates recent worker training fix

- [ ] Backend: Unit composition endpoint
- [ ] Frontend: Add to Strategy Comparison tab
  - [ ] Stacked area chart per strategy
  - [ ] Toggle between strategies

### Phase 3: Action Frequency (MEDIUM PRIORITY)
**Effort:** 2 days
**Why third:** Shows if strategy weights are working

- [ ] Backend: Action frequency endpoint
- [ ] Frontend: Add to Strategy Comparison tab
  - [ ] Grouped bar chart
  - [ ] Resource efficiency table

### Phase 4: Individual Bot Drill-Down (MEDIUM PRIORITY)
**Effort:** 1 week
**Why last:** Nice-to-have for deep debugging specific bots

- [ ] Backend: Individual bot timeline endpoint
- [ ] Frontend: Individual Bot tab
  - [ ] Bot selector
  - [ ] 5 timeline charts
  - [ ] Recent actions table

---

## Success Metrics

After implementation, we can:

✅ **Spot bugs immediately**
- See bots with 0% win rate = targeting bug
- See bots with 0 attacks = stuck/idle bug

✅ **Validate strategy differentiation**
- Confirm WARRIOR attacks more, ECONOMIST trains more workers
- See different unit compositions per strategy

✅ **Track progression**
- See if bots improve at combat over time
- See if bots get stuck at certain levels

✅ **Measure efficiency**
- See which strategy generates most gold/XP per day
- See which strategy is most active

✅ **Validate fixes**
- After changing weights, see behavior change in charts
- After fixing bugs, see outliers disappear

---

## Future Enhancements (Post-MVP)

- **Real-time updates:** WebSocket push for live simulation progress
- **Alerts:** Email/Slack notifications for critical outliers
- **Export:** Download CSV of bot data for external analysis
- **Filters:** Filter charts by level range, date range, custom bot selection
- **Compare mode:** Select 2-3 bots to overlay on same chart
- **Annotations:** Mark dates where strategy weights changed (vertical lines on charts)
- **Heatmaps:** Show attack activity by hour of day (when are bots most active?)
- **Network graph:** Bot attack relationships (who attacks whom?)

---

## Technical Considerations

### Performance

**Problem:** Queries spanning 30+ days across 100 bots × 1000s of logs = slow

**Solutions:**
- Use `BotSnapshot` table for aggregated daily stats (already exists)
- Cache expensive aggregations (Redis or in-memory)
- Limit default time period to 30d (not "All")
- Pagination on action logs (100 per page)

### Data Retention

- Keep snapshots forever (1 row/bot/day = ~36k rows/year for 100 bots)
- Archive action logs after 90 days (high volume)
- Aggregate action logs into daily summaries for long-term analysis

### Testing

- Seed test data: 5 bots × 30 days of snapshots + action logs
- Unit tests for outlier detection logic
- Integration tests for analytics endpoints
- Visual regression tests for charts (Percy/Chromatic)

---

## Open Questions

1. **How to define "outlier" thresholds?**
   - Current rules: 0% win rate, <20% win rate, <3 attacks/day
   - Should these be configurable or hardcoded?

2. **Should we show individual bot data on Strategy Comparison tab?**
   - Or keep it aggregated (average across all bots of that strategy)?
   - Pros of individual: See variance within strategy
   - Cons: Too noisy, harder to read

3. **Auto-refresh frequency during simulation?**
   - Current: Every 5s
   - Too fast? Too slow?
   - Should it be configurable?

4. **Should we support comparing multiple bots side-by-side?**
   - "Compare GoldWeaver vs IronFist"
   - Overlay their charts
   - Effort: Medium, Value: Medium

5. **Should we show defensive stats (times attacked, defense win rate)?**
   - Currently focused on offensive combat
   - Defensive stats would reveal if TURTLE is actually better at defense
   - Effort: Low, Value: Medium

---

## Conclusion

This dashboard transforms raw bot data into actionable insights. By focusing on:
1. **Battle analytics** (spot bugs via outliers)
2. **Unit composition** (validate training behavior)
3. **Action frequency** (confirm strategy differentiation)
4. **Individual timelines** (debug specific bots)

...we create a comprehensive monitoring system that makes bots effective QA agents.

**Next step:** Implement Phase 1 (Battle Analytics) to immediately gain value from outlier detection.
