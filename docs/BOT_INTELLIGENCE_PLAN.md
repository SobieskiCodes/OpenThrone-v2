# Bot Intelligence Plan — Making Bots Play Smart

> **Goal:** Transform bots from random action generators into competent players with strategic thinking, battle memory, economic optimization, and social awareness.

## Philosophy: "Good Enough to Challenge Humans"

Bots should:
- **Learn from experience** (remember wins/losses, adapt strategy)
- **Make informed decisions** (spy before attacking, target weak players)
- **Optimize resources** (buy armor for units they have, scale workers for income)
- **Play socially** (join alliances, coordinate attacks, respond to threats)
- **Respect game mechanics** (daily limits, level ranges, turn costs)

**Not AI/LLM-powered** (yet) — just smart heuristics and memory. (it can look at its own battle log/history - utilize alliance spies etc)

---

## Current State

### What Bots Do NOW ✅
- Train units (workers, offense, defense, spy, sentry)
- Upgrade buildings progressively
- Repair fort when damaged
- Bank gold deposits/withdrawals
- **Attack players RANDOMLY** (no target selection logic)
- **Spy missions RANDOMLY** (no correlation to attacks)
- Purchase cosmetics when wealthy
- Hire mercenaries from camp
- Send chat messages (boasts, taunts, revenge threats)

### Critical Gaps ❌
1. **No proficiency point spending** — Earn points on level-up but never spend them (systemically weaker than humans)
2. **No intelligence gathering** — Spy and attack are disconnected
3. **No target selection** — Attacks anyone, including much stronger players
4. **No battle memory** — Doesn't remember wins/losses
5. **No learning** — Repeats mistakes (attacking same strong player repeatedly)
6. **No equipment optimization** — Buys items randomly, doesn't match unit count
7. **No economic strategy** — Doesn't understand workers = income
8. **No social play** — Can't join alliances, no coordination

---

## Phase 0: Proficiency Point Allocation (Foundation)

**Goal:** Bots spend proficiency points earned from leveling up to boost their stats strategically.

### The Problem

Bots currently:
- ✅ Earn proficiency points on level-up
- ❌ **Never spend them** (just accumulate forever)
- ❌ Don't track `availablePoints` in `BotGameState`
- ❌ Have no action type for allocating points

Result: Bots become weaker than humans of the same level because they never boost their stats.

### Proficiency Point System

**7 Bonus Types:**
- `OFFENSE` — Boost attack power
- `DEFENSE` — Boost defense power
- `RECRUITING` — More citizens per day
- `CASUALTY` — Reduce unit losses in battle
- `INTEL` — Better spy success rates
- `INCOME` — Gold income multiplier
- `PRICES` — Cheaper items/units

**API Endpoint:** `POST /player/me/bonus-points` (already exists)

### 0.1 Track Available Points

**Update BotGameState:**
```typescript
export interface BotGameState {
  // ... existing fields ...

  // Proficiency tracking
  availablePoints: number;
  bonusPoints: {
    OFFENSE: number;
    DEFENSE: number;
    RECRUITING: number;
    CASUALTY: number;
    INTEL: number;
    INCOME: number;
    PRICES: number;
  };
}
```

**Update loadBotGameState():**
```typescript
// In bot.service.ts
const bonusPointsArray = player.bonus_points || [];
const bonusPoints = {
  OFFENSE: bonusPointsArray.filter(bp => bp.bonus_type === 'OFFENSE').length,
  DEFENSE: bonusPointsArray.filter(bp => bp.bonus_type === 'DEFENSE').length,
  RECRUITING: bonusPointsArray.filter(bp => bp.bonus_type === 'RECRUITING').length,
  CASUALTY: bonusPointsArray.filter(bp => bp.bonus_type === 'CASUALTY').length,
  INTEL: bonusPointsArray.filter(bp => bp.bonus_type === 'INTEL').length,
  INCOME: bonusPointsArray.filter(bp => bp.bonus_type === 'INCOME').length,
  PRICES: bonusPointsArray.filter(bp => bp.bonus_type === 'PRICES').length,
};

return {
  // ... existing fields ...
  availablePoints: player.level - bonusPointsArray.length, // 1 point per level
  bonusPoints,
};
```

### 0.2 Strategy-Based Point Allocation

**Add Weights:**
```typescript
interface StrategyWeights {
  // ... existing weights ...

  // Proficiency point priorities
  allocateOffense: number;
  allocateDefense: number;
  allocateRecruiting: number;
  allocateCasualty: number;
  allocateIntel: number;
  allocateIncome: number;
  allocatePrices: number;
}
```

**Strategy Preferences:**
```typescript
const STRATEGY_WEIGHTS: Record<Strategy, StrategyWeights> = {
  WARRIOR: {
    // ... existing ...
    allocateOffense: 10,    // Primary focus
    allocateDefense: 3,
    allocateCasualty: 5,    // Reduce losses
    allocateRecruiting: 2,
    allocateIntel: 1,
    allocateIncome: 2,
    allocatePrices: 1,
  },
  TURTLE: {
    allocateOffense: 2,
    allocateDefense: 10,    // Primary focus
    allocateCasualty: 3,
    allocateRecruiting: 4,
    allocateIntel: 2,
    allocateIncome: 5,      // Need income for fort repairs
    allocatePrices: 2,
  },
  ECONOMIST: {
    allocateOffense: 1,
    allocateDefense: 2,
    allocateCasualty: 1,
    allocateRecruiting: 4,
    allocateIntel: 2,
    allocateIncome: 10,     // Primary focus
    allocatePrices: 6,      // Cheaper purchases
  },
  SPYMASTER: {
    allocateOffense: 2,
    allocateDefense: 3,
    allocateCasualty: 2,
    allocateRecruiting: 3,
    allocateIntel: 10,      // Primary focus
    allocateIncome: 4,      // Need income for spy missions
    allocatePrices: 3,
  },
  BALANCED: {
    allocateOffense: 5,
    allocateDefense: 5,
    allocateCasualty: 3,
    allocateRecruiting: 3,
    allocateIntel: 3,
    allocateIncome: 5,
    allocatePrices: 3,
  },
};
```

### 0.3 Allocation Actions

```typescript
// In prioritizeActions():

// ── Allocate Proficiency Points (HIGHEST PRIORITY) ──
if (state.availablePoints > 0) {
  // Determine best bonus type based on strategy weights
  const bonusOptions: { type: BonusType; weight: number }[] = [
    { type: 'OFFENSE', weight: weights.allocateOffense },
    { type: 'DEFENSE', weight: weights.allocateDefense },
    { type: 'RECRUITING', weight: weights.allocateRecruiting },
    { type: 'CASUALTY', weight: weights.allocateCasualty },
    { type: 'INTEL', weight: weights.allocateIntel },
    { type: 'INCOME', weight: weights.allocateIncome },
    { type: 'PRICES', weight: weights.allocatePrices },
  ];

  // Sort by weight descending
  bonusOptions.sort((a, b) => b.weight - a.weight);

  // Pick top 3 options and randomize slightly
  const topOptions = bonusOptions.slice(0, 3);
  const selected = topOptions[Math.floor(rng() * topOptions.length)]!;

  actions.push({
    type: 'ALLOCATE_BONUS_POINTS',
    weight: 1000, // VERY HIGH PRIORITY (always spend points immediately)
    reasoning: `Has ${state.availablePoints} unspent proficiency points — allocate to ${selected.type} (strategy: ${strategy}).`,
    params: { bonusType: selected.type },
  });
}
```

### 0.4 Executor

```typescript
// In bot-executor.service.ts
case 'ALLOCATE_BONUS_POINTS':
  return await this.execAllocateBonusPoints(playerId, action.params!);

// ...

private async execAllocateBonusPoints(playerId: string, params: any): Promise<ActionResult> {
  try {
    await this.playerService.allocateBonusPoints(playerId, {
      bonusType: params.bonusType,
    });

    return {
      success: true,
      resultData: {
        bonusType: params.bonusType,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, errorMessage: msg };
  }
}
```

### Deliverables

- [x] Add `availablePoints` and `bonusPoints` to `BotGameState` interface
- [x] Update `loadBotGameState()` to calculate available points and current allocations
- [x] Add proficiency allocation weights to all 5 bot strategies
- [x] Add `ALLOCATE_BONUS_POINTS` action with very high priority (1000 weight)
- [x] Add executor method calling `playerService.allocateBonusPoints()`
- [ ] Test: New bot at level 10 should have 10 bonus points allocated within first few sessions (deferred)
- [ ] Test: WARRIOR bots should have majority of points in OFFENSE/CASUALTY (deferred)
- [ ] Test: ECONOMIST bots should have majority in INCOME/PRICES (deferred)

**Commits:**
- `0b87872` - Phase 0: Proficiency Point Allocation (complete implementation)
- `b2f56ab` - Fix: PlayerModule import (added after Phase 1 - dependency for bonus points)

**Estimated Effort:** 0.5 days (4 hours)

**Impact:** HUGE — Bots will be competitive with humans of the same level instead of being systematically weaker.

**Status:** ✅ **COMPLETE** (build tested)

**Testing:** Deferred to end of Phase 1 (test proficiency + combat intelligence together)

---

## Phase 1: Combat Intelligence & Target Selection

**Goal:** Bots spy before attacking, pick appropriate targets, remember outcomes, and avoid repeating mistakes.

### 1.1 Pre-Attack Intelligence

**New BotGameState Fields:**
```typescript
interface BotGameState {
  // ... existing fields ...

  // Intelligence tracking
  intelReports: {
    targetId: string;
    targetName: string;
    targetLevel: number;
    goldAmount: number; // Revealed if spy/sentry ratio > 1.1x
    offenseStrength: number; // Estimated from units seen
    defenseStrength: number;
    spiedAt: Date;
    revealPercent: number; // How much info was revealed
  }[];

  // Battle memory
  battleHistory: {
    targetId: string;
    targetName: string;
    isWin: boolean;
    goldStolen: number;
    unitsLost: number;
    timestamp: Date;
  }[];

  // Threat tracking (who attacked me recently)
  recentAttackers: {
    attackerId: string;
    attackerName: string;
    attackerLevel: number;
    timestamp: Date;
    goldLost: number;
  }[];
}
```

**DB Schema Addition:**
```prisma
model BotIntelCache {
  id           String   @id @default(cuid())
  bot_id       String
  target_id    String
  target_name  String
  target_level Int
  gold_amount  BigInt?  // Null if not revealed
  offense_strength Int
  defense_strength Int
  spied_at     DateTime
  reveal_percent Float

  bot          Player   @relation("BotIntelReports", fields: [bot_id], references: [id], onDelete: Cascade)

  @@unique([bot_id, target_id])
  @@index([bot_id, spied_at])
}

model BotBattleMemory {
  id           String   @id @default(cuid())
  bot_id       String
  target_id    String
  target_name  String
  is_win       Boolean
  gold_stolen  BigInt
  units_lost   Int
  timestamp    DateTime @default(now())

  bot          Player   @relation("BotBattleHistory", fields: [bot_id], references: [id], onDelete: Cascade)

  @@index([bot_id, timestamp])
  @@index([bot_id, target_id, timestamp])
}
```

### 1.2 Smart Target Selection

**New Action: `FIND_ATTACK_TARGET`**

```typescript
// In bot-strategies.ts
function getAttackTargetCandidates(state: BotGameState): AttackTarget[] {
  // Filter rules:
  // 1. Within level range (±3 levels)
  // 2. Not in same alliance
  // 3. Hasn't been attacked 5 times today (daily limit)
  // 4. Not in "avoid list" (lost to them recently without new intel)

  const candidates = /* fetch from API */;

  // Score each candidate
  return candidates.map(target => ({
    ...target,
    score: calculateTargetScore(target, state),
  })).sort((a, b) => b.score - a.score);
}

function calculateTargetScore(target: Player, botState: BotGameState): number {
  let score = 100;

  // Prefer targets we've spied on recently (fresh intel)
  const intel = botState.intelReports.find(r => r.targetId === target.id);
  if (intel && isRecent(intel.spiedAt, 24 * 60 * 60 * 1000)) {
    score += 50; // Fresh intel bonus

    // Prefer weak defense
    if (intel.defenseStrength < botState.offenseUnits * 0.8) {
      score += 30; // Easy win predicted
    }

    // Prefer wealthy targets (if gold revealed)
    if (intel.goldAmount && intel.goldAmount > 50000) {
      score += 20;
    }
  } else {
    score -= 30; // No intel penalty
  }

  // Avoid targets we've lost to recently
  const recentLoss = botState.battleHistory.find(
    h => h.targetId === target.id && !h.isWin && isRecent(h.timestamp, 48 * 60 * 60 * 1000)
  );
  if (recentLoss) {
    score -= 100; // Avoid repeat losses
  }

  // Revenge bonus (attacked me recently)
  const attackedMe = botState.recentAttackers.find(a => a.attackerId === target.id);
  if (attackedMe && isRecent(attackedMe.timestamp, 24 * 60 * 60 * 1000)) {
    score += 40; // Revenge motivation
  }

  // Level difference penalty (prefer similar level)
  const levelDiff = Math.abs(target.level - botState.level);
  score -= levelDiff * 5;

  return score;
}
```

### 1.3 Intel-Driven Attack Flow

**New Action Priority:**
1. **Spy on potential targets** (if no recent intel)
2. **Select best target** (using target scoring)
3. **Attack selected target** (with appropriate turn count)

```typescript
// In prioritizeActions():

// ── Intelligence Gathering (prioritize if planning to attack) ──
if (!isEarlyGame && state.attackTurns >= 2 && state.spyUnits >= 3 && state.gold >= 3000) {
  // Get list of potential attack targets (within level range)
  const potentialTargets = /* fetch candidates */;

  // Find targets without recent intel
  const needsIntel = potentialTargets.filter(t => {
    const intel = state.intelReports.find(r => r.targetId === t.id);
    return !intel || !isRecent(intel.spiedAt, 24 * 60 * 60 * 1000);
  });

  if (needsIntel.length > 0) {
    // Pick random target to spy on
    const target = needsIntel[Math.floor(rng() * needsIntel.length)]!;
    actions.push({
      type: 'SPY_MISSION',
      weight: weights.spyMission + 5, // Higher weight than before
      reasoning: `Gathering intel on ${target.displayName} (Lv${target.level}) before attacking.`,
      params: {
        type: 'INTEL',
        targetId: target.id,
        spiesSent: Math.min(state.spyUnits, 5),
      },
    });
  }
}

// ── Attack Player (use smart target selection) ──
if (!isEarlyGame && state.attackTurns >= 1 && state.offenseUnits > 10) {
  const targets = getAttackTargetCandidates(state);

  if (targets.length > 0) {
    const bestTarget = targets[0]!; // Highest scored target
    const turns = Math.min(
      Math.max(1, Math.floor(1 + rng() * 3)),
      state.attackTurns,
    );

    actions.push({
      type: 'ATTACK_PLAYER',
      weight: weights.attackPlayer + rng() * 3,
      reasoning: `Attacking ${bestTarget.displayName} (Lv${bestTarget.level}, score: ${bestTarget.score}) with ${turns} turns.`,
      params: {
        targetId: bestTarget.id,
        turns,
      },
    });
  }
}
```

### 1.4 Battle Memory & Learning

**Event Listener: Store Battle Outcomes**

```typescript
// In BotService or new BotMemoryService
@OnEvent('battle.completed')
async handleBattleCompleted(event: BattleCompletedEvent) {
  // If attacker is a bot, record the outcome
  const attackerConfig = await this.prisma.botConfig.findUnique({
    where: { player_id: event.attackerId },
  });

  if (attackerConfig) {
    await this.prisma.botBattleMemory.create({
      data: {
        bot_id: event.attackerId,
        target_id: event.defenderId,
        target_name: event.defenderName,
        is_win: event.winner === event.attackerId,
        gold_stolen: event.goldStolen,
        units_lost: event.attackerUnitsLost,
        timestamp: new Date(),
      },
    });
  }

  // If defender is a bot, track the attacker as a threat
  const defenderConfig = await this.prisma.botConfig.findUnique({
    where: { player_id: event.defenderId },
  });

  if (defenderConfig) {
    await this.prisma.botThreatTracking.create({
      data: {
        bot_id: event.defenderId,
        attacker_id: event.attackerId,
        attacker_name: event.attackerName,
        attacker_level: event.attackerLevel,
        gold_lost: event.goldStolen,
        timestamp: new Date(),
      },
    });
  }
}

@OnEvent('spy.mission.completed')
async handleSpyMissionCompleted(event: SpyMissionCompletedEvent) {
  const botConfig = await this.prisma.botConfig.findUnique({
    where: { player_id: event.spyId },
  });

  if (botConfig && event.missionType === 'INTEL') {
    await this.prisma.botIntelCache.upsert({
      where: {
        bot_id_target_id: {
          bot_id: event.spyId,
          target_id: event.targetId,
        },
      },
      update: {
        target_level: event.intelData.level,
        gold_amount: event.intelData.goldRevealed ? event.intelData.gold : null,
        offense_strength: event.intelData.offenseUnits,
        defense_strength: event.intelData.defenseUnits,
        spied_at: new Date(),
        reveal_percent: event.intelData.revealPercent,
      },
      create: {
        bot_id: event.spyId,
        target_id: event.targetId,
        target_name: event.intelData.name,
        target_level: event.intelData.level,
        gold_amount: event.intelData.goldRevealed ? event.intelData.gold : null,
        offense_strength: event.intelData.offenseUnits,
        defense_strength: event.intelData.defenseUnits,
        spied_at: new Date(),
        reveal_percent: event.intelData.revealPercent,
      },
    });
  }
}
```

### 1.5 API Endpoints for Target Selection

**New Endpoint: `GET /battle/targets`**

```typescript
// In BattleController
@Get('targets')
async getAttackTargets(@CurrentPlayer() player: Player) {
  const targets = await this.battleService.findAttackTargets(player.id);
  return {
    targets: targets.map(t => ({
      id: t.id,
      displayName: t.displayName,
      level: t.level,
      race: t.race,
      // Don't reveal stats unless player has spied on them
    })),
  };
}
```

**BattleService:**
```typescript
async findAttackTargets(playerId: string): Promise<Player[]> {
  const player = await this.prisma.player.findUnique({
    where: { id: playerId },
    include: { alliance_membership: true },
  });

  if (!player) throw new NotFoundException('Player not found');

  // Filter rules:
  // 1. Within ±3 levels (or configurable range)
  // 2. Not in same alliance
  // 3. Not the player themselves
  // 4. Account is active

  return this.prisma.player.findMany({
    where: {
      id: { not: playerId },
      level: {
        gte: player.level - 3,
        lte: player.level + 3,
      },
      account_status: 'ACTIVE',
      alliance_membership: player.alliance_membership
        ? { alliance_id: { not: player.alliance_membership.alliance_id } }
        : undefined,
    },
    take: 50,
    orderBy: { last_active: 'desc' },
  });
}
```

### Deliverables

- [x] Add `BotIntelCache` and `BotBattleMemory` tables to schema
- [x] Add `BotThreatTracking` table for tracking who attacked the bot
- [x] Create `BotMemoryService` with event listeners for battle/spy outcomes
- [x] Update `loadBotGameState()` to include intel reports, battle history, recent attackers
- [x] Implement `calculateTargetScore()` with intelligence-based scoring logic
- [x] Update `pickBestTarget()` to use intelligence-based scoring (`calculateTargetScore`)
- [x] Update `SPY_MISSION` action to prioritize intel gathering (new `findSpyTarget` method)
  - Prioritizes revenge targets without intel
  - Then targets without any intel
  - Then targets with stale intel (>7 days)
- [ ] Add `GET /battle/targets` endpoint for fetching attack candidates (deferred — not needed, using existing player queries)
- [ ] Add admin UI to view bot intel cache and battle memory (deferred to Phase 5)

**Implementation Notes:**
- Intelligence tables store last 50 intel reports, 100 battle memories, 50 threat records per bot
- Event listeners automatically populate tables when bots spy/battle
- `calculateTargetScore()` applies bonuses for: recent intel (+30), revenge targets (+50 within 24h), past wins (+10 each), and penalties for: no intel (-15), past losses (-15 each), attacking blind (-15)
- Spy target selection prioritizes gathering NEW intel vs re-spying known targets
- SPYMASTER bots get -30 penalty for attacking without intel (forces them to spy first)
- **Fix applied:** Added `PlayerModule` import to `BotModule` for `PlayerService` dependency (needed for bonus point allocation in Phase 0)

**Commits:**
- `8e0f115` - Phase 1.1: Database tables (BotIntelCache, BotBattleMemory, BotThreatTracking)
- `6e49e70` - Phase 1: Combat Intelligence & Smart Target Selection (event listeners, target scoring, spy selection)
- `b2f56ab` - Fix: PlayerModule import for BotExecutorService dependency

**Estimated Effort:** 2-3 days

**Status:** ✅ **COMPLETE** (build tested, server running, uncommitted)

**Bugs Fixed During Testing:**
- ✅ Fixed proficiency allocation bug (was using array length instead of sum of levels) - Commit: 18d2c49
- ✅ Fixed intel cache case mismatch ('intel' vs 'INTEL') - Commit: 18d2c49
- ✅ Fixed wrong XP-to-level formula (exponential vs linear) - used `getLevelForXP()` - Commit: 18d2c49
- ✅ Rebalanced strategy weights (prioritize worker training over banking) - Commit: 18d2c49
- ✅ Bot chat system integration with admin settings - Commit: 18d2c49

**What's Next:**
Bot analytics dashboard is being built to monitor Phase 1 effectiveness (see `BOT_DASHBOARD_PLAN.md`). Once analytics are complete, we'll circle back to Phase 2 with data-driven insights about bot behavior.

---

## Phase 2: Equipment Optimization

**Goal:** Bots buy armor/weapons for units they actually have, sell excess items, and upgrade strategically.

### 2.1 Calculate Equipment Needs

```typescript
interface EquipmentNeeds {
  weaponsNeeded: number; // For offense units
  armorNeeded: number;   // For defense units
  excessWeapons: number; // Items to sell
  excessArmor: number;
}

function calculateEquipmentNeeds(state: BotGameState): EquipmentNeeds {
  const weaponsOwned = state.items.filter(i => i.type === 'WEAPON').length;
  const armorOwned = state.items.filter(i => i.type === 'ARMOR').length;

  const weaponsNeeded = Math.max(0, state.offenseUnits - weaponsOwned);
  const armorNeeded = Math.max(0, state.defenseUnits - armorOwned);

  const excessWeapons = Math.max(0, weaponsOwned - state.offenseUnits);
  const excessArmor = Math.max(0, armorOwned - state.defenseUnits);

  return { weaponsNeeded, armorNeeded, excessWeapons, excessArmor };
}
```

### 2.2 Smart Equipment Actions

```typescript
// In prioritizeActions():

const equipNeeds = calculateEquipmentNeeds(state);

// ── Sell Excess Equipment ──
if (equipNeeds.excessWeapons > 5) {
  // Sell lowest tier weapons first
  const weaponsToSell = state.items
    .filter(i => i.type === 'WEAPON')
    .sort((a, b) => a.tier - b.tier)
    .slice(0, equipNeeds.excessWeapons);

  actions.push({
    type: 'SELL_ITEMS',
    weight: weights.sellItems + rng() * 2,
    reasoning: `${equipNeeds.excessWeapons} excess weapons (only ${state.offenseUnits} offense units) — sell lowest tier for gold.`,
    params: { itemIds: weaponsToSell.map(w => w.id) },
  });
}

if (equipNeeds.excessArmor > 5) {
  const armorToSell = state.items
    .filter(i => i.type === 'ARMOR')
    .sort((a, b) => a.tier - b.tier)
    .slice(0, equipNeeds.excessArmor);

  actions.push({
    type: 'SELL_ITEMS',
    weight: weights.sellItems + rng() * 2,
    reasoning: `${equipNeeds.excessArmor} excess armor (only ${state.defenseUnits} defense units) — sell lowest tier for gold.`,
    params: { itemIds: armorToSell.map(a => a.id) },
  });
}

// ── Buy Equipment (only what's needed) ──
if (equipNeeds.weaponsNeeded > 0 && state.gold >= 5000) {
  const affordable = Math.floor(state.gold / 5000); // Rough weapon cost
  const quantity = Math.min(equipNeeds.weaponsNeeded, affordable, 10);

  actions.push({
    type: 'BUY_WEAPONS',
    weight: weights.buyWeapons + rng() * 2,
    reasoning: `Need ${equipNeeds.weaponsNeeded} weapons for ${state.offenseUnits} offense units — buy ${quantity}.`,
    params: { quantity, tier: determineBestAffordableTier(state) },
  });
}

if (equipNeeds.armorNeeded > 0 && state.gold >= 5000) {
  const affordable = Math.floor(state.gold / 5000);
  const quantity = Math.min(equipNeeds.armorNeeded, affordable, 10);

  actions.push({
    type: 'BUY_ARMOR',
    weight: weights.buyArmor + rng() * 2,
    reasoning: `Need ${equipNeeds.armorNeeded} armor for ${state.defenseUnits} defense units — buy ${quantity}.`,
    params: { quantity, tier: determineBestAffordableTier(state) },
  });
}
```

### 2.3 Upgrade Low-Tier Equipment

```typescript
// Upgrade logic: If bot has excess gold and items are low tier, upgrade
function shouldUpgradeEquipment(state: BotGameState): boolean {
  const avgWeaponTier = average(state.items.filter(i => i.type === 'WEAPON').map(i => i.tier));
  const avgArmorTier = average(state.items.filter(i => i.type === 'ARMOR').map(i => i.tier));

  // If wealthy and equipment is low tier, consider upgrading
  return state.gold > 100000 && (avgWeaponTier < 3 || avgArmorTier < 3);
}

if (shouldUpgradeEquipment(state)) {
  // Sell low-tier, buy high-tier
  actions.push({
    type: 'UPGRADE_EQUIPMENT',
    weight: weights.upgradeEquipment + rng(),
    reasoning: `Wealthy with low-tier equipment — sell old gear and buy better.`,
    params: { targetTier: 4 },
  });
}
```

### Deliverables

- [ ] Implement `calculateEquipmentNeeds()` helper
- [ ] Add `SELL_ITEMS` action and executor
- [ ] Update `BUY_WEAPONS` / `BUY_ARMOR` actions to respect unit counts
- [ ] Add `UPGRADE_EQUIPMENT` action for replacing low-tier items
- [ ] Add `sellItems` weight to all bot strategies
- [ ] Test: Bot with 50 offense units should have ~50 weapons, not 200

**Estimated Effort:** 1 day

---

## Phase 3: Economic Strategy & Worker Scaling

**Goal:** Bots understand workers = income, scale workers strategically, and target wealthy players for gold theft.

### 3.1 Income Optimization

```typescript
interface EconomicTarget {
  targetWorkerCount: number;
  currentIncome: number; // Gold per turn tick
  targetIncome: number;
  workerDeficit: number;
}

function calculateEconomicTarget(state: BotGameState, strategy: Strategy): EconomicTarget {
  // Income calculation: workers * baseIncome * fortBonus * mineBonus
  const baseIncome = 10; // Per worker
  const fortBonus = 1 + (state.fortification.level * 0.1); // +10% per fort level
  const mineBonus = 1 + (state.buildings.MINE * 0.15); // +15% per mine level

  const currentIncome = state.workerUnits * baseIncome * fortBonus * mineBonus;

  // Target income based on strategy
  const targetIncomeByStrategy: Record<Strategy, number> = {
    WARRIOR: 5000,   // Low income, focus on offense
    TURTLE: 8000,    // Moderate income for fort repairs
    ECONOMIST: 15000, // High income, maximize workers
    SPYMASTER: 7000, // Moderate income for spy missions
    BALANCED: 10000, // Balanced approach
  };

  const targetIncome = targetIncomeByStrategy[strategy] ?? 10000;
  const targetWorkerCount = Math.ceil(targetIncome / (baseIncome * fortBonus * mineBonus));
  const workerDeficit = Math.max(0, targetWorkerCount - state.workerUnits);

  return {
    targetWorkerCount,
    currentIncome,
    targetIncome,
    workerDeficit,
  };
}
```

### 3.2 Worker Scaling Actions

```typescript
// In prioritizeActions():

const economicTarget = calculateEconomicTarget(state, strategy);

// ── Train Workers (if below target) ──
if (economicTarget.workerDeficit > 0 && state.citizens > 10) {
  const trainCount = Math.min(
    economicTarget.workerDeficit,
    state.citizens,
    Math.floor(state.citizens * 0.3), // Don't convert ALL citizens at once
  );

  actions.push({
    type: 'TRAIN_UNITS',
    weight: weights.trainWorkers + rng() * 2,
    reasoning: `Income: ${economicTarget.currentIncome.toLocaleString()}/turn (target: ${economicTarget.targetIncome.toLocaleString()}) — train ${trainCount} workers.`,
    params: { type: 'WORKER', count: trainCount },
  });
}

// ── Prioritize Mine Upgrades (increase income multiplier) ──
if (state.buildings.MINE < 4 && state.gold > 50000) {
  const nextLevel = state.buildings.MINE + 1;
  const mineDef = getBuildingLevel('MINE', nextLevel);
  if (mineDef) {
    actions.push({
      type: 'UPGRADE_BUILDING',
      weight: weights.upgradeEconomy + 5, // Higher weight for ECONOMIST strategy
      reasoning: `Mine Lv${state.buildings.MINE} → Lv${nextLevel} increases income by 15% (current: ${economicTarget.currentIncome.toLocaleString()}/turn).`,
      params: { buildingType: 'MINE' },
    });
  }
}
```

### 3.3 Gold Theft Targeting

```typescript
// Enhance target scoring with wealth consideration
function calculateTargetScore(target: Player, botState: BotGameState): number {
  let score = 100;

  const intel = botState.intelReports.find(r => r.targetId === target.id);

  if (intel) {
    // If gold is revealed and high, boost score significantly
    if (intel.goldAmount && intel.goldAmount > 100000) {
      score += 50; // Juicy target
    } else if (intel.goldAmount && intel.goldAmount > 50000) {
      score += 25;
    }

    // If defense is weak AND gold is high, massive bonus
    if (intel.defenseStrength < botState.offenseUnits * 0.6 && intel.goldAmount && intel.goldAmount > 100000) {
      score += 75; // Jackpot: weak defense + rich
    }
  }

  // ... rest of scoring logic ...

  return score;
}
```

### 3.4 Strategy-Based Economic Behavior

```typescript
// Different strategies have different worker/soldier ratios
const STRATEGY_ECONOMIC_RATIOS: Record<Strategy, { workers: number; soldiers: number }> = {
  WARRIOR: { workers: 1, soldiers: 3 },   // 25% workers, 75% military
  TURTLE: { workers: 1, soldiers: 2 },    // 33% workers, 67% military (need income for fort repairs)
  ECONOMIST: { workers: 3, soldiers: 1 }, // 75% workers, 25% military
  SPYMASTER: { workers: 1, soldiers: 1 }, // 50/50 (need income for spy missions)
  BALANCED: { workers: 2, soldiers: 3 },  // 40% workers, 60% military
};

function shouldPrioritizeWorkers(state: BotGameState, strategy: Strategy): boolean {
  const ratio = STRATEGY_ECONOMIC_RATIOS[strategy];
  const currentWorkerRatio = state.workerUnits / (state.workerUnits + state.offenseUnits + state.defenseUnits);
  const targetWorkerRatio = ratio.workers / (ratio.workers + ratio.soldiers);

  return currentWorkerRatio < targetWorkerRatio;
}
```

### Deliverables

- [ ] Implement `calculateEconomicTarget()` helper
- [ ] Update worker training logic to use target income thresholds
- [ ] Boost Mine upgrade weights for ECONOMIST strategy
- [ ] Enhance target scoring to prioritize wealthy players (intel reveals gold)
- [ ] Add strategy-based worker/soldier ratio enforcement
- [ ] Test: ECONOMIST bots should have 70%+ workers, WARRIOR bots should have 20%

**Estimated Effort:** 1-2 days

---

## Phase 4: Alliance System & Social Play

**Goal:** Bots can join alliances, respect alliance rules, and coordinate (basic level).

### 4.1 Alliance Joining Logic

**New BotConfig Field:**
```prisma
model BotConfig {
  // ... existing fields ...

  auto_join_alliances Boolean @default(true) // Bots can auto-join alliances
  preferred_alliance_size String @default('MEDIUM') // SMALL, MEDIUM, LARGE
}
```

**New Action: `JOIN_ALLIANCE`**

```typescript
// In prioritizeActions():

// ── Join Alliance (if not in one and auto-join enabled) ──
if (!state.allianceId && state.level >= 5) {
  // Fetch available alliances (not full, not invite-only, allows bots)
  const alliances = await fetchJoinableAlliances(state.level);

  if (alliances.length > 0) {
    // Pick alliance based on bot preferences (size, activity level)
    const bestAlliance = selectBestAlliance(alliances, state);

    actions.push({
      type: 'JOIN_ALLIANCE',
      weight: weights.joinAlliance + rng() * 2,
      reasoning: `Not in an alliance — join "${bestAlliance.name}" (${bestAlliance.memberCount} members, Lv${bestAlliance.avgLevel} avg).`,
      params: { allianceId: bestAlliance.id },
    });
  }
}
```

### 4.2 Alliance Toggle for Human Players

**Update Alliance Creation Schema:**
```prisma
model Alliance {
  // ... existing fields ...

  allow_bots Boolean @default(true) // Can bots join this alliance?
}
```

**Frontend: Alliance Creation Form**
```tsx
// In alliance creation form
<Checkbox
  label="Allow bots to join"
  description="Bots can auto-join your alliance if this is enabled"
  defaultChecked={true}
  {...form.getInputProps('allowBots')}
/>
```

### 4.3 Alliance Coordination (Basic)

**Don't Attack Alliance Members:**
```typescript
// In getAttackTargetCandidates():
const targets = allPlayers.filter(p => {
  // ... other filters ...

  // Exclude alliance members
  if (state.allianceId && p.allianceId === state.allianceId) {
    return false;
  }

  return true;
});
```

**Share Intel with Alliance:**
```typescript
// After successful spy mission
@OnEvent('spy.mission.completed')
async handleSpyMissionCompleted(event: SpyMissionCompletedEvent) {
  const botConfig = await this.prisma.botConfig.findUnique({
    where: { player_id: event.spyId },
    include: { player: { include: { alliance_membership: true } } },
  });

  if (botConfig?.player.alliance_membership && event.missionType === 'INTEL') {
    // Share intel with alliance members
    await this.allianceService.shareIntel(
      event.spyId,
      botConfig.player.alliance_membership.alliance_id,
      event.intelData,
    );
  }
}
```

### Deliverables

- [ ] Add `allow_bots` field to Alliance model
- [ ] Add checkbox to alliance creation form (default checked)
- [ ] Add `auto_join_alliances` to BotConfig
- [ ] Implement `fetchJoinableAlliances()` API endpoint
- [ ] Add `JOIN_ALLIANCE` action and executor
- [ ] Update target selection to exclude alliance members
- [ ] Add intel sharing for bot-gathered intelligence
- [ ] Test: Create alliance with bots disabled, verify bots don't join

**Estimated Effort:** 1-2 days

---

## Phase 5: Advanced Intelligence & Adaptive Strategy

**Goal:** Bots adapt their strategy based on performance, detect patterns, and optimize over time.

### 5.1 Performance Metrics

```typescript
interface BotPerformanceMetrics {
  winRate: number; // Last 50 battles
  avgGoldStolen: number;
  avgGoldLost: number;
  netGoldFlow: number; // stolen - lost
  incomeEfficiency: number; // gold income vs. expenses
  rankingTrend: 'rising' | 'falling' | 'stable';
}

async function calculatePerformanceMetrics(botId: string): Promise<BotPerformanceMetrics> {
  const battles = await prisma.botBattleMemory.findMany({
    where: { bot_id: botId },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });

  const wins = battles.filter(b => b.is_win).length;
  const winRate = battles.length > 0 ? wins / battles.length : 0;

  const avgGoldStolen = average(battles.map(b => Number(b.gold_stolen)));

  const threats = await prisma.botThreatTracking.findMany({
    where: { bot_id: botId },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });

  const avgGoldLost = average(threats.map(t => Number(t.gold_lost)));
  const netGoldFlow = avgGoldStolen - avgGoldLost;

  // ... calculate income efficiency, ranking trend ...

  return { winRate, avgGoldStolen, avgGoldLost, netGoldFlow, incomeEfficiency, rankingTrend };
}
```

### 5.2 Strategy Adaptation

```typescript
// If bot is performing poorly, adjust strategy weights
async function adaptStrategyWeights(botId: string, currentStrategy: Strategy): Promise<Partial<StrategyWeights>> {
  const metrics = await calculatePerformanceMetrics(botId);
  const adjustments: Partial<StrategyWeights> = {};

  // If losing too many battles, boost defense training
  if (metrics.winRate < 0.3) {
    adjustments.trainDefense = 5; // Boost defense weight
    adjustments.attackPlayer = -3; // Reduce attack aggression
  }

  // If losing gold (more stolen from than stolen), boost fort repairs
  if (metrics.netGoldFlow < -10000) {
    adjustments.repairFort = 5;
    adjustments.upgradeFortification = 3;
  }

  // If income is low, boost worker training
  if (metrics.incomeEfficiency < 0.5) {
    adjustments.trainWorkers = 4;
    adjustments.upgradeEconomy = 3;
  }

  return adjustments;
}

// Apply adaptations during bot session
const adaptations = await adaptStrategyWeights(botId, strategy);
const weights = { ...baseWeights, ...adaptations };
```

### 5.3 Pattern Detection

```typescript
// Detect if bot is stuck in a pattern (e.g., attacking same player repeatedly)
function detectStuckPattern(battleHistory: BotBattleMemory[]): boolean {
  if (battleHistory.length < 10) return false;

  const recent = battleHistory.slice(0, 10);
  const targets = new Set(recent.map(b => b.target_id));

  // If 70% of recent attacks are on the same 2 targets, bot is stuck
  if (targets.size <= 2) {
    return true;
  }

  // If losing 80%+ of recent battles, strategy isn't working
  const recentWinRate = recent.filter(b => b.is_win).length / recent.length;
  if (recentWinRate < 0.2) {
    return true;
  }

  return false;
}

// If stuck, force diversification
if (detectStuckPattern(state.battleHistory)) {
  // Blacklist recent targets temporarily
  const recentTargets = state.battleHistory.slice(0, 10).map(b => b.target_id);
  // Filter these out in target selection
}
```

### Deliverables

- [ ] Implement `calculatePerformanceMetrics()` helper
- [ ] Add `adaptStrategyWeights()` logic with performance-based adjustments
- [ ] Implement `detectStuckPattern()` to identify repetitive behavior
- [ ] Add temporary target blacklist when stuck in loop
- [ ] Create admin UI to view bot performance metrics
- [ ] Test: Bot with low win rate should boost defense training

**Estimated Effort:** 2-3 days

---

## Implementation Order

| Phase | Effort | Priority | Dependencies | Status |
|-------|--------|----------|--------------|--------|
| **Phase 0** | Low (0.5 days) | **CRITICAL** | None — foundation | ✅ **DONE** (commit: 0b87872) |
| **Phase 1** | High (2-3 days) | **Critical** | Battle/spy event system | ✅ **DONE** (commit: 18d2c49, uncommitted) |
| **Analytics Dashboard** | Medium (1 week) | **High** | Phase 1 complete (needs battle data) | 🔄 **IN PROGRESS** |
| **Phase 2** | Low (1 day) | High | Equipment API endpoints, Analytics | ⏳ **NEXT** (after analytics) |
| **Phase 3** | Medium (1-2 days) | High | Phase 1 (target scoring needs intel) | ⏳ |
| **Phase 4** | Medium (1-2 days) | Medium | Alliance system | ⏳ |
| **Phase 5** | High (2-3 days) | Low | Phase 1-4 complete (needs data) | ⏳ |

**Actual Sprint Progress:**
1. ✅ **Sprint 1:** Phase 0 (Proficiency Points) — COMPLETE
2. ✅ **Sprint 2:** Phase 1 (Combat Intelligence) — COMPLETE with bug fixes
3. 🔄 **Sprint 3:** Analytics Dashboard (see `BOT_DASHBOARD_PLAN.md`) — IN PROGRESS
   - **Why now:** Need to measure Phase 1 effectiveness before continuing
   - **What we're building:** Battle analytics, unit composition tracking, outlier detection
   - **Value:** Spot bugs instantly, validate strategy differentiation, measure progression
4. ⏳ **Sprint 4:** Phase 2 (Equipment) + Phase 3 (Economy) — AFTER analytics
5. ⏳ **Sprint 5:** Phase 4 (Alliances) + Phase 5 (Adaptation)
6. ⏳ **Sprint 6:** Testing & tuning with 100-bot simulation

**Total estimated time: 10-14 days** (added 1 week for analytics dashboard)

---

## Success Metrics

After implementation, bots should:

✅ **Proficiency Points:**
- 100% of bots allocate all available proficiency points within first session
- WARRIOR bots have 60%+ points in OFFENSE/CASUALTY
- ECONOMIST bots have 60%+ points in INCOME/PRICES
- SPYMASTER bots have 60%+ points in INTEL/INCOME
- No bots have unspent points after level 5

✅ **Combat Intelligence:**
- Spy on 80%+ of targets before attacking
- Win rate improves from ~50% to 65%+ (due to better target selection)
- Avoid repeat attacking players who beat them
- Execute revenge attacks on recent attackers

✅ **Equipment Optimization:**
- Have weapon count within ±10% of offense unit count
- Have armor count within ±10% of defense unit count
- Sell excess items when count > units + 20%
- Upgrade to higher tiers when wealthy (>200k gold)

✅ **Economic Strategy:**
- ECONOMIST bots have 70%+ workers
- WARRIOR bots have <30% workers
- Income scales with Mine upgrades
- Target wealthy players revealed by intel

✅ **Alliance Play:**
- 60%+ of bots join alliances by level 10
- Never attack alliance members
- Share intel with alliance after spy missions
- Respect "allow bots" toggle on alliances

✅ **Adaptation:**
- Bots with low win rate (<30%) boost defense training
- Bots losing gold (net negative) prioritize fort upgrades
- Bots stuck attacking same targets diversify after 10 attempts

---

## Testing Strategy

### Unit Tests
- Target scoring logic (verify wealthy + weak = high score)
- Equipment needs calculation (50 offense = 50 weapons needed)
- Economic target calculation (ECONOMIST > WARRIOR income targets)

### Integration Tests
- Full bot session with target selection (verify intel → attack flow)
- Equipment buying (verify bot stops at unit count)
- Alliance joining (verify bots respect allow_bots toggle)

### Simulation Testing
1. **100-bot simulation** (30 days fast-forward)
2. Verify:
   - Bots with higher intelligence have better rankings
   - Equipment counts stabilize around unit counts
   - Alliances form and bots join/leave appropriately
3. Compare metrics before/after intelligence upgrades

---

## Next Steps

### Immediate: Analytics Dashboard (Current Sprint)

See `BOT_DASHBOARD_PLAN.md` for full details. Building:

1. **Battle Analytics Tab**
   - Strategy performance comparison (win rate, attacks/day, gold efficiency)
   - Outlier detection (bots with 0% win rate = bugs)
   - Battle stats over time (improving or plateauing?)

2. **Unit Composition Tracking**
   - See if worker training fix worked (reducing 85-90% untrained citizens)
   - Verify strategy differentiation (WARRIOR = offense, ECONOMIST = workers)
   - Stacked area charts per strategy

3. **Individual Bot Drill-Down**
   - Deep dive into specific bot's timeline
   - Identify why specific bots are stuck/failing

**Why before Phase 2:** Analytics will reveal if Phase 1 is working correctly and guide Phase 2+ priorities with data.

### After Analytics: Resume Bot Intelligence

1. ✅ **Phase 1: Combat Intelligence** — COMPLETE (monitoring via analytics)

2. ⏳ **Phase 2: Equipment Optimization**
   - Equipment needs calculation (weapons = offense units, armor = defense units)
   - Sell excess items logic
   - Buy only what's needed (no hoarding)
   - **Analytics will show:** Current equipment vs unit ratio

3. ⏳ **Phase 3: Economic Strategy**
   - Worker scaling based on target income thresholds
   - Wealth-based target prioritization (steal from rich players)
   - Strategy-specific worker/soldier ratios
   - **Analytics will show:** Income efficiency per strategy

4. ⏳ **Phase 4: Alliances**
   - Add `allow_bots` toggle to alliance creation
   - Implement auto-join logic for bots
   - Exclude alliance members from attacks
   - Share intel with alliance

5. ⏳ **Phase 5: Adaptation**
   - Performance metrics calculation (using analytics data!)
   - Strategy weight adjustments based on metrics
   - Pattern detection & stuck prevention

6. ⏳ **Testing & Tuning**
   - Run 100-bot simulation
   - Use analytics dashboard to monitor in real-time
   - Identify and fix issues as they appear
   - Tune weights and thresholds based on data

Once complete, bots will be **competent opponents** that play strategically, learn from mistakes, optimize resources, and challenge human players! 🤖🧠

**The analytics dashboard makes bots observable — we can see exactly how they're performing and iterate quickly.**
