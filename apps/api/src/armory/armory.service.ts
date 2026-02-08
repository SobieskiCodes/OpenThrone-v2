import { Injectable, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ItemEquippedEvent, ItemUnequippedEvent } from '@openthrone/events';
import { ItemTypes, getItemDefinition } from '@openthrone/game-logic';
import {
  ItemType,
  ItemUsage,
  BankAccountType,
  BankTransferHistoryType,
  BonusType,
  StructureUpgradeType,
} from '@openthrone/shared';
import type { EquipItemDto, UnequipItemDto } from '@openthrone/shared';

@Injectable()
export class ArmoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getArmoryStatus(playerId: string) {
    const [economy, items, player, structureUpgrades, bonusPoints] =
      await Promise.all([
        this.prisma.playerEconomy.findUnique({
          where: { player_id: playerId },
        }),
        this.prisma.playerItem.findMany({ where: { player_id: playerId } }),
        this.prisma.player.findUnique({
          where: { id: playerId },
          select: { race: true },
        }),
        this.prisma.playerStructureUpgrade.findMany({
          where: { player_id: playerId },
        }),
        this.prisma.playerBonusPoint.findMany({
          where: { player_id: playerId },
        }),
      ]);

    if (!economy) throw new BadRequestException('Player economy not found');

    const armoryUpgrade = structureUpgrades.find(
      (u) => u.upgrade_type === StructureUpgradeType.ARMORY,
    );
    const armoryLevel = armoryUpgrade?.level ?? 0;

    const spyUpgrade = structureUpgrades.find(
      (u) => u.upgrade_type === StructureUpgradeType.SPY,
    );
    const spyAcademyLevel = spyUpgrade?.level ?? 0;

    const pricesBonus = bonusPoints.find(
      (bp) => bp.bonus_type === BonusType.PRICES,
    );
    const pricesBonusLevel = pricesBonus?.level ?? 0;

    const playerRace = player?.race ?? 'ALL';

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
      itemDefinitions: ItemTypes,
    };
  }

  async equip(playerId: string, dto: EquipItemDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, items, player, structureUpgrades, bonusPoints] =
        await Promise.all([
          tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
          tx.playerItem.findMany({ where: { player_id: playerId } }),
          tx.player.findUnique({
            where: { id: playerId },
            select: { race: true },
          }),
          tx.playerStructureUpgrade.findMany({
            where: { player_id: playerId },
          }),
          tx.playerBonusPoint.findMany({ where: { player_id: playerId } }),
        ]);

      if (!economy) throw new BadRequestException('Player economy not found');

      const armoryUpgrade = structureUpgrades.find(
        (u) => u.upgrade_type === StructureUpgradeType.ARMORY,
      );
      const armoryLevel = armoryUpgrade?.level ?? 0;

      const spyUpgrade = structureUpgrades.find(
        (u) => u.upgrade_type === StructureUpgradeType.SPY,
      );
      const spyAcademyLevel = spyUpgrade?.level ?? 0;

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

      // Fetch updated items
      const updatedItems = await tx.playerItem.findMany({
        where: { player_id: playerId },
      });

      return {
        gold: newGold.toString(),
        goldSpent: totalCost,
        items: updatedItems.map((i) => ({
          itemType: i.item_type,
          usage: i.usage,
          level: i.level,
          quantity: i.quantity,
        })),
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

    return result;
  }

  async unequip(playerId: string, dto: UnequipItemDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, items, bonusPoints] = await Promise.all([
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerItem.findMany({ where: { player_id: playerId } }),
        tx.playerBonusPoint.findMany({ where: { player_id: playerId } }),
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

      // Fetch updated items
      const updatedItems = await tx.playerItem.findMany({
        where: { player_id: playerId },
      });

      return {
        gold: newGold.toString(),
        refund: totalRefund.toString(),
        items: updatedItems.map((i) => ({
          itemType: i.item_type,
          usage: i.usage,
          level: i.level,
          quantity: i.quantity,
        })),
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

    return result;
  }
}
