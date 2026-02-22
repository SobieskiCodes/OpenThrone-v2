# Bot Modernization Plan — Using New Systems

> **Goal:** Update bots to use buildings, chat, cosmetics, and WebSocket state sync. This "forces us to build good API" — if bots can't do it via REST API, then the endpoint is missing or incomplete.

## Current State

### What Bots CAN Do ✅
- Train units (WORKER, OFFENSE, DEFENSE, SPY, SENTRY)
- Bank deposit/withdrawal
- Equip items (weapons, armor)
- Upgrade old proficiency structures (OFFENSE, SPY, SENTRY upgrades)
- Repair fort
- Attack players
- Spy on players (INTEL missions)
- Auto-recruit citizens
- **✨ Upgrade new buildings** (FORTIFICATION, ARMORY, MINE, SPY_ACADEMY, HOUSING, MERCENARY_CAMP)
- **✨ Chat in general room** (send boasts, taunts, revenge threats with 30 message templates)
- **✨ Purchase and equip cosmetics** (name colors, icons) when wealthy
- **✨ Hire mercenaries** from MERCENARY_CAMP for upcoming battles

### What Bots CAN'T Do (Yet) ❌
- **Connect via WebSocket** (real-time state updates — deferred, only needed for external bots)

### Why This Matters ("Force Good API")

**Philosophy:** Bots should use the **exact same REST API** as human players. No special bot-only endpoints.

**Benefits:**
1. **Dogfooding** - If bots can't do it, the API is incomplete
2. **API completeness** - Forces us to expose all game actions via REST
3. **Testing** - Bots become automated integration tests
4. **Documentation** - Bot code serves as API usage examples

---

## Phase 1: Buildings System Integration

### 1.1 Update BotGameState

**Location:** `packages/game-logic/src/bot-strategies.ts`

Current state tracks old structure levels (houseLevel, economyLevel, etc.). Update to use new buildings:

```typescript
export interface BotGameState {
  // ... existing fields ...

  // OLD (remove these):
  // houseLevel: number;
  // economyLevel: number;
  // offenseUpgradeLevel: number;
  // spyUpgradeLevel: number;
  // sentryUpgradeLevel: number;
  // armoryLevel: number;

  // NEW (buildings):
  buildings: {
    FORTIFICATION: number;    // Level 1-5
    ARMORY: number;           // Level 1-5
    MINE: number;             // Level 1-4
    SPY_ACADEMY: number;      // Level 1-4
    HOUSING: number;          // Level 1-5
    MERCENARY_CAMP: number;   // Level 1-3
  };

  // OLD (remove):
  // fortLevel: number;
  // fortHP: number;
  // fortMaxHP: number;

  // NEW (fortification building):
  fortification: {
    level: number;
    hitpoints: number;
    maxHitpoints: number;
  };
}
```

### 1.2 Update BotService.loadBotGameState()

**Location:** `apps/api/src/bot/bot.service.ts` (lines 478-560)

Current code:
```typescript
houseLevel: getBuildingLevel('HOUSING'),
economyLevel: getBuildingLevel('MINE'),
// ... etc
```

Update to:
```typescript
buildings: {
  FORTIFICATION: getBuildingLevel('FORTIFICATION'),
  ARMORY: getBuildingLevel('ARMORY'),
  MINE: getBuildingLevel('MINE'),
  SPY_ACADEMY: getBuildingLevel('SPY_ACADEMY'),
  HOUSING: getBuildingLevel('HOUSING'),
  MERCENARY_CAMP: getBuildingLevel('MERCENARY_CAMP'),
},
fortification: {
  level: player.fortification?.fort_level ?? 1,
  hitpoints: player.fortification?.hitpoints ?? 50,
  maxHitpoints: fortDef?.hitpoints ?? 50,
},
```

### 1.3 Update Strategy Weights

**Location:** `packages/game-logic/src/bot-strategies.ts`

Add weights for new building types:

```typescript
interface StrategyWeights {
  // ... existing weights ...

  upgradeEconomy: number;   // Already exists (MINE)
  upgradeHouse: number;     // Already exists (HOUSING)
  upgradeOffense: number;   // OLD SYSTEM (proficiency upgrades)
  upgradeSpy: number;       // OLD SYSTEM
  upgradeSentry: number;    // OLD SYSTEM
  upgradeArmory: number;    // Already exists

  // NEW:
  upgradeFortification: number;
  upgradeSpyAcademy: number;
  upgradeMercCamp: number;
}
```

**Update weight tables:**
```typescript
const STRATEGY_WEIGHTS: Record<Strategy, StrategyWeights> = {
  WARRIOR: {
    // ... existing weights ...
    upgradeFortification: 6,
    upgradeSpyAcademy: 2,
    upgradeMercCamp: 5, // Warriors love mercenaries
  },
  TURTLE: {
    upgradeFortification: 10, // Turtles max fort first
    upgradeSpyAcademy: 3,
    upgradeMercCamp: 2,
  },
  // ... etc for all strategies
};
```

### 1.4 Add Building Upgrade Actions

**Location:** `packages/game-logic/src/bot-strategies.ts` (getStructureUpgradeActions)

Update to prioritize building upgrades:

```typescript
function getStructureUpgradeActions(...): PrioritizedAction[] {
  const actions: PrioritizedAction[] = [];

  // Buildings (prioritize these over proficiency upgrades)
  const buildings: {
    type: BuildingType;
    currentLevel: number;
    maxLevel: number;
    wKey: keyof StrategyWeights;
    label: string;
  }[] = [
    { type: 'FORTIFICATION', currentLevel: state.buildings.FORTIFICATION, maxLevel: 5, wKey: 'upgradeFortification', label: 'Fortification' },
    { type: 'ARMORY', currentLevel: state.buildings.ARMORY, maxLevel: 5, wKey: 'upgradeArmory', label: 'Armory' },
    { type: 'MINE', currentLevel: state.buildings.MINE, maxLevel: 4, wKey: 'upgradeEconomy', label: 'Mine' },
    { type: 'SPY_ACADEMY', currentLevel: state.buildings.SPY_ACADEMY, maxLevel: 4, wKey: 'upgradeSpyAcademy', label: 'Spy Academy' },
    { type: 'HOUSING', currentLevel: state.buildings.HOUSING, maxLevel: 5, wKey: 'upgradeHouse', label: 'Housing' },
    { type: 'MERCENARY_CAMP', currentLevel: state.buildings.MERCENARY_CAMP, maxLevel: 3, wKey: 'upgradeMercCamp', label: 'Mercenary Camp' },
  ];

  for (const b of buildings) {
    if (b.currentLevel >= b.maxLevel) continue;
    const result = canUpgradeBuilding(b.type, b.currentLevel, state.level, BigInt(state.gold));
    if (!result.canUpgrade) continue;
    const nextLevel = b.currentLevel + 1;
    const nextDef = getBuildingLevel(b.type, nextLevel);
    if (!nextDef) continue;
    actions.push({
      type: 'UPGRADE_BUILDING',
      weight: weights[b.wKey] + rng() * 2,
      reasoning: `${b.label} Lv${b.currentLevel} → Lv${nextLevel} (${nextDef.cost.toLocaleString()} gold).`,
      params: { buildingType: b.type },
    });
  }

  // Old proficiency upgrades (keep for now, but lower priority)
  // ... existing OFFENSE/SPY/SENTRY upgrade logic ...

  return actions;
}
```

### 1.5 Update BotExecutor

**Location:** `apps/api/src/bot/bot-executor.service.ts`

Add handler for `UPGRADE_BUILDING` action:

```typescript
switch (action.type) {
  // ... existing cases ...

  case 'UPGRADE_BUILDING':
    return await this.execUpgradeBuilding(playerId, action.params!);

  // Keep old UPGRADE_STRUCTURE for proficiency upgrades
  case 'UPGRADE_STRUCTURE':
    return await this.execUpgradeStructure(playerId, action.params!);
}
```

```typescript
private async execUpgradeBuilding(playerId: string, params: any): Promise<ActionResult> {
  try {
    const result = await this.structuresService.upgradeBuilding(playerId, {
      buildingType: params.buildingType,
    });

    return {
      success: true,
      resultData: {
        buildingType: params.buildingType,
        newLevel: result.newLevel,
        cost: result.cost,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, errorMessage: msg };
  }
}
```

### Deliverables

- [x] Update BotGameState interface (remove old fields, add buildings object)
- [x] Update loadBotGameState() to use new buildings
- [x] Add building upgrade weights to strategies
- [x] Add building upgrade actions to prioritizeActions()
- [x] Add UPGRADE_BUILDING executor handler
- [x] Test with simulation (bots should upgrade buildings progressively)

**Status:** ✅ **COMPLETED** (Committed: 18d2c49)

---

## Phase 2: Chat Integration

### 2.1 Add Chat Actions

**Location:** `packages/game-logic/src/bot-strategies.ts`

Add new action types:

```typescript
interface StrategyWeights {
  // ... existing ...
  chatBoast: number;      // Send boastful message after wins
  chatTaunt: number;      // Taunt before attacking
  chatReact: number;      // React to being attacked
}
```

### 2.2 Chat Trigger System

**Location:** `apps/api/src/bot/bot-chat.service.ts` (new file)

```typescript
@Injectable()
export class BotChatService {
  constructor(
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
  ) {}

  async sendBoastMessage(botId: string, targetName: string, goldStolen: number) {
    const config = await this.getBotConfig(botId);
    if (!config || Math.random() > 0.3) return; // 30% chance to boast

    const messages = [
      `Another victory! ${targetName} falls before me.`,
      `${goldStolen.toLocaleString()} gold richer. Too easy.`,
      `${targetName}, you should have trained more defense.`,
      `My armies grow stronger with each conquest.`,
      `Who's next? Step up if you dare.`,
    ];

    const message = messages[Math.floor(Math.random() * messages.length)]!;
    await this.sendToGeneralChat(botId, message);
  }

  async sendTauntMessage(botId: string) {
    const config = await this.getBotConfig(botId);
    if (!config || Math.random() > 0.2) return; // 20% chance to taunt

    const messages = [
      `Time to expand my kingdom...`,
      `Looking for a worthy opponent.`,
      `My armies hunger for battle.`,
      `Let's see who's been slacking on defense.`,
    ];

    const message = messages[Math.floor(Math.random() * messages.length)]!;
    await this.sendToGeneralChat(botId, message);
  }

  async sendRevengeMessage(botId: string, attackerName: string) {
    const config = await this.getBotConfig(botId);
    if (!config || Math.random() > 0.4) return; // 40% chance to threaten

    const messages = [
      `${attackerName}, you will regret that attack.`,
      `Noted, ${attackerName}. Revenge is coming.`,
      `My turn next, ${attackerName}.`,
      `Enjoy your gold while it lasts, ${attackerName}.`,
    ];

    const message = messages[Math.floor(Math.random() * messages.length)]!;
    await this.sendToGeneralChat(botId, message);
  }

  private async sendToGeneralChat(botId: string, content: string) {
    const generalRoom = await this.chatService.ensureGeneralRoom();
    await this.chatService.sendMessage(botId, generalRoom.id, content);
  }

  private async getBotConfig(playerId: string) {
    return this.prisma.botConfig.findUnique({
      where: { player_id: playerId },
    });
  }
}
```

### 2.3 Hook Chat into Bot Sessions

**Location:** `apps/api/src/bot/bot-scheduler.service.ts`

Inject BotChatService and call it after certain actions:

```typescript
constructor(
  // ... existing ...
  private readonly botChat: BotChatService,
) {}

async runSingleBot(...) {
  // ... existing session logic ...

  for (const action of actions) {
    const result = await this.botExecutor.executeAction(...);

    // Chat triggers based on action type
    if (result.success && action.type === 'ATTACK_PLAYER') {
      // Boast after winning attack
      if (result.resultData?.winner === playerId) {
        await this.botChat.sendBoastMessage(
          playerId,
          result.resultData.targetName,
          result.resultData.goldStolen,
        );
      }
    }

    // Log action...
  }
}
```

### 2.4 Event-Based Chat

**Location:** `apps/api/src/bot/bot-chat.service.ts`

Listen to game events for chat triggers:

```typescript
@OnEvent('battle.completed')
async handleBattleCompleted(event: BattleCompletedEvent) {
  // If defender is a bot, maybe send revenge message
  const defenderConfig = await this.prisma.botConfig.findUnique({
    where: { player_id: event.defenderId },
  });

  if (defenderConfig && event.winner === event.attackerId) {
    // Bot lost defense, threaten revenge
    await this.sendRevengeMessage(event.defenderId, event.attackerName);
  }
}
```

### Deliverables

- [x] Create BotChatService with message templates
- [x] Hook chat into bot sessions (boast after wins, taunt before attacks)
- [x] Add event listeners for revenge messages
- [x] Test chat messages appear in general room
- [x] Add admin settings for bot_chat_enabled toggle

**Status:** ✅ **COMPLETED** (Committed: 18d2c49)

**Additions:**
- Added admin settings system with configurable toggles
- Settings: bot_chat_enabled, turns_per_tick, starting_gold, starting_gold_banked, starting_citizens
- Admin UI at `/admin/settings` for game-wide configuration

---

## Phase 3: Cosmetics & Mercenaries

### 3.1 Cosmetics Purchases

Add cosmetics to bot shopping list (low priority, but shows off API):

```typescript
// In bot-strategies.ts
interface StrategyWeights {
  // ... existing ...
  purchaseCosmetic: number; // Very low weight (1-2)
}

// In prioritizeActions():
if (state.gold > 100000 && !state.hasNameColor) {
  actions.push({
    type: 'PURCHASE_COSMETIC',
    weight: weights.purchaseCosmetic + rng(),
    reasoning: 'Wealthy enough to buy cosmetics',
    params: { cosmeticId: 'color-royal-purple' }, // Pick randomly
  });
}
```

### 3.2 Mercenary Hiring

**Location:** `packages/game-logic/src/bot-strategies.ts`

Add mercenary hiring logic:

```typescript
// If MERCENARY_CAMP is built and bot has gold
if (state.buildings.MERCENARY_CAMP > 0 && state.gold > 50000) {
  actions.push({
    type: 'HIRE_MERCENARIES',
    weight: weights.hireMercenaries + rng() * 2,
    reasoning: `Hire mercenaries from camp level ${state.buildings.MERCENARY_CAMP}`,
    params: { quantity: Math.min(5, Math.floor(state.gold / 10000)) },
  });
}
```

**Executor:**
```typescript
case 'HIRE_MERCENARIES':
  return await this.execHireMercenaries(playerId, action.params!);
```

### Deliverables

- [x] Add cosmetics purchasing (low priority, proves API works)
- [x] Add mercenary hiring logic
- [x] Test mercenaries show up in bot units

**Status:** ✅ **COMPLETED** (2026-02-21)

**Implementation Details:**
- Added `purchaseCosmetic` and `hireMercenaries` weights to all 5 bot strategies
- Cosmetics: Bots purchase when gold > 100k (30% chance per session, very low weight 1-2)
- Mercenaries: Bots hire when MERCENARY_CAMP built and gold > 50k (weight 1-7 depending on strategy)
- Warriors prioritize mercenaries (weight 7), Economists deprioritize (weight 1)
- Added executor methods with proper error handling
- Bots can purchase any cosmetic type and optionally equip (50% chance)

---

## Phase 4: WebSocket State Sync (External Bots Only)

**Note:** Internal bots (current system) don't need WebSocket — they query state before each session. WebSocket is only useful for **external bot runner** (Phase 3 of BOT_PLAN.md).

For now, **skip this**. When we build external runner, bots will connect to `/game` namespace for real-time updates.

---

## Phase 5: Admin Dashboard Updates

### 5.1 Bot Detail Page - New Systems

**Location:** `apps/web/src/app/(game)/admin/bots/[id]/page.tsx`

Add sections to show:

**Config Tab:**
- Buildings table (show level for each building)
- Cosmetics owned (if any)
- Chat activity (messages sent today)

**Analytics Tab:**
- Chart: Building progression over time
- Chart: Chat frequency (messages per session)

### 5.2 Global Dashboard - Chat Feed

**Location:** `apps/web/src/app/(game)/admin/bots/dashboard/page.tsx`

Add **"Recent Bot Chat"** panel:
- Last 20 messages from bots in general chat
- Shows bot name, message, timestamp
- Auto-refreshes every 10 seconds

### Deliverables

- [ ] Add buildings display to bot detail page
- [ ] Add chat activity tracking
- [ ] Add bot chat feed to global dashboard

---

## Implementation Order

| Phase | Effort | Priority | Dependencies | Status |
|-------|--------|----------|--------------|--------|
| **Phase 1** | High | **Critical** | New buildings system already deployed | ✅ **DONE** |
| **Phase 2** | Medium | High | Chat system already deployed | ✅ **DONE** |
| **Phase 3** | Low | Low | Cosmetics + mercenaries deployed | ✅ **DONE** |
| **Phase 4** | N/A | Low | Skip for now (only for external bots) | ⏸️ Deferred |
| **Phase 5** | Low | Medium | Phase 1, 2, 3 complete | ⏳ **NEXT** |

**Recommended sprint:**
1. ✅ **Sprint 1:** Fix BigInt build error (DONE)
2. ✅ **Sprint 2:** Phase 1 (buildings integration) — COMPLETED (2025-02-21)
3. ✅ **Sprint 3:** Phase 2 (chat integration) + Admin Settings — COMPLETED (2025-02-21)
4. ⏳ **Sprint 4:** Phase 3 (cosmetics/mercs) + Phase 5 (admin dashboard) — 1 day

**Total estimated time: 4-6 days**

---

## "Force Good API" Checklist

Use this to validate the API is complete:

**Buildings:**
- ✅ Can bots query their building levels? (`GET /player/me` includes buildings)
- ✅ Can bots upgrade buildings? (`POST /structures/buildings/upgrade`)
- ✅ Do building upgrades return updated state? (gold deducted, level increased)

**Chat:**
- ✅ Can bots send messages? (`POST /chat/rooms/:id/messages`)
- ✅ Can bots query recent messages? (`GET /chat/rooms/:id/messages`)
- ✅ Do bot messages show sender cosmetics? (senderColor, senderIcon)

**Cosmetics:**
- ✅ Can bots see available cosmetics? (`GET /shop/cosmetics`)
- ✅ Can bots purchase cosmetics? (`POST /shop/cosmetics/purchase`)
- ✅ Can bots equip cosmetics? (`POST /shop/cosmetics/equip`)

**Mercenaries:**
- ✅ Can bots see mercenary availability? (`GET /structures/mercenaries`)
- ✅ Can bots hire mercenaries? (`POST /structures/mercenaries/hire`)
- ✅ Do hired mercenaries appear in units? (added to PlayerUnit table)

**State Sync:**
- ✅ Can bots query full game state? (`GET /player/me` returns everything)
- ✅ Do mutations return updated state? (gold, units, buildings changed)
- ✅ Can bots use all game endpoints humans can? (no special bot-only APIs)

---

## Success Metrics

After implementation:

✅ Bots can upgrade all 6 buildings progressively
✅ Bots send chat messages (boast, taunt, revenge)
✅ Bot chat shows cosmetics (colors/icons) if owned
✅ Bots hire mercenaries when camp is built
✅ Admin dashboard shows building progression charts
✅ Admin dashboard shows bot chat feed
✅ All bot actions use public REST API (no special endpoints)

---

## Next Steps

1. ✅ **Fix build error** (DONE - committed)
2. ✅ **Phase 1** - Buildings integration (DONE - committed: 18d2c49)
3. ✅ **Phase 2** - Chat integration + Admin Settings (DONE - committed: 18d2c49)
4. ⏳ **Phase 3** - Cosmetics & Mercenaries (NEXT)
   - Add cosmetics purchasing to bot strategies (low priority, proves API)
   - Add mercenary hiring logic (uses MERCENARY_CAMP building)
   - Test mercenaries show up in bot units
5. ⏳ **Phase 5** - Admin Dashboard Updates
   - Add buildings display to bot detail page
   - Add chat activity tracking
   - Add bot chat feed to global dashboard
6. ⏳ **Run simulation** - Test bots upgrading buildings, hiring mercs, sending chat over 30 days

Once bots are modernized, they become a **living integration test suite** for the entire game API! 🤖✨

## Current Status (2026-02-21)

✅ **Phases 1, 2 & 3 Complete!**
- Bots now use the new buildings system (6 buildings with proper progression)
- Bots send chat messages (30 trash-talk templates with probabilistic triggers)
- Bots purchase cosmetics when wealthy (> 100k gold, low priority)
- Bots hire mercenaries when camp is built (warriors prioritize, economists deprioritize)
- Admin settings system for game-wide configuration

**Ready for Phase 5:** Admin Dashboard Updates (show buildings, chat activity, mercenary purchases on bot detail pages)
