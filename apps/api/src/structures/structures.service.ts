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
  BattleUpgrades,
  getBattleUpgradesByType,
  getLevelForXP,
} from '@openthrone/game-logic';
import {
  StructureUpgradeType,
  BattleUpgradeType,
  BankAccountType,
  BankTransferHistoryType,
} from '@openthrone/shared';
import type { PurchaseStructureUpgradeDto, PurchaseBattleUpgradeDto, RepairFortDto } from '@openthrone/shared';

@Injectable()
export class StructuresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getStructuresStatus(playerId: string) {
    const [economy, fort, structureUpgrades, battleUpgrades, stats] = await Promise.all([
      this.prisma.playerEconomy.findUnique({ where: { player_id: playerId } }),
      this.prisma.playerFortification.findUnique({ where: { player_id: playerId } }),
      this.prisma.playerStructureUpgrade.findMany({ where: { player_id: playerId } }),
      this.prisma.playerBattleUpgrade.findMany({ where: { player_id: playerId } }),
      this.prisma.playerStats.findUnique({ where: { player_id: playerId } }),
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
      },
      battleUpgrades: battleUpgrades.map((bu) => ({
        upgradeType: bu.upgrade_type,
        level: bu.level,
        quantity: bu.quantity,
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
      const [economy, existingUpgrades, structureUpgrades] = await Promise.all([
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerBattleUpgrade.findMany({ where: { player_id: playerId } }),
        tx.playerStructureUpgrade.findMany({ where: { player_id: playerId } }),
      ]);

      if (!economy) throw new BadRequestException('Player economy not found');

      // Check siege upgrade level requirement
      const offenseUpgrade = structureUpgrades.find(
        (u) => u.upgrade_type === StructureUpgradeType.OFFENSE,
      );
      const offenseLevel = offenseUpgrade?.level ?? 1;

      // Find the battle upgrade definition
      const allDefsForType = getBattleUpgradesByType(dto.upgradeType as BattleUpgradeType);
      // Battle upgrades must be purchased in level order
      const existing = existingUpgrades.find((u) => u.upgrade_type === dto.upgradeType);
      const currentQty = existing?.quantity ?? 0;
      const currentLevel = existing?.level ?? 0;

      // Determine which level to purchase (must buy level 1 before level 2)
      const targetLevel = currentLevel === 0 ? 1 : currentLevel;
      const def = allDefsForType.find((d) => d.level === targetLevel);
      if (!def) {
        throw new BadRequestException(`No battle upgrade found for ${dto.upgradeType} level ${targetLevel}`);
      }

      if (offenseLevel < def.siegeUpgradeLevel) {
        throw new BadRequestException(
          `${def.name} requires offense upgrade level ${def.siegeUpgradeLevel} (you have ${offenseLevel})`,
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
          player_id_upgrade_type: {
            player_id: playerId,
            upgrade_type: dto.upgradeType,
          },
        },
        update: { quantity: currentQty + dto.quantity, level: targetLevel },
        create: {
          player_id: playerId,
          upgrade_type: dto.upgradeType,
          level: targetLevel,
          quantity: dto.quantity,
        },
      });

      await this.createBankHistory(tx, playerId, BigInt(totalCost), 'BATTLE_UPGRADE', {
        upgradeType: dto.upgradeType,
        level: targetLevel,
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
