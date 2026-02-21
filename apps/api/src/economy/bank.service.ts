import { Injectable, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { GoldDepositedEvent, GoldWithdrawnEvent } from '@openthrone/events';
import { getBuildingLevel } from '@openthrone/game-logic';
import { BankAccountType, BankTransferHistoryType, BuildingType } from '@openthrone/shared';
import { buildPlayerSnapshot } from '../common/helpers/player-snapshot.helper';

@Injectable()
export class BankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async deposit(playerId: string, amount: string) {
    const depositAmount = BigInt(amount);
    if (depositAmount <= 0n) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const [economy, mineBuilding] = await Promise.all([
        tx.playerEconomy.findUnique({ where: { player_id: playerId } }),
        tx.playerBuilding.findFirst({
          where: { player_id: playerId, building_type: BuildingType.MINE },
        }),
      ]);
      if (!economy) throw new BadRequestException('Player economy not found');

      const gold = BigInt(economy.gold);
      if (depositAmount > gold) {
        throw new BadRequestException('Not enough gold on hand');
      }

      // Enforce 80% max deposit
      const maxDeposit = (gold * 80n) / 100n;
      if (depositAmount > maxDeposit) {
        throw new BadRequestException(
          `Cannot deposit more than 80% of gold on hand (max: ${maxDeposit.toString()})`,
        );
      }

      // Check daily deposit limit (base 3 + 1 per Mine level)
      const depositsToday = await this.countDepositsLast24h(tx, playerId);
      const mineLevel = mineBuilding?.level ?? 0;
      const maxDeposits = 3 + mineLevel;

      if (depositsToday >= maxDeposits) {
        throw new BadRequestException(
          `Daily deposit limit reached (${maxDeposits} per day)`,
        );
      }

      const newGold = gold - depositAmount;
      const newBankBalance = BigInt(economy.gold_in_bank) + depositAmount;

      const updated = await tx.playerEconomy.update({
        where: { player_id: playerId },
        data: {
          gold: newGold,
          gold_in_bank: newBankBalance,
        },
      });

      await tx.bankHistory.create({
        data: {
          gold_amount: depositAmount,
          from_user_id: playerId,
          from_account_type: BankAccountType.HAND,
          to_user_id: playerId,
          to_account_type: BankAccountType.BANK,
          date_time: new Date(),
          history_type: BankTransferHistoryType.PLAYER_TRANSFER,
        },
      });

      return {
        gold: updated.gold.toString(),
        goldInBank: updated.gold_in_bank.toString(),
        depositsRemaining: maxDeposits - depositsToday - 1,
      };
    });

    this.eventEmitter.emit(
      'gold.deposited',
      new GoldDepositedEvent(
        playerId,
        depositAmount,
        BigInt(result.gold),
        BigInt(result.goldInBank),
      ),
    );

    // Build player state snapshot for cache sync
    const playerState = await buildPlayerSnapshot(this.prisma, playerId);

    return { ...result, playerState };
  }

  async withdraw(playerId: string, amount: string) {
    const withdrawAmount = BigInt(amount);
    if (withdrawAmount <= 0n) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const economy = await tx.playerEconomy.findUnique({
        where: { player_id: playerId },
      });
      if (!economy) throw new BadRequestException('Player economy not found');

      const bankBalance = BigInt(economy.gold_in_bank);
      if (withdrawAmount > bankBalance) {
        throw new BadRequestException('Not enough gold in bank');
      }

      const newGold = BigInt(economy.gold) + withdrawAmount;
      const newBankBalance = bankBalance - withdrawAmount;

      const updated = await tx.playerEconomy.update({
        where: { player_id: playerId },
        data: {
          gold: newGold,
          gold_in_bank: newBankBalance,
        },
      });

      await tx.bankHistory.create({
        data: {
          gold_amount: withdrawAmount,
          from_user_id: playerId,
          from_account_type: BankAccountType.BANK,
          to_user_id: playerId,
          to_account_type: BankAccountType.HAND,
          date_time: new Date(),
          history_type: BankTransferHistoryType.PLAYER_TRANSFER,
        },
      });

      return {
        gold: updated.gold.toString(),
        goldInBank: updated.gold_in_bank.toString(),
      };
    });

    this.eventEmitter.emit(
      'gold.withdrawn',
      new GoldWithdrawnEvent(
        playerId,
        withdrawAmount,
        BigInt(result.gold),
        BigInt(result.goldInBank),
      ),
    );

    // Build player state snapshot for cache sync
    const playerState = await buildPlayerSnapshot(this.prisma, playerId);

    return { ...result, playerState };
  }

  async getDepositsRemaining(playerId: string) {
    const [economy, mineBuilding] = await Promise.all([
      this.prisma.playerEconomy.findUnique({ where: { player_id: playerId } }),
      this.prisma.playerBuilding.findFirst({
        where: { player_id: playerId, building_type: BuildingType.MINE },
      }),
    ]);
    if (!economy) throw new BadRequestException('Player economy not found');

    const depositsToday = await this.countDepositsLast24h(this.prisma, playerId);
    const mineLevel = mineBuilding?.level ?? 0;
    const maxDeposits = 3 + mineLevel;

    return {
      depositsUsed: depositsToday,
      depositsMax: maxDeposits,
      depositsRemaining: Math.max(0, maxDeposits - depositsToday),
    };
  }

  async getStatus(playerId: string) {
    const economy = await this.prisma.playerEconomy.findUnique({
      where: { player_id: playerId },
    });
    if (!economy) throw new BadRequestException('Player economy not found');

    const deposits = await this.getDepositsRemaining(playerId);

    return {
      gold: economy.gold.toString(),
      goldInBank: economy.gold_in_bank.toString(),
      ...deposits,
    };
  }

  async getHistory(
    playerId: string,
    page: number = 1,
    limit: number = 10,
    filter?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [{ from_user_id: playerId }, { to_user_id: playerId }],
    };

    if (filter === 'deposits') {
      where.from_account_type = BankAccountType.HAND;
      where.to_account_type = BankAccountType.BANK;
      where.from_user_id = playerId;
      where.to_user_id = playerId;
      delete where.OR;
    } else if (filter === 'withdrawals') {
      where.from_account_type = BankAccountType.BANK;
      where.to_account_type = BankAccountType.HAND;
      where.from_user_id = playerId;
      where.to_user_id = playerId;
      delete where.OR;
    } else if (filter && filter !== 'all') {
      // Filter by history_type (e.g. WAR_SPOILS, ECONOMY)
      where.history_type = filter.toUpperCase();
    }

    const [rows, total] = await Promise.all([
      this.prisma.bankHistory.findMany({
        where,
        take: limit,
        skip,
        orderBy: { date_time: 'desc' },
      }),
      this.prisma.bankHistory.count({ where }),
    ]);

    return {
      rows: rows.map((row) => ({
        id: row.id,
        goldAmount: row.gold_amount.toString(),
        fromUserId: row.from_user_id,
        fromAccountType: row.from_account_type,
        toUserId: row.to_user_id,
        toAccountType: row.to_account_type,
        dateTime: row.date_time,
        historyType: row.history_type,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async countDepositsLast24h(
    prisma: any,
    playerId: string,
  ): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return prisma.bankHistory.count({
      where: {
        from_user_id: playerId,
        to_user_id: playerId,
        from_account_type: BankAccountType.HAND,
        to_account_type: BankAccountType.BANK,
        history_type: BankTransferHistoryType.PLAYER_TRANSFER,
        date_time: { gte: oneDayAgo },
      },
    });
  }
}
