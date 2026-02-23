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
      ] = await Promise.all([
        this.prisma.unit.findMany({ where: { enabled: true } }),
        this.prisma.item.findMany({ where: { enabled: true } }),
        this.prisma.building.findMany({ where: { enabled: true } }),
        this.prisma.fortification.findMany({ where: { enabled: true } }),
        this.prisma.battleUpgrade.findMany({ where: { enabled: true } }),
        this.prisma.economyUpgrade.findMany({ where: { enabled: true } }),
        this.prisma.race.findMany({ where: { enabled: true } }),
        // TODO Phase 8: Add gameConfig.findMany() once GameConfig model is added
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

      // TODO Phase 8: Index config by key once GameConfig model is added
      // for (const cfg of configFromDb) {
      //   try {
      //     this.config.set(cfg.key, JSON.parse(cfg.value));
      //   } catch {
      //     this.config.set(cfg.key, cfg.value);
      //   }
      // }

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
