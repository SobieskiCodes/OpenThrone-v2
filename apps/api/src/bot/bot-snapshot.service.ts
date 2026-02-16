import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getLevelForXP } from '@openthrone/game-logic';

@Injectable()
export class BotSnapshotService {
  private readonly logger = new Logger(BotSnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Capture a snapshot of the bot's current state.
   * This should be called daily to track long-term progression.
   * @param botConfigId The bot config ID
   * @param snapshotDate Optional date for the snapshot (defaults to now)
   */
  async captureSnapshot(botConfigId: number, snapshotDate?: Date) {
    const bot = await this.prisma.botConfig.findUnique({
      where: { id: botConfigId },
      include: {
        player: {
          include: {
            economy: true,
            stats: true,
            units: true,
            items: true,
            fortification: true,
          },
        },
      },
    });

    if (!bot) {
      throw new Error(`Bot config ${botConfigId} not found`);
    }

    const player = bot.player;

    // Calculate unit totals
    const citizens = player.units.find(
      (u) => u.unit_type === 'CITIZEN' && u.level === 1,
    )?.quantity ?? 0;
    const workers = player.units.find(
      (u) => u.unit_type === 'WORKER' && u.level === 1,
    )?.quantity ?? 0;
    const offenseUnits = player.units
      .filter((u) => u.unit_type === 'OFFENSE')
      .reduce((sum, u) => sum + u.quantity, 0);
    const defenseUnits = player.units
      .filter((u) => u.unit_type === 'DEFENSE')
      .reduce((sum, u) => sum + u.quantity, 0);
    const spyUnits = player.units
      .filter((u) => u.unit_type === 'SPY')
      .reduce((sum, u) => sum + u.quantity, 0);
    const sentryUnits = player.units
      .filter((u) => u.unit_type === 'SENTRY')
      .reduce((sum, u) => sum + u.quantity, 0);

    const totalPopulation =
      citizens + workers + offenseUnits + defenseUnits + spyUnits + sentryUnits;

    // Count equipment by tier
    const weaponsT1 = player.items
      .filter((i) => i.item_type === 'WEAPON' && i.level === 1)
      .reduce((sum, i) => sum + i.quantity, 0);
    const weaponsT2 = player.items
      .filter((i) => i.item_type === 'WEAPON' && i.level === 2)
      .reduce((sum, i) => sum + i.quantity, 0);
    const weaponsT3 = player.items
      .filter((i) => i.item_type === 'WEAPON' && i.level === 3)
      .reduce((sum, i) => sum + i.quantity, 0);
    const armorT1 = player.items
      .filter((i) => i.item_type === 'ARMOR' && i.level === 1)
      .reduce((sum, i) => sum + i.quantity, 0);
    const armorT2 = player.items
      .filter((i) => i.item_type === 'ARMOR' && i.level === 2)
      .reduce((sum, i) => sum + i.quantity, 0);
    const armorT3 = player.items
      .filter((i) => i.item_type === 'ARMOR' && i.level === 3)
      .reduce((sum, i) => sum + i.quantity, 0);

    // Create snapshot
    const snapshot = await this.prisma.botSnapshot.create({
      data: {
        bot_config_id: botConfigId,
        snapshot_date: snapshotDate || new Date(),

        // Economy
        gold: player.economy?.gold ?? BigInt(0),
        gold_in_bank: player.economy?.gold_in_bank ?? BigInt(0),
        attack_turns: player.economy?.attack_turns ?? 0,

        // Stats
        level: getLevelForXP(player.stats?.experience ?? 0),
        experience: BigInt(player.stats?.experience ?? 0),
        offense: player.stats?.offense ?? 0,
        defense: player.stats?.defense ?? 0,
        spy: player.stats?.spy ?? 0,
        sentry: player.stats?.sentry ?? 0,

        // Population
        citizens,
        workers,
        offense_units: offenseUnits,
        defense_units: defenseUnits,
        spy_units: spyUnits,
        sentry_units: sentryUnits,
        total_population: totalPopulation,

        // Fort
        fort_level: player.fortification?.fort_level ?? 0,
        fort_hp: player.fortification?.hitpoints ?? 0,
        fort_max_hp: player.fortification?.fort_level
          ? player.fortification.fort_level * 100
          : 50,

        // Equipment
        weapons_t1: weaponsT1,
        weapons_t2: weaponsT2,
        weapons_t3: weaponsT3,
        armor_t1: armorT1,
        armor_t2: armorT2,
        armor_t3: armorT3,

        // Combat & session metrics will be updated incrementally
        attacks_won: 0,
        attacks_lost: 0,
        gold_stolen: BigInt(0),
        gold_lost: BigInt(0),
        sessions_run: 0,
        actions_performed: 0,
        actions_failed: 0,
      },
    });

    this.logger.log(
      `Captured snapshot for bot ${bot.player.display_name} (${bot.strategy})`,
    );

    return snapshot;
  }

  /**
   * Get the most recent snapshot for a bot.
   */
  async getLatestSnapshot(botConfigId: number) {
    return this.prisma.botSnapshot.findFirst({
      where: { bot_config_id: botConfigId },
      orderBy: { snapshot_date: 'desc' },
    });
  }

  /**
   * Get snapshot history for a bot within a date range.
   */
  async getSnapshotHistory(
    botConfigId: number,
    startDate: Date,
    endDate: Date = new Date(),
  ) {
    return this.prisma.botSnapshot.findMany({
      where: {
        bot_config_id: botConfigId,
        snapshot_date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { snapshot_date: 'asc' },
    });
  }

  /**
   * Get snapshots for a bot over the last N days.
   */
  async getRecentSnapshots(
    botConfigId: number,
    days: number,
  ) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return this.getSnapshotHistory(botConfigId, startDate);
  }

  /**
   * Update the latest snapshot with session metrics (called after each session).
   */
  async updateSessionMetrics(
    botConfigId: number,
    actionsPerformed: number,
    actionsFailed: number,
  ): Promise<void> {
    const latest = await this.getLatestSnapshot(botConfigId);
    if (!latest) {
      this.logger.warn(
        `No snapshot found for bot ${botConfigId} — creating one`,
      );
      await this.captureSnapshot(botConfigId);
      return;
    }

    await this.prisma.botSnapshot.update({
      where: { id: latest.id },
      data: {
        sessions_run: { increment: 1 },
        actions_performed: { increment: actionsPerformed },
        actions_failed: { increment: actionsFailed },
      },
    });
  }

  /**
   * Update the latest snapshot with combat metrics (called after attacks).
   */
  async updateCombatMetrics(
    botConfigId: number,
    won: boolean,
    goldChange: bigint,
  ): Promise<void> {
    const latest = await this.getLatestSnapshot(botConfigId);
    if (!latest) return;

    await this.prisma.botSnapshot.update({
      where: { id: latest.id },
      data: {
        attacks_won: won ? { increment: 1 } : latest.attacks_won,
        attacks_lost: !won ? { increment: 1 } : latest.attacks_lost,
        gold_stolen: goldChange > 0 ? { increment: goldChange } : latest.gold_stolen,
        gold_lost: goldChange < 0 ? { increment: -goldChange } : latest.gold_lost,
      },
    });
  }

  /**
   * Delete all snapshots older than N days (for cleanup).
   */
  async pruneOldSnapshots(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.prisma.botSnapshot.deleteMany({
      where: {
        snapshot_date: { lt: cutoffDate },
      },
    });

    this.logger.log(`Pruned ${result.count} snapshots older than ${days} days`);
    return result.count;
  }
}
