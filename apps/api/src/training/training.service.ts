import { Injectable, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import {
  UnitsTrainedEvent,
  UnitsUntrainedEvent,
  UnitsConvertedEvent,
} from '@openthrone/events';
import { getUnitByTypeAndLevel, UnitTypes } from '@openthrone/game-logic';
import {
  UnitType,
  BankAccountType,
  BankTransferHistoryType,
  BonusType,
} from '@openthrone/shared';
import type { TrainUnitsDto, UntrainUnitsDto, ConvertUnitsDto } from '@openthrone/shared';

@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getTrainingStatus(playerId: string) {
    const [economy, units, fortification, bonusPoints] = await Promise.all([
      this.prisma.playerEconomy.findUnique({ where: { player_id: playerId } }),
      this.prisma.playerUnit.findMany({ where: { player_id: playerId } }),
      this.prisma.playerFortification.findUnique({ where: { player_id: playerId } }),
      this.prisma.playerBonusPoint.findMany({ where: { player_id: playerId } }),
    ]);

    if (!economy) throw new BadRequestException('Player economy not found');

    const fortLevel = fortification?.fort_level ?? 1;
    const citizenRow = units.find(
      (u) => u.unit_type === UnitType.CITIZEN && u.level === 1,
    );
    const citizens = citizenRow?.quantity ?? 0;

    const pricesBonus = bonusPoints.find(
      (bp) => bp.bonus_type === BonusType.PRICES,
    );
    const pricesBonusLevel = pricesBonus?.level ?? 0;

    return {
      gold: economy.gold.toString(),
      goldInBank: economy.gold_in_bank.toString(),
      citizens,
      fortLevel,
      pricesBonusLevel,
      units: units.map((u) => ({
        unitType: u.unit_type,
        level: u.level,
        quantity: u.quantity,
      })),
      unitDefinitions: UnitTypes.filter((u) => u.type !== UnitType.CITIZEN),
    };
  }

  async train(playerId: string, dto: TrainUnitsDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, units, fortification, bonusPoints] = await Promise.all([
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerUnit.findMany({ where: { player_id: playerId } }),
        tx.playerFortification.findUnique({ where: { player_id: playerId } }),
        tx.playerBonusPoint.findMany({ where: { player_id: playerId } }),
      ]);

      if (!economy) throw new BadRequestException('Player economy not found');

      const fortLevel = fortification?.fort_level ?? 1;
      const pricesBonus = bonusPoints.find(
        (bp) => bp.bonus_type === BonusType.PRICES,
      );
      const pricesBonusPercent = pricesBonus?.level ?? 0;

      let totalCost = 0;
      let citizensNeeded = 0;
      // Track lower-tier units needed for Lv2+ training
      const lowerTierNeeded: Record<string, number> = {};

      for (const entry of dto.units) {
        const unitDef = getUnitByTypeAndLevel(entry.unitType as UnitType, entry.level);
        if (!unitDef) {
          throw new BadRequestException(
            `Invalid unit: ${entry.unitType} level ${entry.level}`,
          );
        }
        if (unitDef.fortLevel > fortLevel) {
          throw new BadRequestException(
            `${unitDef.name} requires fort level ${unitDef.fortLevel} (you have ${fortLevel})`,
          );
        }
        if (entry.unitType === UnitType.CITIZEN) {
          throw new BadRequestException('Cannot train citizens');
        }

        const discountedCost = unitDef.cost - Math.round((pricesBonusPercent / 100) * unitDef.cost);
        totalCost += discountedCost * entry.quantity;

        if (entry.level === 1) {
          // Level 1: costs citizens
          citizensNeeded += entry.quantity;
        } else {
          // Level 2+: costs 1 lower-tier unit per unit trained
          const lowerLevel = entry.level - 1;
          const lowerDef = getUnitByTypeAndLevel(entry.unitType as UnitType, lowerLevel);
          if (!lowerDef) {
            throw new BadRequestException(
              `No lower tier unit found for ${unitDef.name}`,
            );
          }
          const key = `${entry.unitType}_${lowerLevel}`;
          lowerTierNeeded[key] = (lowerTierNeeded[key] ?? 0) + entry.quantity;
        }
      }

      const gold = BigInt(economy.gold);
      if (gold < BigInt(Math.ceil(totalCost))) {
        throw new BadRequestException(
          `Not enough gold. Required: ${Math.ceil(totalCost)}, Available: ${gold}`,
        );
      }

      // Check citizens for Lv1 training
      if (citizensNeeded > 0) {
        const citizenRow = units.find(
          (u) => u.unit_type === UnitType.CITIZEN && u.level === 1,
        );
        const citizens = citizenRow?.quantity ?? 0;
        if (citizens < citizensNeeded) {
          throw new BadRequestException(
            `Not enough citizens. Required: ${citizensNeeded}, Available: ${citizens}`,
          );
        }
      }

      // Check lower-tier units for Lv2+ training
      for (const [key, needed] of Object.entries(lowerTierNeeded)) {
        const [unitType = '', levelStr = '0'] = key.split('_');
        const level = Number(levelStr);
        const existing = units.find(
          (u) => u.unit_type === unitType && u.level === level,
        );
        const available = existing?.quantity ?? 0;
        const lowerDef = getUnitByTypeAndLevel(unitType as UnitType, level);
        if (available < needed) {
          throw new BadRequestException(
            `Not enough ${lowerDef?.name ?? unitType}. Required: ${needed}, Available: ${available}`,
          );
        }
      }

      // Deduct gold
      const newGold = gold - BigInt(Math.ceil(totalCost));
      await tx.playerEconomy.update({
        where: { player_id: playerId },
        data: { gold: newGold },
      });

      // Deduct citizens for Lv1 training
      if (citizensNeeded > 0) {
        const citizenRow = units.find(
          (u) => u.unit_type === UnitType.CITIZEN && u.level === 1,
        );
        const citizens = citizenRow?.quantity ?? 0;
        await tx.playerUnit.upsert({
          where: {
            player_id_unit_type_level: {
              player_id: playerId,
              unit_type: UnitType.CITIZEN,
              level: 1,
            },
          },
          update: { quantity: citizens - citizensNeeded },
          create: {
            player_id: playerId,
            unit_type: UnitType.CITIZEN,
            level: 1,
            quantity: citizens - citizensNeeded,
          },
        });
      }

      // Deduct lower-tier units for Lv2+ training
      for (const [key, needed] of Object.entries(lowerTierNeeded)) {
        const [unitType = '', levelStr = '0'] = key.split('_');
        const level = Number(levelStr);
        const existing = units.find(
          (u) => u.unit_type === unitType && u.level === level,
        );
        const currentQty = existing?.quantity ?? 0;
        await tx.playerUnit.update({
          where: {
            player_id_unit_type_level: {
              player_id: playerId,
              unit_type: unitType,
              level,
            },
          },
          data: { quantity: currentQty - needed },
        });
      }

      // Upsert each trained unit
      for (const entry of dto.units) {
        const existing = units.find(
          (u) => u.unit_type === entry.unitType && u.level === entry.level,
        );
        const currentQty = existing?.quantity ?? 0;

        await tx.playerUnit.upsert({
          where: {
            player_id_unit_type_level: {
              player_id: playerId,
              unit_type: entry.unitType,
              level: entry.level,
            },
          },
          update: { quantity: currentQty + entry.quantity },
          create: {
            player_id: playerId,
            unit_type: entry.unitType,
            level: entry.level,
            quantity: entry.quantity,
          },
        });
      }

      // Bank history
      await tx.bankHistory.create({
        data: {
          gold_amount: BigInt(Math.ceil(totalCost)),
          from_user_id: playerId,
          from_account_type: BankAccountType.HAND,
          to_user_id: playerId,
          to_account_type: BankAccountType.BANK,
          date_time: new Date(),
          history_type: BankTransferHistoryType.SALE,
          stats: JSON.stringify({ type: 'TRAINING_TRAIN', items: dto.units }),
        },
      });

      // Fetch updated units
      const updatedUnits = await tx.playerUnit.findMany({
        where: { player_id: playerId },
      });

      const goldSpent = Math.ceil(totalCost);
      return {
        gold: newGold.toString(),
        goldSpent,
        units: updatedUnits.map((u) => ({
          unitType: u.unit_type,
          level: u.level,
          quantity: u.quantity,
        })),
      };
    });

    this.eventEmitter.emit(
      'units.trained',
      new UnitsTrainedEvent(playerId, dto.units, BigInt(result.goldSpent)),
    );

    return result;
  }

  async untrain(playerId: string, dto: UntrainUnitsDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, units, bonusPoints] = await Promise.all([
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerUnit.findMany({ where: { player_id: playerId } }),
        tx.playerBonusPoint.findMany({ where: { player_id: playerId } }),
      ]);

      if (!economy) throw new BadRequestException('Player economy not found');

      const pricesBonus = bonusPoints.find(
        (bp) => bp.bonus_type === BonusType.PRICES,
      );
      const pricesBonusPercent = pricesBonus?.level ?? 0;

      let totalRefund = 0;
      let totalQuantity = 0;

      for (const entry of dto.units) {
        const unitDef = getUnitByTypeAndLevel(entry.unitType as UnitType, entry.level);
        if (!unitDef) {
          throw new BadRequestException(
            `Invalid unit: ${entry.unitType} level ${entry.level}`,
          );
        }
        if (entry.unitType === UnitType.CITIZEN) {
          throw new BadRequestException('Cannot untrain citizens');
        }

        const existing = units.find(
          (u) => u.unit_type === entry.unitType && u.level === entry.level,
        );
        const currentQty = existing?.quantity ?? 0;
        if (currentQty < entry.quantity) {
          throw new BadRequestException(
            `Not enough ${unitDef.name} to untrain. Required: ${entry.quantity}, Available: ${currentQty}`,
          );
        }

        const discountedCost = unitDef.cost - Math.round((pricesBonusPercent / 100) * unitDef.cost);
        totalRefund += Math.floor(discountedCost * entry.quantity * 0.75);
        totalQuantity += entry.quantity;
      }

      // Add refund to gold
      const newGold = BigInt(economy.gold) + BigInt(totalRefund);
      await tx.playerEconomy.update({
        where: { player_id: playerId },
        data: { gold: newGold },
      });

      // Add citizens back
      const citizenRow = units.find(
        (u) => u.unit_type === UnitType.CITIZEN && u.level === 1,
      );
      const currentCitizens = citizenRow?.quantity ?? 0;
      await tx.playerUnit.upsert({
        where: {
          player_id_unit_type_level: {
            player_id: playerId,
            unit_type: UnitType.CITIZEN,
            level: 1,
          },
        },
        update: { quantity: currentCitizens + totalQuantity },
        create: {
          player_id: playerId,
          unit_type: UnitType.CITIZEN,
          level: 1,
          quantity: totalQuantity,
        },
      });

      // Deduct units
      for (const entry of dto.units) {
        const existing = units.find(
          (u) => u.unit_type === entry.unitType && u.level === entry.level,
        );
        const currentQty = existing?.quantity ?? 0;

        await tx.playerUnit.update({
          where: {
            player_id_unit_type_level: {
              player_id: playerId,
              unit_type: entry.unitType,
              level: entry.level,
            },
          },
          data: { quantity: currentQty - entry.quantity },
        });
      }

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
          stats: JSON.stringify({ type: 'TRAINING_UNTRAIN', items: dto.units }),
        },
      });

      // Fetch updated units
      const updatedUnits = await tx.playerUnit.findMany({
        where: { player_id: playerId },
      });

      return {
        gold: newGold.toString(),
        refund: totalRefund.toString(),
        units: updatedUnits.map((u) => ({
          unitType: u.unit_type,
          level: u.level,
          quantity: u.quantity,
        })),
      };
    });

    this.eventEmitter.emit(
      'units.untrained',
      new UnitsUntrainedEvent(playerId, dto.units, dto.units.reduce((s, u) => s + u.quantity, 0)),
    );

    return result;
  }

  async convert(playerId: string, dto: ConvertUnitsDto) {
    if (dto.fromType !== dto.toType) {
      throw new BadRequestException(
        'Conversion must be within the same unit type',
      );
    }
    if (dto.fromLevel === dto.toLevel) {
      throw new BadRequestException('Cannot convert units to the same level');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, units, fortification, bonusPoints] = await Promise.all([
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerUnit.findMany({ where: { player_id: playerId } }),
        tx.playerFortification.findUnique({ where: { player_id: playerId } }),
        tx.playerBonusPoint.findMany({ where: { player_id: playerId } }),
      ]);

      if (!economy) throw new BadRequestException('Player economy not found');

      const fortLevel = fortification?.fort_level ?? 1;
      const pricesBonus = bonusPoints.find(
        (bp) => bp.bonus_type === BonusType.PRICES,
      );
      const pricesBonusPercent = pricesBonus?.level ?? 0;

      const fromDef = getUnitByTypeAndLevel(dto.fromType as UnitType, dto.fromLevel);
      const toDef = getUnitByTypeAndLevel(dto.toType as UnitType, dto.toLevel);

      if (!fromDef || !toDef) {
        throw new BadRequestException('Invalid unit definition for conversion');
      }

      if (toDef.fortLevel > fortLevel) {
        throw new BadRequestException(
          `${toDef.name} requires fort level ${toDef.fortLevel} (you have ${fortLevel})`,
        );
      }

      // Check player has enough source units
      const fromUnit = units.find(
        (u) => u.unit_type === dto.fromType && u.level === dto.fromLevel,
      );
      const fromQty = fromUnit?.quantity ?? 0;
      if (fromQty < dto.quantity) {
        throw new BadRequestException(
          `Not enough ${fromDef.name} to convert. Required: ${dto.quantity}, Available: ${fromQty}`,
        );
      }

      // Calculate cost with price bonus applied
      const fromCostDiscounted = fromDef.cost - Math.round((pricesBonusPercent / 100) * fromDef.cost);
      const toCostDiscounted = toDef.cost - Math.round((pricesBonusPercent / 100) * toDef.cost);
      const costDifference = toCostDiscounted - fromCostDiscounted;

      const isUpgrade = dto.toLevel > dto.fromLevel;
      let goldDelta: number;

      if (isUpgrade) {
        goldDelta = Math.ceil(costDifference * dto.quantity);
        if (BigInt(economy.gold) < BigInt(goldDelta)) {
          throw new BadRequestException(
            `Not enough gold for upgrade. Required: ${goldDelta}, Available: ${economy.gold}`,
          );
        }
      } else {
        goldDelta = Math.floor(Math.abs(costDifference) * dto.quantity * 0.75);
      }

      // Update gold
      const newGold = isUpgrade
        ? BigInt(economy.gold) - BigInt(goldDelta)
        : BigInt(economy.gold) + BigInt(goldDelta);

      await tx.playerEconomy.update({
        where: { player_id: playerId },
        data: { gold: newGold },
      });

      // Deduct from-units
      await tx.playerUnit.update({
        where: {
          player_id_unit_type_level: {
            player_id: playerId,
            unit_type: dto.fromType,
            level: dto.fromLevel,
          },
        },
        data: { quantity: fromQty - dto.quantity },
      });

      // Upsert to-units
      const toUnit = units.find(
        (u) => u.unit_type === dto.toType && u.level === dto.toLevel,
      );
      const toQty = toUnit?.quantity ?? 0;

      await tx.playerUnit.upsert({
        where: {
          player_id_unit_type_level: {
            player_id: playerId,
            unit_type: dto.toType,
            level: dto.toLevel,
          },
        },
        update: { quantity: toQty + dto.quantity },
        create: {
          player_id: playerId,
          unit_type: dto.toType,
          level: dto.toLevel,
          quantity: dto.quantity,
        },
      });

      // Bank history
      await tx.bankHistory.create({
        data: {
          gold_amount: BigInt(goldDelta),
          from_user_id: playerId,
          from_account_type: isUpgrade ? BankAccountType.HAND : BankAccountType.BANK,
          to_user_id: playerId,
          to_account_type: isUpgrade ? BankAccountType.BANK : BankAccountType.HAND,
          date_time: new Date(),
          history_type: BankTransferHistoryType.SALE,
          stats: JSON.stringify({
            type: 'TRAINING_CONVERSION',
            fromItem: `${dto.fromType}_${dto.fromLevel}`,
            toItem: `${dto.toType}_${dto.toLevel}`,
            amount: dto.quantity,
          }),
        },
      });

      // Fetch updated units
      const updatedUnits = await tx.playerUnit.findMany({
        where: { player_id: playerId },
      });

      return {
        gold: newGold.toString(),
        isUpgrade,
        costOrRefund: goldDelta.toString(),
        units: updatedUnits.map((u) => ({
          unitType: u.unit_type,
          level: u.level,
          quantity: u.quantity,
        })),
      };
    });

    this.eventEmitter.emit(
      'units.converted',
      new UnitsConvertedEvent(
        playerId,
        dto.fromType as UnitType,
        dto.fromLevel,
        dto.toType as UnitType,
        dto.toLevel,
        dto.quantity,
      ),
    );

    return result;
  }
}
