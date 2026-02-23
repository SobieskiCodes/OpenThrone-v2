# Game Data Migration Plan

## Overview

Migrate from hardcoded game definitions (`@openthrone/game-logic`) to a **database-backed, cache-on-boot architecture**. This enables dynamic content management via admin panel without code deployments, while maintaining in-memory performance.

## Architecture

### Current (Hardcoded)
```
@openthrone/game-logic
  ├─ UnitTypes[] (hardcoded array)
  ├─ ItemTypes[] (hardcoded array)
  ├─ Buildings[] (hardcoded array)
  └─ Formulas (pure functions)
           ↓
    Services import directly
           ↓
    O(n) array lookups
```

### New (Database-Cached)
```
PostgreSQL (source of truth)
  ├─ units table
  ├─ items table
  ├─ buildings table
  └─ game_config table
           ↓
  Server Boot: Load into memory
           ↓
  GameDataService (singleton)
    ├─ Map<string, Unit>
    ├─ Map<string, Item>
    └─ Map<string, Building>
           ↓
    Services inject GameDataService
           ↓
    O(1) Map lookups (same performance!)
           ↓
  Optional: Redis for multi-server
```

### Key Benefits

✅ **No code deployments** - Add/edit items via admin panel
✅ **Same performance** - In-memory O(1) lookups
✅ **Hot reload** - Update cache without restart
✅ **Feature flags** - Enable/disable content dynamically
✅ **A/B testing** - Different servers, different configs
✅ **Easy expansion** - New items = DB rows, not code
✅ **Historical tracking** - See who changed what when
✅ **Rollback support** - Revert bad balance changes

## Database Schema

### Core Definition Tables

```prisma
// ─── Units ───────────────────────────────────────────────────
model Unit {
  id          String   @id @default(cuid())
  type        String   // UnitType: CITIZEN, OFFENSE, DEFENSE, SPY, SENTRY
  level       Int
  name        String
  cost        BigInt

  // Stats
  offense     Int      @default(0)
  defense     Int      @default(0)
  spy         Int      @default(0)
  sentry      Int      @default(0)

  // Metadata
  enabled     Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  @@unique([type, level])
  @@index([type, level])
  @@index([enabled])
  @@map("units")
}

// ─── Items ───────────────────────────────────────────────────
model Item {
  id          String   @id @default(cuid())
  type        String   // ItemType: WEAPON, HELM, ARMOR, BOOTS, BRACERS, SHIELD
  usage       String   // ItemUsage: OFFENSE, DEFENSE, SPY, SENTRY
  level       Int      // Tier (1-5)
  name        String
  bonus       Int      // Stat bonus provided
  cost        BigInt

  // Metadata
  enabled     Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  @@unique([type, usage, level])
  @@index([type, usage, level])
  @@index([enabled])
  @@map("items")
}

// ─── Buildings ───────────────────────────────────────────────
model Building {
  id                   String   @id @default(cuid())
  type                 String   // BuildingType: ARMORY, MERCENARY_CAMP, etc.
  level                Int
  name                 String
  cost                 BigInt

  // Requirements
  player_level_req     Int      @default(1)

  // Benefits
  workers_provided     Int?
  offense_bonus        Int      @default(0)
  defense_bonus        Int      @default(0)
  spy_bonus            Int      @default(0)
  sentry_bonus         Int      @default(0)
  income_bonus         Int      @default(0)
  max_item_bonus       Int?     // For ARMORY
  daily_merc_stock     Int?     // For MERCENARY_CAMP

  // Metadata
  enabled              Boolean  @default(true)
  created_at           DateTime @default(now())
  updated_at           DateTime @updatedAt

  @@unique([type, level])
  @@index([type, level])
  @@index([enabled])
  @@map("buildings")
}

// ─── Fortifications ──────────────────────────────────────────
model Fortification {
  id                   String   @id @default(cuid())
  level                Int      @unique
  name                 String
  max_population       Int
  max_land             Int
  price                BigInt
  hitpoints            Int
  gold_per_turn        Int
  cost_per_repair_point BigInt

  // Metadata
  enabled              Boolean  @default(true)
  created_at           DateTime @default(now())
  updated_at           DateTime @updatedAt

  @@index([enabled])
  @@map("fortifications")
}

// ─── Battle Upgrades ─────────────────────────────────────────
model BattleUpgrade {
  id          String   @id @default(cuid())
  type        String   // BattleUpgradeType: OFFENSE, DEFENSE, SPY, SENTRY
  level       Int
  name        String
  bonus       Int      // Stat bonus per unit
  cost        BigInt

  // Metadata
  enabled     Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  @@unique([type, level])
  @@index([type, level])
  @@index([enabled])
  @@map("battle_upgrades")
}

// ─── Economy Upgrades ────────────────────────────────────────
model EconomyUpgrade {
  id          String   @id @default(cuid())
  type        String   // EconomyUpgradeType: OFFENSE, DEFENSE, SPY, SENTRY
  level       Int
  name        String
  bonus       Int      // Income bonus per unit
  cost        BigInt

  // Metadata
  enabled     Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  @@unique([type, level])
  @@index([type, level])
  @@index([enabled])
  @@map("economy_upgrades")
}

// ─── Race Definitions ────────────────────────────────────────
model Race {
  id                String   @id // UNDEAD, HUMAN, GOBLIN, ELF
  name              String

  // Bonuses
  offense_bonus     Float    @default(0) // Multiplier (e.g., 1.5 = +50%)
  defense_bonus     Float    @default(0)
  spy_bonus         Float    @default(0)
  sentry_bonus      Float    @default(0)
  income_bonus      Float    @default(0)
  recruit_bonus     Float    @default(0)

  // UI
  description       String?
  theme_color       String   @default("#6b46c1")

  // Metadata
  enabled           Boolean  @default(true)
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  @@index([enabled])
  @@map("races")
}

// ─── Game Configuration ──────────────────────────────────────
model GameConfig {
  key         String   @id // "unit_cost_multiplier", "xp_multiplier", etc.
  value       String   // JSON-encoded value
  description String?
  updated_at  DateTime @updatedAt

  @@map("game_config")
}
```

## GameDataService Implementation

```typescript
// apps/api/src/game-data/game-data.service.ts

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface UnitDefinition {
  id: string;
  type: string;
  level: number;
  name: string;
  cost: bigint;
  offense: number;
  defense: number;
  spy: number;
  sentry: number;
  enabled: boolean;
}

export interface ItemDefinition {
  id: string;
  type: string;
  usage: string;
  level: number;
  name: string;
  bonus: number;
  cost: bigint;
  enabled: boolean;
}

export interface BuildingDefinition {
  id: string;
  type: string;
  level: number;
  name: string;
  cost: bigint;
  playerLevelRequirement: number;
  workersProvided?: number;
  offenseBonus: number;
  defenseBonus: number;
  spyBonus: number;
  sentryBonus: number;
  incomeBonus: number;
  maxItemBonus?: number;
  dailyMercStock?: number;
  enabled: boolean;
}

@Injectable()
export class GameDataService implements OnModuleInit {
  private readonly logger = new Logger(GameDataService.name);

  // In-memory caches (O(1) lookups)
  private units = new Map<string, UnitDefinition>();
  private items = new Map<string, ItemDefinition>();
  private buildings = new Map<string, BuildingDefinition>();
  private fortifications = new Map<number, any>();
  private battleUpgrades = new Map<string, any>();
  private economyUpgrades = new Map<string, any>();
  private races = new Map<string, any>();
  private config = new Map<string, any>();

  // Loading state
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.loadGameData();
  }

  /**
   * Load all game data from database into memory.
   * Called on server startup and when admin updates data.
   */
  async loadGameData(): Promise<void> {
    // Prevent concurrent loads
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this._loadGameData();
    await this.loadPromise;
    this.loadPromise = null;
  }

  private async _loadGameData(): Promise<void> {
    const startTime = Date.now();
    this.logger.log('Loading game data from database...');

    try {
      // Load all definitions in parallel
      const [
        unitsFromDb,
        itemsFromDb,
        buildingsFromDb,
        fortsFromDb,
        battleUpgradesFromDb,
        economyUpgradesFromDb,
        racesFromDb,
        configFromDb,
      ] = await Promise.all([
        this.prisma.unit.findMany({ where: { enabled: true } }),
        this.prisma.item.findMany({ where: { enabled: true } }),
        this.prisma.building.findMany({ where: { enabled: true } }),
        this.prisma.fortification.findMany({ where: { enabled: true } }),
        this.prisma.battleUpgrade.findMany({ where: { enabled: true } }),
        this.prisma.economyUpgrade.findMany({ where: { enabled: true } }),
        this.prisma.race.findMany({ where: { enabled: true } }),
        this.prisma.gameConfig.findMany(),
      ]);

      // Clear existing caches
      this.units.clear();
      this.items.clear();
      this.buildings.clear();
      this.fortifications.clear();
      this.battleUpgrades.clear();
      this.economyUpgrades.clear();
      this.races.clear();
      this.config.clear();

      // Index units by "TYPE_LEVEL"
      for (const unit of unitsFromDb) {
        this.units.set(`${unit.type}_${unit.level}`, unit as UnitDefinition);
      }

      // Index items by "TYPE_USAGE_LEVEL"
      for (const item of itemsFromDb) {
        this.items.set(`${item.type}_${item.usage}_${item.level}`, item as ItemDefinition);
      }

      // Index buildings by "TYPE_LEVEL"
      for (const building of buildingsFromDb) {
        this.buildings.set(`${building.type}_${building.level}`, {
          ...building,
          playerLevelRequirement: building.player_level_req,
          workersProvided: building.workers_provided ?? undefined,
          offenseBonus: building.offense_bonus,
          defenseBonus: building.defense_bonus,
          spyBonus: building.spy_bonus,
          sentryBonus: building.sentry_bonus,
          incomeBonus: building.income_bonus,
          maxItemBonus: building.max_item_bonus ?? undefined,
          dailyMercStock: building.daily_merc_stock ?? undefined,
        } as BuildingDefinition);
      }

      // Index fortifications by level
      for (const fort of fortsFromDb) {
        this.fortifications.set(fort.level, fort);
      }

      // Index battle upgrades by "TYPE_LEVEL"
      for (const upgrade of battleUpgradesFromDb) {
        this.battleUpgrades.set(`${upgrade.type}_${upgrade.level}`, upgrade);
      }

      // Index economy upgrades by "TYPE_LEVEL"
      for (const upgrade of economyUpgradesFromDb) {
        this.economyUpgrades.set(`${upgrade.type}_${upgrade.level}`, upgrade);
      }

      // Index races by id
      for (const race of racesFromDb) {
        this.races.set(race.id, race);
      }

      // Index config by key
      for (const cfg of configFromDb) {
        try {
          this.config.set(cfg.key, JSON.parse(cfg.value));
        } catch {
          this.config.set(cfg.key, cfg.value);
        }
      }

      this.isLoaded = true;
      const duration = Date.now() - startTime;

      this.logger.log(
        `Game data loaded in ${duration}ms: ` +
        `${this.units.size} units, ` +
        `${this.items.size} items, ` +
        `${this.buildings.size} buildings, ` +
        `${this.fortifications.size} fortifications, ` +
        `${this.battleUpgrades.size} battle upgrades, ` +
        `${this.economyUpgrades.size} economy upgrades, ` +
        `${this.races.size} races, ` +
        `${this.config.size} config entries`
      );

      // Emit event for other services
      this.eventEmitter.emit('game-data.loaded');

    } catch (error) {
      this.logger.error('Failed to load game data', error);
      throw error;
    }
  }

  /**
   * Hot reload game data (called by admin panel after updates).
   */
  async reload(): Promise<void> {
    this.logger.log('Reloading game data...');
    await this.loadGameData();
    this.eventEmitter.emit('game-data.reloaded');
  }

  // ─── Units ─────────────────────────────────────────────────

  getUnit(type: string, level: number): UnitDefinition | undefined {
    return this.units.get(`${type}_${level}`);
  }

  getAllUnits(): UnitDefinition[] {
    return Array.from(this.units.values());
  }

  getUnitsByType(type: string): UnitDefinition[] {
    return Array.from(this.units.values()).filter(u => u.type === type);
  }

  // ─── Items ─────────────────────────────────────────────────

  getItem(type: string, usage: string, level: number): ItemDefinition | undefined {
    return this.items.get(`${type}_${usage}_${level}`);
  }

  getAllItems(): ItemDefinition[] {
    return Array.from(this.items.values());
  }

  getItemsByUsage(usage: string): ItemDefinition[] {
    return Array.from(this.items.values()).filter(i => i.usage === usage);
  }

  // ─── Buildings ─────────────────────────────────────────────

  getBuilding(type: string, level: number): BuildingDefinition | undefined {
    return this.buildings.get(`${type}_${level}`);
  }

  getAllBuildings(): BuildingDefinition[] {
    return Array.from(this.buildings.values());
  }

  getBuildingsByType(type: string): BuildingDefinition[] {
    return Array.from(this.buildings.values()).filter(b => b.type === type);
  }

  // ─── Fortifications ────────────────────────────────────────

  getFortification(level: number): any {
    return this.fortifications.get(level);
  }

  getAllFortifications(): any[] {
    return Array.from(this.fortifications.values());
  }

  // ─── Battle Upgrades ───────────────────────────────────────

  getBattleUpgrade(type: string, level: number): any {
    return this.battleUpgrades.get(`${type}_${level}`);
  }

  getAllBattleUpgrades(): any[] {
    return Array.from(this.battleUpgrades.values());
  }

  // ─── Economy Upgrades ──────────────────────────────────────

  getEconomyUpgrade(type: string, level: number): any {
    return this.economyUpgrades.get(`${type}_${level}`);
  }

  getAllEconomyUpgrades(): any[] {
    return Array.from(this.economyUpgrades.values());
  }

  // ─── Races ─────────────────────────────────────────────────

  getRace(id: string): any {
    return this.races.get(id);
  }

  getAllRaces(): any[] {
    return Array.from(this.races.values());
  }

  // ─── Config ────────────────────────────────────────────────

  getConfig<T = any>(key: string, defaultValue?: T): T {
    return this.config.get(key) ?? defaultValue;
  }

  getAllConfig(): Map<string, any> {
    return new Map(this.config);
  }

  // ─── Utilities ─────────────────────────────────────────────

  isDataLoaded(): boolean {
    return this.isLoaded;
  }

  async waitForLoad(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) await this.loadPromise;
    if (!this.isLoaded) {
      throw new Error('Game data failed to load');
    }
  }
}
```

## Migration Strategy

### Phase-by-Phase Approach

We'll migrate **one feature at a time**, testing thoroughly before moving to the next.

#### Phase 0: Foundation (Week 1)
- [ ] Create database schema (add tables to `schema.prisma`)
- [ ] Generate Prisma client (`pnpm db:push`)
- [ ] Create `GameDataService` skeleton
- [ ] Create migration script to seed from current `game-logic` data
- [ ] Add `GameDataModule` and register as global
- [ ] Test: Server boots successfully, cache loads

#### Phase 1: Units (Week 1-2)
**Files to migrate:**
- `packages/game-logic/src/units.ts` → Database
- `apps/api/src/training/training.service.ts` → Use `GameDataService`
- `apps/web/src/app/(game)/battle/training/page.tsx` → Fetch from API

**Steps:**
1. Seed `units` table from `UnitTypes` array
2. Update `GameDataService.getUnit()` implementation
3. Update `TrainingService` to inject `GameDataService`
4. Replace all `getUnitByTypeAndLevel()` calls with `gameData.getUnit()`
5. Test training page thoroughly (train, untrain, convert)
6. Monitor performance (should be same or better)

**Rollback:** Keep `game-logic` imports alongside service calls, use feature flag to switch

#### Phase 2: Items (Week 2-3)
**Files to migrate:**
- `packages/game-logic/src/items.ts` → Database
- `apps/api/src/armory/armory.service.ts` → Use `GameDataService`
- `apps/web/src/app/(game)/structures/armory/page.tsx` → Fetch from API

**Steps:**
1. Seed `items` table from `ItemTypes` array
2. Update `GameDataService.getItem()` implementation
3. Update `ArmoryService` to use `GameDataService`
4. Test armory page (equip, unequip, purchase)

#### Phase 3: Buildings (Week 3-4)
**Files to migrate:**
- `packages/game-logic/src/buildings.ts` → Database
- `apps/api/src/structures/structures.service.ts` → Use `GameDataService`
- `apps/web/src/app/(game)/structures/buildings/page.tsx` → Fetch from API
- `apps/web/src/app/(game)/structures/mercenary/page.tsx` → Fetch from API

**Steps:**
1. Seed `buildings` table
2. Update building-related services
3. Test buildings page, mercenary camp

#### Phase 4: Fortifications (Week 4)
**Files to migrate:**
- `packages/game-logic/src/fortifications.ts` → Database
- All services using fortifications

#### Phase 5: Battle Upgrades (Week 5)
**Files to migrate:**
- `packages/game-logic/src/battle-upgrades.ts` → Database
- `apps/api/src/structures/structures.service.ts` (battle upgrade methods)

#### Phase 6: Economy Upgrades (Week 5)
**Files to migrate:**
- `packages/game-logic/src/economy-upgrades.ts` → Database

#### Phase 7: Races (Week 6)
**Files to migrate:**
- Race bonuses currently hardcoded → Database with multipliers

#### Phase 8: Formulas & Config (Week 6)
**Files to keep in code:**
- XP calculation formulas
- Combat formulas (too complex for DB)

**Config table for:**
- Global multipliers (XP, gold, cost adjustments)
- Feature flags
- Event modifiers (double XP weekend, etc.)

### Testing Checklist (Per Phase)

For each migrated feature:

- [ ] **Unit tests pass** - Service layer works
- [ ] **Integration tests pass** - API endpoints work
- [ ] **Manual testing** - Frontend page works
- [ ] **Performance check** - No slower than before
- [ ] **Cache reload works** - Admin can update data
- [ ] **Rollback tested** - Can revert if needed
- [ ] **Data validation** - Bad data doesn't crash server
- [ ] **Edge cases** - Missing data, level 0, disabled items

## Admin Panel Requirements

Need admin UI to manage game data:

### Admin Routes

```
/admin/game-data/units
  - List all units
  - Create new unit
  - Edit unit (name, cost, stats)
  - Enable/disable unit
  - Delete unit (soft delete)

/admin/game-data/items
  - List all items
  - Create new item
  - Edit item
  - Enable/disable item

/admin/game-data/buildings
  - List all buildings
  - Create new building
  - Edit building
  - Enable/disable building

/admin/game-data/config
  - Edit global multipliers
  - Toggle feature flags
  - Set event modifiers

/admin/game-data/cache
  - View cache status
  - Reload cache button
  - Last loaded timestamp
```

### Admin API Endpoints

```typescript
// apps/api/src/admin/game-data/game-data-admin.controller.ts

@Controller('admin/game-data')
@Roles('ADMIN')
export class GameDataAdminController {
  constructor(
    private gameData: GameDataService,
    private prisma: PrismaService,
  ) {}

  // ─── Units ─────────────────────────────────────────────

  @Get('units')
  async listUnits() {
    return this.prisma.unit.findMany({ orderBy: [{ type: 'asc' }, { level: 'asc' }] });
  }

  @Post('units')
  async createUnit(@Body() dto: CreateUnitDto) {
    const unit = await this.prisma.unit.create({ data: dto });
    await this.gameData.reload(); // Hot reload cache
    return unit;
  }

  @Patch('units/:id')
  async updateUnit(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
    const unit = await this.prisma.unit.update({ where: { id }, data: dto });
    await this.gameData.reload();
    return unit;
  }

  @Delete('units/:id')
  async deleteUnit(@Param('id') id: string) {
    // Soft delete (set enabled = false)
    const unit = await this.prisma.unit.update({
      where: { id },
      data: { enabled: false }
    });
    await this.gameData.reload();
    return unit;
  }

  // ─── Cache Management ──────────────────────────────────

  @Post('cache/reload')
  async reloadCache() {
    const startTime = Date.now();
    await this.gameData.reload();
    const duration = Date.now() - startTime;

    return {
      message: 'Game data cache reloaded successfully',
      duration,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('cache/status')
  getCacheStatus() {
    return {
      loaded: this.gameData.isDataLoaded(),
      counts: {
        units: this.gameData.getAllUnits().length,
        items: this.gameData.getAllItems().length,
        buildings: this.gameData.getAllBuildings().length,
      },
    };
  }
}
```

## Data Seeding Script

Create migration script to seed database from current `game-logic`:

```typescript
// packages/db/scripts/seed-game-data.ts

import { PrismaClient } from '@prisma/client';
import { UnitTypes, ItemTypes, Fortifications, Buildings, BattleUpgrades, EconomyUpgrades } from '@openthrone/game-logic';

const prisma = new PrismaClient();

async function seedGameData() {
  console.log('Seeding game data from game-logic package...');

  // Seed units
  console.log('Seeding units...');
  for (const unit of UnitTypes) {
    await prisma.unit.upsert({
      where: { type_level: { type: unit.type, level: unit.level } },
      update: {
        name: unit.name,
        cost: BigInt(unit.cost),
        offense: unit.offense,
        defense: unit.defense,
        spy: unit.spy,
        sentry: unit.sentry,
      },
      create: {
        type: unit.type,
        level: unit.level,
        name: unit.name,
        cost: BigInt(unit.cost),
        offense: unit.offense,
        defense: unit.defense,
        spy: unit.spy,
        sentry: unit.sentry,
        enabled: true,
      },
    });
  }
  console.log(`✓ Seeded ${UnitTypes.length} units`);

  // Seed items
  console.log('Seeding items...');
  for (const item of ItemTypes) {
    await prisma.item.upsert({
      where: { type_usage_level: { type: item.type, usage: item.usage, level: item.level } },
      update: {
        name: `${item.usage} ${item.type} Tier ${item.level}`,
        bonus: item.bonus,
        cost: BigInt(item.cost),
      },
      create: {
        type: item.type,
        usage: item.usage,
        level: item.level,
        name: `${item.usage} ${item.type} Tier ${item.level}`,
        bonus: item.bonus,
        cost: BigInt(item.cost),
        enabled: true,
      },
    });
  }
  console.log(`✓ Seeded ${ItemTypes.length} items`);

  // Seed buildings
  console.log('Seeding buildings...');
  for (const [type, levels] of Object.entries(Buildings)) {
    for (const building of levels) {
      await prisma.building.upsert({
        where: { type_level: { type, level: building.level } },
        update: {
          name: building.name,
          cost: BigInt(building.cost),
          player_level_req: building.playerLevelRequirement,
          workers_provided: building.workersProvided,
          offense_bonus: building.offenseBonus ?? 0,
          defense_bonus: building.defenseBonus ?? 0,
          spy_bonus: building.spyBonus ?? 0,
          sentry_bonus: building.sentryBonus ?? 0,
          income_bonus: building.incomeBonus ?? 0,
          max_item_bonus: building.maxItemBonus,
          daily_merc_stock: building.dailyMercStock,
        },
        create: {
          type,
          level: building.level,
          name: building.name,
          cost: BigInt(building.cost),
          player_level_req: building.playerLevelRequirement,
          workers_provided: building.workersProvided,
          offense_bonus: building.offenseBonus ?? 0,
          defense_bonus: building.defenseBonus ?? 0,
          spy_bonus: building.spyBonus ?? 0,
          sentry_bonus: building.sentryBonus ?? 0,
          income_bonus: building.incomeBonus ?? 0,
          max_item_bonus: building.maxItemBonus,
          daily_merc_stock: building.dailyMercStock,
          enabled: true,
        },
      });
    }
  }
  console.log(`✓ Seeded buildings`);

  // TODO: Seed fortifications, battle upgrades, economy upgrades, races

  console.log('Game data seeding complete!');
}

seedGameData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Add to `package.json`:
```json
{
  "scripts": {
    "db:seed-game-data": "tsx packages/db/scripts/seed-game-data.ts"
  }
}
```

## Feature Flags & Rollback

### Feature Flag Pattern

```typescript
// apps/api/src/common/guards/feature-flag.guard.ts

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private gameData: GameDataService) {}

  canActivate(context: ExecutionContext): boolean {
    const useGameDataService = this.gameData.getConfig('use_game_data_service', false);
    return useGameDataService;
  }
}

// Usage:
@UseGuards(FeatureFlagGuard)
@Get('training/status')
async getTrainingStatus() {
  // This route only works if feature flag is enabled
}
```

### Rollback Strategy

If a migration phase fails:

1. **Set feature flag** - Disable `use_game_data_service`
2. **Revert code** - Services fall back to `game-logic` imports
3. **Fix issue** - Debug and fix
4. **Re-enable** - Turn flag back on
5. **Monitor** - Watch for errors

## Performance Monitoring

### Metrics to Track

```typescript
// apps/api/src/game-data/game-data.interceptor.ts

@Injectable()
export class GameDataMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        // Log slow lookups
        if (duration > 100) {
          console.warn(`Slow game data lookup: ${duration}ms`);
        }
      }),
    );
  }
}
```

**Expected performance:**
- In-memory Map lookups: **< 1ms**
- Database seed at boot: **< 5s**
- Cache reload (hot reload): **< 2s**

If lookups are slow, investigate:
- Map key format (ensure consistent)
- Data volume (should handle 10,000+ definitions easily)
- Garbage collection (check memory leaks)

## Success Metrics

### Before Migration
- ❌ New item requires code change + deployment
- ❌ Balance changes need PR review cycle
- ❌ Can't A/B test configurations
- ❌ No historical tracking of changes
- ❌ Can't disable broken items dynamically

### After Migration
- ✅ New item added via admin panel in 30 seconds
- ✅ Balance changes applied instantly (hot reload)
- ✅ A/B test different servers with different configs
- ✅ Full audit log of who changed what
- ✅ Instant rollback of bad changes

## Timeline Estimate

| Phase | Duration | Risk | Priority |
|-------|----------|------|----------|
| 0. Foundation | 3-5 days | Low | Critical |
| 1. Units | 5-7 days | Medium | High |
| 2. Items | 4-6 days | Medium | High |
| 3. Buildings | 5-7 days | Medium | High |
| 4. Fortifications | 2-3 days | Low | Medium |
| 5. Battle Upgrades | 3-4 days | Low | Medium |
| 6. Economy Upgrades | 3-4 days | Low | Medium |
| 7. Races | 4-5 days | Medium | Low |
| 8. Config | 2-3 days | Low | Medium |
| **Total** | **6-8 weeks** | | |

## Next Steps

1. ✅ Review this plan with team
2. ⏳ Create database schema PR
3. ⏳ Implement `GameDataService`
4. ⏳ Create seed script
5. ⏳ Start Phase 1 (Units)

## Questions to Resolve

- [ ] Do we need Redis for multi-server caching? (Probably not initially)
- [ ] Should we version definitions for rollback? (Nice to have)
- [ ] How to handle formula changes? (Keep formulas in code for now)
- [ ] Do we need real-time sync across servers? (WebSocket broadcast cache reloads?)
- [ ] Audit logging strategy? (Prisma middleware or separate audit table?)

---

**Status**: 📋 Planning Phase
**Owner**: TBD
**Last Updated**: 2026-02-23
