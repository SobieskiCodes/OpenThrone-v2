import { Injectable, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { StructureUpgradedEvent } from '@openthrone/events';
import { FortRepairedEvent } from '@openthrone/events';
import {
  Fortifications,
  getFortificationByLevel,
  getNextFortification,
  EconomyUpgrades,
  getEconomyUpgradeByLevel,
  OffensiveUpgrades,
  getOffensiveUpgradeByLevel,
  SpyUpgrades,
  getSpyUpgradeByLevel,
  SentryUpgrades,
  getSentryUpgradeByLevel,
  ArmoryUpgrades,
  getArmoryUpgradeByLevel,
  HouseUpgrades,
  getHouseUpgradeByLevel,
  MercenaryCampUpgrades,
  getMercenaryCampByLevel,
  getMercenaryStockDistribution,
  MERCENARY_PRICE_MULTIPLIER,
  BattleUpgrades,
  getBattleUpgradesByType,
  getUnitByTypeAndLevel,
  getLevelForXP,
} from '@openthrone/game-logic';
import {
  StructureUpgradeType,
  BattleUpgradeType,
  BankAccountType,
  BankTransferHistoryType,
  UnitType,
} from '@openthrone/shared';
import type { PurchaseStructureUpgradeDto, PurchaseBattleUpgradeDto, SellBattleUpgradeDto, RepairFortDto, BuyMercenaryDto } from '@openthrone/shared';

@Injectable()
export class StructuresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getStructuresStatus(playerId: string) {
    const [economy, fort, structureUpgrades, battleUpgrades, stats, units] = await Promise.all([
      this.prisma.playerEconomy.findUnique({ where: { player_id: playerId } }),
      this.prisma.playerFortification.findUnique({ where: { player_id: playerId } }),
      this.prisma.playerStructureUpgrade.findMany({ where: { player_id: playerId } }),
      this.prisma.playerBattleUpgrade.findMany({ where: { player_id: playerId } }),
      this.prisma.playerStats.findUnique({ where: { player_id: playerId } }),
      this.prisma.playerUnit.findMany({ where: { player_id: playerId } }),
    ]);

    if (!economy) throw new BadRequestException('Player economy not found');

    const fortLevel = fort?.fort_level ?? 1;
    const fortHitpoints = fort?.hitpoints ?? 50;
    const fortDef = getFortificationByLevel(fortLevel);
    const playerLevel = getLevelForXP(stats?.experience ?? 0);

    const getStructureLevel = (type: string) => {
      const entry = structureUpgrades.find((u) => u.upgrade_type === type);
      return entry?.level ?? 1;
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
      upgrades: {
        economy: economy.economy_level || 1,
        house: economy.house_level || 1,
        offense: getStructureLevel(StructureUpgradeType.OFFENSE),
        spy: getStructureLevel(StructureUpgradeType.SPY),
        sentry: getStructureLevel(StructureUpgradeType.SENTRY),
        armory: getStructureLevel(StructureUpgradeType.ARMORY),
        mercenaryCamp: getStructureLevel(StructureUpgradeType.MERCENARY_CAMP),
      },
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
        fortifications: Fortifications,
        economy: EconomyUpgrades,
        house: HouseUpgrades,
        offense: OffensiveUpgrades,
        spy: SpyUpgrades,
        sentry: SentryUpgrades,
        armory: ArmoryUpgrades,
        battle: BattleUpgrades,
        mercenaryCamp: MercenaryCampUpgrades,
      },
    };
  }

  async upgrade(playerId: string, dto: PurchaseStructureUpgradeDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, fort, structureUpgrades, stats] = await Promise.all([
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerFortification.findUnique({ where: { player_id: playerId } }),
        tx.playerStructureUpgrade.findMany({ where: { player_id: playerId } }),
        tx.playerStats.findUnique({ where: { player_id: playerId } }),
      ]);

      if (!economy) throw new BadRequestException('Player economy not found');

      const gold = BigInt(economy.gold);
      const fortLevel = fort?.fort_level ?? 1;
      const playerLevel = getLevelForXP(stats?.experience ?? 0);

      switch (dto.upgradeType) {
        case StructureUpgradeType.FORT:
          return this.handleFortUpgrade(tx, playerId, gold, fortLevel, playerLevel);

        case StructureUpgradeType.HOUSE:
          return this.handleHouseUpgrade(tx, playerId, gold, fortLevel, economy.house_level || 1);

        case StructureUpgradeType.ECONOMY:
          return this.handleEconomyUpgrade(tx, playerId, gold, fortLevel, economy.economy_level || 1);

        case StructureUpgradeType.MERCENARY_CAMP:
          return this.handleMercenaryCampUpgrade(
            tx, playerId, gold, fortLevel, structureUpgrades,
          );

        case StructureUpgradeType.OFFENSE:
        case StructureUpgradeType.SPY:
        case StructureUpgradeType.SENTRY:
        case StructureUpgradeType.ARMORY:
          return this.handleStructureUpgrade(
            tx, playerId, gold, fortLevel, dto.upgradeType, structureUpgrades,
          );

        default:
          throw new BadRequestException(`Unknown upgrade type: ${dto.upgradeType}`);
      }
    });

    this.eventEmitter.emit(
      'structure.upgraded',
      new StructureUpgradedEvent(
        playerId,
        dto.upgradeType,
        result.newLevel,
        BigInt(result.goldSpent),
      ),
    );

    return { gold: result.newGold, upgradeType: dto.upgradeType, newLevel: result.newLevel };
  }

  private async handleFortUpgrade(
    tx: any, playerId: string, gold: bigint, currentFortLevel: number, playerLevel: number,
  ) {
    const nextFort = getNextFortification(currentFortLevel);
    if (!nextFort) {
      throw new BadRequestException('Fortification is already at maximum level');
    }

    if (playerLevel < nextFort.levelRequirement) {
      throw new BadRequestException(
        `${nextFort.name} requires player level ${nextFort.levelRequirement} (you are level ${playerLevel})`,
      );
    }

    if (gold < BigInt(nextFort.cost)) {
      throw new BadRequestException(
        `Not enough gold. Required: ${nextFort.cost}, Available: ${gold}`,
      );
    }

    const newGold = gold - BigInt(nextFort.cost);
    await tx.playerEconomy.update({
      where: { player_id: playerId },
      data: { gold: newGold },
    });

    await tx.playerFortification.upsert({
      where: { player_id: playerId },
      update: { fort_level: nextFort.level, hitpoints: nextFort.hitpoints },
      create: { player_id: playerId, fort_level: nextFort.level, hitpoints: nextFort.hitpoints },
    });

    await this.createBankHistory(tx, playerId, BigInt(nextFort.cost), 'FORT_UPGRADE', {
      fromLevel: currentFortLevel,
      toLevel: nextFort.level,
      name: nextFort.name,
    });

    return { newGold: newGold.toString(), newLevel: nextFort.level, goldSpent: nextFort.cost };
  }

  private async handleHouseUpgrade(
    tx: any, playerId: string, gold: bigint, fortLevel: number, currentHouseLevel: number,
  ) {
    const nextHouse = getHouseUpgradeByLevel(currentHouseLevel + 1);
    if (!nextHouse) {
      throw new BadRequestException('Housing is already at maximum level');
    }

    if (fortLevel < nextHouse.fortLevel) {
      throw new BadRequestException(
        `${nextHouse.name} requires fort level ${nextHouse.fortLevel} (you have fort level ${fortLevel})`,
      );
    }

    if (gold < BigInt(nextHouse.cost)) {
      throw new BadRequestException(
        `Not enough gold. Required: ${nextHouse.cost}, Available: ${gold}`,
      );
    }

    const newGold = gold - BigInt(nextHouse.cost);
    await tx.playerEconomy.update({
      where: { player_id: playerId },
      data: { gold: newGold, house_level: nextHouse.level },
    });

    await this.createBankHistory(tx, playerId, BigInt(nextHouse.cost), 'HOUSE_UPGRADE', {
      fromLevel: currentHouseLevel,
      toLevel: nextHouse.level,
      name: nextHouse.name,
    });

    return { newGold: newGold.toString(), newLevel: nextHouse.level, goldSpent: nextHouse.cost };
  }

  private async handleEconomyUpgrade(
    tx: any, playerId: string, gold: bigint, fortLevel: number, currentEconomyLevel: number,
  ) {
    const nextEcon = getEconomyUpgradeByLevel(currentEconomyLevel + 1);
    if (!nextEcon) {
      throw new BadRequestException('Economy is already at maximum level');
    }

    if (fortLevel < nextEcon.fortLevel) {
      throw new BadRequestException(
        `${nextEcon.name} requires fort level ${nextEcon.fortLevel} (you have fort level ${fortLevel})`,
      );
    }

    if (gold < BigInt(nextEcon.cost)) {
      throw new BadRequestException(
        `Not enough gold. Required: ${nextEcon.cost}, Available: ${gold}`,
      );
    }

    const newGold = gold - BigInt(nextEcon.cost);
    await tx.playerEconomy.update({
      where: { player_id: playerId },
      data: { gold: newGold, economy_level: nextEcon.level },
    });

    await this.createBankHistory(tx, playerId, BigInt(nextEcon.cost), 'ECONOMY_UPGRADE', {
      fromLevel: currentEconomyLevel,
      toLevel: nextEcon.level,
      name: nextEcon.name,
    });

    return { newGold: newGold.toString(), newLevel: nextEcon.level, goldSpent: nextEcon.cost };
  }

  private async handleStructureUpgrade(
    tx: any,
    playerId: string,
    gold: bigint,
    fortLevel: number,
    upgradeType: StructureUpgradeType,
    structureUpgrades: Array<{ upgrade_type: string; level: number }>,
  ) {
    const current = structureUpgrades.find((u) => u.upgrade_type === upgradeType);
    const currentLevel = current?.level ?? 1;

    const { nextDef, nextLevel } = this.getNextStructureDef(upgradeType, currentLevel);
    if (!nextDef) {
      throw new BadRequestException(`${upgradeType} upgrade is already at maximum level`);
    }

    const requiredFortLevel = nextDef.fortLevelRequirement ?? nextDef.fortLevel ?? 0;
    if (fortLevel < requiredFortLevel) {
      throw new BadRequestException(
        `${nextDef.name} requires fort level ${requiredFortLevel} (you have fort level ${fortLevel})`,
      );
    }

    if (gold < BigInt(nextDef.cost)) {
      throw new BadRequestException(
        `Not enough gold. Required: ${nextDef.cost}, Available: ${gold}`,
      );
    }

    const newGold = gold - BigInt(nextDef.cost);
    await tx.playerEconomy.update({
      where: { player_id: playerId },
      data: { gold: newGold },
    });

    await tx.playerStructureUpgrade.upsert({
      where: {
        player_id_upgrade_type: {
          player_id: playerId,
          upgrade_type: upgradeType,
        },
      },
      update: { level: nextLevel },
      create: { player_id: playerId, upgrade_type: upgradeType, level: nextLevel },
    });

    await this.createBankHistory(tx, playerId, BigInt(nextDef.cost), 'STRUCTURE_UPGRADE', {
      upgradeType,
      fromLevel: currentLevel,
      toLevel: nextLevel,
      name: nextDef.name,
    });

    return { newGold: newGold.toString(), newLevel: nextLevel, goldSpent: nextDef.cost };
  }

  private getNextStructureDef(upgradeType: StructureUpgradeType, currentLevel: number) {
    const nextLevel = currentLevel + 1;
    let nextDef: any;

    switch (upgradeType) {
      case StructureUpgradeType.OFFENSE:
        nextDef = getOffensiveUpgradeByLevel(nextLevel);
        break;
      case StructureUpgradeType.SPY:
        nextDef = getSpyUpgradeByLevel(nextLevel);
        break;
      case StructureUpgradeType.SENTRY:
        nextDef = getSentryUpgradeByLevel(nextLevel);
        break;
      case StructureUpgradeType.ARMORY:
        nextDef = getArmoryUpgradeByLevel(nextLevel);
        break;
    }

    return { nextDef, nextLevel };
  }

  async repair(playerId: string, dto: RepairFortDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, fort] = await Promise.all([
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerFortification.findUnique({ where: { player_id: playerId } }),
      ]);

      if (!economy) throw new BadRequestException('Player economy not found');

      const fortLevel = fort?.fort_level ?? 1;
      const currentHp = fort?.hitpoints ?? 50;
      const fortDef = getFortificationByLevel(fortLevel);
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

    return result;
  }

  async purchaseBattleUpgrade(playerId: string, dto: PurchaseBattleUpgradeDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, existingUpgrades, units] = await Promise.all([
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerBattleUpgrade.findMany({ where: { player_id: playerId } }),
        tx.playerUnit.findMany({ where: { player_id: playerId } }),
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

      const totalCost = def.cost * dto.quantity;
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

    return result;
  }

  async sellBattleUpgrade(playerId: string, dto: SellBattleUpgradeDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, existingUpgrades] = await Promise.all([
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerBattleUpgrade.findMany({ where: { player_id: playerId } }),
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

      const totalRefund = Math.floor(def.cost * dto.quantity * 0.75);
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

    return result;
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

  private async handleMercenaryCampUpgrade(
    tx: any,
    playerId: string,
    gold: bigint,
    fortLevel: number,
    structureUpgrades: Array<{ upgrade_type: string; level: number }>,
  ) {
    const current = structureUpgrades.find(
      (u) => u.upgrade_type === StructureUpgradeType.MERCENARY_CAMP,
    );
    const currentLevel = current?.level ?? 1;
    const nextDef = getMercenaryCampByLevel(currentLevel + 1);

    if (!nextDef) {
      throw new BadRequestException('Mercenary Camp is already at maximum level');
    }

    if (fortLevel < nextDef.fortLevel) {
      throw new BadRequestException(
        `${nextDef.name} requires fort level ${nextDef.fortLevel} (you have fort level ${fortLevel})`,
      );
    }

    if (gold < BigInt(nextDef.cost)) {
      throw new BadRequestException(
        `Not enough gold. Required: ${nextDef.cost}, Available: ${gold}`,
      );
    }

    const newGold = gold - BigInt(nextDef.cost);
    await tx.playerEconomy.update({
      where: { player_id: playerId },
      data: { gold: newGold },
    });

    await tx.playerStructureUpgrade.upsert({
      where: {
        player_id_upgrade_type: {
          player_id: playerId,
          upgrade_type: StructureUpgradeType.MERCENARY_CAMP,
        },
      },
      update: { level: nextDef.level },
      create: {
        player_id: playerId,
        upgrade_type: StructureUpgradeType.MERCENARY_CAMP,
        level: nextDef.level,
      },
    });

    await this.createBankHistory(tx, playerId, BigInt(nextDef.cost), 'MERCENARY_CAMP_UPGRADE', {
      fromLevel: currentLevel,
      toLevel: nextDef.level,
      name: nextDef.name,
    });

    return { newGold: newGold.toString(), newLevel: nextDef.level, goldSpent: nextDef.cost };
  }

  async getMercenaryStatus(playerId: string) {
    const [structureUpgrades, purchases] = await Promise.all([
      this.prisma.playerStructureUpgrade.findMany({ where: { player_id: playerId } }),
      this.prisma.mercenaryDailyPurchase.findMany({ where: { player_id: playerId } }),
    ]);

    const campEntry = structureUpgrades.find(
      (u) => u.upgrade_type === StructureUpgradeType.MERCENARY_CAMP,
    );
    const campLevel = campEntry?.level ?? 1;
    const campDef = getMercenaryCampByLevel(campLevel);
    const nextDef = getMercenaryCampByLevel(campLevel + 1);
    const distribution = getMercenaryStockDistribution(campDef?.dailyStock ?? 0);

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

      const unitDef = getUnitByTypeAndLevel(ut as UnitType, 1);
      const baseCost = unitDef?.cost ?? 0;
      const cost = Math.ceil(baseCost * MERCENARY_PRICE_MULTIPLIER);

      return {
        unitType: ut,
        unitName: unitDef?.name ?? ut,
        available: Math.max(0, total - purchased),
        total,
        purchased,
        cost,
        baseCost,
      };
    });

    return {
      campLevel,
      campName: campDef?.name ?? 'No Camp',
      nextUpgrade: nextDef
        ? { name: nextDef.name, cost: nextDef.cost, fortLevel: nextDef.fortLevel, dailyStock: nextDef.dailyStock }
        : null,
      stock,
    };
  }

  async buyMercenary(playerId: string, dto: BuyMercenaryDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, structureUpgrades] = await Promise.all([
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerStructureUpgrade.findMany({ where: { player_id: playerId } }),
      ]);

      if (!economy) throw new BadRequestException('Player economy not found');

      const campEntry = structureUpgrades.find(
        (u) => u.upgrade_type === StructureUpgradeType.MERCENARY_CAMP,
      );
      const campLevel = campEntry?.level ?? 1;
      if (campLevel <= 1) {
        throw new BadRequestException('You must build a Mercenary Camp first');
      }

      const campDef = getMercenaryCampByLevel(campLevel);
      const distribution = getMercenaryStockDistribution(campDef?.dailyStock ?? 0);

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

        const unitDef = getUnitByTypeAndLevel(unit.unitType as UnitType, 1);
        const costPerUnit = Math.ceil((unitDef?.cost ?? 0) * MERCENARY_PRICE_MULTIPLIER);
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

    return result;
  }

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
