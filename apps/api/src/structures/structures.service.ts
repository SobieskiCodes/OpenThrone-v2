import { Injectable, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { StructureUpgradedEvent } from '@openthrone/events';
import { FortRepairedEvent } from '@openthrone/events';
import { PlayerStateChangedEvent } from '../game/events';
// Phase 3: Migrated Buildings to GameDataService (keeping import for rollback)
// Phase 4: Migrated Fortifications to GameDataService (keeping import for rollback)
import {
  // Fortifications, getFortificationByLevel, getNextFortification, // Phase 4 migration
  BattleUpgrades,
  getBattleUpgradesByType,
  // getUnitByTypeAndLevel, // Phase 1 migration
  getLevelForXP,
  // Buildings, getBuildingDefinition, getBuildingLevel, getNextBuildingLevel, getMaxBuildingLevel, canUpgradeBuilding, // Phase 3 migration
  MERCENARY_PRICE_MULTIPLIER,
  getMercenaryStockDistribution,
} from '@openthrone/game-logic';
import {
  StructureUpgradeType,
  BattleUpgradeType,
  BankAccountType,
  BankTransferHistoryType,
  BuildingType,
  UnitType,
} from '@openthrone/shared';
import type {
  PurchaseStructureUpgradeDto,
  PurchaseBattleUpgradeDto,
  SellBattleUpgradeDto,
  RepairFortDto,
  BuyMercenaryDto,
  UpgradeBuildingDto,
} from '@openthrone/shared';
import { buildPlayerSnapshot } from '../common/helpers/player-snapshot.helper';
import { GameDataService } from '../game-data/game-data.service';

@Injectable()
export class StructuresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly gameData: GameDataService,
  ) {}

  // ─── Buildings (new system) ──────────────────────────────────────────

  async getBuildingsStatus(playerId: string) {
    const [buildings, economy, stats] = await Promise.all([
      this.prisma.playerBuilding.findMany({ where: { player_id: playerId } }),
      this.prisma.playerEconomy.findUnique({ where: { player_id: playerId } }),
      this.prisma.playerStats.findUnique({ where: { player_id: playerId } }),
    ]);

    if (!economy) throw new BadRequestException('Player economy not found');

    const playerLevel = getLevelForXP(stats?.experience ?? 0);
    const gold = BigInt(economy.gold);

    const getBuildingLevelForPlayer = (type: string): number => {
      const entry = buildings.find((b) => b.building_type === type);
      return entry?.level ?? 0;
    };

    const buildingTypes = Object.values(BuildingType);
    const buildingStatuses = buildingTypes.map((type) => {
      const currentLevel = getBuildingLevelForPlayer(type);
      // Phase 3: Using GameDataService
      const currentLevelDef = currentLevel > 0 ? this.gameData.getBuilding(type, currentLevel) : null;
      // Phase 3: Using GameDataService
      const nextLevelDef = this.gameData.getBuilding(type, currentLevel + 1);
      // Phase 3: Using GameDataService
      const maxLevel = this.gameData.getBuildingsByType(type).length;
      // Phase 3: Inline canUpgradeBuilding logic
      let upgradeCheck: { canUpgrade: boolean; reason?: string };
      if (!nextLevelDef) {
        upgradeCheck = { canUpgrade: false, reason: 'Already at maximum level' };
      } else if (playerLevel < nextLevelDef.playerLevelRequirement) {
        upgradeCheck = {
          canUpgrade: false,
          reason: `Requires player level ${nextLevelDef.playerLevelRequirement} (you are level ${playerLevel})`,
        };
      } else if (gold < BigInt(nextLevelDef.cost)) {
        upgradeCheck = {
          canUpgrade: false,
          reason: `Not enough gold. Required: ${nextLevelDef.cost}`,
        };
      } else {
        upgradeCheck = { canUpgrade: true };
      }
      // Phase 3: Building descriptions not stored in DB yet (TODO: add to schema or use static map)
      const description = '';

      return {
        buildingType: type,
        description,
        currentLevel,
        currentLevelName: currentLevelDef?.name ?? 'Not Built',
        nextLevel: nextLevelDef
          ? {
              level: nextLevelDef.level,
              name: nextLevelDef.name,
              cost: nextLevelDef.cost,
              playerLevelRequirement: nextLevelDef.playerLevelRequirement,
              fortHitpoints: nextLevelDef.fortHitpoints,
              incomeBonusPercent: nextLevelDef.incomeBonusPercent,
              spyOffenseBonus: nextLevelDef.spyOffenseBonus,
              citizensPerDay: nextLevelDef.citizensPerDay,
              dailyMercStock: nextLevelDef.dailyMercStock,
            }
          : null,
        canUpgrade: upgradeCheck.canUpgrade,
        upgradeBlockedReason: upgradeCheck.reason,
        maxLevel,
      };
    });

    return {
      gold: economy.gold.toString(),
      goldInBank: economy.gold_in_bank.toString(),
      playerLevel,
      buildings: buildingStatuses,
      // Phase 3: Using GameDataService
      definitions: this.gameData.getAllBuildings(),
    };
  }

  async upgradeBuilding(playerId: string, dto: UpgradeBuildingDto) {
    const { buildingType } = dto;

    const result = await this.prisma.$transaction(async (tx) => {
      const [buildings, economy, stats] = await Promise.all([
        tx.playerBuilding.findMany({ where: { player_id: playerId } }),
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerStats.findUnique({ where: { player_id: playerId } }),
      ]);

      if (!economy) throw new BadRequestException('Player economy not found');

      const playerLevel = getLevelForXP(stats?.experience ?? 0);
      const gold = BigInt(economy.gold);

      const currentEntry = buildings.find((b) => b.building_type === buildingType);
      const currentLevel = currentEntry?.level ?? 0;

      // Phase 3: Using GameDataService
      const nextLevelDef = this.gameData.getBuilding(buildingType, currentLevel + 1);
      if (!nextLevelDef) {
        throw new BadRequestException(`${buildingType} is already at maximum level`);
      }

      if (playerLevel < nextLevelDef.playerLevelRequirement) {
        throw new BadRequestException(
          `${nextLevelDef.name} requires player level ${nextLevelDef.playerLevelRequirement} (you are level ${playerLevel})`,
        );
      }

      if (gold < BigInt(nextLevelDef.cost)) {
        throw new BadRequestException(
          `Not enough gold. Required: ${nextLevelDef.cost}, Available: ${gold}`,
        );
      }

      const newGold = gold - BigInt(nextLevelDef.cost);

      // Deduct gold
      await tx.playerEconomy.update({
        where: { player_id: playerId },
        data: { gold: newGold },
      });

      // Upsert building level
      await tx.playerBuilding.upsert({
        where: {
          player_id_building_type: {
            player_id: playerId,
            building_type: buildingType,
          },
        },
        update: { level: nextLevelDef.level },
        create: {
          player_id: playerId,
          building_type: buildingType,
          level: nextLevelDef.level,
        },
      });

      // Special case: FORTIFICATION upgrades also reset fort hitpoints
      if (buildingType === BuildingType.FORTIFICATION && nextLevelDef.fortHitpoints) {
        await tx.playerFortification.upsert({
          where: { player_id: playerId },
          update: {
            fort_level: nextLevelDef.level,
            hitpoints: nextLevelDef.fortHitpoints,
          },
          create: {
            player_id: playerId,
            fort_level: nextLevelDef.level,
            hitpoints: nextLevelDef.fortHitpoints,
          },
        });
      }

      // Bank history
      await this.createBankHistory(tx, playerId, BigInt(nextLevelDef.cost), 'BUILDING_UPGRADE', {
        buildingType,
        fromLevel: currentLevel,
        toLevel: nextLevelDef.level,
        name: nextLevelDef.name,
      });

      return {
        newGold: newGold.toString(),
        newLevel: nextLevelDef.level,
        goldSpent: nextLevelDef.cost,
        name: nextLevelDef.name,
      };
    });

    // Emit event after transaction
    this.eventEmitter.emit(
      'structure.upgraded',
      new StructureUpgradedEvent(
        playerId,
        `BUILDING_${buildingType}`,
        result.newLevel,
        BigInt(result.goldSpent),
      ),
    );

    // Emit WebSocket event for real-time state sync
    this.eventEmitter.emit(
      'player.state.changed',
      new PlayerStateChangedEvent({
        playerId,
        gold: BigInt(result.newGold),
      }),
    );

    // Build player state snapshot for cache sync
    const playerState = await buildPlayerSnapshot(this.prisma, this.gameData, playerId, {
      includeBuildings: true, // Buildings changed
    });

    return {
      gold: result.newGold,
      buildingType,
      newLevel: result.newLevel,
      name: result.name,
      playerState,
    };
  }

  // ─── Legacy Structures Status (includes buildings data) ──────────────

  async getStructuresStatus(playerId: string) {
    const [economy, fort, battleUpgrades, stats, units, buildings] =
      await Promise.all([
        this.prisma.playerEconomy.findUnique({ where: { player_id: playerId } }),
        this.prisma.playerFortification.findUnique({ where: { player_id: playerId } }),
        this.prisma.playerBattleUpgrade.findMany({ where: { player_id: playerId } }),
        this.prisma.playerStats.findUnique({ where: { player_id: playerId } }),
        this.prisma.playerUnit.findMany({ where: { player_id: playerId } }),
        this.prisma.playerBuilding.findMany({ where: { player_id: playerId } }),
      ]);

    if (!economy) throw new BadRequestException('Player economy not found');

    const fortLevel = fort?.fort_level ?? 1;
    const fortHitpoints = fort?.hitpoints ?? 50;
    const fortDef = this.gameData.getFortification(fortLevel);
    const playerLevel = getLevelForXP(stats?.experience ?? 0);

    const getBuildingLevelForPlayer = (type: string): number => {
      const entry = buildings.find((b) => b.building_type === type);
      return entry?.level ?? 0;
    };

    return {
      gold: economy.gold.toString(),
      goldInBank: economy.gold_in_bank.toString(),
      playerLevel,
      fort: {
        level: fortLevel,
        name: fortDef?.name ?? 'Manor',
        hitpoints: fortHitpoints,
        maxHitpoints: fortDef?.hitpoints ?? 50,
        costPerRepairPoint: fortDef?.costPerRepairPoint ?? 5,
        goldPerTurn: fortDef?.goldPerTurn ?? 1000,
        defenseBonusPercentage: fortDef?.defenseBonusPercentage ?? 5,
      },
      buildings: Object.values(BuildingType).map((type) => ({
        buildingType: type,
        level: getBuildingLevelForPlayer(type),
      })),
      battleUpgrades: battleUpgrades.map((bu) => ({
        upgradeType: bu.upgrade_type,
        level: bu.level,
        quantity: bu.quantity,
      })),
      units: units.map((u) => ({
        unitType: u.unit_type,
        level: u.level,
        quantity: u.quantity,
      })),
      definitions: {
        // Phase 4: Using GameDataService
        fortifications: this.gameData.getAllFortifications(),
        battle: BattleUpgrades,
        // Phase 3: Using GameDataService
        buildings: this.gameData.getAllBuildings(),
      },
    };
  }

  // ─── Legacy upgrade (delegates to buildings system) ──

  async upgrade(playerId: string, dto: PurchaseStructureUpgradeDto) {
    // Map old structure types to new building types
    const buildingTypeMap: Partial<Record<StructureUpgradeType, BuildingType>> = {
      [StructureUpgradeType.FORT]: BuildingType.FORTIFICATION,
      [StructureUpgradeType.HOUSE]: BuildingType.HOUSING,
      [StructureUpgradeType.ECONOMY]: BuildingType.MINE,
      [StructureUpgradeType.ARMORY]: BuildingType.ARMORY,
      [StructureUpgradeType.MERCENARY_CAMP]: BuildingType.MERCENARY_CAMP,
    };

    const mappedBuildingType = buildingTypeMap[dto.upgradeType];
    if (mappedBuildingType) {
      // Delegate to the new buildings system
      return this.upgradeBuilding(playerId, { buildingType: mappedBuildingType });
    }

    throw new BadRequestException(`Unknown upgrade type: ${dto.upgradeType}`);
  }

  // ─── Fort Repair ────────────────────────────────────────────────────

  async repair(playerId: string, dto: RepairFortDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, fort] = await Promise.all([
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerFortification.findUnique({ where: { player_id: playerId } }),
      ]);

      if (!economy) throw new BadRequestException('Player economy not found');

      const fortLevel = fort?.fort_level ?? 1;
      const currentHp = fort?.hitpoints ?? 50;
      const fortDef = this.gameData.getFortification(fortLevel);
      if (!fortDef) throw new BadRequestException('Invalid fortification level');

      const maxHp = fortDef.hitpoints;
      if (currentHp >= maxHp) {
        throw new BadRequestException('Fortification is already at full health');
      }

      // Cap repair to what's actually needed
      const actualRepair = Math.min(dto.points, maxHp - currentHp);
      const totalCost = actualRepair * fortDef.costPerRepairPoint;

      const gold = BigInt(economy.gold);
      if (gold < BigInt(totalCost)) {
        throw new BadRequestException(
          `Not enough gold. Required: ${totalCost}, Available: ${gold}`,
        );
      }

      const newGold = gold - BigInt(totalCost);
      const newHp = currentHp + actualRepair;

      await tx.playerEconomy.update({
        where: { player_id: playerId },
        data: { gold: newGold },
      });

      await tx.playerFortification.upsert({
        where: { player_id: playerId },
        update: { hitpoints: newHp },
        create: { player_id: playerId, fort_level: fortLevel, hitpoints: newHp },
      });

      await tx.bankHistory.create({
        data: {
          gold_amount: BigInt(totalCost),
          from_user_id: playerId,
          from_account_type: BankAccountType.HAND,
          to_user_id: playerId,
          to_account_type: BankAccountType.BANK,
          date_time: new Date(),
          history_type: BankTransferHistoryType.FORT_REPAIR,
          stats: JSON.stringify({
            type: 'FORT_REPAIR',
            pointsRepaired: actualRepair,
            newHitpoints: newHp,
            maxHitpoints: maxHp,
          }),
        },
      });

      return {
        newGold: newGold.toString(),
        repaired: actualRepair,
        newHitpoints: newHp,
        maxHitpoints: maxHp,
        goldSpent: totalCost,
      };
    });

    this.eventEmitter.emit(
      'fort.repaired',
      new FortRepairedEvent(
        playerId,
        result.repaired,
        result.newHitpoints,
        BigInt(result.goldSpent),
      ),
    );

    // Emit WebSocket event for real-time state sync
    this.eventEmitter.emit(
      'player.state.changed',
      new PlayerStateChangedEvent({
        playerId,
        gold: BigInt(result.newGold),
      }),
    );

    return result;
  }

  // ─── Battle Upgrades ────────────────────────────────────────────────

  async purchaseBattleUpgrade(playerId: string, dto: PurchaseBattleUpgradeDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, existingUpgrades, units, bonusPoints] = await Promise.all([
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerBattleUpgrade.findMany({ where: { player_id: playerId } }),
        tx.playerUnit.findMany({ where: { player_id: playerId } }),
        tx.playerBonusPoint.findMany({ where: { player_id: playerId } }),
      ]);

      if (!economy) throw new BadRequestException('Player economy not found');

      // Find the battle upgrade definition
      const allDefsForType = getBattleUpgradesByType(dto.upgradeType as BattleUpgradeType);
      const def = allDefsForType.find((d) => d.level === dto.level);
      if (!def) {
        throw new BadRequestException(`No battle upgrade found for ${dto.upgradeType} level ${dto.level}`);
      }

      // Check unit tier requirement — player must have units of the required tier
      const unitType = this.battleUpgradeTypeToUnitType(dto.upgradeType);
      const unitsOfTier = units.find(
        (u) => u.unit_type === unitType && u.level === def.minUnitLevel,
      );
      const tierUnitCount = unitsOfTier?.quantity ?? 0;
      if (tierUnitCount <= 0) {
        throw new BadRequestException(
          `${def.name} requires Tier ${def.minUnitLevel} ${unitType} units. Train them first!`,
        );
      }

      // Max is limited by units of the required tier
      const existing = existingUpgrades.find(
        (u) => u.upgrade_type === dto.upgradeType && u.level === dto.level,
      );
      const currentQty = existing?.quantity ?? 0;
      if (currentQty + dto.quantity > tierUnitCount) {
        throw new BadRequestException(
          `Cannot own more ${def.name} than Tier ${def.minUnitLevel} units (${tierUnitCount}). You already own ${currentQty}.`,
        );
      }

      // Apply PRICES bonus discount
      const pricesBonus = bonusPoints.find((bp) => bp.bonus_type === 'PRICES');
      const pricesBonusPercent = pricesBonus?.level ?? 0;
      const discountedCostPerUnit = def.cost - Math.ceil((pricesBonusPercent / 100) * def.cost);
      const totalCost = discountedCostPerUnit * dto.quantity;

      const gold = BigInt(economy.gold);
      if (gold < BigInt(totalCost)) {
        throw new BadRequestException(
          `Not enough gold. Required: ${totalCost}, Available: ${gold}`,
        );
      }

      const newGold = gold - BigInt(totalCost);
      await tx.playerEconomy.update({
        where: { player_id: playerId },
        data: { gold: newGold },
      });

      await tx.playerBattleUpgrade.upsert({
        where: {
          player_id_upgrade_type_level: {
            player_id: playerId,
            upgrade_type: dto.upgradeType,
            level: dto.level,
          },
        },
        update: { quantity: currentQty + dto.quantity },
        create: {
          player_id: playerId,
          upgrade_type: dto.upgradeType,
          level: dto.level,
          quantity: dto.quantity,
        },
      });

      await this.createBankHistory(tx, playerId, BigInt(totalCost), 'BATTLE_UPGRADE', {
        upgradeType: dto.upgradeType,
        level: dto.level,
        quantity: dto.quantity,
        name: def.name,
      });

      const updatedUpgrades = await tx.playerBattleUpgrade.findMany({
        where: { player_id: playerId },
      });

      return {
        gold: newGold.toString(),
        goldSpent: totalCost,
        battleUpgrades: updatedUpgrades.map((bu) => ({
          upgradeType: bu.upgrade_type,
          level: bu.level,
          quantity: bu.quantity,
        })),
      };
    });

    this.eventEmitter.emit(
      'structure.upgraded',
      new StructureUpgradedEvent(
        playerId,
        `BATTLE_${dto.upgradeType}`,
        dto.quantity,
        BigInt(result.goldSpent),
      ),
    );

    // Emit WebSocket event for real-time state sync
    this.eventEmitter.emit(
      'player.state.changed',
      new PlayerStateChangedEvent({
        playerId,
        gold: BigInt(result.gold),
      }),
    );

    // Build player state snapshot for cache sync
    const playerState = await buildPlayerSnapshot(this.prisma, this.gameData, playerId);

    return { ...result, playerState };
  }

  async sellBattleUpgrade(playerId: string, dto: SellBattleUpgradeDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, existingUpgrades, bonusPoints] = await Promise.all([
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerBattleUpgrade.findMany({ where: { player_id: playerId } }),
        tx.playerBonusPoint.findMany({ where: { player_id: playerId } }),
      ]);

      if (!economy) throw new BadRequestException('Player economy not found');

      const allDefsForType = getBattleUpgradesByType(dto.upgradeType as BattleUpgradeType);
      const def = allDefsForType.find((d) => d.level === dto.level);
      if (!def) {
        throw new BadRequestException(`No battle upgrade found for ${dto.upgradeType} level ${dto.level}`);
      }

      const existing = existingUpgrades.find(
        (u) => u.upgrade_type === dto.upgradeType && u.level === dto.level,
      );
      const currentQty = existing?.quantity ?? 0;
      if (currentQty < dto.quantity) {
        throw new BadRequestException(
          `Not enough ${def.name} to sell. You have ${currentQty}, tried to sell ${dto.quantity}.`,
        );
      }

      // Apply PRICES bonus discount (same discount on refund)
      const pricesBonus = bonusPoints.find((bp) => bp.bonus_type === 'PRICES');
      const pricesBonusPercent = pricesBonus?.level ?? 0;
      const discountedCostPerUnit = def.cost - Math.ceil((pricesBonusPercent / 100) * def.cost);
      const totalRefund = Math.floor(discountedCostPerUnit * dto.quantity * 0.75);

      const newGold = BigInt(economy.gold) + BigInt(totalRefund);

      await tx.playerEconomy.update({
        where: { player_id: playerId },
        data: { gold: newGold },
      });

      await tx.playerBattleUpgrade.update({
        where: {
          player_id_upgrade_type_level: {
            player_id: playerId,
            upgrade_type: dto.upgradeType,
            level: dto.level,
          },
        },
        data: { quantity: currentQty - dto.quantity },
      });

      await this.createBankHistory(tx, playerId, BigInt(totalRefund), 'BATTLE_UPGRADE_SELL', {
        upgradeType: dto.upgradeType,
        level: dto.level,
        quantity: dto.quantity,
        name: def.name,
      });

      const updatedUpgrades = await tx.playerBattleUpgrade.findMany({
        where: { player_id: playerId },
      });

      return {
        gold: newGold.toString(),
        refund: totalRefund,
        battleUpgrades: updatedUpgrades.map((bu) => ({
          upgradeType: bu.upgrade_type,
          level: bu.level,
          quantity: bu.quantity,
        })),
      };
    });

    // Emit WebSocket event for real-time state sync
    this.eventEmitter.emit(
      'player.state.changed',
      new PlayerStateChangedEvent({
        playerId,
        gold: BigInt(result.gold),
      }),
    );

    // Build player state snapshot for cache sync
    const playerState = await buildPlayerSnapshot(this.prisma, this.gameData, playerId);

    return { ...result, playerState };
  }

  private battleUpgradeTypeToUnitType(upgradeType: string): string {
    switch (upgradeType) {
      case BattleUpgradeType.OFFENSE: return 'OFFENSE';
      case BattleUpgradeType.DEFENSE: return 'DEFENSE';
      case BattleUpgradeType.SPY: return 'SPY';
      case BattleUpgradeType.SENTRY: return 'SENTRY';
      default: return 'OFFENSE';
    }
  }

  // ─── Mercenary (reads from PlayerBuilding) ──────────────────────────

  async getMercenaryStatus(playerId: string) {
    const [buildings, purchases] = await Promise.all([
      this.prisma.playerBuilding.findMany({ where: { player_id: playerId } }),
      this.prisma.mercenaryDailyPurchase.findMany({ where: { player_id: playerId } }),
    ]);

    const campEntry = buildings.find(
      (b) => b.building_type === BuildingType.MERCENARY_CAMP,
    );
    const campLevel = campEntry?.level ?? 0;

    // Camp must be at least level 1 to have any stock
    // Phase 3: Using GameDataService
    const campLevelDef = campLevel >= 1 ? this.gameData.getBuilding(BuildingType.MERCENARY_CAMP, campLevel) : null;
    // Phase 3: Using GameDataService
    const nextLevelDef = this.gameData.getBuilding(BuildingType.MERCENARY_CAMP, campLevel + 1);
    const dailyMercStock = campLevelDef?.dailyMercStock ?? 0;
    const distribution = getMercenaryStockDistribution(dailyMercStock);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const unitTypes = ['OFFENSE', 'DEFENSE', 'SPY', 'SENTRY'] as const;
    const stock = unitTypes.map((ut) => {
      const total = distribution[ut];
      const record = purchases.find((p) => p.unit_type === ut);

      // Self-reset: if the record's reset_date is before today, treat purchased as 0
      let purchased = 0;
      if (record) {
        const resetDate = new Date(record.reset_date);
        resetDate.setHours(0, 0, 0, 0);
        purchased = resetDate.getTime() < today.getTime() ? 0 : record.purchased;
      }

      const unitDef = this.gameData.getUnit(ut as UnitType, 1);
      const baseCost = Number(unitDef?.cost ?? 0);
      const cost = Math.ceil(baseCost * MERCENARY_PRICE_MULTIPLIER);

      return {
        unitType: ut,
        unitName: unitDef?.name ?? ut,
        bonus: unitDef?.bonus ?? 0,
        available: Math.max(0, total - purchased),
        total,
        purchased,
        cost,
        baseCost,
      };
    });

    return {
      campLevel,
      campName: campLevelDef?.name ?? 'No Camp',
      nextUpgrade: nextLevelDef
        ? {
            level: nextLevelDef.level,
            name: nextLevelDef.name,
            cost: nextLevelDef.cost,
            playerLevelRequirement: nextLevelDef.playerLevelRequirement,
            dailyMercStock: nextLevelDef.dailyMercStock,
          }
        : null,
      stock,
    };
  }

  async buyMercenary(playerId: string, dto: BuyMercenaryDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, buildings] = await Promise.all([
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerBuilding.findMany({ where: { player_id: playerId } }),
      ]);

      if (!economy) throw new BadRequestException('Player economy not found');

      const campEntry = buildings.find(
        (b) => b.building_type === BuildingType.MERCENARY_CAMP,
      );
      const campLevel = campEntry?.level ?? 0;
      if (campLevel < 1) {
        throw new BadRequestException('You must build a Mercenary Camp first');
      }

      // Phase 3: Using GameDataService
      const campLevelDef = this.gameData.getBuilding(BuildingType.MERCENARY_CAMP, campLevel);
      const dailyMercStock = campLevelDef?.dailyMercStock ?? 0;
      const distribution = getMercenaryStockDistribution(dailyMercStock);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let totalGoldCost = BigInt(0);
      const purchases: Array<{ unitType: string; quantity: number; cost: number }> = [];

      for (const unit of dto.units) {
        const maxStock = distribution[unit.unitType as keyof typeof distribution];
        if (!maxStock || maxStock <= 0) {
          throw new BadRequestException(`No mercenary stock available for ${unit.unitType}`);
        }

        // Get/reset daily purchase record
        let record = await tx.mercenaryDailyPurchase.findUnique({
          where: {
            player_id_unit_type: { player_id: playerId, unit_type: unit.unitType },
          },
        });

        let currentPurchased = 0;
        if (record) {
          const resetDate = new Date(record.reset_date);
          resetDate.setHours(0, 0, 0, 0);
          if (resetDate.getTime() < today.getTime()) {
            // Reset stale record
            await tx.mercenaryDailyPurchase.update({
              where: { id: record.id },
              data: { purchased: 0, reset_date: new Date() },
            });
            currentPurchased = 0;
          } else {
            currentPurchased = record.purchased;
          }
        }

        const available = maxStock - currentPurchased;
        if (unit.quantity > available) {
          throw new BadRequestException(
            `Not enough ${unit.unitType} mercenaries. Available: ${available}, requested: ${unit.quantity}`,
          );
        }

        const unitDef = this.gameData.getUnit(unit.unitType as UnitType, 1);
        const costPerUnit = Math.ceil(Number(unitDef?.cost ?? 0) * MERCENARY_PRICE_MULTIPLIER);
        const lineCost = BigInt(costPerUnit) * BigInt(unit.quantity);
        totalGoldCost += lineCost;

        purchases.push({ unitType: unit.unitType, quantity: unit.quantity, cost: costPerUnit });
      }

      const gold = BigInt(economy.gold);
      if (gold < totalGoldCost) {
        throw new BadRequestException(
          `Not enough gold. Required: ${totalGoldCost}, Available: ${gold}`,
        );
      }

      const newGold = gold - totalGoldCost;
      await tx.playerEconomy.update({
        where: { player_id: playerId },
        data: { gold: newGold },
      });

      // Add units and update purchase counters
      for (const purchase of purchases) {
        await tx.playerUnit.upsert({
          where: {
            player_id_unit_type_level: {
              player_id: playerId,
              unit_type: purchase.unitType,
              level: 1,
            },
          },
          update: { quantity: { increment: purchase.quantity } },
          create: {
            player_id: playerId,
            unit_type: purchase.unitType,
            level: 1,
            quantity: purchase.quantity,
          },
        });

        await tx.mercenaryDailyPurchase.upsert({
          where: {
            player_id_unit_type: { player_id: playerId, unit_type: purchase.unitType },
          },
          update: { purchased: { increment: purchase.quantity } },
          create: {
            player_id: playerId,
            unit_type: purchase.unitType,
            purchased: purchase.quantity,
            reset_date: new Date(),
          },
        });
      }

      await tx.bankHistory.create({
        data: {
          gold_amount: totalGoldCost,
          from_user_id: playerId,
          from_account_type: BankAccountType.HAND,
          to_user_id: playerId,
          to_account_type: BankAccountType.BANK,
          date_time: new Date(),
          history_type: BankTransferHistoryType.MERCENARY_PURCHASE,
          stats: JSON.stringify({
            type: 'MERCENARY_PURCHASE',
            units: purchases,
          }),
        },
      });

      return { gold: newGold.toString(), purchases };
    });

    // Emit WebSocket event for real-time state sync
    // Fetch updated units to calculate totals
    const updatedUnits = await this.prisma.playerUnit.findMany({
      where: { player_id: playerId },
    });

    const unitsByType: Record<string, number> = {};
    let totalUnits = 0;
    for (const u of updatedUnits) {
      unitsByType[u.unit_type] = (unitsByType[u.unit_type] || 0) + u.quantity;
      totalUnits += u.quantity;
    }

    this.eventEmitter.emit(
      'player.state.changed',
      new PlayerStateChangedEvent({
        playerId,
        gold: BigInt(result.gold),
        totalUnits,
        unitsByType,
      }),
    );

    return result;
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private async createBankHistory(
    tx: any,
    playerId: string,
    goldAmount: bigint,
    type: string,
    details: Record<string, any>,
  ) {
    await tx.bankHistory.create({
      data: {
        gold_amount: goldAmount,
        from_user_id: playerId,
        from_account_type: BankAccountType.HAND,
        to_user_id: playerId,
        to_account_type: BankAccountType.BANK,
        date_time: new Date(),
        history_type: BankTransferHistoryType.SALE,
        stats: JSON.stringify({ type, ...details }),
      },
    });
  }
}
