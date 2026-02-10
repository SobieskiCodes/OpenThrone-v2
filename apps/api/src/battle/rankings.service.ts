import { Injectable } from '@nestjs/common';
import { Prisma } from '@openthrone/db';
import { PrismaService } from '../prisma/prisma.service';
import { getLevelForXP, computeArmoryValue, calculateRankScore } from '@openthrone/game-logic';

export type RankingCategory = 'global' | 'combat' | 'spy' | 'economy' | 'army' | 'social';
export type RankingPeriod = 'allTime' | 'today';

interface RankEntry {
  rank: number;
  id: string;
  displayName: string;
  race: string;
  class: string;
  level: number;
  score: number;
}

interface RankingsResult {
  data: RankEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable()
export class RankingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRankings(
    category: RankingCategory,
    subType: string,
    period: RankingPeriod,
    page: number,
    limit: number,
  ): Promise<RankingsResult> {
    switch (category) {
      case 'global':
        return this.getGlobalRankings(subType, page, limit);
      case 'combat':
        return this.getCombatRankings(subType, period, page, limit);
      case 'spy':
        return this.getSpyRankings(subType, period, page, limit);
      case 'economy':
        return this.getEconomyRankings(subType, page, limit);
      case 'army':
        return this.getArmyRankings(subType, page, limit);
      case 'social':
        return this.getSocialRankings(subType, page, limit);
      default:
        return this.getGlobalRankings('overall_power', page, limit);
    }
  }

  // ─── GLOBAL ─────────────────────────────────────────────────────────

  private async getGlobalRankings(subType: string, page: number, limit: number): Promise<RankingsResult> {
    // Simple stat-based rankings (offense, defense, level) can use DB ordering
    if (subType === 'offense' || subType === 'defense' || subType === 'level') {
      const orderBy = subType === 'level'
        ? { experience: 'desc' as const }
        : { [subType]: 'desc' as const };

      const [stats, total] = await Promise.all([
        this.prisma.playerStats.findMany({
          where: { player: { status: 'ACTIVE' } },
          include: { player: { select: { id: true, display_name: true, race: true, player_class: true } } },
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.playerStats.count({ where: { player: { status: 'ACTIVE' } } }),
      ]);

      const data = stats.map((s, index) => ({
        rank: (page - 1) * limit + index + 1,
        id: s.player.id,
        displayName: s.player.display_name,
        race: s.player.race,
        class: s.player.player_class,
        level: getLevelForXP(s.experience),
        score: subType === 'level' ? getLevelForXP(s.experience)
          : subType === 'offense' ? s.offense : s.defense,
      }));

      return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    // Overall power: composite score from combat + progression + economy
    return this.getOverallPowerRanking(page, limit);
  }

  private async getOverallPowerRanking(page: number, limit: number): Promise<RankingsResult> {
    const players = await this.prisma.player.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        display_name: true,
        race: true,
        player_class: true,
        stats: { select: { offense: true, defense: true, spy: true, sentry: true, experience: true } },
        economy: { select: { gold: true, gold_in_bank: true } },
        fortification: { select: { fort_level: true } },
        items: { select: { item_type: true, usage: true, level: true, quantity: true } },
      },
    });

    const ranked = players
      .filter((p) => p.stats)
      .map((p) => {
        const armory = computeArmoryValue(
          (p.items ?? []).map((i) => ({
            itemType: i.item_type,
            usage: i.usage,
            level: i.level,
            quantity: i.quantity,
          })),
        );
        const gold = Number(p.economy?.gold ?? 0);
        const bank = Number(p.economy?.gold_in_bank ?? 0);

        const score = calculateRankScore({
          offense: p.stats!.offense,
          defense: p.stats!.defense,
          spy: p.stats!.spy,
          sentry: p.stats!.sentry,
          fortLevel: p.fortification?.fort_level ?? 1,
          experience: p.stats!.experience,
          netWorth: gold + bank + armory,
        });

        return {
          id: p.id,
          displayName: p.display_name,
          race: p.race,
          class: p.player_class,
          level: getLevelForXP(p.stats!.experience),
          score,
        };
      });

    ranked.sort((a, b) => b.score - a.score);

    const total = ranked.length;
    const offset = (page - 1) * limit;
    const data = ranked.slice(offset, offset + limit).map((r, index) => ({
      ...r,
      rank: offset + index + 1,
    }));

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── COMBAT ─────────────────────────────────────────────────────────

  private async getCombatRankings(subType: string, period: RankingPeriod, page: number, limit: number): Promise<RankingsResult> {
    const field = this.combatSubTypeToField(subType);
    const dailyField = this.combatSubTypeToDailyField(subType);

    if (period === 'today' && dailyField) {
      return this.getCumulativeRanking(dailyField, page, limit);
    }
    return this.getCumulativeRanking(field, page, limit);
  }

  private combatSubTypeToField(subType: string): string {
    switch (subType) {
      case 'attack_wins': return 'attack_wins';
      case 'total_kills': return 'units_killed';
      case 'defense_wins': return 'defense_wins';
      case 'gold_stolen': return 'gold_stolen';
      case 'fort_damage': return 'fort_damage_dealt';
      default: return 'attack_wins';
    }
  }

  private combatSubTypeToDailyField(subType: string): string | null {
    switch (subType) {
      case 'attack_wins': return 'daily_attack_wins';
      case 'defense_wins': return 'daily_defense_wins';
      case 'gold_stolen': return 'daily_gold_stolen';
      default: return null;
    }
  }

  // ─── SPY ────────────────────────────────────────────────────────────

  private async getSpyRankings(subType: string, period: RankingPeriod, page: number, limit: number): Promise<RankingsResult> {
    const field = this.spySubTypeToField(subType);
    const dailyField = subType === 'spy_wins' && period === 'today' ? 'daily_spy_wins' : null;

    if (dailyField) {
      return this.getCumulativeRanking(dailyField, page, limit);
    }
    return this.getCumulativeRanking(field, page, limit);
  }

  private spySubTypeToField(subType: string): string {
    switch (subType) {
      case 'spy_wins': return 'spy_wins';
      case 'counter_spy_wins': return 'counter_spy_wins';
      case 'total_spy_ops': return 'total_spy_ops';
      case 'spies_lost': return 'spies_lost';
      default: return 'spy_wins';
    }
  }

  // ─── ECONOMY ────────────────────────────────────────────────────────

  private async getEconomyRankings(subType: string, page: number, limit: number): Promise<RankingsResult> {
    if (subType === 'richest_banked') {
      return this.getEconomyFieldRanking('gold_in_bank', page, limit);
    }
    if (subType === 'net_worth') {
      return this.getNetWorthRanking(page, limit);
    }
    if (subType === 'gold_spent') {
      return this.getCumulativeRanking('gold_spent', page, limit);
    }
    return this.getEconomyFieldRanking('gold_in_bank', page, limit);
  }

  private async getEconomyFieldRanking(field: 'gold' | 'gold_in_bank', page: number, limit: number): Promise<RankingsResult> {
    const [economies, total] = await Promise.all([
      this.prisma.playerEconomy.findMany({
        where: { player: { status: 'ACTIVE' } },
        include: {
          player: {
            include: { stats: { select: { experience: true } } },
          },
        },
        orderBy: { [field]: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.playerEconomy.count({ where: { player: { status: 'ACTIVE' } } }),
    ]);

    const data = economies.map((e, index) => ({
      rank: (page - 1) * limit + index + 1,
      id: e.player.id,
      displayName: e.player.display_name,
      race: e.player.race,
      class: e.player.player_class,
      level: getLevelForXP(e.player.stats?.experience ?? 0),
      score: Number(e[field]),
    }));

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private async getNetWorthRanking(page: number, limit: number): Promise<RankingsResult> {
    // Fetch all active players with economy + items (item costs are in game-logic, not DB)
    const players = await this.prisma.player.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        display_name: true,
        race: true,
        player_class: true,
        economy: { select: { gold: true, gold_in_bank: true } },
        stats: { select: { experience: true } },
        items: { select: { item_type: true, usage: true, level: true, quantity: true } },
      },
    });

    // Compute net worth per player: gold + bank + armory value
    const ranked = players.map((p) => {
      const gold = Number(p.economy?.gold ?? 0);
      const bank = Number(p.economy?.gold_in_bank ?? 0);
      const armory = computeArmoryValue(
        (p.items ?? []).map((i) => ({
          itemType: i.item_type,
          usage: i.usage,
          level: i.level,
          quantity: i.quantity,
        })),
      );
      return {
        id: p.id,
        displayName: p.display_name,
        race: p.race,
        class: p.player_class,
        level: getLevelForXP(p.stats?.experience ?? 0),
        score: gold + bank + armory,
      };
    });

    // Sort descending by net worth
    ranked.sort((a, b) => b.score - a.score);

    const total = ranked.length;
    const offset = (page - 1) * limit;
    const data = ranked.slice(offset, offset + limit).map((r, index) => ({
      ...r,
      rank: offset + index + 1,
    }));

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── ARMY ───────────────────────────────────────────────────────────

  private async getArmyRankings(subType: string, page: number, limit: number): Promise<RankingsResult> {
    if (subType === 'units_trained') {
      return this.getCumulativeRanking('units_trained', page, limit);
    }

    // largest_army = sum of OFFENSE+DEFENSE+SPY+SENTRY units
    // highest_population = sum of ALL units
    const unitFilter = subType === 'largest_army'
      ? Prisma.raw(`AND pu.unit_type IN ('OFFENSE','DEFENSE','SPY','SENTRY')`)
      : Prisma.raw('');

    const countResult = await this.prisma.$queryRaw<{ cnt: number | bigint }[]>`
      SELECT COUNT(DISTINCT pu.player_id) as cnt
       FROM player_units pu
       JOIN players p ON p.id = pu.player_id
       WHERE p.status = 'ACTIVE' ${unitFilter}`;
    const total = Number(countResult[0]?.cnt ?? 0);

    const offset = (page - 1) * limit;
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT pu.player_id, SUM(pu.quantity) as total_units,
              p.display_name, p.race, p."class",
              COALESCE(ps.experience, 0) as experience
       FROM player_units pu
       JOIN players p ON p.id = pu.player_id
       LEFT JOIN player_stats ps ON ps.player_id = pu.player_id
       WHERE p.status = 'ACTIVE' ${unitFilter}
       GROUP BY pu.player_id, p.display_name, p.race, p."class", ps.experience
       ORDER BY total_units DESC
       LIMIT ${limit} OFFSET ${offset}`;

    const data = rows.map((r, index) => ({
      rank: (page - 1) * limit + index + 1,
      id: r.player_id,
      displayName: r.display_name,
      race: r.race,
      class: r.class,
      level: getLevelForXP(Number(r.experience)),
      score: Number(r.total_units),
    }));

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── SOCIAL ─────────────────────────────────────────────────────────

  private async getSocialRankings(subType: string, page: number, limit: number): Promise<RankingsResult> {
    if (subType === 'messages_sent' || subType === 'citizens_recruited') {
      return this.getCumulativeRanking(subType, page, limit);
    }

    if (subType === 'building_upgrades') {
      return this.getBuildingUpgradesRanking(page, limit);
    }

    // most_friends — count from Social table
    return this.getFriendsRanking(page, limit);
  }

  private async getFriendsRanking(page: number, limit: number): Promise<RankingsResult> {
    const countResult = await this.prisma.$queryRaw<{ cnt: number | bigint }[]>`
      SELECT COUNT(DISTINCT s.player_id) as cnt
       FROM social s
       JOIN players p ON p.id = s.player_id
       WHERE p.status = 'ACTIVE' AND s.status = 'ACCEPTED'`;
    const total = Number(countResult[0]?.cnt ?? 0);

    const offset = (page - 1) * limit;
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT s.player_id, COUNT(*) as friend_count,
              p.display_name, p.race, p."class",
              COALESCE(ps.experience, 0) as experience
       FROM social s
       JOIN players p ON p.id = s.player_id
       LEFT JOIN player_stats ps ON ps.player_id = s.player_id
       WHERE p.status = 'ACTIVE' AND s.status = 'ACCEPTED'
       GROUP BY s.player_id, p.display_name, p.race, p."class", ps.experience
       ORDER BY friend_count DESC
       LIMIT ${limit} OFFSET ${offset}`;

    const data = rows.map((r, index) => ({
      rank: (page - 1) * limit + index + 1,
      id: r.player_id,
      displayName: r.display_name,
      race: r.race,
      class: r.class,
      level: getLevelForXP(Number(r.experience)),
      score: Number(r.friend_count),
    }));

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private async getBuildingUpgradesRanking(page: number, limit: number): Promise<RankingsResult> {
    const countResult = await this.prisma.$queryRaw<{ cnt: number | bigint }[]>`
      SELECT COUNT(DISTINCT su.player_id) as cnt
       FROM player_structure_upgrades su
       JOIN players p ON p.id = su.player_id
       WHERE p.status = 'ACTIVE'`;
    const total = Number(countResult[0]?.cnt ?? 0);

    const offset = (page - 1) * limit;
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT su.player_id, SUM(su.level) as total_levels,
              p.display_name, p.race, p."class",
              COALESCE(ps.experience, 0) as experience
       FROM player_structure_upgrades su
       JOIN players p ON p.id = su.player_id
       LEFT JOIN player_stats ps ON ps.player_id = su.player_id
       WHERE p.status = 'ACTIVE'
       GROUP BY su.player_id, p.display_name, p.race, p."class", ps.experience
       ORDER BY total_levels DESC
       LIMIT ${limit} OFFSET ${offset}`;

    const data = rows.map((r, index) => ({
      rank: (page - 1) * limit + index + 1,
      id: r.player_id,
      displayName: r.display_name,
      race: r.race,
      class: r.class,
      level: getLevelForXP(Number(r.experience)),
      score: Number(r.total_levels),
    }));

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── GENERIC CUMULATIVE STATS RANKING ───────────────────────────────

  private async getCumulativeRanking(field: string, page: number, limit: number): Promise<RankingsResult> {
    const fieldSql = Prisma.raw(field);

    const countResult = await this.prisma.$queryRaw<{ cnt: number | bigint }[]>`
      SELECT COUNT(*) as cnt
       FROM player_cumulative_stats cs
       JOIN players p ON p.id = cs.player_id
       WHERE p.status = 'ACTIVE' AND cs.${fieldSql} > 0`;
    const total = Number(countResult[0]?.cnt ?? 0);

    const offset = (page - 1) * limit;
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT cs.player_id, cs.${fieldSql} as score,
              p.display_name, p.race, p."class",
              COALESCE(ps.experience, 0) as experience
       FROM player_cumulative_stats cs
       JOIN players p ON p.id = cs.player_id
       LEFT JOIN player_stats ps ON ps.player_id = cs.player_id
       WHERE p.status = 'ACTIVE' AND cs.${fieldSql} > 0
       ORDER BY cs.${fieldSql} DESC
       LIMIT ${limit} OFFSET ${offset}`;

    const data = rows.map((r, index) => ({
      rank: (page - 1) * limit + index + 1,
      id: r.player_id,
      displayName: r.display_name,
      race: r.race,
      class: r.class,
      level: getLevelForXP(Number(r.experience)),
      score: Number(r.score),
    }));

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── INCREMENT HELPERS (called by event listeners) ──────────────────

  async incrementStat(playerId: string, field: string, amount: number | bigint) {
    await this.prisma.playerCumulativeStats.upsert({
      where: { player_id: playerId },
      create: { player_id: playerId, [field]: amount } as any,
      update: { [field]: { increment: amount } } as any,
    });
  }

  async incrementMultiple(playerId: string, increments: Record<string, number | bigint>) {
    const updateData: Record<string, any> = {};
    const createData: Record<string, any> = { player_id: playerId };
    for (const [field, amount] of Object.entries(increments)) {
      updateData[field] = { increment: amount };
      createData[field] = amount;
    }
    await this.prisma.playerCumulativeStats.upsert({
      where: { player_id: playerId },
      create: createData as any,
      update: updateData as any,
    });
  }

  /** Reset all daily counters — called by scheduler at midnight */
  async resetDailyCounters() {
    await this.prisma.playerCumulativeStats.updateMany({
      data: {
        daily_attack_wins: 0,
        daily_defense_wins: 0,
        daily_gold_stolen: BigInt(0),
        daily_gold_income: BigInt(0),
        daily_spy_wins: 0,
        daily_units_trained: 0,
        daily_reset_at: new Date(),
      },
    });
  }
}
