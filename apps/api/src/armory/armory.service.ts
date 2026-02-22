import { Injectable, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ItemEquippedEvent, ItemUnequippedEvent } from '@openthrone/events';
import { ItemTypes, getItemDefinition, calculateFullStats } from '@openthrone/game-logic';
import {
  ItemType,
  ItemUsage,
  BankAccountType,
  BankTransferHistoryType,
  BonusType,
} from '@openthrone/shared';
import type { EquipItemDto, UnequipItemDto } from '@openthrone/shared';
import { PlayerStateChangedEvent } from '../game/events';

@Injectable()
export class ArmoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getArmoryStatus(playerId: string) {
    const [economy, items, player, playerBuildings, bonusPoints, units, battleUpgrades, fortification] =
      await Promise.all([
        this.prisma.playerEconomy.findUnique({
          where: { player_id: playerId },
        }),
        this.prisma.playerItem.findMany({ where: { player_id: playerId } }),
        this.prisma.player.findUnique({
          where: { id: playerId },
          select: { race: true, player_class: true },
        }),
        this.prisma.playerBuilding.findMany({ where: { player_id: playerId } }),        this.prisma.playerBonusPoint.findMany({
          where: { player_id: playerId },
        }),
        this.prisma.playerUnit.findMany({ where: { player_id: playerId } }),
        this.prisma.playerBattleUpgrade.findMany({ where: { player_id: playerId } }),
        this.prisma.playerFortification.findUnique({ where: { player_id: playerId } }),
      ]);

    if (!economy) throw new BadRequestException('Player economy not found');

    const armoryLevel = playerBuildings.find((b) => b.building_type === 'ARMORY')?.level ?? 0;
    const spyAcademyLevel = playerBuildings.find((b) => b.building_type === 'SPY_ACADEMY')?.level ?? 0;

    const pricesBonus = bonusPoints.find(
      (bp) => bp.bonus_type === BonusType.PRICES,
    );
    const pricesBonusLevel = pricesBonus?.level ?? 0;

    const playerRace = player?.race ?? 'ALL';

    // Calculate stats for live display
    const statsInput = {
      race: player?.race ?? 'HUMAN',
      playerClass: player?.player_class ?? 'FIGHTER',
      fortLevel: fortification?.fort_level ?? 1,
      units: units.map((u) => ({ unitType: u.unit_type, level: u.level, quantity: u.quantity })),
      items: items.map((i) => ({ itemType: i.item_type, usage: i.usage, level: i.level, quantity: i.quantity })),
      battleUpgrades: battleUpgrades.map((b) => ({ upgradeType: b.upgrade_type, level: b.level, quantity: b.quantity })),
      bonusPoints: bonusPoints.map((bp) => ({ bonusType: bp.bonus_type, level: bp.level })),    };
    const stats = calculateFullStats(statsInput);

    return {
      gold: economy.gold.toString(),
      goldInBank: economy.gold_in_bank.toString(),
      armoryLevel,
      spyAcademyLevel,
      pricesBonusLevel,
      playerRace,
      items: items.map((i) => ({
        itemType: i.item_type,
        usage: i.usage,
        level: i.level,
        quantity: i.quantity,
      })),
      units: units.map((u) => ({
        unitType: u.unit_type,
        level: u.level,
        quantity: u.quantity,
      })),
      stats: {
        offense: stats.offense.total,
        defense: stats.defense.total,
        spy: stats.spy.total,
        sentry: stats.sentry.total,
      },
      itemDefinitions: ItemTypes,
    };
  }

  async equip(playerId: string, dto: EquipItemDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, items, player, playerBuildings, bonusPoints] =
        await Promise.all([
          tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
          tx.playerItem.findMany({ where: { player_id: playerId } }),
          tx.player.findUnique({
            where: { id: playerId },
            select: { race: true, player_class: true },
          }),
          tx.playerBuilding.findMany({ where: { player_id: playerId } }),
          tx.playerBonusPoint.findMany({ where: { player_id: playerId } }),
        ]);

      if (!economy) throw new BadRequestException('Player economy not found');

      const armoryLevel = playerBuildings.find((b) => b.building_type === 'ARMORY')?.level ?? 0;
      const spyAcademyLevel = playerBuildings.find((b) => b.building_type === 'SPY_ACADEMY')?.level ?? 0;

      const pricesBonus = bonusPoints.find(
        (bp) => bp.bonus_type === BonusType.PRICES,
      );
      const pricesBonusPercent = pricesBonus?.level ?? 0;

      const playerRace = player?.race ?? 'ALL';

      // Look up item definition
      const itemDef = getItemDefinition(
        dto.itemType as ItemType,
        dto.usage as ItemUsage,
        dto.level,
      );
      if (!itemDef) {
        throw new BadRequestException(
          `Invalid item: ${dto.itemType} ${dto.usage} level ${dto.level}`,
        );
      }

      // Check building level requirement (Armory for OFF/DEF, Spy Academy for SPY/SENTRY)
      const isSpyItem = dto.usage === ItemUsage.SPY || dto.usage === ItemUsage.SENTRY;
      const requiredLevel = itemDef.armoryLevel;
      const playerBuildingLevel = isSpyItem ? spyAcademyLevel : armoryLevel;
      const buildingName = isSpyItem ? 'Spy Academy' : 'Armory';

      if (requiredLevel > playerBuildingLevel) {
        throw new BadRequestException(
          `${itemDef.name} requires ${buildingName} level ${requiredLevel} (you have ${playerBuildingLevel})`,
        );
      }

      // Check race restriction
      if (itemDef.race !== 'ALL' && itemDef.race !== playerRace) {
        throw new BadRequestException(
          `${itemDef.name} is restricted to ${itemDef.race} race`,
        );
      }

      // Calculate cost with price bonus
      const discountedCost =
        itemDef.cost -
        Math.ceil((pricesBonusPercent / 100) * itemDef.cost);
      const totalCost = Math.ceil(discountedCost * dto.quantity);

      const gold = BigInt(economy.gold);
      if (gold < BigInt(totalCost)) {
        throw new BadRequestException(
          `Not enough gold. Required: ${totalCost}, Available: ${gold}`,
        );
      }

      // Deduct gold
      const newGold = gold - BigInt(totalCost);
      await tx.playerEconomy.update({
        where: { player_id: playerId },
        data: { gold: newGold },
      });

      // Upsert item
      const existing = items.find(
        (i) =>
          i.item_type === dto.itemType &&
          i.usage === dto.usage &&
          i.level === dto.level,
      );
      const currentQty = existing?.quantity ?? 0;

      await tx.playerItem.upsert({
        where: {
          player_id_item_type_usage_level: {
            player_id: playerId,
            item_type: dto.itemType,
            usage: dto.usage,
            level: dto.level,
          },
        },
        update: { quantity: currentQty + dto.quantity },
        create: {
          player_id: playerId,
          item_type: dto.itemType,
          usage: dto.usage,
          level: dto.level,
          quantity: dto.quantity,
        },
      });

      // Bank history
      await tx.bankHistory.create({
        data: {
          gold_amount: BigInt(totalCost),
          from_user_id: playerId,
          from_account_type: BankAccountType.HAND,
          to_user_id: playerId,
          to_account_type: BankAccountType.BANK,
          date_time: new Date(),
          history_type: BankTransferHistoryType.SALE,
          stats: JSON.stringify({
            type: 'ARMORY_EQUIP',
            item: {
              itemType: dto.itemType,
              usage: dto.usage,
              level: dto.level,
              quantity: dto.quantity,
            },
          }),
        },
      });

      // Fetch updated items and recalculate stats
      const [updatedItems, updatedUnits, updatedBattleUpgrades, updatedBonusPoints, updatedFort] =
        await Promise.all([
          tx.playerItem.findMany({ where: { player_id: playerId } }),
          tx.playerUnit.findMany({ where: { player_id: playerId } }),
          tx.playerBattleUpgrade.findMany({ where: { player_id: playerId } }),
          tx.playerBonusPoint.findMany({ where: { player_id: playerId } }),          tx.playerFortification.findUnique({ where: { player_id: playerId } }),
        ]);

      const updatedStatsInput = {
        race: player?.race ?? 'HUMAN',
        playerClass: player?.player_class ?? 'FIGHTER',
        fortLevel: updatedFort?.fort_level ?? 1,
        units: updatedUnits.map((u) => ({ unitType: u.unit_type, level: u.level, quantity: u.quantity })),
        items: updatedItems.map((i) => ({ itemType: i.item_type, usage: i.usage, level: i.level, quantity: i.quantity })),
        battleUpgrades: updatedBattleUpgrades.map((b) => ({ upgradeType: b.upgrade_type, level: b.level, quantity: b.quantity })),
        bonusPoints: updatedBonusPoints.map((bp) => ({ bonusType: bp.bonus_type, level: bp.level })),      };
      const updatedStats = calculateFullStats(updatedStatsInput);

      return {
        gold: newGold.toString(),
        goldSpent: totalCost,
        items: updatedItems.map((i) => ({
          itemType: i.item_type,
          usage: i.usage,
          level: i.level,
          quantity: i.quantity,
        })),
        stats: {
          offense: updatedStats.offense.total,
          defense: updatedStats.defense.total,
          spy: updatedStats.spy.total,
          sentry: updatedStats.sentry.total,
        },
      };
    });

    this.eventEmitter.emit(
      'item.equipped',
      new ItemEquippedEvent(
        playerId,
        dto.itemType as ItemType,
        dto.usage as ItemUsage,
        dto.level,
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

    return {
      ...result,
      playerState: {
        gold: result.gold,
      },
    };
  }

  async unequip(playerId: string, dto: UnequipItemDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, items, bonusPoints, player] = await Promise.all([
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerItem.findMany({ where: { player_id: playerId } }),
        tx.playerBonusPoint.findMany({ where: { player_id: playerId } }),
        tx.player.findUnique({ where: { id: playerId }, select: { race: true, player_class: true } }),
      ]);

      if (!economy) throw new BadRequestException('Player economy not found');

      const pricesBonus = bonusPoints.find(
        (bp) => bp.bonus_type === BonusType.PRICES,
      );
      const pricesBonusPercent = pricesBonus?.level ?? 0;

      const itemDef = getItemDefinition(
        dto.itemType as ItemType,
        dto.usage as ItemUsage,
        dto.level,
      );
      if (!itemDef) {
        throw new BadRequestException(
          `Invalid item: ${dto.itemType} ${dto.usage} level ${dto.level}`,
        );
      }

      // Check player owns enough
      const existing = items.find(
        (i) =>
          i.item_type === dto.itemType &&
          i.usage === dto.usage &&
          i.level === dto.level,
      );
      const currentQty = existing?.quantity ?? 0;
      if (currentQty < dto.quantity) {
        throw new BadRequestException(
          `Not enough ${itemDef.name} to unequip. Required: ${dto.quantity}, Available: ${currentQty}`,
        );
      }

      // Calculate 75% refund with price bonus
      const discountedCost =
        itemDef.cost -
        Math.ceil((pricesBonusPercent / 100) * itemDef.cost);
      const totalRefund = Math.floor(discountedCost * dto.quantity * 0.75);

      // Add refund
      const newGold = BigInt(economy.gold) + BigInt(totalRefund);
      await tx.playerEconomy.update({
        where: { player_id: playerId },
        data: { gold: newGold },
      });

      // Deduct item quantity
      await tx.playerItem.update({
        where: {
          player_id_item_type_usage_level: {
            player_id: playerId,
            item_type: dto.itemType,
            usage: dto.usage,
            level: dto.level,
          },
        },
        data: { quantity: currentQty - dto.quantity },
      });

      // Bank history
      await tx.bankHistory.create({
        data: {
          gold_amount: BigInt(totalRefund),
          from_user_id: playerId,
          from_account_type: BankAccountType.BANK,
          to_user_id: playerId,
          to_account_type: BankAccountType.HAND,
          date_time: new Date(),
          history_type: BankTransferHistoryType.SALE,
          stats: JSON.stringify({
            type: 'ARMORY_UNEQUIP',
            item: {
              itemType: dto.itemType,
              usage: dto.usage,
              level: dto.level,
              quantity: dto.quantity,
            },
          }),
        },
      });

      // Fetch updated items and recalculate stats
      const [updatedItems, updatedUnits, updatedBattleUpgrades, updatedBonusPoints, updatedFort] =
        await Promise.all([
          tx.playerItem.findMany({ where: { player_id: playerId } }),
          tx.playerUnit.findMany({ where: { player_id: playerId } }),
          tx.playerBattleUpgrade.findMany({ where: { player_id: playerId } }),
          tx.playerBonusPoint.findMany({ where: { player_id: playerId } }),          tx.playerFortification.findUnique({ where: { player_id: playerId } }),
        ]);

      const updatedStatsInput = {
        race: player?.race ?? 'HUMAN',
        playerClass: player?.player_class ?? 'FIGHTER',
        fortLevel: updatedFort?.fort_level ?? 1,
        units: updatedUnits.map((u) => ({ unitType: u.unit_type, level: u.level, quantity: u.quantity })),
        items: updatedItems.map((i) => ({ itemType: i.item_type, usage: i.usage, level: i.level, quantity: i.quantity })),
        battleUpgrades: updatedBattleUpgrades.map((b) => ({ upgradeType: b.upgrade_type, level: b.level, quantity: b.quantity })),
        bonusPoints: updatedBonusPoints.map((bp) => ({ bonusType: bp.bonus_type, level: bp.level })),      };
      const updatedStats = calculateFullStats(updatedStatsInput);

      return {
        gold: newGold.toString(),
        refund: totalRefund.toString(),
        items: updatedItems.map((i) => ({
          itemType: i.item_type,
          usage: i.usage,
          level: i.level,
          quantity: i.quantity,
        })),
        stats: {
          offense: updatedStats.offense.total,
          defense: updatedStats.defense.total,
          spy: updatedStats.spy.total,
          sentry: updatedStats.sentry.total,
        },
      };
    });

    this.eventEmitter.emit(
      'item.unequipped',
      new ItemUnequippedEvent(
        playerId,
        dto.itemType as ItemType,
        dto.usage as ItemUsage,
        dto.level,
        dto.quantity,
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

    return {
      ...result,
      playerState: {
        gold: result.gold,
      },
    };
  }
}
